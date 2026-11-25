"use client";
import { useEffect, useState } from "react";

export interface GfxCaps {
  webgl: boolean;
  reducedMotion: boolean;
  lowPower: boolean;
  checked: boolean;
}

/** Detects WebGL support, reduced-motion preference and low-power devices so 3D can degrade gracefully. */
export function useGfx(): GfxCaps {
  const [caps, setCaps] = useState<GfxCaps>({ webgl: false, reducedMotion: false, lowPower: false, checked: false });
  useEffect(() => {
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = Boolean(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
    } catch {
      webgl = false;
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowPower = (navigator.hardwareConcurrency ?? 8) <= 2 || (navigator as Navigator & { deviceMemory?: number }).deviceMemory === 1;
    setCaps({ webgl, reducedMotion, lowPower, checked: true });
  }, []);
  return caps;
}

/** True while the element is on screen and the tab is visible — used to pause rendering. */
export function useOnScreen(ref: React.RefObject<Element | null>): boolean {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let visible = true;
    let tabVisible = !document.hidden;
    const update = () => setOn(visible && tabVisible);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      update();
    });
    io.observe(el);
    const vis = () => {
      tabVisible = !document.hidden;
      update();
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, [ref]);
  return on;
}
