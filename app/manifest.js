// Minimal PWA manifest (no icon files in V1 — add 192/512 PNG icons
// under /public and reference them here before relying on the
// "install app" prompt; the app works fully in the browser without it).
export default {
  name: "Pharmacy POS",
  short_name: "Pharmacy POS",
  description: "Offline-first Pharmacy POS for a single store.",
  start_url: "/dashboard",
  display: "standalone",
  background_color: "#f3f4f6",
  theme_color: "#111827",
};
