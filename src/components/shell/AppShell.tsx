"use client";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Crown, Droplets, FileText, FolderHeart, Gauge, Home, LogOut, Menu, MessageSquareHeart, Network, NotebookPen, Pill, ScanSearch, Settings, ShieldCheck, SlidersHorizontal, Stethoscope, Waypoints, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/ui";
import { signOutUser } from "@/lib/auth";

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
}
// Six everyday places first, in plain words. Everything else is one tap away in two folding groups.
const MAIN: Item[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/assistant", label: "Ask Sano", icon: MessageSquareHeart },
  { href: "/records", label: "My records", icon: FolderHeart },
  { href: "/timeline", label: "Health story", icon: Waypoints },
  { href: "/doctors", label: "Find care", icon: Stethoscope },
  { href: "/pharmacy", label: "Medicines", icon: Pill },
];
const CHECKS: Item[] = [
  { href: "/blind-spots", label: "What's missing", icon: ScanSearch },
  { href: "/deficiency", label: "Nutrients check", icon: Droplets },
  { href: "/cross-specialty", label: "Body connections", icon: Network },
  { href: "/uncertainty", label: "How sure can we be?", icon: Gauge },
  { href: "/simulator", label: "What if…?", icon: SlidersHorizontal },
];
const MORE: Item[] = [
  { href: "/brief", label: "Doctor summary", icon: FileText },
  { href: "/diary", label: "Health diary", icon: NotebookPen },
  { href: "/pricing", label: "Plans", icon: Crown },
  { href: "/settings", label: "Settings", icon: Settings },
];
const TABS: Item[] = [MAIN[0], MAIN[1], MAIN[2], MAIN[4]];

export interface ShellProps {
  user: { name: string; email: string };
  ai: { effective: "live" | "demo"; label: string };
  isAdmin?: boolean;
  children: ReactNode;
}

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

function NavLink({ item, onNavigate }: { item: Item; onNavigate?: () => void }) {
  const active = isActive(usePathname(), item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={clsx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-medium transition", active ? "bg-gradient-to-r from-sano-500/90 to-cyanx-500/80 text-white shadow-lift" : "text-navy-100 hover:bg-white/[0.07] hover:text-white")}
    >
      <Icon className={clsx("h-5 w-5 shrink-0", active ? "text-white" : "text-sano-300")} strokeWidth={1.8} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function Group({ title, items, onNavigate }: { title: string; items: Item[]; onNavigate?: () => void }) {
  const path = usePathname();
  const [choice, setChoice] = useState<boolean | null>(null);
  const open = choice ?? items.some((i) => isActive(path, i.href));
  return (
    <div className="pt-2">
      <button onClick={() => setChoice(!open)} aria-expanded={open} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[12px] font-semibold uppercase tracking-wider text-navy-300 hover:text-white">
        {title}
        <ChevronDown className={clsx("h-4 w-4 transition", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-0.5">{items.map((i) => <NavLink key={i.href} item={i} onNavigate={onNavigate} />)}</div>}
    </div>
  );
}

export default function AppShell({ user, ai, isAdmin, children }: ShellProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const path = usePathname();
  const live = ai.effective === "live";

  async function logout() {
    await signOutUser().catch(() => {});
    router.push("/login");
  }

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col bg-gradient-to-b from-navy-900 via-navy-900 to-navy-950">
      <div className="flex h-16 items-center px-6">
        <Link href="/dashboard" aria-label="SanoAI home" onClick={onNavigate}>
          <Logo dark />
        </Link>
      </div>
      <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {MAIN.map((i) => <NavLink key={i.href} item={i} onNavigate={onNavigate} />)}
        <Group title="Health checks" items={CHECKS} onNavigate={onNavigate} />
        <Group title="More" items={isAdmin ? [...MORE, { href: "/admin", label: "Admin", icon: ShieldCheck }] : MORE} onNavigate={onNavigate} />
      </nav>
      <div className="space-y-3 p-4">
        <Link href="/settings#privacy" onClick={onNavigate} className="flex items-center gap-2.5 rounded-xl bg-white/[0.05] p-3 text-[12px] text-navy-200 ring-1 ring-white/[0.06] transition hover:bg-white/[0.08]">
          <ShieldCheck className="h-4 w-4 shrink-0 text-sano-300" />
          <span>Your records are private. <span className="text-sano-300">Controls →</span></span>
        </Link>
        <div className="flex items-center gap-3 rounded-xl px-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sano-400 to-cyanx-500 text-sm font-semibold text-navy-950">{user.name.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">{user.name}</p>
            <p className="truncate text-[11.5px] text-navy-300">{user.email}</p>
          </div>
          <button onClick={logout} aria-label="Sign out" title="Sign out" className="rounded-lg p-2 text-navy-300 transition hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(900px_420px_at_85%_-5%,rgba(44,203,200,0.13),transparent_60%),radial-gradient(700px_380px_at_20%_0%,rgba(27,123,224,0.09),transparent_60%)]">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[256px] lg:block">{sidebar()}</aside>

      {/* mobile top bar */}
      <div className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-navy-100 bg-white/90 px-4 backdrop-blur-xl lg:hidden">
        <Logo />
        <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium", live ? "bg-sano-50 text-sano-800" : "bg-amber-50 text-amber-800")}>
          <span className={clsx("h-1.5 w-1.5 rounded-full", live ? "bg-sano-500" : "bg-amber-500")} />
          {live ? "AI on" : "AI off"}
        </span>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", stiffness: 360, damping: 36 }} className="absolute inset-y-0 left-0 w-[280px] shadow-lift">
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-navy-200 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
              {sidebar(() => setOpen(false))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="lg:pl-[256px]">
        {/* provenance: always tells the user what is powering the answers */}
        <div className="no-print hidden border-b border-navy-100/60 bg-white/60 px-8 py-2 text-[12px] backdrop-blur lg:block">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <span className="text-navy-400">SanoAI shares information, not medical advice. In an emergency call 112.</span>
            <Link href="/settings#ai" className={clsx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ring-1 ring-inset transition hover:brightness-95", live ? "bg-sano-50 text-sano-800 ring-sano-200" : "bg-amber-50 text-amber-800 ring-amber-200")}>
              <span className={clsx("h-1.5 w-1.5 rounded-full", live ? "bg-sano-500" : "bg-amber-500")} />
              {live ? `Live AI · ${ai.label}` : "Built-in answers · no AI in use"}
            </Link>
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.main key={path} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }} className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-8 sm:pt-7 lg:pb-12">
            {children}
          </motion.main>
        </AnimatePresence>
      </div>

      {/* phone: the main places are always one thumb-tap away */}
      <nav aria-label="Quick" className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-navy-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        {TABS.map((t) => {
          const active = isActive(path, t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={clsx("flex flex-col items-center gap-1 py-2 text-[11px] font-medium", active ? "text-sano-700" : "text-navy-400")}>
              <t.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.3 : 1.8} />
              {t.label.replace("My records", "Records")}
            </Link>
          );
        })}
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="flex flex-col items-center gap-1 py-2 text-[11px] font-medium text-navy-400">
          <Menu className="h-[22px] w-[22px]" strokeWidth={1.8} />
          More
        </button>
      </nav>
    </div>
  );
}
