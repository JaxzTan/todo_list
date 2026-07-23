"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/client/auth";

export default function HomePage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authed") router.replace("/boards");
    else if (status === "anon") router.replace("/login");
  }, [status, router]);

  return (
    <main
      className="flex min-h-screen items-center justify-center"
      style={{ background: "var(--bg)", color: "var(--muted)" }}
    >
      <p className="text-sm">Loading…</p>
    </main>
  );
}
