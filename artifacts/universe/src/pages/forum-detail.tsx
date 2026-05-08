import { useGetForumPost, useCreateForumReply, getGetForumPostQueryKey, useUpvoteForumPost } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { ChevronLeft, ThumbsUp, MessageSquare, CheckCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMeV2, useDeleteForumReply, useDeleteForumPost } from "@/lib/api";
import { api } from "@/lib/api";
import { formatISODateTime, formatISODate } from "@/lib/dates";

export default function ForumDetail() {
  const { id } = useParams<{ id: string }>();
  const postId = Number(id);
  const { data: post, isLoading } = useGetForumPost(postId, {
    query: { enabled: !!postId, queryKey: getGetForumPostQueryKey(postId) }
  });
  const createReply = useCreateForumReply();
  const upvotePost = useUpvoteForumPost();
  const { data: me } = useMeV2();
  const deleteReply = useDeleteForumReply();
  const deletePost = useDeleteForumPost();
  const queryClient = useQueryClient();
  const [replyBody, setReplyBody] = useState("");
  const [liked, setLiked] = useState(false);
  const isAdmin = me?.role === "admin" || me?.role === "super_admin";

  useEffect(() => {
    if (post && (post as any).likedByMe !== undefined) {
      setLiked(!!(post as any).likedByMe);
    }
  }, [post]);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>;
  if (!post) return <div className="p-8 text-center text-muted-foreground">المنشور غير موجود</div>;

  const handleReply = () => {
    if (!replyBody.trim()) return;
    createReply.mutate(
      { id: postId, data: { body: replyBody } },
      {
        onSuccess: () => {
          setReplyBody("");
          queryClient.invalidateQueries({ queryKey: getGetForumPostQueryKey(postId) });
        }
      }
    );
  };

  const handleUpvote = async () => {
    try {
      const res = await api.post(`/forum/posts/${postId}/upvote`);
      setLiked(!liked);
      queryClient.invalidateQueries({ queryKey: getGetForumPostQueryKey(postId) });
    } catch {}
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/forum" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4 me-1" />
        رجوع للمنتدى
      </Link>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden mb-8">
        <div className="p-6 md:p-8 flex gap-6">
          <div className="flex flex-col items-center gap-2 shrink-0">
            <Button variant={liked ? "default" : "outline"} size="icon" className={`rounded-full h-12 w-12 ${liked ? "bg-primary text-primary-foreground" : "hover:text-primary hover:border-primary hover:bg-primary/5"}`} onClick={handleUpvote}>
              <ThumbsUp className="w-5 h-5" />
            </Button>
            <span className="font-bold text-lg">{post.upvotes}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{post.category}</span>
                <span className="text-sm text-muted-foreground">{formatISODateTime(post.createdAt)}</span>
              </div>
              {isAdmin && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deletePost.mutate(postId)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold mb-6">{post.title}</h1>
            <div className="prose dark:prose-invert max-w-none text-muted-foreground">
              {post.body.split('\n').map((p, i) => <p key={i}>{p}</p>)}
            </div>
            
            <div className="mt-8 pt-6 border-t border-border flex items-center gap-3">
              <Link href={`/students/${post.author.id}`} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 overflow-hidden shrink-0 flex items-center justify-center font-bold text-primary">
                  {post.author.avatarUrl ? <img src={post.author.avatarUrl} alt={post.author.name} /> : post.author.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-sm">{post.author.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{post.author.role.replace('_', ' ')}</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          {post.replyCount} ردود
        </h3>
        
        <div className="space-y-4">
          {post.replies.map(reply => (
            <div key={reply.id} className={`bg-card p-6 rounded-2xl border ${reply.isBest ? 'border-green-500 shadow-sm' : 'border-border'}`}>
              {reply.isBest && (
                <div className="flex items-center gap-2 text-green-600 font-bold text-sm mb-4 bg-green-500/10 w-fit px-3 py-1 rounded-full">
                  <CheckCircle className="w-4 h-4" /> إجابة مقبولة
                </div>
              )}
              <div className="prose dark:prose-invert max-w-none text-sm text-foreground/90 mb-4">
                {reply.body.split('\n').map((p, i) => <p key={i}>{p}</p>)}
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                <Link href={`/students/${reply.author.id}`} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {reply.author.avatarUrl ? <img src={reply.author.avatarUrl} alt="" className="w-full h-full rounded-full" /> : reply.author.name.charAt(0)}
                  </div>
                  <span className="text-xs font-medium">{reply.author.name}</span>
                  <span className="text-xs text-muted-foreground mx-1">•</span>
                  <span className="text-xs text-muted-foreground">{formatISODate(reply.createdAt)}</span>
                </Link>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <ThumbsUp className="w-3 h-3" /> {reply.upvotes}
                  </div>
                  {isAdmin && (
                    <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0" onClick={() => deleteReply.mutate(reply.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
        <h3 className="font-bold mb-4">اكتب رد</h3>
        <Textarea 
          placeholder="شارك رأيك أو أجب على السؤال..." 
          className="min-h-[120px] mb-4 bg-background"
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
        />
        <div className="flex justify-end">
          <Button onClick={handleReply} disabled={!replyBody.trim() || createReply.isPending}>
            {createReply.isPending ? "جاري النشر..." : "نشر الرد"}
          </Button>
        </div>
      </div>
    </div>
  );
}
