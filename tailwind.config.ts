import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#050505",
        foreground: "#f4f4f5", // zinc-100
        primary: {
          DEFAULT: "#050505",
          foreground: "#00ffcc",
        },
        secondary: {
          DEFAULT: "#050505",
          foreground: "#00ffcc",
        },
        accent: {
          DEFAULT: "#00ffcc",
          foreground: "#050505",
        },
        muted: {
          DEFAULT: "#111111",
          foreground: "#71717a", // zinc-500
        },
        popover: {
          DEFAULT: "#050505",
          foreground: "#f4f4f5",
        },
        card: {
          DEFAULT: "#050505",
          foreground: "#f4f4f5",
        },
        border: "#27272a", // zinc-800
        input: "#27272a", // zinc-800
        ring: "#00ffcc",
        // Alert status colors
        critical: "#ef4444", // red-500
        warning: "#f59e0b", // amber-500
        safe: "#10b981", // emerald-500
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
