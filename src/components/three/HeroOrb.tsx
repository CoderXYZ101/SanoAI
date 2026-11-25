"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * The SanoAI "medical intelligence orb": a fresnel-glow core, a particle shell, a wireframe lattice and
 * orbiting data-nodes linked to the core — a visual metaphor for connected medical information.
 * Lightweight by design: ~1.5k points, one custom shader, 9 line segments, DPR capped at 1.6.
 */

const TEAL = new THREE.Color("#5fe3dc");
const CYAN = new THREE.Color("#22d3ee");

function Core({ reduced }: { reduced: boolean }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((_, dt) => {
    if (mat.current && !reduced) mat.current.uniforms.uTime.value += dt;
  });
  return (
    <mesh>
      <sphereGeometry args={[0.82, 64, 64]} />
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vN; varying vec3 vV; varying vec3 vP;
          void main(){
            vN = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position,1.0);
            vV = normalize(-mv.xyz);
            vP = position;
            gl_Position = projectionMatrix * mv;
          }`}
        fragmentShader={`
          uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
          void main(){
            float f = pow(1.0 - abs(dot(vN, vV)), 2.3);
            float bands = 0.5 + 0.5 * sin(vP.y * 7.0 + uTime * 1.3 + sin(vP.x * 4.0 + uTime) * 0.8);
            vec3 deep = vec3(0.03, 0.18, 0.36);
            vec3 glow = vec3(0.37, 0.89, 0.86);
            vec3 col = mix(deep, glow, f) + bands * 0.07 * vec3(0.1, 0.8, 0.9);
            gl_FragColor = vec4(col, 0.28 + 0.72 * f);
          }`}
      />
    </mesh>
  );
}

function Particles({ count, reduced }: { count: number; reduced: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      const rad = 1.55 + (Math.sin(i * 12.9898) * 0.5 + 0.5) * 0.28;
      pos[i * 3] = Math.cos(th) * r * rad;
      pos[i * 3 + 1] = y * rad;
      pos[i * 3 + 2] = Math.sin(th) * r * rad;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count]);
  useFrame((_, dt) => {
    if (ref.current && !reduced) ref.current.rotation.y += dt * 0.07;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color={TEAL} size={0.022} sizeAttenuation transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function Lattice({ reduced }: { reduced: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current && !reduced) {
      ref.current.rotation.y -= dt * 0.1;
      ref.current.rotation.x += dt * 0.03;
    }
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.22, 2]} />
      <meshBasicMaterial color={CYAN} wireframe transparent opacity={0.16} depthWrite={false} />
    </mesh>
  );
}

const NODE_COUNT = 9;
function Nodes({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const lines = useRef<THREE.LineSegments>(null);
  const seeds = useMemo(
    () =>
      Array.from({ length: NODE_COUNT }, (_, i) => ({
        r: 1.95 + (i % 3) * 0.28,
        speed: 0.16 + (i % 4) * 0.045,
        phase: (i / NODE_COUNT) * Math.PI * 2,
        tilt: (i % 5) * 0.38 - 0.7,
        size: 0.045 + (i % 3) * 0.018,
      })),
    [],
  );
  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((NODE_COUNT * 2 + NODE_COUNT) * 2 * 3), 3));
    return g;
  }, []);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!reduced) t.current += dt;
    const g = group.current;
    if (!g) return;
    const pts: THREE.Vector3[] = [];
    seeds.forEach((s, i) => {
      const a = s.phase + t.current * s.speed;
      const x = Math.cos(a) * s.r;
      const z = Math.sin(a) * s.r;
      const y = Math.sin(a * 1.3 + s.phase) * 0.8 + s.tilt * 0.4;
      g.children[i].position.set(x, y, z);
      pts.push(new THREE.Vector3(x, y, z));
    });
    const arr = (lineGeo.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    let k = 0;
    const push = (v: THREE.Vector3) => {
      arr[k++] = v.x;
      arr[k++] = v.y;
      arr[k++] = v.z;
    };
    pts.forEach((p, i) => {
      push(new THREE.Vector3(0, 0, 0).lerp(p, 0.42));
      push(p);
      const q = pts[(i + 3) % NODE_COUNT];
      push(p);
      push(q);
    });
    lineGeo.attributes.position.needsUpdate = true;
    lineGeo.setDrawRange(0, NODE_COUNT * 4);
  });
  return (
    <>
      <lineSegments ref={lines} geometry={lineGeo}>
        <lineBasicMaterial color={TEAL} transparent opacity={0.28} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      <group ref={group}>
        {seeds.map((s, i) => (
          <mesh key={i}>
            <sphereGeometry args={[s.size, 16, 16]} />
            <meshBasicMaterial color={i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? TEAL : CYAN} />
          </mesh>
        ))}
      </group>
    </>
  );
}

function Rig({ children, reduced }: { children: React.ReactNode; reduced: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    if (!g.current) return;
    const px = reduced ? 0 : state.pointer.x;
    const py = reduced ? 0 : state.pointer.y;
    g.current.rotation.y = THREE.MathUtils.damp(g.current.rotation.y, px * 0.45, 3, dt);
    g.current.rotation.x = THREE.MathUtils.damp(g.current.rotation.x, -py * 0.25, 3, dt);
    if (!reduced) g.current.position.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.05;
  });
  return <group ref={g}>{children}</group>;
}

export default function HeroOrb({ active = true, reduced = false, lowPower = false }: { active?: boolean; reduced?: boolean; lowPower?: boolean }) {
  return (
    <Canvas
      dpr={[1, lowPower ? 1 : 1.6]}
      camera={{ position: [0, 0, 6.2], fov: 42 }}
      gl={{ antialias: !lowPower, alpha: true, powerPreference: "high-performance" }}
      frameloop={active ? (reduced ? "demand" : "always") : "never"}
      aria-hidden
    >
      <Rig reduced={reduced}>
        <Core reduced={reduced} />
        <Lattice reduced={reduced} />
        <Particles count={lowPower ? 700 : 1500} reduced={reduced} />
        <Nodes reduced={reduced} />
      </Rig>
    </Canvas>
  );
}
