import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        lore: {
          bg: "#0d0f12",
          surface: "#161a21",
          border: "#2a3140",
          accent: "#3d9b6e",
          "accent-dim": "#2a6b4c",
          muted: "#8b95a8",
          text: "#e8ecf4",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
