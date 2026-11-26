"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { aiStatus } from "@/ai/structured";
import AiChoice from "@/components/AiChoice";
import AppShell from "@/components/shell/AppShell";
import { Spinner } from "@/components/ui";
import VerifyEmail from "@/components/VerifyEmail";
import { isAdmin } from "@/lib/payments";
import { useAuth } from "@/lib/auth";

/** Client-side route guard: every page in this group requires a signed-in Firebase user. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [ai, setAi] = useState<{ effective: "live" | "demo"; label: string }>({ effective: "demo", label: "" });

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=" + encodeURIComponent(path));
  }, [ready, user, router, path]);

  const [admin, setAdmin] = useState(false);
  const [choices, setChoices] = useState(0); // bumps after the AI choice so pages re-read it
  useEffect(() => {
    if (!user?.verified) return setAdmin(false);
    isAdmin(user.id).then(setAdmin).catch(() => setAdmin(false));
  }, [user]);

  // Settings announces AI changes so the top bar updates at once
  const [aiChanges, setAiChanges] = useState(0);
  useEffect(() => {
    const changed = () => setAiChanges((n) => n + 1);
    window.addEventListener("sano:ai", changed);
    return () => window.removeEventListener("sano:ai", changed);
  }, []);

  useEffect(() => {
    if (!user?.verified) return;
    aiStatus(user.id).then((s) => setAi({ effective: s.effective, label: s.provider.label })).catch(() => {});
  }, [user, path, choices, aiChanges]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (!user.verified) return <VerifyEmail email={user.email} />;
  return (
    <AppShell user={{ name: user.name, email: user.email }} ai={ai} isAdmin={admin}>
      <div key={choices}>{children}</div>
      <AiChoice userId={user.id} onChosen={() => setChoices((n) => n + 1)} />
    </AppShell>
  );
}
