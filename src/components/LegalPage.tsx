import Link from "next/link";
import { Logo } from "@/components/ui";

/** Shared layout for the public privacy and terms pages. */
export default function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: { h: string; p?: string; items?: string[] }[] }) {
  return (
    <div className="min-h-screen bg-paper text-navy-900">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-6">
        <Link href="/" aria-label="SanoAI home">
          <Logo size={30} />
        </Link>
        <nav aria-label="Legal" className="flex gap-4 text-sm font-medium text-sano-700">
          <Link href="/privacy" className="hover:underline">Privacy</Link>
          <Link href="/terms" className="hover:underline">Terms</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-[13px] text-navy-400">Last updated 27 November 2026</p>
        <p className="mt-4 text-[15px] leading-relaxed text-navy-600">{intro}</p>
        {sections.map((s) => (
          <section key={s.h} className="mt-8">
            <h2 className="text-lg font-semibold">{s.h}</h2>
            {s.p && <p className="mt-2 text-[15px] leading-relaxed text-navy-600">{s.p}</p>}
            {s.items && (
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-navy-600">
                {s.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
