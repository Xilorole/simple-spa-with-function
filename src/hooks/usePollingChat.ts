import { useState, useCallback, useRef } from "react";
import type { Message } from "../components/MessageBubble";
import { tryParseStructured } from "../components/MessageBubble";
import type { AoaiSettings } from "./useAoaiSettings";
import { buildChatBody, handleFetchError } from "./chatApi";

interface PollResponse {
  content: string;
  cursor: number;
  status: "running" | "done" | "error";
  error?: string;
}

interface AdaptiveIntervalConfig {
  initial: number;
  min: number;
  max: number;
  accelerate: number;
  decelerate: number;
}

const DEFAULT_CONFIG: AdaptiveIntervalConfig = {
  initial: 500,
  min: 100,
  max: 1000,
  accelerate: 0.7,
  decelerate: 1.5,
};

function nextInterval(
  current: number,
  hasContent: boolean,
  config: AdaptiveIntervalConfig
): number {
  if (hasContent) {
    return Math.max(Math.round(current * config.accelerate), config.min);
  }
  return Math.min(Math.round(current * config.decelerate), config.max);
}

/**
 * Polling-based pseudo-streaming hook with adaptive interval.
 *
 * When `structured` is true:
 * - Sends `structured: true` to backend (triggers json_schema response_format)
 * - During polling: shows raw JSON as streaming text
 * - On done: parses JSON into StructuredChat and stores in message.structured
 */
export function usePollingChat(
  settings?: AoaiSettings,
  structured: boolean = false,
  intervalConfig: Partial<AdaptiveIntervalConfig> = {}
) {
  const config = { ...DEFAULT_CONFIG, ...intervalConfig };

  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const cancelledRef = useRef(false);

  const sendMessage = useCallback(
    async (userInput: string) => {
      const userMessage: Message = { role: "user", content: userInput };

      setMessages((prev) => [...prev, userMessage]);
      setStreamingContent("");
      setIsLoading(true);
      cancelledRef.current = false;

      try {
        const allMessages = [...messages, userMessage];

        const startRes = await fetch("/api/chat/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: buildChatBody(allMessages, settings, structured),
        });
        if (!startRes.ok) await handleFetchError(startRes);

        const { job_id }: { job_id: string } = await startRes.json();

        let cursor = 0;
        let accumulated = "";
        let interval = config.initial;

        while (!cancelledRef.current) {
          await sleep(interval);
          if (cancelledRef.current) break;

          const pollRes = await fetch(
            `/api/chat/poll?job_id=${encodeURIComponent(job_id)}&cursor=${cursor}`
          );
          if (!pollRes.ok) await handleFetchError(pollRes);

          const poll: PollResponse = await pollRes.json();
          const hasContent = Boolean(poll.content);

          if (hasContent) {
            accumulated += poll.content;
            setStreamingContent(accumulated);
          }
          cursor = poll.cursor;
          interval = nextInterval(interval, hasContent, config);

          if (poll.status === "error") {
            throw new Error(poll.error ?? "ジョブでエラーが発生しました");
          }
          if (poll.status === "done") break;
        }

        // Finalize: try structured parse if enabled
        if (!cancelledRef.current) {
          const parsed = structured
            ? tryParseStructured(accumulated)
            : null;

          const assistantMsg: Message = parsed
            ? { role: "assistant", content: accumulated, structured: parsed }
            : { role: "assistant", content: accumulated };

          setMessages((prev) => [...prev, assistantMsg]);
        }
        setStreamingContent("");
      } catch (err) {
        if (cancelledRef.current) return;
        const errorMessage =
          err instanceof Error ? err.message : "エラーが発生しました";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `⚠️ ${errorMessage}` },
        ]);
        setStreamingContent("");
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, settings, structured, config]
  );

  const abort = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  return { messages, streamingContent, isLoading, sendMessage, abort };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
