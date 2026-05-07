import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Share2,
  Plus,
  X,
  Loader2,
  Sparkles,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { useTalentsFeed, api, type TalentFeedItem, useDeleteTalent } from "@/lib/api";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import FileUpload from "@/components/file-upload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function CommentSheet({ talentId, open, onClose }: { talentId: number; open: boolean; onClose: () => void }) {
  const [body, setBody] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setComments(await api.get<any[]>(`/v2/talents/${talentId}/comments`));
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    if (!body.trim()) return;
    await api.post(`/v2/talents/${talentId}/comments`, { body });
    setBody("");
    await load();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) load(); else onClose(); }}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>التعليقات</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && <Loader2 className="h-5 w-5 animate-spin mx-auto" />}
          {comments.length === 0 && !loading && (
            <div className="text-sm text-muted-foreground text-center py-8">كن أول من يعلّق</div>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3 items-start">
              <img src={c.authorAvatar || "https://i.pravatar.cc/40"} className="w-8 h-8 rounded-full" />
              <div className="flex-1 bg-muted/40 rounded-2xl p-3">
                <div className="text-xs font-bold mb-0.5">{c.authorName}</div>
                <div className="text-sm">{c.body}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t flex gap-2">
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="اكتب تعليقاً..."
            onKeyDown={(e) => e.key === "Enter" && send()}
            data-testid="input-comment"
          />
          <Button onClick={send} data-testid="button-send-comment">إرسال</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TalentCard({ talent, isAdmin }: { talent: TalentFeedItem; isAdmin: boolean }) {
  const qc = useQueryClient();
  const deleteTalent = useDeleteTalent();
  const [liked, setLiked] = useState(talent.likedByMe);
  const [count, setCount] = useState(talent.likesCount);
  const [showComments, setShowComments] = useState(false);
  const [showModerate, setShowModerate] = useState(false);
  const [warning, setWarning] = useState("يرجى مراجعة سياسة المحتوى وتقديم منشور بصياغة مهنية.");
  const [reason, setReason] = useState("");
  const { toast } = useToast();

  const toggleLike = async () => {
    setLiked(!liked);
    setCount((c) => c + (liked ? -1 : 1));
    try {
      await api.post(`/v2/talents/${talent.id}/like`);
    } catch {
      setLiked(liked);
      setCount(talent.likesCount);
    }
  };

  const proposeRemove = async () => {
    try {
      await api.post("/v2/admin/proposals", {
        action: "remove_talent",
        resourceKind: "talent",
        resourceId: talent.id,
        payload: { warning },
        reason,
      });
      toast({ title: "تم إرسال الاقتراح", description: "السوبر أدمن يحتاج للموافقة قبل التنفيذ." });
      setShowModerate(false);
      qc.invalidateQueries({ queryKey: ["v2", "proposals"] });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-card rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-border shadow-lg shadow-primary/5"
      data-testid={`talent-card-${talent.id}`}
    >
      <div className="flex items-center justify-between p-3 sm:p-4">
        <Link href={`/students/${talent.ownerId}`} className="flex items-center gap-2 sm:gap-3 min-w-0">
          <img
            src={talent.owner?.avatarUrl || "https://i.pravatar.cc/40"}
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-full ring-2 ring-primary/30 shrink-0"
            alt=""
          />
          <div className="min-w-0">
            <div className="font-bold text-xs sm:text-sm flex items-center gap-1.5 truncate">
              {talent.owner?.name}
              {talent.owner?.groupName && (
                <span className="text-[9px] sm:text-[10px] bg-primary/15 text-primary px-1 sm:px-1.5 py-0.5 rounded-full font-bold shrink-0">
                  {talent.owner.groupName}
                </span>
              )}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{talent.owner?.department}</div>
          </div>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <span className="text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 bg-secondary/15 text-secondary-foreground rounded-full font-bold">
            {talent.category}
          </span>
          {isAdmin && (
            <>
              <Button size="icon" variant="ghost" onClick={() => setShowModerate(true)} data-testid={`button-moderate-${talent.id}`} className="h-7 w-7 sm:h-9 sm:w-9">
                <ShieldAlert className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-600" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => { if (confirm("هل تريد حذف هذا المنشور نهائياً؟")) deleteTalent.mutate(talent.id); }} className="h-7 w-7 sm:h-9 sm:w-9">
                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </div>

      {talent.mediaUrl && (
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          <motion.img
            src={talent.mediaUrl}
            alt={talent.title}
            className="w-full h-full object-cover"
            initial={{ scale: 1.05 }}
            whileInView={{ scale: 1 }}
            transition={{ duration: 0.8 }}
          />
        </div>
      )}

      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <button
            onClick={toggleLike}
            className="hover-elevate active-elevate p-1.5 sm:p-2 rounded-full -ms-2"
            data-testid={`button-like-${talent.id}`}
          >
            <motion.div animate={{ scale: liked ? [1, 1.4, 1] : 1 }} transition={{ duration: 0.4 }}>
              <Heart className={`h-5 w-5 sm:h-6 sm:w-6 ${liked ? "fill-rose-500 text-rose-500" : ""}`} />
            </motion.div>
          </button>
          <button
            onClick={() => setShowComments(true)}
            className="hover-elevate p-1.5 sm:p-2 rounded-full"
            data-testid={`button-comments-${talent.id}`}
          >
            <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <button className="hover-elevate p-1.5 sm:p-2 rounded-full">
            <Share2 className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>
        <div className="text-xs sm:text-sm font-bold mb-1">{count.toLocaleString("ar-EG")} إعجاب</div>
        <h3 className="font-bold text-base sm:text-lg leading-snug">{talent.title}</h3>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">{talent.description}</p>
        {talent.commentsCount > 0 && (
          <button
            onClick={() => setShowComments(true)}
            className="text-xs text-muted-foreground mt-2 hover:underline"
          >
            عرض كل {talent.commentsCount} تعليقات
          </button>
        )}
      </div>

      <CommentSheet talentId={talent.id} open={showComments} onClose={() => setShowComments(false)} />

      <Dialog open={showModerate} onOpenChange={setShowModerate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-600" />
              حذف الموهبة وتحذير الطالب
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">سبب الحذف (داخلي)</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="اكتب السبب..." />
            </div>
            <div>
              <Label className="text-xs">رسالة التحذير للطالب</Label>
              <Textarea value={warning} onChange={(e) => setWarning(e.target.value)} rows={4} />
            </div>
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              سيتم إرسال هذا الاقتراح إلى السوبر أدمن للموافقة قبل تنفيذ الحذف وإرسال التحذير.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowModerate(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={proposeRemove} data-testid={`button-confirm-moderate-${talent.id}`}>
              إرسال للموافقة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.article>
  );
}

function NewTalentDialog() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("ابتكار");
  const [description, setDescription] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");

  const submit = async () => {
    if (!title || !description) {
      toast({ title: "العنوان والوصف مطلوبان", variant: "destructive" });
      return;
    }
    try {
      await api.post("/v2/talents", { title, category, description, mediaUrl: mediaUrl || null });
      toast({ title: "تم نشر موهبتك" });
      setOpen(false);
      setTitle(""); setDescription(""); setMediaUrl("");
      qc.invalidateQueries({ queryKey: ["v2", "talents-feed"] });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-primary to-secondary rounded-full" data-testid="button-new-talent">
          <Plus className="me-2 h-4 w-4" /> أضف موهبة
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> شارك موهبتك
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">العنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان مميز..." data-testid="input-talent-title" />
          </div>
          <div>
            <Label className="text-xs">التصنيف</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="ابتكار / فنون / تصوير..." />
          </div>
          <div>
            <Label className="text-xs">الوصف</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} data-testid="input-talent-description" />
          </div>
          <div>
            <Label className="text-xs">صورة الموهبة (اختياري)</Label>
            <FileUpload value={mediaUrl || null} onChange={(v) => setMediaUrl(v || "")} accept="image/*" maxSizeKb={1500} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={submit} data-testid="button-submit-talent">نشر</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Talents() {
  const { data: feed, isLoading } = useTalentsFeed();
  const { data: me } = useGetMe();
  const isAdmin = me?.role === "admin" || me?.role === "super_admin";

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-3xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-3">
        <div>
          <h1 className="text-2xl sm:text-4xl font-serif font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            مواهب الطلاب
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">شارك، أعجب، علّق — مجتمع مواهب كلية الزراعة.</p>
        </div>
        <NewTalentDialog />
      </div>

      {isLoading && <Loader2 className="h-8 w-8 mx-auto animate-spin" />}

      <div className="space-y-6">
        <AnimatePresence>
          {(feed ?? []).map((t) => (
            <TalentCard key={t.id} talent={t} isAdmin={isAdmin} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
