import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, BookOpen, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAdminEbooks, useAddEbook, useUpdateEbook, useDeleteEbook, useMeV2, useAdminPermissions } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const YEARS = [1, 2, 3, 4];

export default function AdminEbooks() {
  const { data: me } = useMeV2();
  const perms = useAdminPermissions();
  const { data: books = [], isLoading } = useAdminEbooks();
  const addBook = useAddEbook();
  const updateBook = useUpdateEbook();
  const removeBook = useDeleteEbook();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", subject: "", yearInCollege: "", coverUrl: "", bookUrl: "", description: "" });

  const canManage = me?.role === "admin" || me?.role === "super_admin" || (me?.role === "student" && !!perms);
  if (!canManage) return <div className="p-12 text-center text-muted-foreground">صلاحياتك غير كافية</div>;

  const resetForm = () => setForm({ title: "", subject: "", yearInCollege: "", coverUrl: "", bookUrl: "", description: "" });
  const openAdd = () => { setEditingId(null); resetForm(); setOpen(true); };
  const openEdit = (b: any) => {
    setEditingId(b.id);
    setForm({ title: b.title, subject: b.subject, yearInCollege: b.yearInCollege ? String(b.yearInCollege) : "", coverUrl: b.coverUrl || "", bookUrl: b.bookUrl, description: b.description || "" });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.title.trim() || !form.bookUrl.trim()) {
      toast({ title: "اسم الكتاب والرابط مطلوبين", variant: "destructive" });
      return;
    }
    const body: any = {
      title: form.title.trim(),
      subject: form.subject.trim(),
      coverUrl: form.coverUrl.trim() || undefined,
      bookUrl: form.bookUrl.trim(),
      description: form.description.trim(),
      yearInCollege: form.yearInCollege ? Number(form.yearInCollege) : null,
    };
    try {
      if (editingId) { await updateBook.mutateAsync({ id: editingId, ...body }); toast({ title: "تم تحديث الكتاب" }); }
      else { await addBook.mutateAsync(body); toast({ title: "تم إضافة الكتاب" }); }
      setOpen(false);
      resetForm();
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  const remove = async (id: number) => {
    try { await removeBook.mutateAsync(id); toast({ title: "تم الحذف" }); }
    catch (e) { toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" }); }
  };

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><BookOpen className="h-6 w-6" /></div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold">الكتب الإلكترونية</h1>
            <p className="text-sm text-muted-foreground">{books.length} كتاب</p>
          </div>
        </div>
        <Button onClick={openAdd}><Plus className="me-2 h-4 w-4" /> كتاب جديد</Button>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-16">جاري التحميل…</div>
      ) : books.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">مفيش كتب بعد — ضيف أول كتاب</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {books.map((b) => (
            <motion.div key={b.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 rounded-xl border bg-card p-3">
              <div className="h-20 w-14 shrink-0 rounded-lg bg-muted overflow-hidden flex items-center justify-center">
                {b.coverUrl ? <img src={b.coverUrl} alt="" className="h-full w-full object-cover" /> : <BookOpen className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm leading-snug line-clamp-1">{b.title}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {b.subject ? <span className="rounded-full bg-primary/10 text-primary text-[11px] font-semibold px-2 py-0.5">{b.subject}</span> : null}
                  {b.yearInCollege ? <Badge variant="outline" className="text-[11px] h-5">سنة {b.yearInCollege}</Badge> : null}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <a href={b.bookUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" /> الرابط</a>
                  <span className="text-[11px] text-muted-foreground">#id {b.id}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Button variant="outline" size="sm" className="h-8" onClick={() => openEdit(b)}>تعديل</Button>
                <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => remove(b.id)} disabled={removeBook.isPending}><Trash2 className="me-1 h-3.5 w-3.5" /> حذف</Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-base sm:text-lg">{editingId ? "تعديل الكتاب" : "إضافة كتاب جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">اسم الكتاب</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: أساسيات الكيمياء العضوية" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">المادة</Label>
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="مثال: كيمياء عضوية" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">السنة</Label>
                  <select value={form.yearInCollege} onChange={(e) => setForm({ ...form, yearInCollege: e.target.value })} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                    <option value="">عام لجميع السنوات</option>
                    {YEARS.map((y) => <option key={y} value={y}>سنة {y}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">رابط الكتاب (الموقع اللي فيه الكتاب)</Label>
              <Input dir="ltr" value={form.bookUrl} onChange={(e) => setForm({ ...form, bookUrl: e.target.value })} placeholder="https://…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">رابط صورة الغلاف</Label>
              <Input dir="ltr" value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} placeholder="https://… (اختياري)" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">وصف قصير</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="اختياري" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={submit} disabled={addBook.isPending || updateBook.isPending}>
              {(addBook.isPending || updateBook.isPending) ? <><Loader2 className="me-2 h-4 w-4 animate-spin" /> جاري الحفظ…</> : <>حفظ</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}