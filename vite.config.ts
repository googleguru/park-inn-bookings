import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// GitHub Pages can't send security headers, so production builds get a CSP via <meta>.
// Build-only: the dev server relies on inline scripts for React Fast Refresh.
const securityHeaders = (supabaseUrl: string): Plugin => {
  const supabase = new URL(supabaseUrl);
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${supabase.origin} wss://${supabase.host} https://www.googleapis.com`,
    "frame-src https://www.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  return {
    name: "security-headers",
    apply: "build",
    transformIndexHtml: () => [
      { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: csp }, injectTo: "head-prepend" },
      { tag: "meta", attrs: { name: "referrer", content: "strict-origin-when-cross-origin" }, injectTo: "head-prepend" },
    ],
  };
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    base: "/park-inn-bookings/",
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), securityHeaders(env.VITE_SUPABASE_URL)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
