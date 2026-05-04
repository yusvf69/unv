import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./components/theme-provider";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import "./index.css";

setAuthTokenGetter(() => {
  try {
    return localStorage.getItem("uv_token");
  } catch {
    return null;
  }
});

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
