"use client";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, ExternalLink, Info, Loader2, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { AiMeta, SourceRef } from "@/ai/types";

export const cn = clsx;

// ───────────────────────── brand ─────────────────────────
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5FE3DC" />
          <stop offset="1" stopColor="#1B7BE0" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#g${id})`} />
      <path d="M12 26h6l3-8 5 15 3.5-9H36" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="35.5" cy="15" r="3" fill="#fff" fillOpacity=".9" />
    </svg>
  );
}
export function Logo({ dark = false, size = 30 }: { dark?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className={clsx("font-display text-[19px] font-semibold tracking-tight", dark ? "text-white" : "text-navy-900")}>
        Sano<span className="text-sano-400">AI</span>
      </span>
    </span>
  );
}

// ───────────────────────── buttons ─────────────────────────
type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark" | "outline-light";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-gradient-to-r from-sano-500 to-cyanx-500 text-white shadow-glow hover:brightness-110 active:brightness-95",
  secondary: "bg-white text-navy-800 border border-navy-100 shadow-sm hover:bg-navy-50",
  ghost: "text-navy-600 hover:bg-navy-50",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  dark: "bg-navy-900 text-white hover:bg-navy-800",
  "outline-light": "border border-white/25 text-white hover:bg-white/10",
};
const SIZES = { sm: "h-8 px-3 text-[13px] gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-6 text-[15px] gap-2.5" };

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof SIZES;
  loading?: boolean;
  href?: string;
  icon?: ReactNode;
}
export function Button({ variant = "primary", size = "md", loading, href, icon, className, children, disabled, ...rest }: BtnProps) {
  const cls = clsx("inline-flex select-none items-center justify-center whitespace-nowrap rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50", VARIANTS[variant], SIZES[size], className);
  if (href) {
    return (
      <Link href={href} className={cls}>
        {icon}
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ───────────────────────── surfaces ─────────────────────────
export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("card", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold text-navy-900">{title}</h2>
        {hint && <p className="mt-0.5 text-[13px] text-navy-400">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-[26px] font-semibold leading-tight text-navy-900 sm:text-[30px]">{title}</h1>
        {description && <p className="mt-2 text-[15px] leading-relaxed text-navy-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

// ───────────────────────── badges ─────────────────────────
export type Tone = "teal" | "amber" | "rose" | "sky" | "slate" | "navy" | "green";
const TONES: Record<Tone, string> = {
  teal: "bg-sano-50 text-sano-800 ring-sano-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  rose: "bg-rose-50 text-rose-800 ring-rose-200",
  sky: "bg-sky-50 text-sky-800 ring-sky-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  navy: "bg-navy-900 text-white ring-navy-700",
};
export function Badge({ tone = "slate", children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={clsx("inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-left text-[11.5px] leading-snug font-medium ring-1 ring-inset", TONES[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export const flagTone = (f: string): Tone => (f === "low" ? "amber" : f === "high" ? "rose" : f === "normal" ? "green" : "slate");
export const flagLabel = (f: string) => (f === "low" ? "Below lab range" : f === "high" ? "Above lab range" : f === "normal" ? "Within lab range" : "No range printed");

// ───────────────────────── feedback ─────────────────────────
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("h-5 w-5 animate-spin text-sano-500", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={clsx("relative overflow-hidden rounded-xl bg-navy-100/60", className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </div>
  );
}

export function LoadingBlock({ label = "Loading…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy-200 bg-white/60 px-6 py-12 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sano-50 text-sano-600">{icon}</div>}
      <h3 className="text-base font-semibold text-navy-900">{title}</h3>
      {body && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-navy-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
      <div className="flex-1">
        <p className="font-medium">Something didn't work</p>
        <p className="mt-0.5 text-rose-800/90">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

const CALLOUT: Record<string, { box: string; icon: ReactNode }> = {
  info: { box: "border-sky-200 bg-sky-50 text-sky-950", icon: <Info className="h-[18px] w-[18px] text-sky-600" /> },
  teal: { box: "border-sano-200 bg-sano-50 text-sano-900", icon: <CheckCircle2 className="h-[18px] w-[18px] text-sano-600" /> },
  warn: { box: "border-amber-200 bg-amber-50 text-amber-950", icon: <AlertTriangle className="h-[18px] w-[18px] text-amber-600" /> },
  alert: { box: "border-rose-300 bg-rose-50 text-rose-950", icon: <ShieldAlert className="h-[18px] w-[18px] text-rose-600" /> },
};
export function Callout({ tone = "info", title, children, className }: { tone?: keyof typeof CALLOUT; title?: string; children?: ReactNode; className?: string }) {
  const c = CALLOUT[tone];
  return (
    <div role={tone === "alert" ? "alert" : undefined} className={clsx("flex gap-3 rounded-2xl border p-4 text-[13.5px] leading-relaxed", c.box, className)}>
      <span className="mt-0.5 shrink-0">{c.icon}</span>
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
    </div>
  );
}

/** Honest provenance label: tells the user exactly what produced the result. */
export function AiModeChip({ meta, className }: { meta?: AiMeta; className?: string }) {
  if (!meta) return null;
  const cfg =
    meta.mode === "live"
      ? { tone: "teal" as Tone, text: `AI-assisted · ${meta.provider}${meta.model ? ` · ${meta.model}` : ""}`, dot: "bg-sano-500" }
      : meta.mode === "rules"
        ? { tone: "sky" as Tone, text: "Curated library · deterministic", dot: "bg-sky-500" }
        : { tone: "amber" as Tone, text: "Built-in rules · no AI used", dot: "bg-amber-500" };
  return (
    <span className={className}>
      <Badge tone={cfg.tone} icon={<span className={clsx("h-1.5 w-1.5 rounded-full", cfg.dot)} />}>
        {cfg.text}
      </Badge>
    </span>
  );
}
export function MetaNotice({ meta }: { meta?: AiMeta }) {
  if (!meta?.notice) return null;
  return (
    <p className="mt-2 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-navy-500">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {meta.notice}
    </p>
  );
}

export function SourceList({ sources, title = "Sources" }: { sources: SourceRef[]; title?: string }) {
  if (!sources.length) return null;
  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-navy-400">{title}</p>
      <ul className="space-y-1.5">
        {sources.map((s) => (
          <li key={s.id}>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-start gap-1.5 text-[13px] text-navy-600 hover:text-sano-700">
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy-300 group-hover:text-sano-600" />
              <span>
                <span className="font-medium text-navy-800 group-hover:text-sano-700">{s.title}</span> <span className="text-navy-400">— {s.publisher}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────────── inputs ─────────────────────────
export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-navy-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-navy-400">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-navy-900">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[13px] leading-relaxed text-navy-500">{description}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50", checked ? "bg-sano-500" : "bg-navy-200")}
      >
        <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label?: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-xl bg-navy-100/70 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx("rounded-lg px-3 py-1.5 text-[13px] font-medium transition", value === o.value ? "bg-white text-navy-900 shadow-sm" : "text-navy-500 hover:text-navy-800")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────── modal ─────────────────────────
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-navy-950/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 24, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 24, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className={clsx("relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-lift sm:rounded-3xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-navy-900">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-50 hover:text-navy-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ───────────────────────── toast ─────────────────────────
interface ToastItem {
  id: number;
  tone: "ok" | "err";
  text: string;
}
const ToastCtx = createContext<(text: string, tone?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, tone, text }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24 }}
              className={clsx("pointer-events-auto flex items-start gap-2.5 rounded-2xl border p-3.5 text-sm shadow-lift", t.tone === "ok" ? "border-sano-200 bg-white text-navy-800" : "border-rose-200 bg-rose-50 text-rose-900")}
            >
              {t.tone === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sano-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
              <span>{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

/** Standard module disclaimer strip: communicates limits at the point of use. */
export function LimitsNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-navy-900/[0.04] px-4 py-3 text-[12.5px] leading-relaxed text-navy-600">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" />
      <div>{children}</div>
    </div>
  );
}
