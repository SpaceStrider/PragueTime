/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./content/atlas.html"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Plus Jakarta Sans", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        vltava: "#141923",
        garnet: { DEFAULT: "#B8293D", dark: "#9E2032" },
        pilsner: { DEFAULT: "#C97A1E", light: "#F3D28F" },
        linden: { DEFAULT: "#245C46", dark: "#1C4837" },
        cobalt: "#255485",
        coffee: "#7A4B2A",
        parchment: "#FCFAF6",
      },
      boxShadow: {
        "2xs": "0 1px 0 0 rgb(0 0 0 / 0.05)",
      },
      backdropBlur: {
        xs: "2px",
      },
      scale: {
        115: "1.15",
      },
    },
  },
  plugins: [],
};
