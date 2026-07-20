/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#102018",
        paper: "#F5F1E7",
        moss: "#2D945D",
        fern: "#BFD8C3",
        clay: "#C97959",
        night: "#0B1710",
        mist: "#E4ECE3",
      },
      fontFamily: {
        display: ["LibreBaskerville_700Bold"],
        sans: ["DMSans_400Regular"],
        medium: ["DMSans_600SemiBold"],
        mono: ["DMMono_500Medium"],
      },
      borderRadius: { card: "24px" },
    },
  },
  plugins: [],
};

