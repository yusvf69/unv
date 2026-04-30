import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Calendar, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMeV2, useEvents, useCreateEvent, useDeleteEvent } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const KINDS = [
  { value: "exam", label: "امتحان" },
  { value: "deadline", label: "موعد نهائي" },
  { value: "assignment", label: "تكليف" },
  { value: "workshop", label: "ورشة" },
  { value: "other", label: "آخر" },
];
const GROUPS = ["A", "B", "C", "D", "E"];
const YEARS = [1, 2, 3, 4];

export default function AdminEvents() {
  const { data: me } = useMeV2();
  const { data: events = [] } = useEvents();
  const create = useCreateEvent();
  const remove = useDeleteEvent();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    kind: "exam",
    yearInCollege: 0,
    groupName: "",
    dueAt: "",
    location: "",
  });

  if (!me || (me.role !== "admin" && me.role !== "super_admin")) {
    return <div className="p-12 text-center text-muted-foreground">صلاحياتك غير كافية</div>;
  }

  const submit = async () => {
    if (!form.title || !form.dueAt) {
      toast({ title: "العنوان والموعد مطلوبان", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        title: form.title,
        description: form.description,
        kind: form.kind,
        yearInCollege: form.yearInCollege || undefined,
        groupName: form.groupName || undefined,
        dueAt: new Date(form.dueAt).toISOString(),
        location: form.location || undefined,
      });
      toast({ title: "تم إضافة الحدث", description: "تم إخطار الطلاب المعنيين." });
      setOpen(false);
      setForm({ title: "", description: "", kind: "exam", yearInCollege: 0, groupName: "", dueAt: "", location: "" });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  const remove1 = async (id: number) => {
    if (!confirm("حذف الحدث؟")) return;
    try {
      await remove.mutateAsync(id);
      toast({ title: "تم الحذف" });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-serif font-bold flex items-center gap-2">
            <Calendar className="h-7 w-7" /> إدارة الأحداث
          </h1>
          <p className="text-sm text-muted-foreground mt-1">امتحانات، مواعيد نهائية، ورش — تظهر للطلاب حسب سنتهم ومجموعتهم</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="me-2 h-4 w-4" /> حدث جديد</Button>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {events.map((e, i) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ delay: i * 0.03 }}
              className="bg-card border rounded-xl p-4 flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-bold">{e.kind}</span>
                  {e.yearInCollege && <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">السنة {e.yearInCollege}</span>}
                  {e.groupName && <span className="text-[10px] bg-secondary/20 text-secondary-foreground px-2 py-0.5 rounded-full">G{e.groupName}</span>}
                </div>
                <h3 className="font-bold">{e.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(e.dueAt).toLocaleString("ar-EG")}{e.location ? ` — ${e.location}` : ""}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove1(e.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
        {!events.length && <p className="text-center text-muted-foreground py-12">لا توجد أحداث بعد.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>إضافة حدث</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pe-2">
            <div><Label className="text-xs">العنوان</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label className="text-xs">الوصف</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">النوع</Label>
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}
                  className="w-full h-10 px-3 border-2 border-input rounded-md bg-background text-sm">
                  {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">المكان (اختياري)</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">السنة (اختياري — كل السنين لو تركتها فارغة)</Label>
                <select value={form.yearInCollege} onChange={(e) => setForm({ ...form, yearInCollege: Number(e.target.value) })}
                  className="w-full h-10 px-3 border-2 border-input rounded-md bg-background text-sm">
                  <option value={0}>كل السنين</option>
                  {YEARS.map((y) => <option key={y} value={y}>السنة {y}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">المجموعة (اختياري)</Label>
                <select value={form.groupName} onChange={(e) => setForm({ ...form, groupName: e.target.value })}
                  className="w-full h-10 px-3 border-2 border-input rounded-md bg-background text-sm">
                  <option value="">كل المجموعات</option>
                  {GROUPS.map((g) => <option key={g} value={g}>G{g}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs">الموعد النهائي</Label>
              <Input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={submit}><Send className="me-2 h-4 w-4" /> إضافة الحدث</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
