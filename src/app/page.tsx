import { ArrowRight, BadgeCheck, Droplets, EyeOff, FileSearch, Fingerprint, Gauge, HeartPulse, Lock, MessageSquareHeart, Network, Pill, ScanSearch, ShieldCheck, SlidersHorizontal, Sparkles, Stethoscope, Trash2, Waypoints } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { FloatChip, Reveal } from "@/components/Reveal";
import HeroOrbLazy from "@/components/three/HeroOrbLazy";

const CORE = [
  { icon: Waypoints, title: "Medical history reconstruction", body: "Upload reports, prescriptions and discharge summaries. SanoAI builds one chronological timeline — every item linked to the exact line it came from, uncertain dates clearly marked.", href: "/timeline", wide: true },
  { icon: ScanSearch, title: "Diagnostic blind-spot detector", body: "Surfaces what your records don't say: missing results, conflicting entries, unanswered questions — framed as questions for your doctor, never as accusations.", href: "/blind-spots", wide: true },
  { icon: Gauge, title: "Uncertainty engine", body: "Every analysis separates what is supported, what is only possible, what is missing and what needs a professional. No invented confidence percentages.", href: "/uncertainty" },
  { icon: Network, title: "Cross-specialty intelligence", body: "Connects cardiology, endocrinology, nutrition and more on an interactive 3D body map — so one specialist's finding isn't invisible to another.", href: "/cross-specialty" },
  { icon: SlidersHorizontal, title: "Counterfactual simulator", body: "Explore “what if I slept more, moved more?” against public-health guidance — an educational model, never a prediction.", href: "/simulator" },
];
const MORE = [
  { icon: MessageSquareHeart, t: "AI Health Assistant", d: "Cited answers, voice in/out, urgent-care safety net" },
  { icon: Droplets, t: "Deficiency Finder", d: "B12, D, iron, ferritin, haemoglobin, calcium, folate — against your lab's own ranges" },
  { icon: Stethoscope, t: "Find care", d: "Real hospitals and clinics near you, with call and directions" },
  { icon: Pill, t: "Medicines", d: "Real pharmacies nearby, plain-language labels — never prescribes" },
  { icon: HeartPulse, t: "Doctor Brief", d: "A printable one-page summary traceable to your documents" },
];
const STEPS = [
  { n: "01", t: "Add your records", d: "Upload PDFs, photos or text — or explore with synthetic demo records. Everything is private to your account." },
  { n: "02", t: "Extract & verify", d: "Facts are pulled out with the source quote attached. Anything an AI proposes that can't be found verbatim in your document is discarded." },
  { n: "03", t: "Connect the dots", d: "Timeline, gaps, uncertainty and cross-specialty links are built from your verified facts — not from guesses." },
  { n: "04", t: "Talk to your doctor", d: "Walk in with a clear brief and the right questions. Share only what you choose, and revoke it any time." },
];
const TRUST = [
  { icon: Lock, t: "Private by design", d: "Per-account isolation enforced by Firestore security rules, with data encrypted at rest by Google Cloud. If you choose SanoAI AI, the text needed for an answer passes through SanoAI's relay to an AI provider." },
  { icon: Fingerprint, t: "Consent before any AI call", d: "Nothing leaves SanoAI for an external AI service unless you switch that on. Turn it off any time." },
  { icon: FileSearch, t: "A ledger of every AI call", d: "See each request — module, provider, size, outcome — in your own audit log. Never the content." },
  { icon: BadgeCheck, t: "Built not to fabricate", d: "Verbatim-quote verification, schema validation, a medical-language guard and cited references." },
  { icon: ShieldCheck, t: "Safety net first", d: "Red-flag symptoms trigger urgent-care guidance from deterministic rules — never left to a model." },
  { icon: Trash2, t: "Yours to delete", d: "Delete any document, export everything, or erase your account and files permanently." },
];

