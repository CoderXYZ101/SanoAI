"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Interactive 3D "body map" of medical specialties. Each specialty node sits at the region of the
 * body it relates to; glowing arcs connect specialties for which the user's own records contain
 * cross-specialty connections (arc thickness = number of connections found, NOT clinical severity).
 */

export interface BodyNode {
  specialty: string;
  count: number; // items from the user's records in this specialty
}
export interface BodyEdge {
  a: string;
  b: string;
  count: number;
}

const POS: Record<string, [number, number, number]> = {
  Neurology: [0, 1.82, 0.12],
  Endocrinology: [0, 1.2, 0.2],
  Cardiology: [-0.3, 0.7, 0.22],
  Haematology: [0.34, 0.72, 0.2],
  Nutrition: [-0.34, 0.12, 0.22],
  Gastroenterology: [0.0, -0.02, 0.28],
  Nephrology: [0.36, 0.1, -0.08],
  "General Medicine": [0, -0.7, 0.22],
};
export const BODY_SPECIALTIES = Object.keys(POS);

const TEAL = "#2dd4bf";

function Silhouette() {
  const wire = <meshBasicMaterial color="#4a76b8" wireframe transparent opacity={0.28} depthWrite={false} />;
  const fill = <meshBasicMaterial color="#12274a" transparent opacity={0.4} depthWrite={false} />;
  const parts: { pos: [number, number, number]; scale: [number, number, number]; rot?: [number, number, number] }[] = [
    { pos: [0, 1.82, 0], scale: [0.32, 0.38, 0.32] }, // head
    { pos: [0, 1.4, 0], scale: [0.13, 0.2, 0.13] }, // neck
    { pos: [0, 0.55, 0], scale: [0.62, 1.0, 0.34] }, // torso
    { pos: [0, -0.55, 0], scale: [0.5, 0.45, 0.3] }, // pelvis
    { pos: [-0.78, 0.7, 0], scale: [0.13, 0.62, 0.13], rot: [0, 0, 0.14] }, // arm L
    { pos: [0.78, 0.7, 0], scale: [0.13, 0.62, 0.13], rot: [0, 0, -0.14] }, // arm R
  ];
  return (
    <group>
      {parts.map((p, i) => (
        <group key={i} position={p.pos} scale={p.scale} rotation={p.rot ?? [0, 0, 0]}>
          <mesh>
            <sphereGeometry args={[1, 18, 14]} />
            {fill}
          </mesh>
          <mesh>
            <sphereGeometry args={[1.001, 18, 14]} />
            {wire}
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Scene({ nodes, edges, selected, onSelect, labelRefs, dragRot, reduced }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const pulses = useRef<THREE.Mesh[]>([]);
  const counts = useMemo(() => new Map(nodes.map((n) => [n.specialty, n.count])), [nodes]);
  const maxCount = Math.max(1, ...nodes.map((n) => n.count));

  const curves = useMemo(
    () =>
      edges
        .filter((e) => POS[e.a] && POS[e.b])
        .map((e) => {
          const a = new THREE.Vector3(...POS[e.a]);
          const b = new THREE.Vector3(...POS[e.b]);
          const mid = a.clone().add(b).multiplyScalar(0.5);
          mid.z += 0.55 + a.distanceTo(b) * 0.18;
          return { e, curve: new THREE.QuadraticBezierCurve3(a, mid, b) };
        }),
    [edges],
  );

  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const target = dragRot.current.y + (reduced ? 0 : Math.sin(state.clock.elapsedTime * 0.4) * 0.28);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, target, 4, dt);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, dragRot.current.x, 4, dt);
    pulses.current.forEach((m, i) => {
      const c = curves[i];
      if (!m || !c) return;
      const t = reduced ? 0.5 : (state.clock.elapsedTime * 0.35 + i * 0.37) % 1;
      m.position.copy(c.curve.getPoint(t));
    });
    // project nodes to screen for HTML labels
    const w = state.size.width;
    const h = state.size.height;
    nodes.forEach((n) => {
      const el = labelRefs.current.get(n.specialty);
      const p = POS[n.specialty];
      if (!el || !p) return;
      tmp.set(p[0], p[1] + 0.02, p[2]);
      g.localToWorld(tmp);
      const depth = tmp.clone();
      tmp.project(state.camera);
      el.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px) translate(-50%, 22px)`;
      el.style.opacity = depth.z < -0.45 ? "0.25" : "1";
    });
  });

  return (
    <group ref={group} position={[0, -0.55, 0]}>
      <Silhouette />
      {curves.map(({ e, curve }, i) => (
        <group key={`${e.a}-${e.b}`}>
          <mesh>
            <tubeGeometry args={[curve, 28, 0.012 + Math.min(e.count, 4) * 0.01, 6, false]} />
            <meshBasicMaterial color={TEAL} transparent opacity={selected && selected !== e.a && selected !== e.b ? 0.1 : 0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh
            ref={(m) => {
              if (m) pulses.current[i] = m;
            }}
          >
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
      {Object.entries(POS).map(([name, p]) => {
        const c = counts.get(name) ?? 0;
        const active = c > 0;
        const sel = selected === name;
        const r = 0.09 + (active ? (c / maxCount) * 0.1 : 0);
        return (
          <group key={name} position={p}>
            {active && (
              <mesh>
                <sphereGeometry args={[r * 2.1, 20, 20]} />
                <meshBasicMaterial color={TEAL} transparent opacity={sel ? 0.34 : 0.14} depthWrite={false} blending={THREE.AdditiveBlending} />
              </mesh>
            )}
            <mesh
              onClick={(ev) => {
                ev.stopPropagation();
                onSelect(sel ? null : name);
              }}
              onPointerOver={() => (document.body.style.cursor = "pointer")}
              onPointerOut={() => (document.body.style.cursor = "")}
            >
              <sphereGeometry args={[r, 24, 24]} />
              <meshBasicMaterial color={sel ? "#ffffff" : active ? "#5fe3dc" : "#5a7396"} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

interface SceneProps {
  nodes: BodyNode[];
  edges: BodyEdge[];
  selected: string | null;
  onSelect: (s: string | null) => void;
  labelRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  dragRot: React.MutableRefObject<{ x: number; y: number }>;
  reduced: boolean;
}

export default function BodyNetwork3D({ nodes, edges, selected, onSelect, active = true, reduced = false, lowPower = false }: { nodes: BodyNode[]; edges: BodyEdge[]; selected: string | null; onSelect: (s: string | null) => void; active?: boolean; reduced?: boolean; lowPower?: boolean }) {
  const labelRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragRot = useRef({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const all = useMemo(() => BODY_SPECIALTIES.map((s) => nodes.find((n) => n.specialty === s) ?? { specialty: s, count: 0 }), [nodes]);

  useEffect(() => () => void (document.body.style.cursor = ""), []);

  return (
    <div
      ref={wrap}
      className="relative h-full w-full touch-pan-y select-none"
      onPointerDown={(e) => (drag.current = { x: e.clientX, y: e.clientY })}
      onPointerMove={(e) => {
        if (!drag.current) return;
        dragRot.current.y += (e.clientX - drag.current.x) * 0.008;
        dragRot.current.x = THREE.MathUtils.clamp(dragRot.current.x + (e.clientY - drag.current.y) * 0.004, -0.4, 0.4);
        drag.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
    >
      <Canvas dpr={[1, lowPower ? 1 : 1.6]} camera={{ position: [0, 0.6, 5.4], fov: 40 }} gl={{ antialias: !lowPower, alpha: true }} frameloop={active ? "always" : "never"} aria-hidden>
        <Scene nodes={all} edges={edges} selected={selected} onSelect={onSelect} labelRefs={labelRefs} dragRot={dragRot} reduced={reduced} />
      </Canvas>
      {all.map((n) => (
        <div
          key={n.specialty}
          ref={(el) => {
            if (el) labelRefs.current.set(n.specialty, el);
          }}
          className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium transition-opacity"
          style={{ color: n.count ? "#d6e0f0" : "#7b93bc", background: n.count ? "rgba(10,20,40,.65)" : "transparent" }}
        >
          {n.specialty}
          {n.count > 0 && <span className="ml-1 text-sano-300">· {n.count}</span>}
        </div>
      ))}
    </div>
  );
}
