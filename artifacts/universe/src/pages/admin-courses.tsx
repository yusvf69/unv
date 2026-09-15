import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, BookOpen, Send, Trash2, FileText, Pencil } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useAdminCourses,
  useMeV2,
  useDoctorsList,
  useCreateAdminCourse,
  useUpdateAdminCourse,
  useDeleteAdminCourse,
  useImportCourses,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import FileUpload from "@/components/file-upload";
import { parseCoursesText } from "@/lib/schedule-parse";

const YEARS = [1, 2, 3, 4];
const DEPARTMENTS = [
  "الإنتاج النباتي",
  "البستنة",
  "وقاية النبات",
  "الأمراض النباتية",
  "التربة والمياه",
  "الاقتصاد الزراعي",
  "الإرشاد الزراعي",
  "هندسة الزراعة",
  "علوم الأغذية",
  "هندسة الري",
  "الإحصاء الحيوي",
  "الموارد الطبيعية",
];

export default function AdminCourses() {
  const { data: me } = useMeV2();
  const { data: courses = [] } = useAdminCourses();
  const { data: doctors = [] } = useDoctorsList();
  const create = useCreateAdminCourse();
  const update = useUpdateAdminCourse();
  const remove = useDeleteAdminCourse();
  const importCourses = useImportCourses();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [form, setForm] = useState({
    title: "",
    code: "",
    description: "",
    credits: 3,
    department: "",
    instructorId: 0,
    taIds: [] as number[],
    yearInCollege: 1,
    semester: 1,
    coverUrl: "",
  });

  const doctorOptions = useMemo(() => doctors.filter((d) => d.role === "doctor"), [doctors]);
  const taOptions = useMemo(() => doctors.filter((d) => d.role === "ta"), [doctors]);

  if (!me || (me.role !== "admin" && me.role !== "super_admin")) {
    return <div className="p-12 text-center text-muted-foreground">صلاحياتك غير كافية</div>;
  }

  const submit = async () => {
    if (!form.title || !form.code || !form.instructorId) {
      toast({ title: "العنوان والكود واختيار الدكتور مطلوب", variant: "destructive" });
      return;
    }
    const payload = {
      title: form.title,
      code: form.code,
      description: form.description,
      credits: Number(form.credits),
      department: form.department,
      instructorId: form.instructorId,
      taIds: form.taIds,
      yearInCollege: form.yearInCollege,
      semester: form.semester,
      coverUrl: form.coverUrl || undefined,
    };
    try {
      if (editingId) {
        await update.mutateAsync({ id: editingId, ...payload });
        toast({ title: "تم حفظ التعديلات" });
      } else {
        await create.mutateAsync(payload);
        toast({ title: "تم إضافة المقرر" });
      }
      setOpen(false);
      setEditingId(null);
      setForm({ title: "", code: "", description: "", credits: 3, department: "", instructorId: 0, taIds: [], yearInCollege: 1, semester: 1, coverUrl: "" });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  const startEdit = (c: (typeof courses)[number]) => {
    setEditingId(c.id);
    setForm({
      title: c.title,
      code: c.code,
      description: c.description,
      credits: c.credits,
      department: c.department,
      instructorId: c.instructorId ?? 0,
      taIds: c.taIds ?? [],
      yearInCollege: c.yearInCollege ?? 1,
      semester: c.semester || 1,
      coverUrl: c.coverUrl ?? "",
    });
    setOpen(true);
  };

  const parsed = useMemo(() => parseCoursesText(importText), [importText]);

  const submitImport = async () => {
    if (!parsed.rows.length) {
      toast({ title: "مفيش مقررات مفهومة من النص", variant: "destructive" });
      return;
    }
    try {
      const r = await importCourses.mutateAsync(parsed.rows);
      toast({ title: `أُضيف ${r.inserted} مقرر` });
      setImportOpen(false);
      setImportText("");
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  const remove1 = async (id: number) => {
    if (!confirm("حذف المقرر نهائيًا؟")) return;
    try {
      await remove.mutateAsync(id);
      toast({ title: "تم حذف المقرر" });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  const toggleTa = (id: number) => {
    setForm((f) => ({
      ...f,
      taIds: f.taIds.includes(id) ? f.taIds.filter((x) => x !== id) : [...f.taIds, id],
    }));
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-5xl">
      <div className="flex items-start justify-between mb-4 sm:mb-6 flex-wrap gap-2 sm:gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-serif font-bold flex items-center gap-2"><BookOpen className="h-5 w-5 sm:h-7 sm:w-7" /> إدارة المقررات</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">اختر دكتور المقرر من قائمة الأعضاء المسجلين</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="h-9 sm:h-10 text-xs sm:text-sm"><FileText className="me-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> استيراد من نص</Button>
          <Button onClick={() => setOpen(true)} className="h-9 sm:h-10 text-xs sm:text-sm"><Plus className="me-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> مقرر جديد</Button>
        </div>
      </div>

      {!courses.length && <p className="text-center text-muted-foreground py-8 sm:py-12 text-sm">لا توجد مقررات بعد.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {courses.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="bg-card border rounded-xl sm:rounded-2xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/admin/courses/${c.id}`)}>
            {c.coverUrl ? (
              <img src={c.coverUrl} alt={c.title} className="w-full h-24 sm:h-32 object-cover" />
            ) : (
              <div className="w-full h-24 sm:h-32 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center"><BookOpen className="h-8 w-8 sm:h-10 sm:w-10 text-primary/40" /></div>
            )}
            <div className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[10px] sm:text-xs text-secondary font-bold">{c.code} · {c.credits} ساعات · {c.yearInCollege ? `سنة ${c.yearInCollege}` : "عام"}</div>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); startEdit(c); }} className="p-1 rounded hover:bg-primary/10" title="تعديل"><Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" /></button>
                  <button onClick={(e) => { e.stopPropagation(); remove1(c.id); }} className="p-1 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" /></button>
                </div>
              </div>
              <h3 className="font-bold text-sm sm:text-base mt-1">{c.title}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{c.description}</p>
              <div className="text-xs text-muted-foreground mt-2">د. {c.instructor} · {c.department}</div>
              <div className="text-xs mt-2 bg-primary/10 text-primary px-2 py-0.5 rounded inline-block font-bold">{c.enrolled} طالب مسجل</div>
            </div>
          </motion.div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingId(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh]">
          <DialogHeader><DialogTitle className="text-base sm:text-lg">{editingId ? `تعديل: ${form.code}` : "إضافة مقرر جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pe-2">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">الكود</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="AGR101" className="h-9 text-sm" /></div>
              <div><Label className="text-xs">الساعات</Label><Input type="number" value={form.credits} onChange={(e) => setForm({ ...form, credits: Number(e.target.value) })} className="h-9 text-sm" /></div>
            </div>
            <div><Label className="text-xs">عنوان المقرر</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-9 text-sm" /></div>
            <div><Label className="text-xs">الوصف</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="text-sm" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">القسم</Label>
                <select
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full h-9 px-3 border-2 border-input rounded-md bg-background text-sm"
                >
                  <option value="">— اختر القسم —</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">السنة الدراسية</Label>
                <select
                  value={form.yearInCollege}
                  onChange={(e) => setForm({ ...form, yearInCollege: Number(e.target.value) })}
                  className="w-full h-9 px-3 border-2 border-input rounded-md bg-background text-sm"
                >
                  {YEARS.map((y) => <option key={y} value={y}>السنة {y}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">الترم</Label>
                <select
                  value={form.semester}
                  onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })}
                  className="w-full h-9 px-3 border-2 border-input rounded-md bg-background text-sm"
                >
                  <option value={1}>الترم الأول</option>
                  <option value={2}>الترم الثاني</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs">دكتور المقرر</Label>
              <select
                value={form.instructorId}
                onChange={(e) => setForm({ ...form, instructorId: Number(e.target.value) })}
                className="w-full h-9 px-3 border-2 border-input rounded-md bg-background text-sm"
              >
                <option value={0}>— اختر دكتور —</option>
                {doctorOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.title ? `(${d.title})` : ""} — {d.department}
                  </option>
                ))}
              </select>
              {!doctorOptions.length && (
                <p className="text-xs text-muted-foreground mt-1">لا يوجد دكاترة مسجلين بعد. أضفهم من إدارة الكادر.</p>
              )}
            </div>
            <div>
              <Label className="text-xs">المعيدون (اختياري — يمكن اختيار أكثر من واحد)</Label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto bg-muted/30 p-2 rounded-md">
                {taOptions.length === 0 && <p className="text-xs text-muted-foreground">لا يوجد معيدين</p>}
                {taOptions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTa(t.id)}
                    className={`text-xs px-2 py-1 rounded-full border ${form.taIds.includes(t.id) ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">صورة الغلاف (اختياري)</Label>
              <FileUpload value={form.coverUrl || null} onChange={(d) => setForm({ ...form, coverUrl: d || "" })} maxSizeKb={500} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpen(false); setEditingId(null); }} className="text-xs sm:text-sm">إلغاء</Button>
            <Button onClick={submit} disabled={create.isPending || update.isPending} className="text-xs sm:text-sm"><Send className="me-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> {editingId ? "حفظ التعديلات" : "إضافة المقرر"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) setImportText(""); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="text-base sm:text-lg">استيراد مقررات من نص</DialogTitle></DialogHeader>
          <p className="text-xs sm:text-sm text-muted-foreground">
            كل سطر مقرر: <span className="font-bold">الكود | العنوان | السنة | الترم | الساعات | القسم</span> — السنة والترم والساعات والقسم اختياريين.
          </p>
          <Textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={10} className="text-sm font-mono" placeholder={"AGR101 | كيمياء عضوية | 1 | 1 | 2 | النبات\nAGR102 | فيزياء حيوية | 1 | 1 | 2 | النبات"} />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs">
              {parsed.rows.length > 0 ? <span className="font-bold text-primary">{parsed.rows.length} مقرر جاهز</span> : <span className="text-destructive font-bold">مفيش مقررات مفهومة</span>}
              {parsed.skipped.length > 0 && <span className="text-muted-foreground ms-2">{parsed.skipped.length} سطر متخطى</span>}
            </div>
            {parsed.rows.length > 0 && parsed.rows.length <= 3 && (
              <div className="text-[10px] text-muted-foreground font-mono">{parsed.rows.map((r) => `${r.code} · ${r.title} · سنة ${r.yearInCollege}`).join(" / ")}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOpen(false)} className="text-xs sm:text-sm">إلغاء</Button>
            <Button onClick={submitImport} disabled={importCourses.isPending || !parsed.rows.length} className="text-xs sm:text-sm">{importCourses.isPending ? "جاري الاستيراد..." : <><FileText className="me-2 h-3.5 w-3.5" /> استيراد</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
