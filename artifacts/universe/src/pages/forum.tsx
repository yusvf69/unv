import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, ThumbsUp, Plus, Send, Loader2, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useForumPosts, useCreatePost, useUpvotePost, useForumReplies, useReplyToPost, useMeV2, useDeleteForumReply, useDeleteForumPost } from "@/lib/api";
import { Link } from "wouter";

const CATEGORIES = ["عام", "محاضرات", "اختبارات", "أبحاث", "أنشطة", "اقتراحات"];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `منذ ${m}د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h}س`;
  return `منذ ${Math.floor(h / 24)}ي`;
}

function PostCard({ post }: { post: any }) {
  const me = useMeV2();
  const deleteReply = useDeleteForumReply();
  const deletePost = useDeleteForumPost();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const { data: replies = [] } = useForumReplies(open ? post.id : 0);
  const reply = useReplyToPost(post.id);
  const upvote = useUpvotePost();
  const isAdmin = me.data?.role === "admin" || me.data?.role === "super_admin";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const body = text.trim();
    setText("");
    try { await reply.mutateAsync(body); } catch {}
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-2xl p-4 sm:p-5">
      <div className="flex items-start gap-2 sm:gap-3">
        <Link href={`/students/${post.authorId}`} className="shrink-0">
          {post.authorAvatar ? (
            <img src={post.authorAvatar} alt={post.authorName} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border" />
          ) : (
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs sm:text-base">{post.authorName?.charAt(0) || "?"}</div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/students/${post.authorId}`} className="font-bold text-sm hover:text-primary transition">
                {post.authorName || `مستخدم #${post.authorId}`}
              </Link>
              {post.authorGroup && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">G{post.authorGroup}</span>}
              <span className="text-xs text-muted-foreground">· {timeAgo(post.createdAt)}</span>
              <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">{post.category}</span>
            </div>
            {isAdmin && (
              <Button size="sm" variant="ghost" className="text-destructive h-8 w-8 p-0 shrink-0" onClick={() => deletePost.mutate(post.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Link href={`/forum/${post.id}`} className="block">
            <h3 className="font-bold text-lg mt-1">{post.title}</h3>
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{post.body}</p>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4 ms-13">
        <Button size="sm" variant="ghost" onClick={() => upvote.mutate(post.id)} className="gap-1 text-xs">
          <ThumbsUp className="h-3.5 w-3.5" /> {post.upvotes}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(!open)} className="gap-1 text-xs">
          <MessageSquare className="h-3.5 w-3.5" /> {post.repliesCount} ردود
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 border-t pt-4 space-y-3 overflow-hidden">
            {replies.map((r) => (
              <div key={r.id} className="flex items-start gap-2 ps-4 border-s-2 border-primary/20">
                <Link href={`/students/${r.authorId}`} className="shrink-0">
                  {r.authorAvatar ? (
                    <img src={r.authorAvatar} alt={r.authorName} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-xs font-bold text-secondary">{r.authorName?.charAt(0) || "?"}</div>
                  )}
                </Link>
                <div className="flex-1 bg-muted/30 rounded-lg p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs">{r.authorName || "مستخدم"}</span>
                      {r.authorRole && r.authorRole !== "student" && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">{r.authorRole}</span>}
                      <span className="text-xs text-muted-foreground">· {timeAgo(r.createdAt)}</span>
                    </div>
                    {isAdmin && (
                      <Button size="sm" variant="ghost" className="text-destructive h-6 w-6 p-0" onClick={() => deleteReply.mutate(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{r.body}</p>
                </div>
              </div>
            ))}
            {me.data && (
              <form onSubmit={submit} className="flex gap-2 mt-2">
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب ردك..." className="text-sm" />
                <Button type="submit" size="sm" disabled={reply.isPending || !text.trim()}>
                  {reply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            )}
            {!me.data && <p className="text-xs text-muted-foreground text-center">سجّل دخولك للرد</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Forum() {
  const { data: posts = [], isLoading } = useForumPosts();
  const { data: me } = useMeV2();
  const create = useCreatePost();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [filter, setFilter] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast({ title: "العنوان والمحتوى مطلوبان", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({ title: title.trim(), body: body.trim(), category });
      toast({ title: "تم نشر الموضوع" });
      setTitle(""); setBody(""); setShowForm(false);
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  const visible = filter ? posts.filter((p) => p.category === filter) : posts;

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-3xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-8 gap-3">
        <div>
          <h1 className="text-2xl sm:text-4xl font-serif font-bold flex items-center gap-3">
            <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 text-primary" /> المنتدى
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">شارك، ناقش، وتعلم مع زملائك.</p>
        </div>
        <Button onClick={() => setNewDialog(true)} className="rounded-full w-full sm:w-auto">
          <Plus className="me-2 h-4 w-4" /> منشور جديد
        </Button>
      </div>

      <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2">
        {["الكل", ...CATEGORIES].map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold shrink-0 transition whitespace-nowrap ${category === c ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        <Button size="sm" variant={!filter ? "default" : "outline"} onClick={() => setFilter(null)}>الكل</Button>
        {CATEGORIES.map((c) => (
          <Button key={c} size="sm" variant={filter === c ? "default" : "outline"} onClick={() => setFilter(c)}>{c}</Button>
        ))}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            onSubmit={submit}
            className="bg-card border-2 border-primary/20 rounded-2xl p-4 mb-4 space-y-3 overflow-hidden"
          >
            <div>
              <Label className="text-xs">العنوان</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان مختصر" />
            </div>
            <div>
              <Label className="text-xs">المحتوى</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="اشرح فكرتك بالتفصيل..." />
            </div>
            <div>
              <Label className="text-xs">القسم</Label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "نشر"}
            </Button>
          </motion.form>
        )}
      </AnimatePresence>

      {isLoading && <p className="text-center text-muted-foreground py-12">جاري التحميل...</p>}
      {!isLoading && !visible.length && (
        <div className="text-center py-16 border-2 border-dashed rounded-2xl">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">لا توجد مواضيع بعد. كن أول من يبدأ النقاش!</p>
        </div>
      )}

      <div className="space-y-3">
        {visible.map((p) => <PostCard key={p.id} post={p} />)}
      </div>
    </div>
  );
}
