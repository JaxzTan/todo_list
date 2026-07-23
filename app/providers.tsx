"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/client/auth";
import { ThemeProvider } from "@/lib/client/theme";
import { I18nProvider } from "@/lib/client/i18n";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>{children}</AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
