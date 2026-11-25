"use client";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** Scroll-reveal wrapper. Respects reduced-motion via the global CSS rule and framer's own handling. */
export function Reveal({ children, delay = 0, className, y = 22 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

export function FloatChip({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.92, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.5 + delay, duration: 0.6, ease: "easeOut" }} className={className}>
      <div className="animate-floaty" style={{ animationDelay: `${delay * 2}s` }}>
        {children}
      </div>
    </motion.div>
  );
}
