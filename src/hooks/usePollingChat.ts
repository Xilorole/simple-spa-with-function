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

/**
 * Adaptive polling interval configuration.
 *
 * - Starts at `initial` ms
 * - When content arrives: multiply by `accelerate` (shrink), clamped to `min`
 * - When no content:      multiply by `decelerate` (grow),  clamped to `max`
 */
interface AdaptiveIntervalConfig {
  /** Starting interval (ms). Default: 500 */
  initial: number;
  /** Fastest interval (ms). Default: 100 */
  min: number;
  /** Slowest interval (ms). Default: 1000 */
  max: number;
  /** Multiplier on hit (< 1 = faster). Default: 0.7 */
  accelerate: number;
  /** Multiplier on miss (> 1 = slower). Default: 1.5 */
  decelerate: number;
}

const DEFAULT_INTERVAL_CONFIG: AdaptiveIntervalConfig = {
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
 * 1. POST /api/chat/start → get job_id
 * 2. Poll GET /api/chat/poll?job_id=xxx&cursor=N
 *    - interval shrinks when content is flowing (down to 100ms)
 *    - interval grows when idle (up to 1000ms)
 * 3. Accumulate delta content and update UI progressively
 *
 * Works on ANY hosting plan including SWA Managed Functions and Consumption.
 */
export function usePollingChat(
  settings?: AoaiSettings,
  intervalConfig: Partial<AdaptiveIntervalConfig> = {}
) {
  const config: AdaptiveIntervalConfig = {
    ...DEFAULT_INTERVAL_CONFIG,
    ...intervalConfig,
  };

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

        // Step 2: Adaptive polling
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

          // Adapt interval based on whether we received content
          interval = nextInterval(interval, hasContent, config);

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
    [messages, settings, config]
  );

  const abort = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  return { messages, streamingContent, isLoading, sendMessage, abort };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
