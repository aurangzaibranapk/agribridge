import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deliberate palette: deep field-green as the brand anchor (this is
        // an agriculture business), warm wheat as a secondary accent, and a
        // near-neutral slate for the actual data-dense UI so the green
        // doesn't fight with tables full of numbers.
        brand: {
          50: "#f0f7f0",
          100: "#dcebdc",
          200: "#b9d7ba",
          300: "#8ebd90",
          400: "#5f9c63",
          500: "#3f7d43",
          600: "#2f6334",
          700: "#274f2b",
          800: "#204024",
          900: "#1b351f",
        },
        wheat: {
          400: "#e0b96c",
          500: "#d3a24a",
          600: "#b8873a",
        },
        surface: {
          50: "#fafaf9",
          100: "#f4f3f1",
          200: "#e7e5e1",
          300: "#d3d1cb",
          400: "#a8a69e",
          500: "#78766e",
          600: "#57564f",
          700: "#3f3e38",
          800: "#26261f",
          900: "#1a1a16",
          950: "#121210",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        card: "10px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
