/*
 * Tailwind v4 is wired through its own PostCSS package. Using the `tailwindcss`
 * plugin directly here is the v3 form and does not work on v4, and there is no
 * tailwind.config.js - the theme lives in CSS via `@theme`, fed by the tokens
 * generated in packages/tokens.
 */
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
