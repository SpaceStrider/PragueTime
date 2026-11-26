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
        garnet: "#B8293D",
        pilsner: "#C97A1E",
        linden: "#245C46",
        cobalt: "#255485",
        parchment: "#FCFAF6",
      },
    },
  },
  plugins: [],
};
