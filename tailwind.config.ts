import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#EEF3FA",
          100: "#D6E0F0",
          200: "#A9BCDB",
          300: "#7B93BC",
          400: "#516E9B",
          500: "#33507C",
          600: "#233B63",
          700: "#182B4C",
          800: "#0F1E3A",
          900: "#0A1428",
          950: "#050B1A",
        },
        sano: {
          50: "#ECFDFC",
          100: "#CFFAF6",
          200: "#A0F2EC",
          300: "#5FE3DC",
          400: "#2CCBC8",
          500: "#14AFB1",
          600: "#0E8F96",
          700: "#0F727A",
          800: "#115B62",
          900: "#124C52",
        },
        cyanx: { 300: "#67E8F9", 400: "#22D3EE", 500: "#06B6D4" },
        paper: "#F5F8FB",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(10,20,40,.04), 0 8px 24px -12px rgba(10,20,40,.10)",
        lift: "0 2px 4px rgba(10,20,40,.05), 0 18px 40px -16px rgba(10,20,40,.18)",
        glow: "0 0 0 1px rgba(44,203,200,.25), 0 10px 40px -10px rgba(20,175,177,.45)",
      },
      borderRadius: { xl2: "1.25rem", xl3: "1.75rem" },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        floaty: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        pulseRing: {
          "0%": { transform: "scale(.9)", opacity: ".7" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        floaty: "floaty 6s ease-in-out infinite",
        pulseRing: "pulseRing 2.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
