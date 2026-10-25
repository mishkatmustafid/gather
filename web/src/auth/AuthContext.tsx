import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, hasToken, setToken } from "../lib/api";
import type { User } from "../lib/types";
import { queryClient } from "../lib/queryClient";
import { keys } from "../lib/queries";

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(hasToken());

  useEffect(() => {
    if (!hasToken()) return;
    api<User>("/auth/me")
      .then(setUser)
      .catch(() => setToken(null)) // expired or invaid token
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { access_token } = await api<{ access_token: string }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    );
    setToken(access_token);
    setUser(await api<User>("/auth/me"));
  }

  function logout() {
    setToken(null);
    queryClient.removeQueries({ queryKey: keys.me }); // drop the previous user's private data
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
