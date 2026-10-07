import { useEffect } from "react";
import { loadAdSenseScript } from "@/lib/ads";

/**
 * Loads the AdSense (Auto Ads) script exactly once, and only when called.
 * Screens without publisher content (login, 404, loading, redirects) must
 * never call this — AdSense policy forbids ads on those screens.
 */
export function loadAdSense(): void {
  loadAdSenseScript().catch(() => {});
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