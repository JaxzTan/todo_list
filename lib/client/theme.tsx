"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";
const STORAGE_KEY = "exec-board:theme";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // "dark" matches the wireframe's default and app/layout.tsx's inline
  // pre-hydration script, which sets data-theme="dark" unless a stored
  // preference or prefers-color-scheme says otherwise.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // localStorage/matchMedia don't exist during SSR, so the real value can
    // only be known after mount — layout.tsx's inline script already
    // applied the class pre-hydration to avoid a flash, this just brings
    // React's own state in sync with it.
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial: Theme =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(initial);
    apply(initial);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      window.localStorage.setItem(STORAGE_KEY, next);
      apply(next);
      return next;
    });
  };

  const value = useMemo(() => ({ theme, toggleTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
