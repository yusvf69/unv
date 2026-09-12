import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Calendar, FileText, Clock, Award, Upload, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useMeV2, useAdminGroupSchedule, useAddGroupScheduleRow, useDeleteGroupScheduleRow, useUpdateGroupScheduleRow,
  useImportGroupSchedule, useAdminExamSchedule, useAddExamScheduleRow, useDeleteExamScheduleRow, useUpdateExamScheduleRow,
  useImportExamSchedule, type GroupScheduleRow, type ExamScheduleRow,
} from "@/lib/api";
import { parseScheduleText, type ScheduleKind } from "@/lib/schedule-parse";
import { useToast } from "@/hooks/use-toast";

const DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const JS_TO_AR: Record<number, string> = { 6: "السبت", 0: "الأحد", 1: "الاثنين", 2: "الثلاثاء", 3: "الأربعاء", 4: "الخميس", 5: "الجمعة" };
const GROUPS = ["A", "B", "C", "D", "E"];
const YEARS = [1, 2, 3, 4];

const TEMPLATE_CLASSES = `A, 1, السبت, 08:00-10:00, رياضيات, AGR101, د. أحمد, قاعة 3, محاضرة
A, 1, الأحد, 10:00, 12:00, فيزياء, PHY102, د. سارة, معمل 2, معمل
*, 2, الاثنين, 09:00, 11:00, لغة إنجليزية, ENG201, د. منى, قاعة 5`;

const TEMPLATE_EXAMS = `A, 1, السبت, 2026-01-10, 09:00, رياضيات, AGR101, قاعة 3, نصفي
*, 2, الأحد, 2026-01-15, 11:00, كيمياء, CHM102, معمل 1, نهائي`;

