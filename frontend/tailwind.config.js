/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#A572FF",
        ink: "#0A0A0A",
      },
      aspectRatio: { "9/16": "9 / 16" },
    },
  },
  plugins: [],
};
