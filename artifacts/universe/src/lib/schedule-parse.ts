export type ScheduleKind = "classes" | "exams";

export interface GroupScheduleImportRow {
  groupName: string;
  yearInCollege: number;
  day: string;
  startTime: string;
  endTime: string;
  courseTitle: string;
  courseCode: string;
  instructor: string;
  room: string;
  type: string;
}

export interface ExamScheduleImportRow {
  groupName: string;
  yearInCollege: number;
  day: string;
  date: string;
  time: string;
  courseTitle: string;
  courseCode: string;
  room: string;
  type: string;
}

export interface ImportResult {
  classes?: GroupScheduleImportRow[];
  exams?: ExamScheduleImportRow[];
  errors: string[];
  skipped: string[];
  groupCounts: Record<string, number>;
}

export interface CourseImportRow {
  title: string;
  code: string;
  description?: string;
  credits: number;
  department: string;
  yearInCollege: number;
  semester: number;
}

export interface CourseImportResult {
  rows: CourseImportRow[];
  errors: string[];
  skipped: string[];
}

const COURSE_DEPT_HINTS = /القسم|السنة|الترم|الساعات|الكود|العنوان|المقرر|الماده|المادة|نوع/;

export function parseCoursesText(text: string): CourseImportResult {
  const res: CourseImportResult = { rows: [], errors: [], skipped: [] };
  const lines = text.split(/\r?\n/);

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    if (!raw.trim()) continue;
    if (SEP_LINE.test(raw)) continue;
    if (/^[#/]/.test(raw.trim())) continue;
    const parts = splitLine(raw);
    if (parts.length >= 2 && COURSE_DEPT_HINTS.test(parts[0] + " " + (parts[1] || "")) && parts.length >= 5) continue;
    const lineNo = idx + 1;
    if (parts.length < 2) {
      res.skipped.push(`سطر ${lineNo}: مش مكتمل — محتاج كود وعنوان على الأقل`);
      continue;
    }
    const code = normCode(parts[0]);
    const title = str(parts[1]);
    if (!code) { res.skipped.push(`سطر ${lineNo}: الكود غلط ("${parts[0]}")`); continue; }
    if (!title) { res.skipped.push(`سطر ${lineNo}: اكتب عنوان المقرر`); continue; }
    const year = Number(String(parts[2] ?? "").replace(/^سنة\s*/i, "")) || 1;
    const semester = Number(parts[3] ?? "") || 1;
    const credits = Number(parts[4] ?? "") || 3;
    const department = str(parts[5]);
    res.rows.push({ title, code, credits, department, yearInCollege: Math.min(4, Math.max(1, year)), semester: semester === 2 ? 2 : 1 });
  }

  return res;
}

const GROUPS = ["A", "B", "C", "D", "E"];
const YEARS = [1, 2, 3, 4];
const DAY_NORMAL: Record<string, string> = {
  "السبت": "السبت", "الاحد": "الأحد", "الأحد": "الأحد",
  "الاثنين": "الاثنين", "الخميس": "الخميس", "الثلاثاء": "الثلاثاء",
  "الاربعاء": "الأربعاء", "الأربعاء": "الأربعاء", "الجمعة": "الجمعة",
};
const HDR_HINTS = /المجموعة|السنة|اليوم|المادة|الوقت|من\s*الى|الى|إلى|امتحان|المحاضرة|القاعة|الكود|كود|جدول|التاريخ|التوقيت/;
const SEP_LINE = /^[\s\-=_+|:.،,·]+$/;

const TYPE_CLASS: Record<string, string> = {
  "محاضرة": "lecture", "lectures": "lecture", "lecture": "lecture",
  "معمل": "lab", "lab": "lab", "مختبر": "lab",
  "تدريب": "practical", "تدريب عملي": "practical", "عملي": "practical", "practical": "practical",
};

const TYPE_EXAM: Record<string, string> = {
  "نصفي": "midterm", "midterm": "midterm", "منتصف": "midterm", "منتصف الفصل": "midterm",
  "نهائي": "final", "final": "final", "نهائية": "final",
  "اختبار": "quiz", "quiz": "quiz", "اختبار قصير": "quiz", "كويز": "quiz",
  "عملي": "practical", "practical": "practical",
};

const ALL_MARK = new Set(["all", "الكل", "كل", "*", "كل الشعب", "all_groups"]);

function normDay(d: string): string | null {
  const key = d.trim().replace(/\s+/g, "");
  return DAY_NORMAL[key] || null;
}

function normTime(t: string): string | null {
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  if (h < 0 || h > 23) return null;
  return `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
}

function splitRange(field: string): string[] | null {
  const m = /^(\d{1,2}(?::\d{2})?)\s*(?:-|–|—|الى|إلى|to)\s*(\d{1,2}(?::\d{2})?)$/i.exec(field.trim());
  if (!m) return null;
  const a = normTime(m[1]);
  const b = normTime(m[2]);
  return a && b ? [a, b] : null;
}

function str(v: string | number | null | undefined): string {
  return String(v ?? "").trim();
}

function normCode(code: string): string {
  const c = code.trim();
  return c && c !== "-" && c !== "—" && c.toLowerCase() !== "null" ? c : "";
}

function splitLine(line: string): string[] {
  const t = line.trim();
  if (t.includes(",") || t.includes("،") || t.includes("|")) return t.split(/[,،|]/).map((s) => s.trim()).filter(Boolean);
  if (t.includes("\t")) return t.split(/\t+/).map((s) => s.trim()).filter(Boolean);
  const parts = t.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 5) return parts;
  return t.split(/\s+/).map((s) => s.trim()).filter(Boolean);
}

function parseGroup(g: string, res: ImportResult, lineNo: number): string[] | null {
  const s = g.trim();
  if (ALL_MARK.has(s)) return GROUPS;
  if (/^[A-Ea-e]$/.test(s)) return [s.toUpperCase()];
  const m = s.match(/شعبة\s*([A-Ea-e])/i);
  if (m) return [m[1].toUpperCase()];
  res.errors.push(`سطر ${lineNo}: المجموعة غير معروفة (${s}) — استخدم A–E أو *`);
  return null;
}

function parseYear(y: string, res: ImportResult, lineNo: number): number[] | null {
  const s = y.trim().toLowerCase().replace(/^سنة\s*/i, "");
  if (ALL_MARK.has(s)) return YEARS;
  const m = /^\d+$/.exec(s);
  if (!m) {
    res.errors.push(`سطر ${lineNo}: السنة غير معروفة (${y})`);
    return null;
  }
  const n = Number(m[0]);
  if (n < 1 || n > 4) {
    res.errors.push(`سطر ${lineNo}: السنة لازم تكون 1–4 (${y})`);
    return null;
  }
  return [n];
}

function isHeaderLike(raw: string): boolean {
  const parts = splitLine(raw);
  if (parts.length <= 3) return HDR_HINTS.test(raw);
  let hits = 0;
  for (const p of parts) if (HDR_HINTS.test(p)) hits++;
  return hits >= 3;
}

export function parseScheduleText(text: string, mode: ScheduleKind): ImportResult {
  const res: ImportResult = { errors: [], skipped: [], groupCounts: {} };
  const lines = text.split(/\r?\n/);

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    if (!raw.trim()) continue;
    if (SEP_LINE.test(raw)) continue;
    if (/^[#/]/.test(raw.trim())) continue;
    if (isHeaderLike(raw)) continue;

    const f = splitLine(raw);
    const lineNo = idx + 1;
    const pushRow = (g: string, y: number, row: any) => {
      const target = mode === "classes" ? (res.classes ??= []) : (res.exams ??= []);
      target.push(row);
      res.groupCounts[g] = (res.groupCounts[g] || 0) + 1;
    };

    if (mode === "classes") {
      const groups = parseGroup(f[0] ?? "", res, lineNo);
      const years = parseYear(f[1] ?? "", res, lineNo);
      const day = normDay(f[2] ?? "");
      if (!groups || !years) continue;
      if (!day) { res.errors.push(`سطر ${lineNo}: اليوم غير معروف ("${f[2]}")`); continue; }

      let s: string | null = null, e: string | null = null, title: string;
      const range = splitRange(f[3] ?? "");
      if (range) {
        [s, e] = range;
        title = f[4] ?? "";
        const code = normCode(f[5] ?? "");
        const type = TYPE_CLASS[f[8]?.trim().toLowerCase()] || TYPE_CLASS[f[7]?.trim().toLowerCase()] || "lecture";
        const instructor = str(f[6]) || "—";
        const room = str(f[7]) || "—";
        if (!title) { res.errors.push(`سطر ${lineNo}: اكتب عنوان المادة`); continue; }
        for (const g2 of groups) for (const y2 of years) {
          pushRow(g2, y2, { groupName: g2, yearInCollege: y2, day, startTime: s!, endTime: e!, courseTitle: title, courseCode: code, instructor, room, type });
        }
        continue;
      }

      s = normTime(f[3] ?? "");
      e = normTime(f[4] ?? "");
      title = f[5] ?? "";
      const code = normCode(f[6] ?? "");
      const instr = str(f[7]) || "—";
      const room = str(f[8]) || "—";
      const type = TYPE_CLASS[f[9]?.trim().toLowerCase()] || "lecture";
      if (!s || !e) { res.errors.push(`سطر ${lineNo}: الوقت مكتوب غلط ("${f[3]} / ${f[4]}")`); continue; }
      if (!title) { res.errors.push(`سطر ${lineNo}: اكتب عنوان المادة`); continue; }
      for (const g2 of groups) for (const y2 of years) {
        pushRow(g2, y2, { groupName: g2, yearInCollege: y2, day, startTime: s, endTime: e, courseTitle: title, courseCode: code, instructor: instr, room, type });
      }
    } else {
      const groups = parseGroup(f[0] ?? "", res, lineNo);
      const years = parseYear(f[1] ?? "", res, lineNo);
      const day = normDay(f[2] ?? "");
      if (!groups || !years) continue;
      if (!day) { res.errors.push(`سطر ${lineNo}: اليوم غير معروف ("${f[2]}")`); continue; }
      const date = f[3] ?? "";
      const time = normTime(f[4] ?? "");
      const title = f[5] ?? "";
      const code = normCode(f[6] ?? "");
      const room = str(f[7]) || "—";
      const type = TYPE_EXAM[f[8]?.trim().toLowerCase()] || "midterm";
      if (!date) { res.errors.push(`سطر ${lineNo}: اكتب التاريخ (YYYY-MM-DD)`); continue; }
      if (!time) { res.errors.push(`سطر ${lineNo}: الوقت مكتوب غلط ("${f[4]}")`); continue; }
      if (!title) { res.errors.push(`سطر ${lineNo}: اكتب عنوان المادة`); continue; }
      for (const g2 of groups) for (const y2 of years) {
        pushRow(g2, y2, { groupName: g2, yearInCollege: y2, day, date, time, courseTitle: title, courseCode: code, room, type });
      }
    }
  }

  return res;
}