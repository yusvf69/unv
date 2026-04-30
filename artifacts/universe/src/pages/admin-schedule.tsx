import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Calendar, FileText, Clock, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useAdminGroupSchedule, useAddGroupScheduleRow, useDeleteGroupScheduleRow,
  useAdminExamSchedule, useAddExamScheduleRow, useDeleteExamScheduleRow,
  useMeV2,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const JS_TO_AR: Record<number, string> = { 6: "السبت", 0: "الأحد", 1: "الاثنين", 2: "الثلاثاء", 3: "الأربعاء", 4: "الخميس", 5: "الجمعة" };
const GROUPS = ["A", "B", "C", "D", "E"];
const YEARS = [1, 2, 3, 4];

export default function AdminSchedule() {
  const { data: me } = useMeV2();
  const [tab, setTab] = useState<"classes" | "exams">("classes");

  if (!me || (me.role !== "admin" && me.role !== "super_admin")) {
    return <div className="p-12 text-center text-muted-foreground">صلاحياتك غير كافية</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-3xl font-serif font-bold flex items-center gap-2"><Calendar className="h-7 w-7" /> إدارة الجداول</h1>
        <p className="text-sm text-muted-foreground mt-1">حدّد جداول المحاضرات والامتحانات لكل مجموعة وسنة</p>
      </motion.div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("classes")}
          className={`px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition ${tab === "classes" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
        >
          <Clock className="h-4 w-4" /> جدول المحاضرات
        </button>
        <button
          onClick={() => setTab("exams")}
          className={`px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition ${tab === "exams" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
        >
          <Award className="h-4 w-4" /> جدول الامتحانات
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
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [filterGroup, setFilterGroup] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [form, setForm] = useState({
    groupName: "A", yearInCollege: 1, day: "السبت", startTime: "08:00", endTime: "10:00",
    courseTitle: "", courseCode: "", instructor: "", room: "", type: "lecture",
  });

  const filtered = rows.filter((r) => (!filterGroup || r.groupName === filterGroup) && (!filterYear || r.yearInCollege === filterYear));

  const submit = async () => {
    if (!form.courseTitle || !form.instructor || !form.room) {
      toast({ title: "املأ الحقول الأساسية", variant: "destructive" });
      return;
    }
    try {
      await add.mutateAsync(form as any);
      toast({ title: "أُضيف للجدول" });
      setOpen(false);
      setForm({ ...form, courseTitle: "", courseCode: "", instructor: "", room: "" });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 flex-wrap p-3 bg-card border rounded-xl">
          <span className="text-xs font-bold self-center">المجموعة:</span>
          <Button size="sm" variant={!filterGroup ? "default" : "outline"} onClick={() => setFilterGroup(null)}>الكل</Button>
          {GROUPS.map((g) => <Button key={g} size="sm" variant={filterGroup === g ? "default" : "outline"} onClick={() => setFilterGroup(g)}>{g}</Button>)}
          <span className="text-xs font-bold self-center ms-4">السنة:</span>
          <Button size="sm" variant={!filterYear ? "default" : "outline"} onClick={() => setFilterYear(null)}>الكل</Button>
          {YEARS.map((y) => <Button key={y} size="sm" variant={filterYear === y ? "default" : "outline"} onClick={() => setFilterYear(y)}>{y}</Button>)}
        </div>
        <Button className="ms-3" onClick={() => setOpen(true)}><Plus className="me-2 h-4 w-4" /> محاضرة جديدة</Button>
      </div>

      {!filtered.length && <p className="text-center text-muted-foreground py-12">لا توجد محاضرات في الجدول.</p>}

      <div className="space-y-2">
        {filtered.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="bg-card border rounded-xl p-3 flex items-center gap-3 flex-wrap">
            <div className="bg-primary/10 text-primary font-bold px-3 py-1.5 rounded-lg text-sm">{r.day}</div>
            <div className="text-sm font-mono">{r.startTime} - {r.endTime}</div>
            <div className="flex-1 min-w-[200px]">
              <div className="font-bold">{r.courseTitle} {r.courseCode && <span className="text-xs text-muted-foreground">({r.courseCode})</span>}</div>
              <div className="text-xs text-muted-foreground">د. {r.instructor} · {r.room}</div>
            </div>
            <div className="flex gap-1.5">
              <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-bold">G{r.groupName}</span>
              <span className="text-xs bg-accent/30 text-accent-foreground px-2 py-0.5 rounded-full">سنة {r.yearInCollege}</span>
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{r.type === "lab" ? "معمل" : r.type === "lecture" ? "محاضرة" : "تدريب"}</span>
            </div>
            <Button size="icon" variant="ghost" onClick={() => del.mutateAsync(r.id).then(() => toast({ title: "تم الحذف" }))}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </motion.div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>إضافة محاضرة للجدول</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">المجموعة</Label>
                <select value={form.groupName} onChange={(e) => setForm({ ...form, groupName: e.target.value })} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                  {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">السنة</Label>
                <select value={form.yearInCollege} onChange={(e) => setForm({ ...form, yearInCollege: Number(e.target.value) })} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                  {YEARS.map((y) => <option key={y} value={y}>السنة {y}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">اليوم</Label>
                <select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">من</Label><Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
              <div><Label className="text-xs">إلى</Label><Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">عنوان المادة</Label><Input value={form.courseTitle} onChange={(e) => setForm({ ...form, courseTitle: e.target.value })} /></div>
              <div><Label className="text-xs">كود المادة</Label><Input value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} placeholder="AGR101" /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2"><Label className="text-xs">المحاضر</Label><Input value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} /></div>
              <div><Label className="text-xs">القاعة</Label><Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></div>
            </div>
            <div>
              <Label className="text-xs">النوع</Label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                <option value="lecture">محاضرة</option>
                <option value="lab">معمل</option>
                <option value="practical">تدريب عملي</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={submit} disabled={add.isPending}>{add.isPending ? "جاري..." : <><Plus className="me-2 h-4 w-4" /> إضافة</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExamScheduleTab() {
  const { data: rows = [] } = useAdminExamSchedule();
  const add = useAddExamScheduleRow();
  const del = useDeleteExamScheduleRow();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [filterGroup, setFilterGroup] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [form, setForm] = useState({
    groupName: "A", yearInCollege: 1, day: "السبت", date: "", time: "09:00",
    courseTitle: "", courseCode: "", room: "", type: "midterm",
  });

  const filtered = rows.filter((r) => (!filterGroup || r.groupName === filterGroup) && (!filterYear || r.yearInCollege === filterYear));

  const submit = async () => {
    if (!form.courseTitle || !form.room || !form.date) {
      toast({ title: "املأ الحقول الأساسية", variant: "destructive" });
      return;
    }
    try {
      await add.mutateAsync(form as any);
      toast({ title: "أُضيف للجدول" });
      setOpen(false);
      setForm({ ...form, courseTitle: "", courseCode: "", room: "", date: "" });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 flex-wrap p-3 bg-card border rounded-xl">
          <span className="text-xs font-bold self-center">المجموعة:</span>
          <Button size="sm" variant={!filterGroup ? "default" : "outline"} onClick={() => setFilterGroup(null)}>الكل</Button>
          {GROUPS.map((g) => <Button key={g} size="sm" variant={filterGroup === g ? "default" : "outline"} onClick={() => setFilterGroup(g)}>{g}</Button>)}
          <span className="text-xs font-bold self-center ms-4">السنة:</span>
          <Button size="sm" variant={!filterYear ? "default" : "outline"} onClick={() => setFilterYear(null)}>الكل</Button>
          {YEARS.map((y) => <Button key={y} size="sm" variant={filterYear === y ? "default" : "outline"} onClick={() => setFilterYear(y)}>{y}</Button>)}
        </div>
        <Button className="ms-3" onClick={() => setOpen(true)}><Plus className="me-2 h-4 w-4" /> امتحان جديد</Button>
      </div>

      {!filtered.length && <p className="text-center text-muted-foreground py-12">لا توجد امتحانات في الجدول.</p>}

      <div className="space-y-2">
        {filtered.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="bg-card border rounded-xl p-3 flex items-center gap-3 flex-wrap">
            <div className="bg-amber-500/10 text-amber-600 font-bold px-3 py-1.5 rounded-lg text-sm">{r.day}</div>
            <div className="text-sm font-mono">{r.time}</div>
            <div className="text-xs text-muted-foreground">{r.date}</div>
            <div className="flex-1 min-w-[200px]">
              <div className="font-bold">{r.courseTitle} {r.courseCode && <span className="text-xs text-muted-foreground">({r.courseCode})</span>}</div>
              <div className="text-xs text-muted-foreground">{r.room}</div>
            </div>
            <div className="flex gap-1.5">
              <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-bold">G{r.groupName}</span>
              <span className="text-xs bg-accent/30 text-accent-foreground px-2 py-0.5 rounded-full">سنة {r.yearInCollege}</span>
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{r.type === "final" ? "نهائي" : r.type === "midterm" ? "نصفي" : r.type === "quiz" ? "اختبار" : "عملي"}</span>
            </div>
            <Button size="icon" variant="ghost" onClick={() => del.mutateAsync(r.id).then(() => toast({ title: "تم الحذف" }))}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </motion.div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>إضافة امتحان للجدول</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">المجموعة</Label>
                <select value={form.groupName} onChange={(e) => setForm({ ...form, groupName: e.target.value })} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                  {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">السنة</Label>
                <select value={form.yearInCollege} onChange={(e) => setForm({ ...form, yearInCollege: Number(e.target.value) })} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                  {YEARS.map((y) => <option key={y} value={y}>السنة {y}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">اليوم</Label>
                <div className="w-full h-10 rounded-md border bg-muted px-3 text-sm flex items-center font-bold text-muted-foreground">
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
              }} /></div>
              <div><Label className="text-xs">الوقت</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">عنوان المادة</Label><Input value={form.courseTitle} onChange={(e) => setForm({ ...form, courseTitle: e.target.value })} /></div>
              <div><Label className="text-xs">كود المادة</Label><Input value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} placeholder="AGR101" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">القاعة</Label><Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></div>
              <div>
                <Label className="text-xs">النوع</Label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                  <option value="midterm">نصفي</option>
                  <option value="final">نهائي</option>
                  <option value="quiz">اختبار قصير</option>
                  <option value="practical">عملي</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={submit} disabled={add.isPending}>{add.isPending ? "جاري..." : <><Plus className="me-2 h-4 w-4" /> إضافة</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
