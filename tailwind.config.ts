import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        intime: {
          primary: "#0284C7", // InTime Royal Blue
          hover: "#0369A1",   // Deep Ocean Blue
          navy: "#0F172A",    // Deep Tech Navy
          surface: "#1E293B", // Slate Tech Surface
          accent: "#38BDF8",  // Electric Cyan / Sky
          success: "#10B981", // Verde Esmeralda (Operacional/Concluído)
          warning: "#F59E0B", // Âmbar (Em Atendimento/Aguardando)
          danger: "#EF4444",  // Vermelho (Crítico/Cancelado)
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
