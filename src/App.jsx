import { useState, useEffect } from "react";

export default function App() {
  const [user, setUser] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/.auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.clientPrincipal) {
          setUser(data.clientPrincipal);
        }
      })
      .catch(() => {});
  }, []);

  const handleSend = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError("");
    setResponse("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
      });

      const contentType = res.headers.get("content-type") || "";

      // 認証リダイレクトで HTML が返ってきた場合
      if (!contentType.includes("application/json")) {
        throw new Error(
          "認証エラー: ログインが必要です。ページをリロードしてください。"
        );
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error: ${res.status}`);
      }

      const data = await res.json();
      setResponse(data.reply);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSend();
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Azure OpenAI PoC</h1>
        <div className="user-info">
          {user ? (
            <>
              <span>{user.userDetails}</span>
              <a href="/.auth/logout" className="btn btn-sm">
                ログアウト
              </a>
            </>
          ) : (
            <a href="/.auth/login/aad" className="btn btn-sm">
              ログイン
            </a>
          )}
        </div>
      </header>

      <main className="main">
        <div className="input-section">
          <textarea
            className="prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力してください..."
            rows={5}
            disabled={loading}
          />
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={loading || !prompt.trim()}
          >
            {loading ? "送信中..." : "送信"}
          </button>
          <span className="hint">Ctrl+Enter でも送信できます</span>
        </div>

        {error && <div className="error">{error}</div>}

        {response && (
          <div className="response-section">
            <h2>回答</h2>
            <div className="response-content">{response}</div>
          </div>
        )}
      </main>
    </div>
  );
}
