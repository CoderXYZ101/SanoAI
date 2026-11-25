"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { aiStatus } from "@/ai/structured";
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
  useEffect(() => {
    if (!user?.verified) return setAdmin(false);
    isAdmin(user.id).then(setAdmin).catch(() => setAdmin(false));
  }, [user]);

  useEffect(() => {
    if (!user?.verified) return;
    aiStatus(user.id).then((s) => setAi({ effective: s.effective, label: s.provider.label })).catch(() => {});
  }, [user, path]);

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
      {children}
    </AppShell>
  );
}
