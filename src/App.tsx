import { useState } from "react";
import { ChatWindow } from "./components/ChatWindow";
import { ReviewPanel } from "./components/ReviewPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { useAoaiSettings } from "./hooks/useAoaiSettings";

type Tab = "chat" | "review";

export default function App() {
  const [tab, setTab] = useState<Tab>("review");
  const [showSettings, setShowSettings] = useState(false);
  const { settings, updateSettings, isConfigured } = useAoaiSettings();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      {/* Top bar */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-3">
        <div className="flex gap-1 bg-white rounded-full p-1 shadow-sm border border-gray-200">
          <TabButton active={tab === "chat"} onClick={() => setTab("chat")}>
            💬 Chat
          </TabButton>
          <TabButton active={tab === "review"} onClick={() => setTab("review")}>
            📋 Review
          </TabButton>
        </div>

        <button
          onClick={() => setShowSettings(true)}
          title="Azure OpenAI 設定"
          className={`w-9 h-9 flex items-center justify-center rounded-full shadow-sm border transition-colors ${
            isConfigured
              ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
              : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path
              fillRule="evenodd"
              d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Main panel */}
      <div className="w-full max-w-2xl h-[85vh]">
        {tab === "chat" ? (
          <ChatWindow settings={settings} />
        ) : (
          <ReviewPanel settings={settings} />
        )}
      </div>

      {/* Settings modal */}
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}