export default function Landing() {
  // Static page: signed-in visitors are forwarded from /register to their dashboard automatically.
  const user = null as null | object;
  const primary = { href: "/register", label: "Get Started" };
  return (
    <div className="bg-navy-950 text-white">
      {/* ───────── nav ───────── */}
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="SanoAI home">
            <Logo dark size={34} />
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-8 text-sm text-navy-200 md:flex">
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#how" className="transition hover:text-white">How it works</a>
            <a href="#trust" className="transition hover:text-white">Privacy &amp; transparency</a>
            <Link href="/business" className="transition hover:text-white">For labs &amp; clinics</Link>
          </nav>
          <div className="flex items-center gap-2">
            {!user && (
              <Link href="/login" className="hidden rounded-xl px-4 py-2 text-sm font-medium text-navy-100 transition hover:bg-white/10 sm:block">
                Sign in
              </Link>
            )}
            <Link href={primary.href} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-navy-900 transition hover:bg-sano-100">
              {primary.label}
            </Link>
          </div>
        </div>
      </header>

      {/* ───────── hero ───────── */}
      <section className="relative isolate overflow-hidden bg-[radial-gradient(1200px_600px_at_75%_30%,rgba(20,175,177,0.22),transparent_60%),radial-gradient(900px_500px_at_10%_0%,rgba(27,123,224,0.2),transparent_55%)] pb-24 pt-32 sm:pt-40">
        <div className="bg-grid absolute inset-0 -z-10" />
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-sano-200 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" /> Spark X Tech Fest · Generative AI · HealGen
              </span>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-6 text-[40px] font-semibold leading-[1.06] tracking-tight sm:text-6xl lg:text-[64px]">
                Understand your health.
                <br />
                <span className="text-gradient">Connect the dots.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-navy-200">
                SanoAI turns scattered reports and prescriptions into one clear picture — a verified timeline, the questions your records leave open, and honest uncertainty about what can&apos;t be known. Not another chatbot that sounds sure.
              </p>
            </Reveal>
            <Reveal delay={0.24} className="mt-9 flex flex-wrap items-center gap-3">
              <Link href={primary.href} className="group inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-sano-400 to-cyanx-500 px-6 text-[15px] font-semibold text-navy-950 shadow-glow transition hover:brightness-110">
                {primary.label}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <a href="#features" className="inline-flex h-12 items-center rounded-xl border border-white/20 px-6 text-[15px] font-medium text-white transition hover:bg-white/10">
                Explore SanoAI
              </a>
            </Reveal>
            <Reveal delay={0.28}>
              <p className="mt-4 text-[13.5px] text-navy-300">
                No records handy?{" "}
                <Link href="/register" className="font-medium text-sano-300 underline">Create a free account</Link> and load a fictional sample patient in one click.
              </p>
            </Reveal>
            <Reveal delay={0.32}>
              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-navy-300">
                {["Information, not diagnosis", "Source-linked, never invented", "Built for India"].map((t) => (
                  <li key={t} className="inline-flex items-center gap-1.5">
                    <BadgeCheck className="h-4 w-4 text-sano-300" />
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-[560px]">
            <HeroOrbLazy className="absolute inset-0" />
            <FloatChip className="absolute left-0 top-[14%] hidden sm:block" delay={0}>
              <div className="glass rounded-2xl px-4 py-3 text-xs shadow-lift">
                <p className="font-semibold text-white">Free T4 result not found</p>
                <p className="mt-0.5 text-navy-300">TSH is above the lab range — worth asking</p>
              </div>
            </FloatChip>
            <FloatChip className="absolute bottom-[18%] right-0 hidden sm:block" delay={0.4}>
              <div className="glass rounded-2xl px-4 py-3 text-xs shadow-lift">
                <p className="font-semibold text-white">Known 4 · Possible 3 · Missing 5</p>
                <p className="mt-0.5 text-navy-300">Why SanoAI can&apos;t be definitive</p>
              </div>
            </FloatChip>
            <FloatChip className="absolute bottom-[4%] left-[6%] hidden sm:block" delay={0.8}>
              <div className="glass rounded-2xl px-4 py-3 text-xs shadow-lift">
                <p className="font-semibold text-white">Cardiology ↔ Endocrinology</p>
                <p className="mt-0.5 text-navy-300">Connection found in your records</p>
              </div>
            </FloatChip>
            <p className="absolute -bottom-2 right-2 text-[10px] text-navy-400">Illustrative labels</p>
          </div>
        </div>
      </section>

      {/* ───────── features ───────── */}
      <section id="features" className="relative bg-paper py-24 text-navy-900">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">More than a medical chatbot</p>
            <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Five ways SanoAI connects your health information</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-navy-500">A chatbot answers a question. SanoAI reads across everything you&apos;ve been told, and shows you what fits together — and what doesn&apos;t.</p>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-6">
            {CORE.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.06} className={f.wide ? "md:col-span-3" : i === 4 ? "md:col-span-6" : "md:col-span-3 lg:col-span-2"}>
                <Link href="/register" className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-navy-100 bg-white p-7 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                  <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-sano-200/30 blur-3xl transition group-hover:bg-sano-300/40" />
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-navy-800 to-navy-900 text-sano-300">
                    <f.icon className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <h3 className="relative mt-5 text-lg font-semibold">{f.title}</h3>
                  <p className="relative mt-2 text-[14.5px] leading-relaxed text-navy-500">{f.body}</p>
                  <span className="relative mt-auto inline-flex items-center gap-1 pt-5 text-sm font-medium text-sano-700">
                    Open module <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-10">
            <p className="mb-4 text-sm font-semibold text-navy-400">Also in the platform</p>
            <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
              {MORE.map((m) => (
                <li key={m.t} className="flex gap-3">
                  <m.icon className="mt-0.5 h-5 w-5 shrink-0 text-sano-600" strokeWidth={1.8} />
                  <div>
                    <p className="text-sm font-semibold">{m.t}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-navy-500">{m.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ───────── how it works ───────── */}
      <section id="how" className="bg-white py-24 text-navy-900">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">From a pile of PDFs to a clear conversation</h2>
          </Reveal>
          <ol className="relative mt-14 grid gap-8 md:grid-cols-4">
            <div className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-sano-300 to-transparent md:block" />
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <li className="relative">
                  <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-900 font-display text-sm font-semibold text-sano-300 shadow-lift">{s.n}</span>
                  <h3 className="mt-5 text-base font-semibold">{s.t}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-navy-500">{s.d}</p>
                </li>
              </Reveal>
            ))}
          </ol>

          {/* uncertainty preview */}
          <Reveal className="mt-20">
            <div className="overflow-hidden rounded-3xl bg-navy-900 p-6 text-white shadow-lift sm:p-10">
              <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
                <div>
                  <p className="eyebrow !text-sano-300">What an answer looks like</p>
                  <h3 className="mt-2 text-2xl font-semibold">Confidence you can actually inspect</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-navy-200">Most health bots sound certain. SanoAI shows its working: what&apos;s documented, what&apos;s merely possible, what&apos;s absent, what else could explain it, and what only a clinician can settle.</p>
                </div>
                <div className="space-y-2.5 text-[13px]">
                  {[
                    ["Supported", "Your latest B12 is below the range printed on the lab report", "bg-sano-400", "From your records"],
                    ["Possible", "Long-term metformin is associated with lower B12", "bg-amber-400", "Cited: NIH ODS"],
                    ["Missing", "No dietary history or follow-up plan in the records", "bg-slate-400", "Not found"],
                    ["Alternatives", "Lab variation; recent supplements", "bg-sky-400", "Cited reference"],
                    ["Needs a professional", "Interpretation and next steps", "bg-rose-400", "Clinician"],
                  ].map(([k, v, c, b]) => (
                    <div key={k} className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-4 py-2.5 ring-1 ring-white/[0.07]">
                      <span className={`h-8 w-1 rounded-full ${c}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-300">{k}</p>
                        <p className="truncate text-white">{v}</p>
                      </div>
                      <span className="hidden shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-navy-200 sm:block">{b}</span>
                    </div>
                  ))}
                  <p className="pt-1 text-[11px] text-navy-400">Illustrative example, built from synthetic data.</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────── trust ───────── */}
      <section id="trust" className="relative overflow-hidden bg-navy-950 py-24">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-sano-500/10 blur-[120px]" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal className="max-w-2xl">
            <p className="eyebrow !text-sano-300">Healthcare transparency &amp; privacy</p>
            <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Trust is a feature, not a footer</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-navy-200">Health data is the most personal data there is. SanoAI is designed so you can see, control and delete everything it knows — with consent, access, export and erasure controls in the spirit of India's DPDP Act (not a compliance certification).</p>
          </Reveal>
          <div className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {TRUST.map((t, i) => (
              <Reveal key={t.t} delay={i * 0.05}>
                <div className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.07] text-sano-300 ring-1 ring-white/10">
                    <t.icon className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold">{t.t}</h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-navy-300">{t.d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-14">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-5 text-[14px] leading-relaxed text-amber-100">
              <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              <p>
                <strong className="text-amber-200">SanoAI is not a doctor.</strong> It provides educational information and decision support. It does not diagnose, prescribe, or replace a qualified clinician. In an emergency, call 112.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="bg-[radial-gradient(800px_300px_at_50%_0%,rgba(20,175,177,0.25),transparent_70%)] py-24">
        <Reveal className="mx-auto max-w-3xl px-5 text-center">
          <h2 className="text-3xl font-semibold sm:text-5xl">Ready to see the whole picture?</h2>
          <p className="mx-auto mt-4 max-w-xl text-[17px] text-navy-200">Create a private account and explore with synthetic demo records in under a minute. Free to start, ₹0 and no AI key needed.</p>
          <Link href={primary.href} className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-7 text-[15px] font-semibold text-navy-900 transition hover:bg-sano-100">
            {primary.label} <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>
      </section>

      <footer className="border-t border-white/10 bg-navy-950 py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 text-[13px] text-navy-300 sm:px-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <Logo dark size={28} />
            <p className="mt-3 leading-relaxed">“Sano” — Latin for <em>to heal</em>. Built for Spark X Tech Fest · Generative AI · Theme S2: HealGen (Accessible Healthcare &amp; Diagnostics).</p>
          </div>
          <div className="max-w-md leading-relaxed">
            <p>
              Educational information only. SanoAI cannot diagnose, treat or prescribe. Sample records are fictional. Places are from OpenStreetMap. Always consult a qualified healthcare professional; in an emergency call 112.
            </p>
            <p className="mt-3 text-navy-400">
              © {new Date().getFullYear()} SanoAI ·{" "}
              <Link href="/privacy" className="underline hover:text-white">Privacy &amp; responsible AI</Link> ·{" "}
              <Link href="/terms" className="underline hover:text-white">Terms</Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
