import { useState, useEffect, useCallback } from "react";

interface UserInfo {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
}

export function useAuth() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/.auth/me");
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = await res.json();
      const clientPrincipal = data.clientPrincipal;
      if (clientPrincipal) {
        setUser(clientPrincipal);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = () => {
    window.location.href = "/.auth/login/aad";
  };

  const logout = () => {
    window.location.href = "/.auth/logout";
  };

  return { user, loading, login, logout };
}
