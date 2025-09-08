export default {
  content: ["./index.html", "./src/**/*.{html,js,ts,tsx}"],
  theme: {
    extend: {},
  },
  safelist: [
    {
      pattern: /border-(red|blue|green|purple|orange)-(500)/,
    },
  ],
  plugins: [require("@tailwindcss/typography")],
};
