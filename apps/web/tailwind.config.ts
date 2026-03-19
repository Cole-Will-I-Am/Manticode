import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#06060a",
          secondary: "#0c0c12",
          tertiary: "#13131c",
        },
        surface: {
          DEFAULT: "#13131c",
          elevated: "#1a1a26",
        },
        border: {
          DEFAULT: "#1e1e2e",
          light: "#2a2a3e",
        },
        text: {
          primary: "#e8e6f0",
          secondary: "#8b87a0",
          tertiary: "#5a5672",
        },
        accent: {
          DEFAULT: "#f97316",
          soft: "rgba(249, 115, 22, 0.1)",
        },
        telegram: "#2aabee",
        success: "#34d399",
        danger: "#ef4444",
      },
      fontFamily: {
        sans: ['"Outfit"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, #f97316 0%, #fb923c 40%, #2aabee 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
