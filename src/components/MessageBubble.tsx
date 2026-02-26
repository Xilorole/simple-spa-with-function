import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight, oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import "katex/dist/katex.min.css";

export type MessageRole = "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
}

interface MessageBubbleProps {
  message: Message;
}

/** Animated typing-indicator shown while waiting for a response. */
export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3 animate-slide-in-left">
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-gray-400 bounce-dot-1" />
        <span className="w-2 h-2 rounded-full bg-gray-400 bounce-dot-2" />
        <span className="w-2 h-2 rounded-full bg-gray-400 bounce-dot-3" />
      </div>
    </div>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3 ${
        isUser ? "animate-slide-in-right" : "animate-slide-in-left"
      }`}
    >
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-br-md"
            : "bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm"
        }`}
      >
        <div
          className={`bubble-markdown ${isUser ? "bubble-markdown-user" : ""}`}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const codeString = String(children).replace(/\n$/, "");
                if (match) {
                  return (
                    <SyntaxHighlighter
                      style={isUser ? oneDark : oneLight}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{
                        margin: 0,
                        borderRadius: "6px",
                        fontSize: "0.85em",
                      }}
                    >
                      {codeString}
                    </SyntaxHighlighter>
                  );
                }
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
