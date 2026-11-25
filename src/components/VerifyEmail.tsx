"use client";
import { MailCheck, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Callout, Card, Logo, useToast } from "@/components/ui";
import { authMessage, refreshVerification, resendVerification, signOutUser } from "@/lib/auth";

/** Shown to email/password users until they confirm their address. */
export default function VerifyEmail({ email }: { email: string }) {
  const [busy, setBusy] = useState<"check" | "resend" | null>(null);
  const [wait, setWait] = useState(30);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function check() {
    setBusy("check");
    try {
      if (await refreshVerification()) toast("Email verified. Welcome to SanoAI.");
      else toast("Not verified yet. Open the link in the email, then try again.", "err");
    } catch (e) {
      toast(authMessage(e), "err");
    } finally {
      setBusy(null);
    }
  }

  async function resend() {
    setBusy("resend");
    try {
      await resendVerification();
      setWait(60);
      toast("Verification email sent.");
    } catch (e) {
      toast(authMessage(e), "err");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-5 py-12">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sano-50 text-sano-600">
          <MailCheck className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold text-navy-900">Verify your email</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-navy-500">
          We sent a link to <strong className="break-all text-navy-800">{email}</strong>. Open it, then come back here.
        </p>
        <Callout tone="info" className="mt-5 text-left">This protects your health records and makes sure payments are matched to the right person. Check your spam folder if you can&apos;t find the email.</Callout>
        <Button className="mt-5 w-full" size="lg" loading={busy === "check"} onClick={check} icon={<RefreshCw className="h-4 w-4" />}>
          I&apos;ve verified — continue
        </Button>
        <div className="mt-3 flex justify-between">
          <Button variant="ghost" size="sm" loading={busy === "resend"} disabled={wait > 0} onClick={resend}>
            {wait > 0 ? `Resend in ${wait}s` : "Resend email"}
          </Button>
          <Button variant="ghost" size="sm" onClick={async () => { await signOutUser(); router.push("/login"); }}>
            Use a different account
          </Button>
        </div>
      </Card>
    </main>
  );
}
