import { createContext, useContext, useEffect, useState, ReactNode, createElement } from "react";
import { api, setAccessToken } from "./api";

interface User {
  id: string;
  email: string;
  role: "EMPLOYEE" | "AGENT" | "ADMIN";
  name: string;
  team_id: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Try current access token session first (if any)
        const me = await api.get("/auth/me");
        setUser(me.data);
      } catch {
        try {
          // Try refresh-token cookie to obtain new access token
          const refreshed = await api.post("/auth/refresh");
          const token = refreshed.data?.token ?? null;
          setAccessToken(token);
          const me = await api.get("/auth/me");
          setUser(me.data);
        } catch {
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    const { token, user: u } = res.data;
    setAccessToken(token);
    setUser(u);
  };

  const logout = () => {
    api.post("/auth/logout").catch(() => undefined);
    setAccessToken(null);
    setUser(null);
  };

  if (!ready) return null;

  return createElement(
    AuthContext.Provider,
    { value: { user, isAuthenticated: !!user, login, logout } },
    children
  );
};
