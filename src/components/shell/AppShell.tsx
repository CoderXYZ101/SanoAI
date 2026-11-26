"use client";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Droplets, FolderHeart, NotebookPen, Gauge, LayoutDashboard, LogOut, Menu, MessageSquareHeart, Network, Pill, ScanSearch, Settings, SlidersHorizontal, Stethoscope, Waypoints, X, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/ui";
import { signOutUser } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assistant", label: "AI Health Assistant", icon: MessageSquareHeart },
  { href: "/timeline", label: "Medical Timeline", icon: Waypoints },
  { href: "/blind-spots", label: "Blind-Spot Detector", icon: ScanSearch },
  { href: "/simulator", label: "Counterfactual Simulator", icon: SlidersHorizontal },
  { href: "/uncertainty", label: "Uncertainty Engine", icon: Gauge },
  { href: "/cross-specialty", label: "Cross-Specialty Intelligence", icon: Network },
  { href: "/deficiency", label: "Deficiency Finder", icon: Droplets },
  { href: "/doctors", label: "Find Doctors", icon: Stethoscope },
  { href: "/pharmacy", label: "Pharmacy Connector", icon: Pill },
  { href: "/records", label: "My Medical Records", icon: FolderHeart },
  { href: "/diary", label: "Health Diary", icon: NotebookPen },
  { href: "/pricing", label: "Plans", icon: Crown },
  { href: "/settings", label: "Settings", icon: Settings },
];

export interface ShellProps {
  user: { name: string; email: string };
  ai: { effective: "live" | "demo"; label: string };
  isAdmin?: boolean;
  children: ReactNode;
}

function NavList({ onNavigate, isAdmin }: { onNavigate?: () => void; isAdmin?: boolean }) {
  const path = usePathname();
  const items = isAdmin ? [...NAV, { href: "/admin", label: "Admin", icon: ShieldCheck }] : NAV;
  return (
    <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
      {items.map(({ href, label, icon: Icon }, i) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <div key={href}>
            {(i === 8 || i === 10) && <div className="mx-3 my-2 h-px bg-white/[0.07]" />}
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={clsx("group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition", active ? "bg-white/[0.09] text-white" : "text-navy-200 hover:bg-white/[0.05] hover:text-white")}
            >
              {active && <motion.span layoutId="nav-active" className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-gradient-to-b from-sano-300 to-cyanx-500" />}
              <Icon className={clsx("h-[18px] w-[18px] shrink-0 transition", active ? "text-sano-300" : "text-navy-300 group-hover:text-sano-300")} strokeWidth={1.8} />
              <span className="truncate">{label}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

export default function AppShell({ user, ai, isAdmin, children }: ShellProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const path = usePathname();

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
      <NavList onNavigate={onNavigate} isAdmin={isAdmin} />
      <div className="space-y-3 p-4">
        <Link href="/settings#privacy" onClick={onNavigate} className="flex items-start gap-2.5 rounded-xl bg-white/[0.05] p-3 text-[11.5px] leading-relaxed text-navy-200 ring-1 ring-white/[0.06] transition hover:bg-white/[0.08]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sano-300" />
          <span>
            Your records are private to your account (Firestore security rules). <span className="text-sano-300">Privacy controls →</span>
          </span>
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
    <div className="min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[264px] lg:block">{sidebar()}</aside>

      {/* mobile top bar */}
      <div className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-navy-100 bg-white/85 px-4 backdrop-blur-xl lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-navy-700 hover:bg-navy-50">
          <Menu className="h-5 w-5" />
        </button>
        <Logo />
        <span className={clsx("h-2.5 w-2.5 rounded-full", ai.effective === "live" ? "bg-sano-500" : "bg-amber-500")} title={ai.effective === "live" ? "Live AI" : "Demo mode"} />
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

      <div className="lg:pl-[264px]">
        {/* provenance bar: always tells the user what is powering the analysis */}
        <div className="no-print border-b border-navy-100/70 bg-white/60 px-4 py-2 text-[12px] backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1">
            <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium ring-1 ring-inset", ai.effective === "live" ? "bg-sano-50 text-sano-800 ring-sano-200" : "bg-amber-50 text-amber-800 ring-amber-200")}>
              <span className={clsx("h-1.5 w-1.5 rounded-full", ai.effective === "live" ? "bg-sano-500" : "bg-amber-500")} />
              {ai.effective === "live" ? `Live AI · ${ai.label}` : "Built-in rules · no AI in use"}
            </span>
            <span className="text-navy-400">SanoAI shares information, not medical advice — it cannot diagnose or replace a clinician.</span>
            {ai.effective === "demo" && (
              <Link href="/settings#ai" className="font-medium text-sano-700 hover:underline">
                AI settings
              </Link>
            )}
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.main key={path} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }} className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
