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
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl font-serif font-bold flex items-center gap-2"><Inbox className="h-5 w-5 sm:h-7 sm:w-7" /> الرسائل</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">محادثاتك الخاصة مع باقي الطلاب</p>
      </motion.div>

      {isLoading && <p className="text-center text-muted-foreground py-8 sm:py-12 text-sm">جاري التحميل...</p>}

      {!isLoading && !threads.length && (
        <div className="text-center py-12 sm:py-16 border-2 border-dashed rounded-xl sm:rounded-2xl">
          <MessageCircle className="h-8 w-8 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-2 sm:mb-3" />
          <p className="text-muted-foreground text-sm">لا توجد محادثات بعد.</p>
          <Link href="/students" className="inline-block mt-2 sm:mt-3 text-primary font-medium underline text-xs sm:text-sm">ابدأ محادثة من قائمة الطلاب</Link>
        </div>
      )}

      <div className="space-y-2">
        {threads.map((t, i) => t.other && (
          <motion.div key={t.threadId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
            <Link href={`/messages/${t.other.id}`}>
              <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-card border rounded-xl hover:bg-muted/40 transition cursor-pointer">
                {t.other.avatarUrl ? (
                  <img src={t.other.avatarUrl} alt={t.other.name} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-primary/20" />
                ) : (
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">{t.other.name.charAt(0)}</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs sm:text-sm truncate">{t.other.name}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">{timeAgo(t.lastMessageAt)}</div>
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground truncate">
                    {t.lastMessage ? (t.lastMessage.fromMe ? "أنت: " : "") + t.lastMessage.body : "لا توجد رسائل بعد"}
                  </div>
                </div>
                {t.unread > 0 && (
                  <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary text-primary-foreground text-[10px] sm:text-xs font-bold flex items-center justify-center flex-shrink-0">{t.unread}</span>
                )}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
