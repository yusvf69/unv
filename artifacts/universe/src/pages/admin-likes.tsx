import { useAdminLikes } from "@/lib/api";
import { motion } from "framer-motion";
import { ThumbsUp, MessageSquare, Clock, User, ArrowLeft } from "lucide-react";

export default function AdminLikes() {
  const { data, isLoading } = useAdminLikes();

  if (isLoading) {
    return <div className="p-12 text-center text-muted-foreground">جارِ التحميل...</div>;
  }

  const allItems = [
    ...(data?.talentLikes ?? []).map((l) => ({ ...l, type: "لايك" })),
    ...(data?.forumLikes ?? []).map((l) => ({ ...l, type: "لايك" })),
    ...(data?.forumReplies ?? []).map((l) => ({ ...l, type: "رد", body: l.body })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin/dashboard" className="p-2 hover:bg-muted rounded-lg transition"><ArrowLeft /></a>
        <h1 className="text-xl sm:text-2xl font-bold">الإعجابات والردود</h1>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "لايكات المواهب", count: data?.talentLikes.length ?? 0, color: "text-rose-500" },
          { label: "لايكات المنتدى", count: data?.forumLikes.length ?? 0, color: "text-sky-500" },
          { label: "الردود", count: data?.forumReplies.length ?? 0, color: "text-emerald-500" },
        ].map((s) => (
          <div key={s.label} className="card border-2 p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-sm text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {allItems.map((item, i) => (
          <motion.div
            key={`${item.type}-${item.id}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02 }}
            className="border-2 rounded-xl p-3 sm:p-4 flex items-start gap-3"
          >
            <div className="p-2 rounded-lg bg-muted flex-shrink-0">
              {item.type === "لايك" ? (
                <ThumbsUp className="h-4 w-4 text-orange-500" />
              ) : (
                <MessageSquare className="h-4 w-4 text-emerald-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{item.user_name}</span>
                <span className="text-xs text-muted-foreground">@{item.username}</span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded">{item.type}</span>
                <span className="text-xs text-muted-foreground"><Clock className="h-3 w-3 inline" /> {item.createdAt ? new Date(item.createdAt).toLocaleString("ar-EG") : ""}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1 truncate">{item.post_title}</div>
              {item.body && <div className="text-sm text-foreground mt-1 line-clamp-2">{item.body}</div>}
            </div>
          </motion.div>
        ))}

        {allItems.length === 0 && (
          <div className="text-center text-muted-foreground py-12">لا توجد إعجابات أو ردود</div>
        )}
      </div>
    </div>
  );
}