function ImportScheduleDialog({ open, onOpenChange, mode }: { open: boolean; onOpenChange: (v: boolean) => void; mode: ScheduleKind }) {
  const { toast } = useToast();
  const importC = useImportGroupSchedule();
  const importE = useImportExamSchedule();
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseScheduleText(text, mode), [text, mode]);
  const rowsCount = mode === "classes" ? (parsed.classes?.length ?? 0) : (parsed.exams?.length ?? 0);
  const mutation = mode === "classes" ? importC : importE;

  const submit = async () => {
    if (rowsCount === 0) {
      toast({ title: "مافيش صفوف متظاهرة — راجع الأخطاء", variant: "destructive" });
      return;
    }
    const rows = mode === "classes" ? parsed.classes : parsed.exams;
    try {
      const r = await mutation.mutateAsync(rows as any);
      toast({ title: `أُضيف ${(r as any)?.inserted ?? rowsCount} عنصر للجدول` });
      setText("");
      onOpenChange(false);
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader><DialogTitle className="text-base sm:text-lg">{mode === "classes" ? "استيراد جدول المحاضرات من نص" : "استيراد جدول الامتحانات من نص"}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[65vh] overflow-y-auto pe-2">
          <div className="bg-muted/50 border rounded-lg p-3 text-[11px] leading-relaxed text-muted-foreground">
            <p className="font-bold text-foreground mb-1">الطريقة — كل سطر عنصر واحد، الفواصل بـ (فاصلة أو | أو تبويب أو مسافتين):</p>
            <pre dir="ltr" className="text-[10px] overflow-x-auto">{(mode === "classes" ? TEMPLATE_CLASSES : TEMPLATE_EXAMS).trim()}</pre>
            <p className="mt-1.5">المجموعة (A–E أو <b className="text-foreground">*</b> لكل الشعب) · السنة (1–4 أو <b className="text-foreground">*</b> لكل السنوات) · اليوم · الوقت · عنوان المادة — و الباقي اختياري (كود، محاضر، قاعة، النوع). الوقت ممكن `08:00-10:00` أو عمودين `08:00, 10:00`.</p>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            dir="rtl"
            className="text-sm font-mono"
            placeholder={mode === "classes" ? "A, 1, السبت, 08:00-10:00, رياضيات, AGR101, د. أحمد, قاعة 3" : "A, 1, السبت, 2026-01-10, 09:00, رياضيات, AGR101, قاعة 3, نصفي"}
          />
          {text.trim() && (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs">
                {rowsCount > 0 ? <span className="font-bold text-primary">{rowsCount} عنصر جاهز</span> : <span className="text-destructive font-bold">مفيش عناصر مفهومة</span>}
                {Object.keys(parsed.groupCounts).length > 0 && (
                  <span className="text-muted-foreground ms-2">التوزيع: {Object.entries(parsed.groupCounts).map(([g, n]) => `G${g} ×${n}`).join(" · ")}</span>
                )}
              </div>
              <Button onClick={submit} disabled={mutation.isPending || rowsCount === 0} size="sm" className="text-xs">
                {mutation.isPending ? "جاري الحفظ..." : <><Upload className="me-2 h-3.5 w-3.5" /> إضافة للجدول</>}
              </Button>
            </div>
          )}
          {parsed.errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive rounded-lg p-3">
              <p className="text-xs font-bold text-destructive mb-1">خطأ في بعض السطور (لـ {parsed.errors.length}):</p>
              <ul className="text-[11px] text-destructive/90 list-disc ps-4 space-y-0.5 max-h-28 overflow-y-auto">
                {parsed.errors.slice(0, 12).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)} className="text-xs sm:text-sm">إلغاء</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminSchedule() {
  const { data: me } = useMeV2();
  const [tab, setTab] = useState<"classes" | "exams">("classes");

  if (!me || (me.role !== "admin" && me.role !== "super_admin")) {
    return <div className="p-12 text-center text-muted-foreground">صلاحياتك غير كافية</div>;
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl font-serif font-bold flex items-center gap-2"><Calendar className="h-5 w-5 sm:h-7 sm:w-7" /> إدارة الجداول</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">حدّد جداول المحاضرات والامتحانات لكل مجموعة وسنة</p>
      </motion.div>

      <div className="flex gap-2 mb-4 sm:mb-6 flex-wrap">
        <button
          onClick={() => setTab("classes")}
          className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 transition ${tab === "classes" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
        >
          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> جدول المحاضرات
        </button>
        <button
          onClick={() => setTab("exams")}
          className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 transition ${tab === "exams" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
        >
          <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> جدول الامتحانات
        </button>
      </div>

      {tab === "classes" ? <ClassScheduleTab /> : <ExamScheduleTab />}
    </div>
  );
}

function ClassScheduleTab() {
  const { data: rows = [] } = useAdminGroupSchedule();
  const add = useAddGroupScheduleRow();
  const del = useDeleteGroupScheduleRow();
  const update = useUpdateGroupScheduleRow();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTargets, setEditTargets] = useState<GroupScheduleRow[] | null>(null);
  const [filterGroup, setFilterGroup] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [form, setForm] = useState({
    groupName: "A", yearInCollege: 1, day: "السبت", startTime: "08:00", endTime: "10:00",
    courseTitle: "", courseCode: "", instructor: "", room: "", type: "lecture",
    allGroups: false, allYears: false,
  });

  const filtered = rows.filter((r) => (!filterGroup || r.groupName === filterGroup) && (!filterYear || r.yearInCollege === filterYear));

  const grouped = useMemo(() => {
    const m = new Map<string, { rows: GroupScheduleRow[]; groups: Set<string> }>();
    for (const r of filtered) {
      const key = `${r.day}|${r.startTime}|${r.endTime}|${r.courseTitle}|${r.room}|${r.yearInCollege}`;
      let g = m.get(key);
      if (!g) { g = { rows: [], groups: new Set() }; m.set(key, g); }
      g.rows.push(r);
      g.groups.add(r.groupName);
    }
    return [...m.values()].map((g) => ({ ...g, key: g.rows[0], groupsSorted: [...g.groups].sort() }));
  }, [filtered]);

  const openAdd = () => {
    setEditTargets(null);
    setForm({
      groupName: "A", yearInCollege: 1, day: "السبت", startTime: "08:00", endTime: "10:00",
      courseTitle: "", courseCode: "", instructor: "", room: "", type: "lecture",
      allGroups: !!filterGroup ? false : true, allYears: false,
    });
    setOpen(true);
  };

  const rowKey = (r: GroupScheduleRow) => `${r.day}|${r.startTime}|${r.endTime}|${r.courseTitle}|${r.room}|${r.yearInCollege}`;

  const openEdit = (r: GroupScheduleRow) => {
    setForm({
      groupName: r.groupName, yearInCollege: r.yearInCollege, day: r.day,
      startTime: r.startTime.slice(0, 5), endTime: r.endTime.slice(0, 5),
      courseTitle: r.courseTitle, courseCode: r.courseCode ?? "", instructor: r.instructor === "—" ? "" : r.instructor,
      room: r.room === "—" ? "" : r.room, type: r.type, allGroups: true, allYears: false,
    });
    setEditTargets(filtered.filter((x) => rowKey(x) === rowKey(r)));
    setOpen(true);
  };

  const submit = async () => {
    if (!form.courseTitle || !form.instructor || !form.room) {
      toast({ title: "املأ الحقول الأساسية", variant: "destructive" });
      return;
    }
    const body: any = {
      groupName: form.groupName, yearInCollege: form.yearInCollege, day: form.day,
      startTime: form.startTime, endTime: form.endTime, courseTitle: form.courseTitle,
      courseCode: form.courseCode, instructor: form.instructor, room: form.room, type: form.type,
    };
    const targets = editTargets ? (form.allGroups ? editTargets : editTargets.slice(0, 1)) : null;
    try {
      if (targets?.length) {
        await Promise.all(targets.map((t) => update.mutateAsync({ id: t.id, ...body })));
        toast({ title: targets.length > 1 ? "تم تعديل كل الشعب" : "تم تعديل المحاضرة" });
      } else {
        await add.mutateAsync(form.allGroups || form.allYears ? { ...body, allGroups: form.allGroups, allYears: form.allYears } : body);
        toast({ title: form.allGroups || form.allYears ? "أُضيف لكل الشعب/السنوات المختارة" : "أُضيف للجدول" });
      }
      setOpen(false);
      setEditTargets(null);
      setForm({ ...form, courseTitle: "", courseCode: "", instructor: "", room: "" });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2">
        <div className="flex gap-1.5 sm:gap-2 flex-wrap p-2 sm:p-3 bg-card border rounded-xl">
          <span className="text-[10px] sm:text-xs font-bold self-center">المجموعة:</span>
          <Button size="sm" variant={!filterGroup ? "default" : "outline"} onClick={() => setFilterGroup(null)} className="h-7 sm:h-8 text-[10px] sm:text-xs">الكل</Button>
          {GROUPS.map((g) => <Button key={g} size="sm" variant={filterGroup === g ? "default" : "outline"} onClick={() => setFilterGroup(g)} className="h-7 sm:h-8 text-[10px] sm:text-xs">{g}</Button>)}
          <span className="text-[10px] sm:text-xs font-bold self-center ms-2 sm:ms-4">السنة:</span>
          <Button size="sm" variant={!filterYear ? "default" : "outline"} onClick={() => setFilterYear(null)} className="h-7 sm:h-8 text-[10px] sm:text-xs">الكل</Button>
          {YEARS.map((y) => <Button key={y} size="sm" variant={filterYear === y ? "default" : "outline"} onClick={() => setFilterYear(y)} className="h-7 sm:h-8 text-[10px] sm:text-xs">{y}</Button>)}
        </div>
        <Button className="ms-3 h-8 sm:h-9 text-xs sm:text-sm" onClick={openAdd}><Plus className="me-2 h-3 w-3 sm:h-4 sm:w-4" /> محاضرة جديدة</Button>
        <Button variant="outline" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={() => { setImportOpen(true); setOpen(false); }}><FileText className="me-2 h-3 w-3 sm:h-4 sm:w-4" /> استيراد من نص</Button>
      </div>

      {!grouped.length && <p className="text-center text-muted-foreground py-8 sm:py-12 text-sm">لا توجد محاضرات في الجدول.</p>}

      <div className="space-y-2">
        {grouped.map((g, i) => {
          const r = g.rows[0];
          return (
            <motion.div key={g.key.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="bg-card border rounded-xl p-2 sm:p-3 flex flex-col sm:flex-row items-start gap-2 sm:gap-3 flex-wrap">
              <div className="bg-primary/10 text-primary font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm">{r.day}</div>
              <div className="text-xs sm:text-sm font-mono">{g.rows.length > 1 ? `${r.startTime} - ${r.endTime}` : `${r.startTime} - ${r.endTime}`}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs sm:text-sm">{r.courseTitle} {r.courseCode && <span className="text-xs text-muted-foreground">({r.courseCode})</span>}</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">د. {r.instructor} · {r.room}</div>
              </div>
              <div className="flex gap-1 sm:gap-1.5 items-center">
                <span className="text-[10px] sm:text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-bold">{g.groupsSorted.length === 1 ? `G${g.groupsSorted[0]}` : `G ${g.groupsSorted.join("،")}`}</span>
                <span className="text-[10px] sm:text-xs bg-accent/30 text-accent-foreground px-2 py-0.5 rounded-full">سنة {r.yearInCollege}</span>
                <span className="text-[10px] sm:text-xs bg-muted px-2 py-0.5 rounded-full">{r.type === "lab" ? "معمل" : r.type === "lecture" ? "محاضرة" : "تدريب"}</span>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(r)} className="h-7 w-7 sm:h-8 sm:w-8" title="تعديل">
                  <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => Promise.all(g.rows.map((x) => del.mutateAsync(x.id))).then(() => toast({ title: "تم الحذف" }))} className="h-7 w-7 sm:h-8 sm:w-8" title="حذف">
                  <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditTargets(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh]">
          <DialogHeader><DialogTitle className="text-base sm:text-lg">{editTargets ? "تعديل محاضرة" : "إضافة محاضرة للجدول"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pe-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">المجموعة</Label>
                <select value={form.groupName} onChange={(e) => setForm({ ...form, groupName: e.target.value })} disabled={form.allGroups} className="w-full h-9 rounded-md border bg-background px-3 text-sm disabled:opacity-50">
                  {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">السنة</Label>
                <select value={form.yearInCollege} onChange={(e) => setForm({ ...form, yearInCollege: Number(e.target.value) })} disabled={form.allYears} className="w-full h-9 rounded-md border bg-background px-3 text-sm disabled:opacity-50">
                  {YEARS.map((y) => <option key={y} value={y}>السنة {y}</option>)}
                </select>
              </div>
            </div>
            {!editTargets && (
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer bg-primary/5 border rounded-lg px-3 py-2">
                  <input type="checkbox" checked={form.allGroups} onChange={(e) => setForm({ ...form, allGroups: e.target.checked })} className="h-4 w-4 accent-primary" />
                  لكل الشعب (A–E)
                </label>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer bg-primary/5 border rounded-lg px-3 py-2">
                  <input type="checkbox" checked={form.allYears} onChange={(e) => setForm({ ...form, allYears: e.target.checked })} className="h-4 w-4 accent-primary" />
                  لكل السنوات (1–4)
                </label>
                {form.allGroups && <span className="text-[10px] text-muted-foreground self-center">المحاضرة هتتضاف لكل الشعب مع نفس الوقت</span>}
              </div>
            )}
            {editTargets && (
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer bg-primary/5 border rounded-lg px-3 py-2">
                  <input type="checkbox" checked={form.allGroups} onChange={(e) => setForm({ ...form, allGroups: e.target.checked })} className="h-4 w-4 accent-primary" />
                  تطبيق التعديل على كل الشعب المرتبطين
                </label>
                {form.allGroups ? <span className="text-[10px] text-muted-foreground self-center">كل الشعب ليها نفس الموعد ده</span> : <span className="text-[10px] text-muted-foreground self-center">هيتعدل بس على المجموعة {form.groupName}</span>}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">اليوم</Label>
                <select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">من</Label><Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="h-9 text-sm" /></div>
              <div><Label className="text-xs">إلى</Label><Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="h-9 text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">عنوان المادة</Label><Input value={form.courseTitle} onChange={(e) => setForm({ ...form, courseTitle: e.target.value })} className="h-9 text-sm" /></div>
              <div><Label className="text-xs">كود المادة</Label><Input value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} placeholder="AGR101" className="h-9 text-sm" /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2"><Label className="text-xs">المحاضر</Label><Input value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} className="h-9 text-sm" /></div>
              <div><Label className="text-xs">القاعة</Label><Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="h-9 text-sm" /></div>
            </div>
            <div>
              <Label className="text-xs">النوع</Label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                <option value="lecture">محاضرة</option>
                <option value="lab">معمل</option>
                <option value="practical">تدريب عملي</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-xs sm:text-sm">إلغاء</Button>
            <Button onClick={submit} disabled={add.isPending || update.isPending} className="text-xs sm:text-sm">{add.isPending || update.isPending ? "جاري..." : editTargets ? <><Pencil className="me-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> حفظ التعديل</> : <><Plus className="me-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> إضافة</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImportScheduleDialog open={importOpen} onOpenChange={setImportOpen} mode="classes" />
    </>
  );
}

function ExamScheduleTab() {
  const { data: rows = [] } = useAdminExamSchedule();
  const add = useAddExamScheduleRow();
  const del = useDeleteExamScheduleRow();
  const update = useUpdateExamScheduleRow();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTargets, setEditTargets] = useState<ExamScheduleRow[] | null>(null);
  const [filterGroup, setFilterGroup] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [form, setForm] = useState({
    groupName: "A", yearInCollege: 1, day: "السبت", date: "", time: "09:00",
    courseTitle: "", courseCode: "", room: "", type: "midterm",
    allGroups: false, allYears: false,
  });

  const filtered = rows.filter((r) => (!filterGroup || r.groupName === filterGroup) && (!filterYear || r.yearInCollege === filterYear));

  const grouped = useMemo(() => {
    const m = new Map<string, { rows: ExamScheduleRow[]; groups: Set<string> }>();
    for (const r of filtered) {
      const key = `${r.day}|${r.time}|${r.courseTitle}|${r.room}|${r.yearInCollege}|${r.date}`;
      let g = m.get(key);
      if (!g) { g = { rows: [], groups: new Set() }; m.set(key, g); }
      g.rows.push(r);
      g.groups.add(r.groupName);
    }
    return [...m.values()].map((g) => ({ ...g, key: g.rows[0], groupsSorted: [...g.groups].sort() }));
  }, [filtered]);

  const rowKey = (r: ExamScheduleRow) => `${r.day}|${r.time}|${r.courseTitle}|${r.room}|${r.yearInCollege}|${r.date}`;

  const openEdit = (r: ExamScheduleRow) => {
    setForm({
      groupName: r.groupName, yearInCollege: r.yearInCollege, day: r.day, date: r.date,
      time: r.time.slice(0, 5), courseTitle: r.courseTitle, courseCode: r.courseCode ?? "",
      room: r.room ?? "", type: r.type, allGroups: true, allYears: false,
    });
    setEditTargets(filtered.filter((x) => rowKey(x) === rowKey(r)));
    setOpen(true);
  };

  const submit = async () => {
    if (!form.courseTitle || !form.room || !form.date) {
      toast({ title: "املأ الحقول الأساسية", variant: "destructive" });
      return;
    }
    const body: any = {
      groupName: form.groupName, yearInCollege: form.yearInCollege, day: form.day, date: form.date,
      time: form.time, courseTitle: form.courseTitle, courseCode: form.courseCode, room: form.room, type: form.type,
    };
    try {
      const targets = editTargets ? (form.allGroups ? editTargets : editTargets.slice(0, 1)) : null;
      if (targets?.length) {
        await Promise.all(targets.map((t) => update.mutateAsync({ id: t.id, ...body })));
        toast({ title: targets.length > 1 ? "تم تعديل كل الشعب" : "تم تعديل الامتحان" });
      } else {
        await add.mutateAsync(form.allGroups || form.allYears ? { ...body, allGroups: form.allGroups, allYears: form.allYears } : body);
        toast({ title: form.allGroups || form.allYears ? "أُضيف لكل الشعب/السنوات المختارة" : "أُضيف للجدول" });
      }
      setOpen(false);
      setEditTargets(null);
      setForm({ ...form, courseTitle: "", courseCode: "", room: "", date: "" });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2">
        <div className="flex gap-1.5 sm:gap-2 flex-wrap p-2 sm:p-3 bg-card border rounded-xl">
          <span className="text-[10px] sm:text-xs font-bold self-center">المجموعة:</span>
          <Button size="sm" variant={!filterGroup ? "default" : "outline"} onClick={() => setFilterGroup(null)} className="h-7 sm:h-8 text-[10px] sm:text-xs">الكل</Button>
          {GROUPS.map((g) => <Button key={g} size="sm" variant={filterGroup === g ? "default" : "outline"} onClick={() => setFilterGroup(g)} className="h-7 sm:h-8 text-[10px] sm:text-xs">{g}</Button>)}
          <span className="text-[10px] sm:text-xs font-bold self-center ms-2 sm:ms-4">السنة:</span>
          <Button size="sm" variant={!filterYear ? "default" : "outline"} onClick={() => setFilterYear(null)} className="h-7 sm:h-8 text-[10px] sm:text-xs">الكل</Button>
          {YEARS.map((y) => <Button key={y} size="sm" variant={filterYear === y ? "default" : "outline"} onClick={() => setFilterYear(y)} className="h-7 sm:h-8 text-[10px] sm:text-xs">{y}</Button>)}
        </div>
        <Button className="ms-3 h-8 sm:h-9 text-xs sm:text-sm" onClick={() => { setEditTargets(null); setForm({ groupName: "A", yearInCollege: 1, day: "السبت", date: "", time: "09:00", courseTitle: "", courseCode: "", room: "", type: "midterm", allGroups: false, allYears: false }); setOpen(true); }}><Plus className="me-2 h-3 w-3 sm:h-4 sm:w-4" /> امتحان جديد</Button>
        <Button variant="outline" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={() => { setImportOpen(true); setOpen(false); }}><FileText className="me-2 h-3 w-3 sm:h-4 sm:w-4" /> استيراد من نص</Button>
      </div>

      {!filtered.length && <p className="text-center text-muted-foreground py-8 sm:py-12 text-sm">لا توجد امتحانات في الجدول.</p>}

      <div className="space-y-2">
        {grouped.map((g, i) => {
          const r = g.rows[0];
          return (
            <motion.div key={g.key.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="bg-card border rounded-xl p-2 sm:p-3 flex flex-col sm:flex-row items-start gap-2 sm:gap-3 flex-wrap">
              <div className="bg-amber-500/10 text-amber-600 font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm">{r.day}</div>
              <div className="text-xs sm:text-sm font-mono">{r.time}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">{r.date}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs sm:text-sm">{r.courseTitle} {r.courseCode && <span className="text-xs text-muted-foreground">({r.courseCode})</span>}</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">{r.room}</div>
              </div>
              <div className="flex gap-1 sm:gap-1.5 items-center">
                <span className="text-[10px] sm:text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-bold">{g.groupsSorted.length === 1 ? `G${g.groupsSorted[0]}` : `G ${g.groupsSorted.join("،")}`}</span>
                <span className="text-[10px] sm:text-xs bg-accent/30 text-accent-foreground px-2 py-0.5 rounded-full">سنة {r.yearInCollege}</span>
                <span className="text-[10px] sm:text-xs bg-muted px-2 py-0.5 rounded-full">{r.type === "final" ? "نهائي" : r.type === "midterm" ? "نصفي" : r.type === "quiz" ? "اختبار" : "عملي"}</span>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(r)} className="h-7 w-7 sm:h-8 sm:w-8" title="تعديل">
                  <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => Promise.all(g.rows.map((x) => del.mutateAsync(x.id))).then(() => toast({ title: "تم الحذف" }))} className="h-7 w-7 sm:h-8 sm:w-8" title="حذف">
                  <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditTargets(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh]">
          <DialogHeader><DialogTitle className="text-base sm:text-lg">{editTargets ? "تعديل امتحان" : "إضافة امتحان للجدول"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pe-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">المجموعة</Label>
                <select value={form.groupName} onChange={(e) => setForm({ ...form, groupName: e.target.value })} disabled={form.allGroups} className="w-full h-9 rounded-md border bg-background px-3 text-sm disabled:opacity-50">
                  {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">السنة</Label>
                <select value={form.yearInCollege} onChange={(e) => setForm({ ...form, yearInCollege: Number(e.target.value) })} disabled={form.allYears} className="w-full h-9 rounded-md border bg-background px-3 text-sm disabled:opacity-50">
                  {YEARS.map((y) => <option key={y} value={y}>السنة {y}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer bg-primary/5 border rounded-lg px-3 py-2">
<input type="checkbox" checked={form.allGroups} onChange={(e) => setForm({ ...form, allGroups: e.target.checked })} className="h-4 w-4 accent-primary" />
                لكل الشعب (A–E)
              </label>
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer bg-primary/5 border rounded-lg px-3 py-2">
                <input type="checkbox" checked={form.allYears} onChange={(e) => setForm({ ...form, allYears: e.target.checked })} className="h-4 w-4 accent-primary" />
                لكل السنوات (1–4)
              </label>
              {form.allGroups && <span className="text-[10px] text-muted-foreground self-center">الامتحان هيتضاف لكل الشعب</span>}
            </div>
            {editTargets && (
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer bg-primary/5 border rounded-lg px-3 py-2">
                  <input type="checkbox" checked={form.allGroups} onChange={(e) => setForm({ ...form, allGroups: e.target.checked })} className="h-4 w-4 accent-primary" />
                  تطبيق على كل الشعب (A–E)
                </label>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">اليوم</Label>
                <div className="w-full h-9 rounded-md border bg-muted px-3 text-sm flex items-center font-bold text-muted-foreground">
                  {form.day || "—"}
                </div>
              </div>
              <div><Label className="text-xs">التاريخ</Label><Input type="date" value={form.date} onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  const d = new Date(val);
                  const dayName = JS_TO_AR[d.getDay()] || "";
                  setForm({ ...form, date: val, day: dayName });
                } else {
                  setForm({ ...form, date: val, day: "" });
                }
              }} className="h-9 text-sm" /></div>
              <div><Label className="text-xs">الوقت</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="h-9 text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">عنوان المادة</Label><Input value={form.courseTitle} onChange={(e) => setForm({ ...form, courseTitle: e.target.value })} className="h-9 text-sm" /></div>
              <div><Label className="text-xs">كود المادة</Label><Input value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} placeholder="AGR101" className="h-9 text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">القاعة</Label><Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="h-9 text-sm" /></div>
              <div>
                <Label className="text-xs">النوع</Label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="midterm">نصفي</option>
                  <option value="final">نهائي</option>
                  <option value="quiz">اختبار قصير</option>
                  <option value="practical">عملي</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-xs sm:text-sm">إلغاء</Button>
            <Button onClick={submit} disabled={add.isPending || update.isPending} className="text-xs sm:text-sm">{add.isPending || update.isPending ? "جاري..." : editTargets ? <><Pencil className="me-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> حفظ التعديل</> : <><Plus className="me-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> إضافة</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImportScheduleDialog open={importOpen} onOpenChange={setImportOpen} mode="exams" />
    </>
  );
}
