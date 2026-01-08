/** @type {import('tailwindcss').Config} */
const tailwindConfig = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,md,html}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: "#facc15",
          dark: "#111111",
          light: "#f1f1f1",
        },
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.5rem",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
  ],
};

export default tailwindConfig;
