"use client";
import dynamic from "next/dynamic";
import { useRef } from "react";
import { Network } from "lucide-react";
import type { BodyEdge, BodyNode } from "./BodyNetwork3D";
import { useGfx, useOnScreen } from "./useWebGL";

const BodyNetwork3D = dynamic(() => import("./BodyNetwork3D"), { ssr: false, loading: () => <Loading /> });

function Loading() {
  return <div className="flex h-full items-center justify-center text-sm text-navy-300">Loading 3D body map…</div>;
}

/** Accessible 2D fallback: the same information as a list when WebGL isn't available. */
function Fallback({ nodes, edges, selected, onSelect }: { nodes: BodyNode[]; edges: BodyEdge[]; selected: string | null; onSelect: (s: string | null) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <Network className="h-8 w-8 text-sano-300" />
      <p className="text-sm text-navy-200">3D graphics aren&apos;t available on this device, so here is the same map as a list.</p>
      <div className="flex flex-wrap justify-center gap-2">
        {nodes.map((n) => (
          <button key={n.specialty} onClick={() => onSelect(selected === n.specialty ? null : n.specialty)} className={`rounded-full px-3 py-1 text-xs font-medium ${selected === n.specialty ? "bg-white text-navy-900" : "bg-white/10 text-white"}`}>
            {n.specialty} · {n.count}
          </button>
        ))}
      </div>
      <p className="text-xs text-navy-300">{edges.length} link{edges.length === 1 ? "" : "s"} between specialties found.</p>
    </div>
  );
}

export default function BodyNetworkLazy(props: { nodes: BodyNode[]; edges: BodyEdge[]; selected: string | null; onSelect: (s: string | null) => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const gfx = useGfx();
  const on = useOnScreen(ref);
  return (
    <div ref={ref} className={props.className}>
      {!gfx.checked ? <Loading /> : gfx.webgl ? <BodyNetwork3D nodes={props.nodes} edges={props.edges} selected={props.selected} onSelect={props.onSelect} active={on} reduced={gfx.reducedMotion} lowPower={gfx.lowPower} /> : <Fallback nodes={props.nodes} edges={props.edges} selected={props.selected} onSelect={props.onSelect} />}
    </div>
  );
}
