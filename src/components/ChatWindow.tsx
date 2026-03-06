import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageBubble,
  StructuredBubble,
  TypingIndicator,
  type Message,
} from "./MessageBubble";
import { SettingsPanel } from "./SettingsPanel";
import { useAoaiSettings } from "../hooks/useAoaiSettings";
import { useStreamingChat } from "../hooks/useStreamingChat";
import { usePollingChat } from "../hooks/usePollingChat";
import { buildChatBody, handleFetchError } from "../hooks/chatApi";
import type { AoaiSettings } from "../hooks/useAoaiSettings";

type StreamMode = "normal" | "sse" | "polling";

const MODE_LABELS: Record<StreamMode, string> = {
  normal: "通常",
  sse: "SSE",
  polling: "Polling",
};

// ── Normal (non-streaming) chat ──

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

  return {
    messages,
    streamingContent: "",
    partialStructured: null,
    isLoading,
    sendMessage,
  };
}

// ── Plain text streaming cursor ──

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-start mb-3 animate-slide-in-left">
      <div className="max-w-[75%] rounded-2xl px-4 py-2 text-sm leading-relaxed bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm">
        <span className="whitespace-pre-wrap">{content}</span>
        <span className="inline-block w-2 h-4 ml-0.5 bg-blue-500 animate-pulse rounded-sm" />
      </div>
    </div>
  );
}

// ── Main ──

export function ChatWindow() {
  const [mode, setMode] = useState<StreamMode>("polling");
  const [structured, setStructured] = useState(false);
  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { settings, updateSettings, isConfigured } = useAoaiSettings();

  const normalChat = useNormalChat(settings);
  const sseChat = useStreamingChat(settings);
  const pollingChat = usePollingChat(settings, structured);

  const activeChat =
    mode === "sse"
      ? { ...sseChat, partialStructured: null }
      : mode === "polling"
        ? pollingChat
        : normalChat;

  const { messages, streamingContent, partialStructured, isLoading, sendMessage } =
    activeChat;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, partialStructured, scrollToBottom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    await sendMessage(trimmed);
  };

  // Decide what to show during streaming
  const renderStreaming = () => {
    if (!isLoading && !streamingContent) return null;

    // Structured mode: show partial structured view if available
    if (structured && partialStructured) {
      return <StructuredBubble data={partialStructured} streaming />;
    }

    // Plain streaming text
    if (streamingContent) {
      return <StreamingBubble content={streamingContent} />;
    }

    // Waiting for first chunk
    return <TypingIndicator />;
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {(Object.keys(MODE_LABELS) as StreamMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
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

            {mode === "polling" && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={structured}
                  onChange={(e) => setStructured(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-600">Structured</span>
              </label>
            )}
          </div>

          <button
            onClick={() => setShowSettings(true)}
            className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
              isConfigured
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-gray-200 text-gray-500 hover:bg-gray-300"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
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
        {renderStreaming()}
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

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onUpdate={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
