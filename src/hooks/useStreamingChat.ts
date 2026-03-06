import { useState, useCallback, useRef } from "react";
import type { Message } from "../components/MessageBubble";
import type { AoaiSettings } from "./useAoaiSettings";
import { buildChatBody, handleFetchError } from "./chatApi";

/**
 * SSE-based streaming hook.
 *
 * Uses fetch + ReadableStream to parse SSE frames from POST /api/chat/stream.
 * NOTE: On SWA Managed Functions (Consumption), the response is buffered
 * so all chunks arrive at once. On BYOF + Premium/ASGI, true streaming works.
 */
export function useStreamingChat(settings?: AoaiSettings) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (userInput: string) => {
      const userMessage: Message = { role: "user", content: userInput };

      setMessages((prev) => [...prev, userMessage]);
      setStreamingContent("");
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const allMessages = [...messages, userMessage];
        const res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: buildChatBody(allMessages, settings),
          signal: controller.signal,
        });

        if (!res.ok) await handleFetchError(res);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("ReadableStream not supported");

        const decoder = new TextDecoder();
        let accumulated = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.content) {
                accumulated += parsed.content;
                setStreamingContent(accumulated);
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: accumulated },
        ]);
        setStreamingContent("");
      } catch (err) {
        if (controller.signal.aborted) return;
        const errorMessage =
          err instanceof Error ? err.message : "エラーが発生しました";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `⚠️ ${errorMessage}` },
        ]);
        setStreamingContent("");
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, settings]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, streamingContent, isLoading, sendMessage, abort };
}
