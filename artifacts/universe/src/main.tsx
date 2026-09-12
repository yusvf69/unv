import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./components/theme-provider";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import "./index.css";

const DEMO_EMAIL = "youssef@test.com";

setAuthTokenGetter(() => {
  try {
    return localStorage.getItem("uv_token");
  } catch {
    return null;
  }
});

(async () => {
  // Auto demo-login is a dev convenience only; in production the user must
  // opt in via the demo button on the login page.
  if (!import.meta.env.DEV) return;
  try {
    if (localStorage.getItem("uv_token")) return;
    if (localStorage.getItem("uv_demo_enabled") === "0") return;
    const base =
      (window as any).__API_BASE__ ||
      import.meta.env.VITE_API_URL ||
      "/api";
    fetch(`${base}/v2/auth/demo-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: DEMO_EMAIL }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.token) localStorage.setItem("uv_token", d.token);
      })
      .catch(() => {});
  } catch {}
})();

// Register service worker for offline support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
