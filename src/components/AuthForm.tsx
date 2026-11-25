"use client";
import { motion } from "framer-motion";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Callout, Field, Logo } from "@/components/ui";
import HeroOrbLazy from "@/components/three/HeroOrbLazy";
import { authMessage, resetPassword, signIn, signInWithGoogle, signUp, useAuth } from "@/lib/auth";
import { useEffect } from "react";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.8-6.8C35.9 2.4 30.5 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.2z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gBusy, setGBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const isReg = mode === "register";

  const { user: signedIn, ready } = useAuth();
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  useEffect(() => {
    if (ready && signedIn) router.replace(safeNext);
  }, [ready, signedIn, router, safeNext]);

  async function google() {
    setError(null);
    setInfo(null);
    setGBusy(true);
    try {
      await signInWithGoogle(isReg && consent);
      router.push(safeNext);
    } catch (err) {
      setError(authMessage(err));
      setGBusy(false);
    }
  }

  async function forgot() {
    setError(null);
    setInfo(null);
    if (!email.trim()) return setError("Type your email address first.");
    try {
      await resetPassword(email);
      setInfo("If an account exists for that address, a password reset email is on its way.");
    } catch (err) {
      setError(authMessage(err));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isReg) await signUp(name, email, password, consent);
      else await signIn(email, password);
      router.push(safeNext);
    } catch (err) {
      setError(authMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-navy-950 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(700px_500px_at_70%_40%,rgba(20,175,177,0.28),transparent_65%),radial-gradient(600px_400px_at_0%_0%,rgba(27,123,224,0.22),transparent_60%)]" />
        <div className="bg-grid absolute inset-0" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link href="/" aria-label="SanoAI home">
            <Logo dark size={34} />
          </Link>
          <HeroOrbLazy className="mx-auto aspect-square w-full max-w-[460px]" />
          <div>
            <p className="max-w-md text-2xl font-semibold leading-snug">Understand your health. <span className="text-gradient">Connect the dots.</span></p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-navy-300">Your records stay private to your account, protected by Firestore security rules. SanoAI shares information — it never diagnoses.</p>
          </div>
        </div>
      </aside>

      <main className="flex items-center justify-center bg-paper px-5 py-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-[420px]">
          <Link href="/" className="mb-8 inline-block lg:hidden" aria-label="SanoAI home">
            <Logo />
          </Link>
          <h1 className="text-[28px] font-semibold text-navy-900">{isReg ? "Create your private account" : "Welcome back"}</h1>
          <p className="mt-2 text-[15px] text-navy-500">{isReg ? "Takes under a minute. You can explore with synthetic demo records straight away." : "Sign in to continue to your dashboard."}</p>

          <button type="button" onClick={google} disabled={gBusy || busy} className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-navy-100 bg-white text-[15px] font-medium text-navy-800 shadow-sm transition hover:bg-navy-50 disabled:opacity-60">
            <GoogleIcon />
            {gBusy ? "Opening Google…" : "Continue with Google"}
          </button>
          <div className="mt-5 flex items-center gap-3 text-[12px] uppercase tracking-wide text-navy-300">
            <span className="h-px flex-1 bg-navy-100" /> or use email <span className="h-px flex-1 bg-navy-100" />
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            {isReg && (
              <Field label="Your name" htmlFor="name">
                <input id="name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
              </Field>
            )}
            <Field label="Email" htmlFor="email">
              <input id="email" type="email" className="field" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password" htmlFor="password" hint={isReg ? "At least 10 characters, with capitals or numbers." : undefined}>
              <div className="relative">
                <input id="password" type={show ? "text" : "password"} className="field pr-11" autoComplete={isReg ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-navy-400 hover:text-navy-700">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            {isReg && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-100 bg-white p-3.5 text-[13px] leading-relaxed text-navy-600">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-sano-600" />
                <span>
                  <span className="font-medium text-navy-800">Optional:</span> allow SanoAI to send my questions and document text to the configured external AI service. Leave unticked to use the built-in rule-based engines only. You can change this any time in Settings.
                </span>
              </label>
            )}
            {!isReg && (
              <button type="button" onClick={forgot} className="text-[13px] font-medium text-sano-700 hover:underline">
                Forgot password?
              </button>
            )}
            {isReg && <p className="text-[12.5px] text-navy-400">We&apos;ll email you a link to verify your address.</p>}
            {info && <Callout tone="teal">{info}</Callout>}
            {error && <Callout tone="alert" title={isReg ? "We couldn't create your account" : "We couldn't sign you in"}>{error}</Callout>}
            <Button type="submit" size="lg" loading={busy} className="w-full">
              {isReg ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-navy-500">
            {isReg ? "Already have an account?" : "New to SanoAI?"}{" "}
            <Link href={isReg ? "/login" : "/register"} className="font-semibold text-sano-700 hover:underline">
              {isReg ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <p className="mt-8 flex items-start gap-2 text-xs leading-relaxed text-navy-400">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sano-500" />
            Sign-in is handled by Firebase Authentication. SanoAI is an information tool, not a medical service.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
