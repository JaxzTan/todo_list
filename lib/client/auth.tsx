"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, getToken, setToken } from "./api";
import type { BoardSummary } from "./types";

interface AuthContextValue {
  status: "checking" | "authed" | "anon";
  login: (token: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue["status"]>("checking");

  useEffect(() => {
    const token = getToken();
    const resolved: Promise<AuthContextValue["status"]> = token
      ? api
          .get<{ boards: BoardSummary[] }>("/api/boards")
          .then(() => "authed" as const)
          .catch(() => {
            setToken(null);
            return "anon" as const;
          })
      : Promise.resolve("anon" as const);
    resolved.then(setStatus);
  }, []);

  const login = async (token: string) => {
    setToken(token);
    try {
      await api.get<{ boards: BoardSummary[] }>("/api/boards");
      setStatus("authed");
      return true;
    } catch (err) {
      setToken(null);
      setStatus("anon");
      if (err instanceof ApiError && err.status === 401) return false;
      throw err;
    }
  };

  const logout = () => {
    setToken(null);
    setStatus("anon");
  };

  const value = useMemo(() => ({ status, login, logout }), [status]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Redirects to /login as soon as we know there's no valid session. */
export function useRequireAuth() {
  const { status } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === "anon") router.replace("/login");
  }, [status, router]);
  return status;
}
