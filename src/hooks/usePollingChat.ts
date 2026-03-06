import { useState, useCallback, useRef } from "react";
import type { Message } from "../components/MessageBubble";
import type { AoaiSettings } from "./useAoaiSettings";
import { buildChatBody, handleFetchError } from "./chatApi";

interface PollResponse {
  content: string;
  cursor: number;
  status: "running" | "done" | "error";
  error?: string;
}

const DEFAULT_POLL_INTERVAL_MS = 500;

/**
 * Polling-based pseudo-streaming hook.
 *
 * 1. POST /api/chat/start → get job_id
 * 2. Poll GET /api/chat/poll?job_id=xxx&cursor=N every interval
 * 3. Accumulate delta content and update UI progressively
 *
 * Works on ANY hosting plan including SWA Managed Functions and Consumption.
 */
export function usePollingChat(
  settings?: AoaiSettings,
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS
) {
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

        // Step 1: Start the job
        const startRes = await fetch("/api/chat/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: buildChatBody(allMessages, settings),
        });

        if (!startRes.ok) await handleFetchError(startRes);

        const { job_id }: { job_id: string } = await startRes.json();

        // Step 2: Poll for content
        let cursor = 0;
        let accumulated = "";

        while (!cancelledRef.current) {
          await sleep(pollIntervalMs);
          if (cancelledRef.current) break;

          const pollRes = await fetch(
            `/api/chat/poll?job_id=${encodeURIComponent(job_id)}&cursor=${cursor}`
          );

          if (!pollRes.ok) await handleFetchError(pollRes);

          const poll: PollResponse = await pollRes.json();

          if (poll.content) {
            accumulated += poll.content;
            setStreamingContent(accumulated);
          }
          cursor = poll.cursor;

          if (poll.status === "error") {
            throw new Error(poll.error ?? "ジョブでエラーが発生しました");
          }

          if (poll.status === "done") {
            break;
          }
        }

        // Finalize
        if (!cancelledRef.current) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: accumulated },
          ]);
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
    [messages, settings, pollIntervalMs]
  );

  const abort = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  return { messages, streamingContent, isLoading, sendMessage, abort };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
