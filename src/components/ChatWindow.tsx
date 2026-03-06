import { useState, useRef, useEffect, useCallback } from "react";
import { MessageBubble, TypingIndicator, type Message } from "./MessageBubble";
import { useStreamingChat } from "../hooks/useStreamingChat";
import { usePollingChat } from "../hooks/usePollingChat";
import { buildChatBody, handleFetchError } from "../hooks/chatApi";
import type { AoaiSettings } from "../hooks/useAoaiSettings";

type StreamMode = "normal" | "sse" | "polling";

const MODE_LABELS: Record<StreamMode, string> = {
  normal: "通常",
  sse: "SSE Stream",
  polling: "Polling Stream",
};

const MODE_DESCRIPTIONS: Record<StreamMode, string> = {
  normal: "全文が返るまで待機",
  sse: "Server-Sent Events（BYOF+Premium向け）",
  polling: "job_id + 差分ポーリング（Consumption互換）",
};

interface ChatWindowProps {
  settings: AoaiSettings;
}

// ── Normal (non-streaming) chat logic ──

function useNormalChat(settings?: AoaiSettings) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (userInput: string) => {
      const userMessage: Message = { role: "user", content: userInput };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: buildChatBody(newMessages, settings),
        });
        if (!res.ok) await handleFetchError(res);
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "エラーが発生しました。";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `⚠️ ${errorMessage}` },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, settings]
  );

  return { messages, streamingContent: "", isLoading, sendMessage };
}

// ── StreamingBubble ──

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-start mb-3 animate-slide-in-left">
      <div className="max-w-[75%] rounded-2xl px-4 py-2 text-sm leading-relaxed bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm">
        <span>{content}</span>
        <span className="inline-block w-2 h-4 ml-0.5 bg-blue-500 animate-pulse rounded-sm" />
      </div>
    </div>
  );
}

// ── Main component ──

export function ChatWindow({ settings }: ChatWindowProps) {
  const [mode, setMode] = useState<StreamMode>("polling");
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const normalChat = useNormalChat(settings);
  const sseChat = useStreamingChat(settings);
  const pollingChat = usePollingChat(settings);

  const activeChat =
    mode === "sse" ? sseChat : mode === "polling" ? pollingChat : normalChat;

  const { messages, streamingContent, isLoading, sendMessage } = activeChat;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    await sendMessage(trimmed);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header with mode selector */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800">💬 Chat</h1>
          <div className="flex gap-1">
            {(Object.keys(MODE_LABELS) as StreamMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                title={MODE_DESCRIPTIONS[m]}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  mode === m
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                }`}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1">{MODE_DESCRIPTIONS[mode]}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && !streamingContent && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            メッセージを入力してください
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {streamingContent && <StreamingBubble content={streamingContent} />}
        {isLoading && !streamingContent && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="メッセージを入力..."
          disabled={isLoading}
          autoComplete="off"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          送信
        </button>
      </form>
    </div>
  );
}
