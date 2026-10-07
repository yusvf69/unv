export const AD_CLIENT = "ca-pub-2720033869750214";
export const AD_SLOTS = {
  homeFeed: "REPLACE_WITH_SLOT_ID",
  newsList: "REPLACE_WITH_SLOT_ID",
  newsDetail: "REPLACE_WITH_SLOT_ID",
} as const;

export type AdSlotKey = keyof typeof AD_SLOTS;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let loading: Promise<void> | null = null;

export function loadAdSenseScript(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (loading) return loading;
  if (document.querySelector(`script[src*="adsbygoogle.js"]`)) return Promise.resolve();

  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      window.adsbygoogle = window.adsbygoogle || [];
      resolve();
    };
    script.onerror = () => {
      loading = null;
      reject(new Error("Failed to load AdSense script"));
    };
    document.head.appendChild(script);
  });

  return loading;
}

export function pushAd(): void {
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch {
    // ignore — ads are best-effort and must never break the UI
  }
}