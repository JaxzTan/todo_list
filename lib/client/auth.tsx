"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, getToken, setToken } from "./api";
import type { BoardSummary } from "./types";

interface AuthContextValue {
  status: "checking" | "authed" | "anon";
  loginWithPassword: (handle: string, password: string, persist?: boolean) => Promise<boolean>;
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

  const loginWithPassword = async (handle: string, password: string, persist = true) => {
    try {
      const { token } = await api.post<{ token: string }>("/api/auth/login", { handle, password });
      setToken(token, persist);
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

  const value = useMemo(
    () => ({ status, loginWithPassword, logout }),
    [status],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** True for a 401 from the API — token missing, expired, or revoked. */
export function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
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
