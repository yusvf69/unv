export const AR_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const AR_SHORT_DAYS = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
export const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "إبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
export const AR_SHORT_MONTHS = [
  "يناير", "فبراير", "مارس", "إبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export const JS_TO_AR_DAY: Record<number, string> = { 0: "الأحد", 1: "الاثنين", 2: "الثلاثاء", 3: "الأربعاء", 4: "الخميس", 5: "الجمعة", 6: "السبت" };

export function formatDate(date: Date): string {
  const d = date.getDate();
  const m = AR_MONTHS[date.getMonth()];
  const y = date.getFullYear();
  return `${d} ${m} ${y}`;
}

export function formatDateFull(date: Date): string {
  const day = JS_TO_AR_DAY[date.getDay()];
  const d = date.getDate();
  const m = AR_MONTHS[date.getMonth()];
  const y = date.getFullYear();
  return `${day}، ${d} ${m} ${y}`;
}

export function formatMonth(date: Date): string {
  const m = AR_MONTHS[date.getMonth()];
  const y = date.getFullYear();
  return `${m} ${y}`;
}

export function formatShortDate(date: Date): string {
  const d = date.getDate();
  const m = AR_SHORT_MONTHS[date.getMonth()];
  return `${d} ${m}`;
}

export function formatShortDateYear(date: Date): string {
  const d = date.getDate();
  const m = AR_SHORT_MONTHS[date.getMonth()];
  const y = date.getFullYear();
  return `${d} ${m} ${y}`;
}

export function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function formatTimeWithWeekday(date: Date): string {
  const day = JS_TO_AR_DAY[date.getDay()];
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m} ${day}`;
}

export function formatShortMonth(date: Date): string {
  return AR_SHORT_MONTHS[date.getMonth()];
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function formatISODate(iso: string): string {
  return formatDate(new Date(iso));
}

export function formatISOTime(iso: string): string {
  return formatTime(new Date(iso));
}

export function formatISODateTime(iso: string): string {
  return formatDateTime(new Date(iso));
}
