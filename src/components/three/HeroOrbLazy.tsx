"use client";
import dynamic from "next/dynamic";
import { useRef } from "react";
import { useGfx, useOnScreen } from "./useWebGL";

const HeroOrb = dynamic(() => import("./HeroOrb"), { ssr: false, loading: () => <OrbFallback pulse /> });

/** CSS-only orb used when WebGL is unavailable (or while the 3D bundle loads). */
export function OrbFallback({ pulse = false }: { pulse?: boolean }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center" aria-hidden>
      <div className={`absolute h-[62%] w-[62%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#5fe3dc_0%,#1b7be0_45%,#0a1428_78%)] opacity-90 blur-[2px] ${pulse ? "animate-floaty" : ""}`} />
      <div className="absolute h-[78%] w-[78%] rounded-full border border-sano-300/25" />
      <div className="absolute h-[96%] w-[96%] rounded-full border border-cyanx-400/15" />
    </div>
  );
}

export default function HeroOrbLazy({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const gfx = useGfx();
  const on = useOnScreen(ref);
  return (
    <div ref={ref} className={className}>
      {!gfx.checked ? <OrbFallback pulse /> : gfx.webgl ? <HeroOrb active={on} reduced={gfx.reducedMotion} lowPower={gfx.lowPower} /> : <OrbFallback pulse />}
    </div>
  );
}
