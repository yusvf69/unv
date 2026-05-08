import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Heart,
  Eye,
  Download,
  Plus,
  Trophy,
  Send,
  Trash2,
  Search,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useStudentSummaries,
  useUploadStudentSummary,
  useDeleteStudentSummary,
  useToggleMaterialFileLike,
  useCountMaterialFileView,
  useCourses,
  useMeV2,
} from "@/lib/api";
import FileUpload from "@/components/file-upload";
import { useToast } from "@/hooks/use-toast";
import { formatISODate } from "@/lib/dates";

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function StudentSummariesPage() {
  const { data: me } = useMeV2();
  const { data: summaries = [], isLoading } = useStudentSummaries();
  const { data: courses = [] } = useCourses();
  const upload = useUploadStudentSummary();
  const remove = useDeleteStudentSummary();
  const toggleLike = useToggleMaterialFileLike();
  const countView = useCountMaterialFileView();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState<{ name: string; url: string } | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [liking, setLiking] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", url: "", kind: "pdf", sizeBytes: 0, courseId: 0 });

  const filtered = useMemo(() => {
    return summaries.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.uploadedByName.toLowerCase().includes(q.toLowerCase()));
  }, [summaries, q]);

  const submit = async () => {
    if (!form.name || !form.url || !form.courseId) {
      toast({ title: "اختر المادة وارفع الملف وضع له اسماً", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      await upload.mutateAsync(form);
      toast({ title: "تم رفع الملخص!", description: "+5 نقاط لك. كل مشاهدة وإعجاب يضيفان لك المزيد." });
      setOpen(false);
      setForm({ name: "", url: "", kind: "pdf", sizeBytes: 0, courseId: 0 });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const onView = async (id: number, name: string, url: string) => {
    setViewing(id);
    try { await countView.mutateAsync(id); } catch {}
    finally { setViewing(null); }
    setViewerOpen({ name, url });
  };
  const onLike = async (id: number) => {
    setLiking(id);
    try { await toggleLike.mutateAsync(id); } catch {}
    finally { setLiking(null); }
  };
  const onDelete = async (id: number) => {
    if (!confirm("حذف الملخص؟")) return;
    setDeleting(id);
    try { await remove.mutateAsync(id); toast({ title: "تم الحذف" }); }
    catch (e) { toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" }); }
    finally { setDeleting(null); }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold flex items-center gap-3">
            <Trophy className="h-8 w-8 text-primary" /> ملخصات الطلبة
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            اقرأ، حمّل، وأعجب بملخصات الزملاء — كل إعجاب يضيف نقاط للناشر ويمنحه ألقاب جديدة.
          </p>
        </div>
        {me && <Button onClick={() => setOpen(true)}><Plus className="me-2 h-4 w-4" /> ارفع ملخصك</Button>}
      </motion.div>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في الملخصات..." className="ps-9" />
      </div>

      {isLoading && <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 bg-card border rounded-2xl">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">لا توجد ملخصات بعد. كن أول من يشارك!</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {filtered.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.04 }}
              className="bg-card border rounded-2xl p-4 flex flex-col gap-3 hover:shadow-lg transition"
            >
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary p-2 rounded-lg">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm leading-tight line-clamp-2">{s.name}</h3>
                  <div className="text-xs text-muted-foreground mt-1">{formatSize(s.sizeBytes)} · {formatISODate(s.createdAt)}</div>
                </div>
                {me && s.uploadedById === me.id && (
                  <Button size="icon" variant="ghost" onClick={() => onDelete(s.id)} disabled={deleting === s.id}>
                    {deleting === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                {s.uploaderAvatar ? (
                  <img src={s.uploaderAvatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-muted" />
                )}
                <span className="font-medium truncate">{s.uploadedByName}</span>
                {s.uploaderTitle && <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">{s.uploaderTitle}</span>}
                <span className="text-[10px] text-muted-foreground ms-auto">{s.uploaderPoints} pts</span>
              </div>
              <div className="flex items-center gap-2 mt-1 pt-3 border-t">
                <Button size="sm" variant="outline" onClick={() => onView(s.id, s.name, s.url)} disabled={viewing === s.id} className="flex-1">
                  {viewing === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Download className="me-1 h-4 w-4" /> فتح</>}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onLike(s.id)} disabled={liking === s.id} className="gap-1">
                  {liking === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Heart className="h-4 w-4" /> {s.likes}</>}
                </Button>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" /> {s.views}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>ارفع ملخصك</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">المادة</Label>
              <select
                value={form.courseId}
                onChange={(e) => setForm({ ...form, courseId: Number(e.target.value) })}
                className="w-full h-10 px-3 border-2 border-input rounded-md bg-background text-sm"
              >
                <option value={0}>— اختر مادة —</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">اسم الملخص</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: ملخص الفصل الأول" />
            </div>
            <div>
              <Label className="text-xs">الملف (يتم ضغط PDF تلقائياً)</Label>
              <FileUpload
                value={form.url || null}
                onChange={(d, meta) => setForm({ ...form, url: d || "", kind: meta?.type?.includes("pdf") ? "pdf" : "file", sizeBytes: meta?.size || 0 })}
                accept="application/pdf,.pdf,.doc,.docx,.ppt,.pptx,image/*"
                maxSizeKb={6000}
                imageOnly={false}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={uploading}>إلغاء</Button>
            <Button onClick={submit} disabled={uploading}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="me-2 h-4 w-4" /> رفع</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewerOpen && (
        <Dialog open={viewerOpen !== null} onOpenChange={(o) => !o && setViewerOpen(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] w-[90vw]">
            <DialogHeader><DialogTitle>{viewerOpen.name}</DialogTitle></DialogHeader>
            <div className="h-[70vh] border rounded-lg overflow-hidden">
              {viewerOpen.url.startsWith("data:") ? (
                <iframe src={viewerOpen.url} className="w-full h-full" title={viewerOpen.name} />
              ) : (
                <iframe src={`${viewerOpen.url}#toolbar=1&navpanes=0`} className="w-full h-full" title={viewerOpen.name} />
              )}
            </div>
            <div className="flex gap-2">
              <a href={viewerOpen.url} download={viewerOpen.name} target="_blank" rel="noreferrer" className="flex-1">
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 me-1" /> تحميل
                </Button>
              </a>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
