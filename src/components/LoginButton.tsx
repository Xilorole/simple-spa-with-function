import { useAuth } from "../hooks/useAuth";

export function LoginButton() {
  const { user, loading, login, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 truncate max-w-[200px]">
          {user.userDetails}
        </span>
        <button
          onClick={logout}
          className="text-xs text-gray-500 hover:text-gray-700 underline transition-colors"
        >
          ログアウト
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 transition-colors"
    >
      ログイン
    </button>
  );
}
