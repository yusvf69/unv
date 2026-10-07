import { useEffect } from "react";

const AD_CLIENT = "ca-pub-2720033869750214";
const SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;

let injected = false;

/**
 * Loads the AdSense (Auto Ads) script exactly once, and only when called.
 * Screens without publisher content (login, 404, loading, redirects) must
 * never call this — AdSense policy forbids ads on those screens.
 */
export function loadAdSense(): void {
  if (injected || typeof document === "undefined") return;
  if (document.querySelector(`script[src*="adsbygoogle.js"]`)) {
    injected = true;
    return;
  }
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = SCRIPT_SRC;
  document.head.appendChild(script);
  injected = true;
}

/**
 * Enables AdSense when `enabled` is true — i.e. when the screen actually
 * shows content. Pass false (or omit) on login/404/loading screens.
 */
export function useAdSense(enabled = true): void {
  useEffect(() => {
    if (enabled) loadAdSense();
  }, [enabled]);
}
