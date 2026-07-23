"use client";

import { AppShell } from "@/app/components/AppShell";
import { useI18n } from "@/lib/client/i18n";

export default function BoardsIndexPage() {
  const { t } = useI18n();
  return (
    <AppShell>
      <div className="flex h-full items-center justify-center">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {t("noBoards")}
        </p>
      </div>
    </AppShell>
  );
}
