import { Link } from "wouter";
import { motion } from "framer-motion";
import { MessageCircle, Inbox } from "lucide-react";
import { useDmThreads } from "@/lib/api";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `منذ ${m}د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h}س`;
  return `منذ ${Math.floor(h / 24)}ي`;
}

export default function Messages() {
  const { data: threads = [], isLoading } = useDmThreads();

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-3xl font-serif font-bold flex items-center gap-2"><Inbox className="h-7 w-7" /> الرسائل</h1>
        <p className="text-sm text-muted-foreground mt-1">محادثاتك الخاصة مع باقي الطلاب</p>
      </motion.div>

      {isLoading && <p className="text-center text-muted-foreground py-12">جاري التحميل...</p>}

      {!isLoading && !threads.length && (
        <div className="text-center py-16 border-2 border-dashed rounded-2xl">
          <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">لا توجد محادثات بعد.</p>
          <Link href="/students" className="inline-block mt-3 text-primary font-medium underline">ابدأ محادثة من قائمة الطلاب</Link>
        </div>
      )}

      <div className="space-y-2">
        {threads.map((t, i) => t.other && (
          <motion.div key={t.threadId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
            <Link href={`/messages/${t.other.id}`}>
              <div className="flex items-center gap-3 p-3 bg-card border rounded-xl hover:bg-muted/40 transition cursor-pointer">
                {t.other.avatarUrl ? (
                  <img src={t.other.avatarUrl} alt={t.other.name} className="w-12 h-12 rounded-full object-cover border-2 border-primary/20" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">{t.other.name.charAt(0)}</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-bold truncate">{t.other.name}</div>
                    <div className="text-xs text-muted-foreground">{timeAgo(t.lastMessageAt)}</div>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {t.lastMessage ? (t.lastMessage.fromMe ? "أنت: " : "") + t.lastMessage.body : "لا توجد رسائل بعد"}
                  </div>
                </div>
                {t.unread > 0 && (
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">{t.unread}</span>
                )}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
