import { useState, useCallback, useRef } from "react";
import type { AoaiSettings } from "./useAoaiSettings";
import type { ReviewFormData, ReviewResult } from "../types/review";
import { tryParseReviewResult } from "../types/review";
import { handleFetchError } from "./chatApi";

interface PollResponse {
  content: string;
  cursor: number;
  status: "running" | "done" | "error";
  error?: string;
}

type ReviewState =
  | { phase: "idle" }
  | { phase: "loading"; rawText: string }
  | { phase: "done"; result: ReviewResult }
  | { phase: "error"; message: string };

const INTERVAL = { initial: 500, min: 100, max: 1000 };

function adaptInterval(current: number, hasContent: boolean): number {
  if (hasContent) return Math.max(Math.round(current * 0.7), INTERVAL.min);
  return Math.min(Math.round(current * 1.5), INTERVAL.max);
}

/**
 * Polling-based review hook with structured output.
 *
 * 1. POST /api/review/start with form_data
 * 2. Poll /api/chat/poll with adaptive interval
 * 3. Accumulated text is partial JSON; parse when done
 */
export function useReviewPolling(settings?: AoaiSettings) {
  const [state, setState] = useState<ReviewState>({ phase: "idle" });
  const cancelledRef = useRef(false);

  const submitReview = useCallback(
    async (formData: ReviewFormData) => {
      setState({ phase: "loading", rawText: "" });
      cancelledRef.current = false;

      try {
        const body: Record<string, unknown> = { form_data: formData };
        if (settings?.endpoint && settings?.apiKey) {
          body.aoai_settings = {
            endpoint: settings.endpoint,
            apiKey: settings.apiKey,
            deployment: settings.deployment || undefined,
            apiVersion: settings.apiVersion || undefined,
          };
        }

        // Start job
        const startRes = await fetch("/api/review/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!startRes.ok) await handleFetchError(startRes);

        const { job_id }: { job_id: string } = await startRes.json();

        // Poll
        let cursor = 0;
        let accumulated = "";
        let interval = INTERVAL.initial;

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
            setState({ phase: "loading", rawText: accumulated });
          }
          cursor = poll.cursor;
          interval = adaptInterval(interval, hasContent);

          if (poll.status === "error") {
            throw new Error(poll.error ?? "レビュージョブでエラーが発生しました");
          }

          if (poll.status === "done") break;
        }

        if (cancelledRef.current) return;

        // Parse structured output
        const parsed = tryParseReviewResult(accumulated);
        if (parsed) {
          setState({ phase: "done", result: parsed });
        } else {
          setState({
            phase: "error",
            message: `JSONパースに失敗しました:\n${accumulated.slice(0, 200)}`,
          });
        }
      } catch (err) {
        if (cancelledRef.current) return;
        setState({
          phase: "error",
          message: err instanceof Error ? err.message : "エラーが発生しました",
        });
      }
    },
    [settings]
  );

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setState({ phase: "idle" });
  }, []);

  return { state, submitReview, reset };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
