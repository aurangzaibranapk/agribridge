import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // AgriBridge ke rang -- malik ne 4 September ko ye lock kiye.
        //
        // Ye ek hi jagah hain, safhon mein nahi: rang badalna ho to yahan
        // badle, poore nizam par khud lag jaye. Pehle har safha apna
        // hara chun raha tha aur nateeja ye tha ke screen safaid-khaki
        // lagti thi -- brand nazar hi nahi aata tha.
        //
        //   600 Deep Green  #1F6B3A -- asal brand, buttons aur nishan
        //   700 Dark Green  #174D2B -- gehra (AI ka header, hover)
        //   50  Light Green #EAF5EC -- nishan ke peeche ka khana
        //   25  Soft Green  #F3F9F4 -- halka pas-manzar
        brand: {
          25: "#f3f9f4",
          50: "#eaf5ec",
          100: "#d6ebda",
          200: "#b3d9bb",
          300: "#86c194",
          400: "#4f9f66",
          500: "#2b8047",
          600: "#1f6b3a",
          700: "#174d2b",
          800: "#123c22",
          900: "#0e2f1b",
          950: "#081d11",
        },
        // Sona: sirf doosre darje ka nishan (badge, tawajjo) -- brand nahi.
        wheat: {
          50: "#fff4d6",
          400: "#e5bb54",
          500: "#d9a62e",
          600: "#b88722",
        },
        // Kaghaz aur likhai. Halka sabz-mail rakha gaya hai taake safed
        // khana bhi usi khandan ka lage, thanda neela na lage.
        surface: {
          50: "#f7f8f5",
          100: "#eff1ec",
          200: "#e2e8e3",
          300: "#cbd4cc",
          400: "#9aa69c",
          500: "#68736b",
          600: "#4c554e",
          700: "#333b35",
          800: "#222a24",
          900: "#17221a",
          950: "#0e150f",
        },
        // Khatra: laal bhi khandan ka -- kachcha #ff0000 nahi.
        danger: {
          50: "#fdecec",
          100: "#fad7d7",
          500: "#d64545",
          600: "#c03636",
          700: "#9c2b2b",
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
