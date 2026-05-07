import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Newspaper, Send, Check, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGetMe } from "@workspace/api-client-react";
import {
  useAdminNews,
  useCreateAdminNews,
  useApproveNews,
  useRejectNews,
  useDeleteAdminNews,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import FileUpload from "@/components/file-upload";

const CATEGORIES = ["إعلان", "حدث", "بحث", "نجاح طلابي", "إنجاز", "زراعي"];

interface FormState {
  title: string;
  excerpt: string;
  body: string;
  category: string;
  imageUrl: string;
}

const empty: FormState = { title: "", excerpt: "", body: "", category: "إعلان", imageUrl: "" };

export default function AdminNews() {
  const { data: me } = useGetMe();
  const { data: items = [] } = useAdminNews();
  const create = useCreateAdminNews();
  const approve = useApproveNews();
  const reject = useRejectNews();
  const remove = useDeleteAdminNews();
  const isSuper = me?.role === "super_admin";
  const isAdmin = me?.role === "admin" || isSuper;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const { toast } = useToast();

  if (!isAdmin) {
    return <div className="container mx-auto p-12 text-center text-muted-foreground">صلاحياتك غير كافية.</div>;
  }

  const submit = async () => {
    if (!form.title || !form.excerpt || !form.body) {
      toast({ title: "العنوان والمقتطف والمحتوى مطلوبة", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        title: form.title,
        excerpt: form.excerpt,
        body: form.body,
        category: form.category,
        imageUrl: form.imageUrl || undefined,
      });
      toast({
        title: isSuper ? "تم نشر الخبر" : "أُرسل الخبر للموافقة",
        description: isSuper ? "ظاهر للجميع الآن." : "السوبر أدمن سيراجع طلبك.",
      });
      setOpen(false);
      setForm(empty);
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  const onApprove = async (id: number) => {
    try { await approve.mutateAsync(id); toast({ title: "تم الاعتماد" }); }
    catch (e) { toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" }); }
  };
  const onReject = async (id: number) => {
    const reason = prompt("سبب الرفض (اختياري):") || undefined;
    try { await reject.mutateAsync({ id, reason }); toast({ title: "تم الرفض" }); }
    catch (e) { toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" }); }
  };
  const onDelete = async (id: number) => {
    if (!confirm("حذف الخبر؟")) return;
    try { await remove.mutateAsync(id); toast({ title: "تم الحذف" }); }
    catch (e) { toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" }); }
  };

  const StatusBadge = ({ s }: { s: string }) => (
    s === "pending" ? <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1"><Clock className="h-3 w-3" /> بانتظار الموافقة</span>
    : s === "rejected" ? <span className="text-[10px] bg-destructive/20 text-destructive px-2 py-0.5 rounded-full font-bold">مرفوض</span>
    : <span className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">منشور</span>
  );

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
      <div className="flex items-start justify-between gap-3 sm:gap-4 mb-4 sm:mb-8 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-3xl md:text-4xl font-serif font-bold flex items-center gap-2 sm:gap-3">
            <Newspaper className="h-6 w-6 sm:h-8 sm:w-8 text-primary" /> إدارة الأخبار
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 sm:mt-2">
            {isSuper
              ? "كل أخبار الكلية + اعتمد أو ارفض اقتراحات الإداريين."
              : "أي خبر جديد يُرسل للسوبر أدمن للاعتماد قبل النشر."}
          </p>
        </div>
        <Button onClick={() => { setForm(empty); setOpen(true); }} className="h-9 sm:h-10 text-xs sm:text-sm">
          <Plus className="me-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> خبر جديد
        </Button>
      </div>

      {items.length === 0 && <p className="text-center text-muted-foreground py-8 sm:py-12 text-sm">لا توجد أخبار بعد.</p>}

      <div className="grid gap-2 sm:gap-3">
        <AnimatePresence>
          {items.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ delay: i * 0.03 }}
              className="bg-card border-2 border-border rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4 hover:shadow-md transition-shadow"
            >
              {n.imageUrl && (
                <img src={n.imageUrl} alt="" className="w-full sm:w-24 h-32 sm:h-24 object-cover rounded-xl flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-bold">
                    {n.category}
                  </span>
                  <StatusBadge s={n.status} />
                  <span className="text-[10px] sm:text-xs text-muted-foreground">{new Date(n.publishedAt).toLocaleDateString("ar-EG")}</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">— بقلم {n.author}</span>
                </div>
                <h3 className="font-bold text-sm sm:text-base">{n.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mt-1">{n.excerpt}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {isSuper && n.status === "pending" && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => onApprove(n.id)} title="اعتمد" className="h-8 w-8 p-0">
                      <Check className="h-4 w-4 text-emerald-500" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onReject(n.id)} title="ارفض" className="h-8 w-8 p-0">
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
                <Button size="sm" variant="ghost" onClick={() => onDelete(n.id)} className="h-8 w-8 p-0">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">إضافة خبر</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pe-2">
            <div>
              <Label className="text-xs">العنوان</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">التصنيف</Label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full h-9 px-3 border-2 border-input rounded-md bg-background text-sm"
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">المقتطف</Label>
              <Textarea rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} className="text-sm" />
            </div>
            <div>
              <Label className="text-xs">المحتوى</Label>
              <Textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="text-sm" />
            </div>
            <div>
              <Label className="text-xs">صورة الخبر</Label>
              <FileUpload value={form.imageUrl || null} onChange={(v) => setForm({ ...form, imageUrl: v || "" })} accept="image/*" maxSizeKb={1500} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-xs sm:text-sm">إلغاء</Button>
            <Button onClick={submit} className="text-xs sm:text-sm">
              <Send className="me-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> {isSuper ? "نشر مباشر" : "إرسال للموافقة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
