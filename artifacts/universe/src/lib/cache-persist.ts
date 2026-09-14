import type { QueryClient } from "@tanstack/react-query";

const CACHE_PREFIX = "unv-qcache:v5:";
const MAX_ENTRIES = 80;
const MAX_ENTRY_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 3.5 * 1024 * 1024;

function namespace(): string {
  if (typeof window === "undefined") return "anon";
  const token = localStorage.getItem("uv_token");
  return token ? token.slice(-16) : "anon";
}

function storageKey(): string {
  return `${CACHE_PREFIX}${namespace()}`;
}

interface PersistedEntry {
  key: string;
  data: unknown;
  updatedAt: number;
}

function isSkippable(key: readonly unknown[]): boolean {
  if (!key || key.length === 0) return true;
  if (key[0] === "v2" && key[1] === "dm") return false;
  if (key[0] === "v2" && key[1] === "quiz" && key[2] === "start") return true;
  if (key[0] === "v2" && key[1] === "admin" && (key[2] === "group-schedule" || key[2] === "exam-schedule" || key[2] === "retake-courses")) return true;
  if (key[0] === "v2" && (key[1] === "group-schedule" || key[1] === "exam-schedule")) return true;
  if (key[0] === "v2" && (key[1] === "my-retakes" || key[1] === "retake-options")) return true;
  return false;
}

export function loadCache(queryClient: QueryClient): void {
  if (typeof window === "undefined") return;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(storageKey());
  } catch {}
  if (!raw) return;
  let entries: PersistedEntry[] = [];
  try {
    entries = JSON.parse(raw);
  } catch {}
  for (const e of entries) {
    if (!e || typeof e.key !== "string") continue;
    let key: unknown[] = [];
    try {
      key = JSON.parse(e.key);
    } catch {
      continue;
    }
    if (!Array.isArray(key) || isSkippable(key)) continue;
    if (e.data === null || e.data === undefined) continue;
    queryClient.setQueryData(key, e.data, { updatedAt: e.updatedAt || Date.now() });
  }
}

export function clearPersistedCache(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey());
  } catch {}
}

export function setupCachePersistence(queryClient: QueryClient): void {
  if (typeof window === "undefined") return;

  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    let prev: PersistedEntry[] = [];
    try {
      const raw = localStorage.getItem(storageKey());
      if (raw) prev = JSON.parse(raw);
    } catch {}
    const map = new Map<string, PersistedEntry>(prev.filter((e) => e && typeof e.key === "string").map((e) => [e.key, e]));

    let any = false;
    for (const query of queryClient.getQueryCache().getAll()) {
      if (query.state.status !== "success") continue;
      if (isSkippable(query.queryKey)) continue;
      const data = query.state.data;
      if (data === null || data === undefined) continue;
      let bytes = 0;
      try {
        bytes = new Blob([JSON.stringify(data)]).size;
      } catch {
        bytes = Infinity;
      }
      if (bytes > MAX_ENTRY_BYTES) continue;
      let key = "";
      try {
        key = JSON.stringify(query.queryKey);
      } catch {
        continue;
      }
      map.set(key, { key, data, updatedAt: query.state.dataUpdatedAt || Date.now() });
      any = true;
    }
    let kept = Array.from(map.values()).slice(-MAX_ENTRIES);
    let total = 0;
    for (const e of kept) {
      try {
        total += new Blob([JSON.stringify(e.data)]).size;
      } catch {
        total = Infinity;
      }
    }
    if (total > MAX_TOTAL_BYTES) {
      kept = kept
        .map((e) => ({ e, b: JSON.stringify(e.data).length }))
        .sort((a, c) => a.b - c.b)
        .reduce<PersistedEntry[]>((acc, { e }) => {
          const b = acc.reduce((s, x) => s + JSON.stringify(x.data).length, 0);
          if (b + JSON.stringify(e.data).length <= MAX_TOTAL_BYTES) acc.push(e);
          return acc;
        }, []);
    }
    if (any && kept.length) {
      try {
        localStorage.setItem(storageKey(), JSON.stringify(kept));
      } catch {}
    }
  };

  const schedule = () => {
    if (timer) return;
    timer = setTimeout(flush, 600);
  };

  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "added" && event.type !== "updated") return;
    if (!event.query || event.query.state.status !== "success") return;
    if (event.query.queryKey.length === 0) return;
    schedule();
  });

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }

  schedule();
}