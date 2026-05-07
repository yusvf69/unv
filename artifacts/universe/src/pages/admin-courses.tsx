import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, BookOpen, Send, Trash2 } from "lucide-react";
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
  useDeleteAdminCourse,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import FileUpload from "@/components/file-upload";

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
  const remove = useDeleteAdminCourse();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    code: "",
    description: "",
    credits: 3,
    department: "",
    instructorId: 0,
    taIds: [] as number[],
    yearInCollege: 1,
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
    try {
      await create.mutateAsync({
        title: form.title,
        code: form.code,
        description: form.description,
        credits: Number(form.credits),
        department: form.department,
        instructorId: form.instructorId,
        taIds: form.taIds,
        yearInCollege: form.yearInCollege,
        coverUrl: form.coverUrl || undefined,
      });
      toast({ title: "تم إضافة المقرر" });
      setOpen(false);
      setForm({ title: "", code: "", description: "", credits: 3, department: "", instructorId: 0, taIds: [], yearInCollege: 1, coverUrl: "" });
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
        <Button onClick={() => setOpen(true)} className="h-9 sm:h-10 text-xs sm:text-sm"><Plus className="me-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> مقرر جديد</Button>
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
                <div className="text-[10px] sm:text-xs text-secondary font-bold">{c.code} · {c.credits} ساعات</div>
                <button onClick={(e) => { e.stopPropagation(); remove1(c.id); }} className="p-1 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" /></button>
              </div>
              <h3 className="font-bold text-sm sm:text-base mt-1">{c.title}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{c.description}</p>
              <div className="text-xs text-muted-foreground mt-2">د. {c.instructor} · {c.department}</div>
              <div className="text-xs mt-2 bg-primary/10 text-primary px-2 py-0.5 rounded inline-block font-bold">{c.enrolled} طالب مسجل</div>
            </div>
          </motion.div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh]">
          <DialogHeader><DialogTitle className="text-base sm:text-lg">إضافة مقرر جديد</DialogTitle></DialogHeader>
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
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-xs sm:text-sm">إلغاء</Button>
            <Button onClick={submit} className="text-xs sm:text-sm"><Send className="me-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> إضافة المقرر</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
