const STORAGE_KEY = "unv_offline_summaries";

export interface OfflineSummary {
  lessonId: number;
  lessonTitle: string;
  trackTitle: string;
  summary: string;
  savedAt: string;
}

export function saveSummaryOffline(summary: OfflineSummary) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: OfflineSummary[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((s) => s.lessonId === summary.lessonId);
    if (idx >= 0) list[idx] = summary;
    else list.push(summary);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch { return false; }
}

export function getOfflineSummaries(): OfflineSummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function removeOfflineSummary(lessonId: number) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: OfflineSummary[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.filter((s) => s.lessonId !== lessonId)));
  } catch {}
}
