import { ChatWindow } from "./components/ChatWindow";
import { LoginButton } from "./components/LoginButton";
import { useAuth } from "./hooks/useAuth";

export default function App() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Auth Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
        <h1 className="text-sm font-semibold text-gray-700">Simple SPA Chat</h1>
        <LoginButton />
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl h-[calc(100vh-8rem)]">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              読み込み中...
            </div>
          ) : !user ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
              <p className="text-lg">チャットを利用するにはログインしてください</p>
              <button
                onClick={() => (window.location.href = "/.auth/login/aad")}
                className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
              >
                Microsoft でログイン
              </button>
            </div>
          ) : (
            <ChatWindow />
          )}
        </div>
      </main>
    </div>
  );
}
