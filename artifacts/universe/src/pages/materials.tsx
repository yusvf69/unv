import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Folder, Download, Calendar, Search, Heart, Eye, MessageCircle, Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useCourses,
  useCourseFiles,
  useToggleMaterialFileLike,
  useCountMaterialFileView,
  useFileComments,
  useAddFileComment,
  useMeV2,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatISODate, formatISODateTime } from "@/lib/dates";

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileCard({ f }: { f: any }) {
  const toggleLike = useToggleMaterialFileLike();
  const countView = useCountMaterialFileView();
  const [showComments, setShowComments] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [liking, setLiking] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const { data: me } = useMeV2();
  const { data: comments = [] } = useFileComments(showComments ? f.id : 0);
  const addComment = useAddFileComment(f.id);
  const { toast } = useToast();

  const open = async () => {
    setViewerLoading(true);
    try { await countView.mutateAsync(f.id); } catch {}
    finally { setViewerLoading(false); }
    setViewerOpen(true);
  };
  const like = async () => {
    setLiking(true);
    try { await toggleLike.mutateAsync(f.id); } catch {}
    finally { setLiking(false); }
  };
  const sendComment = async () => {
    if (!newComment.trim()) return;
    setCommenting(true);
    try {
      await addComment.mutateAsync(newComment.trim());
      setNewComment("");
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    } finally {
      setCommenting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border rounded-xl overflow-hidden"
    >
      <div className="flex items-start gap-3 p-4">
        <div className="bg-primary/10 text-primary p-2 rounded-lg">
          <FileText className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">{f.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
            <span>{formatSize(f.sizeBytes)}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatISODate(f.createdAt)}</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">رفع: {f.uploadedByName}</div>
        </div>
      </div>
      <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={open} disabled={viewerLoading} className="gap-1">
          {viewerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Download className="h-4 w-4" /> فتح</>}
        </Button>
        <Button size="sm" variant="ghost" onClick={like} disabled={liking} className="gap-1">
          {liking ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Heart className="h-4 w-4" /> {f.likes ?? 0}</>}
        </Button>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5" /> {f.views ?? 0}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setShowComments((s) => !s)} className="gap-1 ms-auto">
          <MessageCircle className="h-4 w-4" /> التعليقات
        </Button>
      </div>
      {showComments && (
        <div className="border-t p-3 space-y-2 bg-muted/20">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {comments.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">لا توجد تعليقات بعد</p>}
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-xs">
                {c.authorAvatar ? (
                  <img src={c.authorAvatar} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-muted flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0 bg-background rounded-lg p-2">
                  <div className="font-bold flex items-center gap-1">
                    {c.authorName}
                    {c.authorRole && <span className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">{c.authorRole}</span>}
                  </div>
                  <div className="mt-0.5 break-words">{c.body}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{formatISODateTime(c.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
          {me && (
            <div className="flex gap-2 pt-2 border-t">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="اكتب تعليقك..."
                rows={1}
                className="text-xs flex-1 min-h-[36px]"
                disabled={commenting}
              />
              <Button size="sm" onClick={sendComment} disabled={commenting}>
                {commenting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}
        </div>
      )}

      {viewerOpen && (
        <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] w-[90vw]">
            <DialogHeader><DialogTitle>{f.name}</DialogTitle></DialogHeader>
            <div className="h-[70vh] border rounded-lg overflow-hidden">
              {viewerLoading ? (
                <div className="w-full h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : f.url.startsWith("data:") ? (
                <iframe src={f.url} className="w-full h-full" title={f.name} />
              ) : (
                <iframe src={`${f.url}#toolbar=1&navpanes=0`} className="w-full h-full" title={f.name} />
              )}
            </div>
            <div className="flex gap-2">
              <a href={f.url} download={f.name} target="_blank" rel="noreferrer" className="flex-1">
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 me-1" /> تحميل
                </Button>
              </a>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </motion.div>
  );
}

export default function Materials() {
  const { data: courses = [] } = useCourses();
  const [selected, setSelected] = useState<number | null>(null);
  const { data: files = [] } = useCourseFiles(selected || 0);
  const [q, setQ] = useState("");

  const filtered = files.filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl font-serif font-bold flex items-center gap-2"><Folder className="h-5 w-5 sm:h-7 sm:w-7" /> ملفات المقررات</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">شاهد، أعجب، علّق — كل تفاعل يدعم زملاءك ويرفع نقاطهم.</p>
      </motion.div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-3 sm:gap-6">
        <div className="bg-card border rounded-xl sm:rounded-2xl p-2 sm:p-3 h-fit lg:sticky lg:top-20">
          <h2 className="font-bold text-xs sm:text-sm px-2 mb-2">المقررات</h2>
          <div className="space-y-1 max-h-[30vh] sm:max-h-[60vh] overflow-y-auto">
            {courses.length === 0 && <p className="text-xs text-muted-foreground p-3">لا توجد مقررات بعد. الإدارة تضيفها من لوحة التحكم.</p>}
            {courses.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`w-full text-start px-3 py-2 rounded-lg text-xs sm:text-sm transition ${selected === c.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                <div className="font-bold truncate">{c.title}</div>
                <div className={`text-[10px] sm:text-[11px] ${selected === c.id ? "opacity-80" : "text-muted-foreground"}`}>{c.code} · {c.instructor}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          {!selected ? (
            <div className="bg-card border rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center">
              <Folder className="h-8 w-8 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-2 sm:mb-3" />
              <p className="text-muted-foreground text-sm">اختر مقرراً من القائمة لعرض ملفاته</p>
            </div>
          ) : (
            <>
              <div className="relative mb-3 sm:mb-4">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في الملفات..." className="ps-9 h-9 sm:h-10 text-sm" />
              </div>
              {filtered.length === 0 ? (
                <div className="bg-card border rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center">
                  <FileText className="h-8 w-8 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-2 sm:mb-3" />
                  <p className="text-muted-foreground text-sm">لا توجد ملفات لهذا المقرر بعد</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {filtered.map((f) => <FileCard key={f.id} f={f} />)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
