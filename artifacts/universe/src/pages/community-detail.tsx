import { useState } from "react";
import { Link, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, ChevronLeft, GraduationCap, Heart, Loader2, MessageSquare,
  Send, Trash2, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import FileUpload from "@/components/file-upload";
import { useToast } from "@/hooks/use-toast";
import {
  useAddCommunityComment, useCommunity, useCommunityComments, useCommunityPosts,
  useCreateCommunityPost, useDeleteCommunityComment, useDeleteCommunityPost,
  useMeV2, useToggleCommunityPostLike, type CommunityPostRow,
} from "@/lib/api";
import { useTranslation, globalI18n } from "@/lib/i18n";

const translations = {
  ...globalI18n,
  backToCommunities: { ar: "كل المجتمعات", en: "All communities" },
  communityLocked: { ar: "المجتمع ده مخصص لطلاب الجامعة/الكلية/الدفعة بتاعته — تقدر تقرأ بس.", en: "This community is for its university/faculty/cohort members — read only." },
  writePost: { ar: "اكتب حاجة لمجتمعك...", en: "Write something for your community..." },
  publish: { ar: "نشر", en: "Post" },
  publishing: { ar: "جاري النشر...", en: "Posting..." },
  attachImage: { ar: "إضافة صورة (اختياري)", en: "Add image (optional)" },
  noPosts: { ar: "لسه مفيش منشورات — ابدأ أنت!", en: "No posts yet — be the first!" },
  comments: { ar: "تعليقات", en: "comments" },
  addComment: { ar: "اكتب تعليق...", en: "Write a comment..." },
  send: { ar: "إرسال", en: "Send" },
  postDeleted: { ar: "تم حذف المنشور", en: "Post deleted" },
  commentDeleted: { ar: "تم حذف التعليق", en: "Comment deleted" },
  like: { ar: "إعجاب", en: "Like" },
  members: { ar: "عضو", en: "members" },
  posts: { ar: "منشور", en: "posts" },
  memberBadge: { ar: "عضو في المجتمع", en: "Member" },
  universityKind: { ar: "جامعة", en: "University" },
  facultyKind: { ar: "كلية", en: "Faculty" },
  cohortKind: { ar: "دفعة", en: "Cohort" },
  communityNotFound: { ar: "المجتمع غير موجود", en: "Community not found" },
};

function timeAgo(iso: string, t: (key: string) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("now");
  if (m < 60) return t("timeAgoMin").replace("{m}", String(m));
  const h = Math.floor(m / 60);
  if (h < 24) return t("timeAgoHour").replace("{h}", String(h));
  return t("timeAgoDay").replace("{d}", String(Math.floor(h / 24)));
}

function Avatar({ name, src, size = "w-9 h-9" }: { name: string; src: string | null; size?: string }) {
  return src ? (
    <img src={src} alt={name} className={`${size} rounded-full object-cover border shrink-0`} />
  ) : (
    <div className={`${size} rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0`}>
      {name?.charAt(0) || "?"}
    </div>
  );
}

function PostComments({ post, isAdmin, meId, t }: { post: CommunityPostRow; isAdmin: boolean; meId?: number; t: (key: string) => string }) {
  const { data: comments = [], isLoading } = useCommunityComments(post.id);
  const addComment = useAddCommunityComment(post.id, post.communityId);
  const deleteComment = useDeleteCommunityComment(post.id, post.communityId);
  const [text, setText] = useState("");
  const { toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    try {
      await addComment.mutateAsync(body);
    } catch (err) {
      setText(body);
      toast({ title: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="mt-3 border-t pt-3 space-y-3">
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("noCommentsYet")}</p>
      ) : (
        comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2 ps-2 border-s-2 border-primary/20">
            <Link href={`/students/${c.authorId}`}><Avatar name={c.authorName} src={c.authorAvatar} size="w-7 h-7" /></Link>
            <div className="flex-1 bg-muted/30 rounded-lg px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/students/${c.authorId}`} className="font-bold text-xs hover:text-primary">{c.authorName || t("user")}</Link>
                  <span className="text-[10px] text-muted-foreground">· {timeAgo(c.createdAt, t)}</span>
                </div>
                {(isAdmin || c.authorId === meId) && (
                  <Button
                    size="sm" variant="ghost" className="text-destructive h-6 w-6 p-0"
                    onClick={() => deleteComment.mutate(c.id, { onSuccess: () => toast({ title: t("commentDeleted") }) })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <p className="text-xs whitespace-pre-wrap mt-0.5">{c.body}</p>
            </div>
          </div>
        ))
      )}
      <form onSubmit={submit} className="flex items-center gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("addComment")} className="h-9 text-sm" />
        <Button type="submit" size="sm" disabled={addComment.isPending || !text.trim()} className="h-9 shrink-0">
          {addComment.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  );
}

function PostCard({ post, isAdmin, meId, t }: { post: CommunityPostRow; isAdmin: boolean; meId?: number; t: (key: string) => string }) {
  const like = useToggleCommunityPostLike(post.communityId);
  const deletePost = useDeleteCommunityPost(post.communityId);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <Link href={`/students/${post.authorId}`}><Avatar name={post.authorName} src={post.authorAvatar} /></Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/students/${post.authorId}`} className="font-bold text-sm hover:text-primary">{post.authorName || t("user")}</Link>
              {post.authorGroup && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">G{post.authorGroup}</span>}
              <span className="text-xs text-muted-foreground">· {timeAgo(post.createdAt, t)}</span>
            </div>
            {(isAdmin || post.authorId === meId) && (
              <Button
                size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0 shrink-0"
                onClick={() => deletePost.mutate(post.id, { onSuccess: () => toast({ title: t("postDeleted") }) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-sm whitespace-pre-wrap mt-1.5">{post.body}</p>
          {post.imageUrl && (
            <img src={post.imageUrl} alt="" className="mt-2 rounded-xl max-h-80 w-full object-cover border" />
          )}
          <div className="flex items-center gap-1 mt-3">
            <Button
              size="sm" variant="ghost" onClick={() => like.mutate(post.id)}
              className={`gap-1 text-xs ${post.likedByMe ? "text-rose-600" : "text-muted-foreground"}`}
            >
              <Heart className={`h-4 w-4 ${post.likedByMe ? "fill-current" : ""}`} /> {post.likes}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(!open)} className="gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-4 w-4" /> {post.comments}
            </Button>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <PostComments post={post} isAdmin={isAdmin} meId={meId} t={t} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function CommunityDetail() {
  const { id } = useParams<{ id: string }>();
  const communityId = Number(id);
  const t = useTranslation(translations);
  const { toast } = useToast();
  const { data: community, isLoading: loadingCommunity } = useCommunity(communityId || null);
  const { data: posts = [], isLoading: loadingPosts } = useCommunityPosts(communityId || null);
  const { data: me } = useMeV2();
  const createPost = useCreateCommunityPost(communityId);
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const isAdmin = me?.role === "admin" || me?.role === "super_admin" || !!community?.isAdmin;
  const canPost = !!community?.isMember || isAdmin;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    try {
      await createPost.mutateAsync({ body: text, imageUrl });
      setBody("");
      setImageUrl(null);
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" });
    }
  };

  if (loadingCommunity) {
    return <div className="py-24 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>;
  }

  if (!community) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <p className="text-muted-foreground mb-4">{t("communityNotFound")}</p>
        <Link href="/communities" className="text-primary font-bold underline">{t("backToCommunities")}</Link>
      </div>
    );
  }

  const kindLabel = community.kind === "university" ? t("universityKind") : community.kind === "faculty" ? t("facultyKind") : t("cohortKind");

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-3xl">
      <Link href="/communities" className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-primary mb-4">
        <ChevronLeft className="w-4 h-4 rotate-180 rtl:rotate-0" /> {t("backToCommunities")}
      </Link>

      <div className="bg-gradient-to-l from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-4 sm:p-6 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
            {community.kind === "university" ? <Building2 className="w-6 h-6 text-primary" />
              : community.kind === "faculty" ? <GraduationCap className="w-6 h-6 text-primary" />
              : <Users className="w-6 h-6 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{kindLabel}</span>
            <h1 className="font-extrabold text-xl sm:text-2xl mt-1">{community.nameAr}</h1>
            {community.description && <p className="text-xs sm:text-sm text-muted-foreground mt-1">{community.description}</p>}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
              <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {community.membersCount} {t("members")}</span>
              <span className="inline-flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> {community.postsCount} {t("posts")}</span>
              {community.isMember && <span className="bg-emerald-500/10 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{t("memberBadge")}</span>}
            </div>
          </div>
        </div>
      </div>

      {canPost ? (
        <form onSubmit={submit} className="bg-card border rounded-2xl p-4 mb-5 space-y-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("writePost")}
            className="min-h-[90px] resize-none"
            maxLength={3000}
          />
          <div className="flex items-end justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 max-w-[220px]">
              <FileUpload value={imageUrl} onChange={(d) => setImageUrl(d)} label={t("attachImage")} maxSizeKb={600} className="text-xs" />
            </div>
            <Button type="submit" disabled={createPost.isPending || !body.trim()} className="gap-1">
              {createPost.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {createPost.isPending ? t("publishing") : t("publish")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="bg-muted/30 border border-dashed rounded-2xl p-4 text-center text-xs sm:text-sm text-muted-foreground mb-5">
          {t("communityLocked")}
        </div>
      )}

      {loadingPosts ? (
        <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : posts.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground bg-muted/20 rounded-2xl border border-dashed">{t("noPosts")}</div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} isAdmin={isAdmin} meId={me?.id} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
