import { useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, ArrowLeft, Eye, Users, Clock } from "lucide-react";
import { useMeV2, useAdminDmThreads, useAdminDmConversation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatISODate, formatISOTime } from "@/lib/dates";

export default function AdminDmMonitor() {
  const { data: me } = useMeV2();
  const { data: threads = [] } = useAdminDmThreads();
  const [selectedThread, setSelectedThread] = useState<number | null>(null);
  const { data: conversation } = useAdminDmConversation(selectedThread || 0);

  if (!me || me.role !== "super_admin") {
    return <div className="p-12 text-center text-muted-foreground">صلاحياتك غير كافية</div>;
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "الآن";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} د`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} س`;
    return formatISODate(d.toISOString());
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl font-serif font-bold flex items-center gap-2"><MessageSquare className="h-5 w-5 sm:h-7 sm:w-7" /> مراقبة المحادثات</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">عرض جميع المحادثات بين الطلاب</p>
      </motion.div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-3 sm:gap-4">
        {/* threads list */}
        <div className="bg-card border rounded-xl sm:rounded-2xl overflow-hidden">
          <div className="p-2 sm:p-3 border-b bg-muted/30 flex items-center gap-2">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            <span className="font-bold text-xs sm:text-sm">المحادثات ({threads.length})</span>
          </div>
          <div className="max-h-[40vh] sm:max-h-[70vh] overflow-y-auto">
            {!threads.length && (
              <div className="p-6 sm:p-8 text-center text-muted-foreground text-xs sm:text-sm">لا توجد محادثات</div>
            )}
            {threads.map((t) => (
              <button
                key={t.threadId}
                onClick={() => setSelectedThread(t.threadId)}
                className={`w-full text-start p-2 sm:p-3 border-b last:border-b-0 transition ${selectedThread === t.threadId ? "bg-primary/10 border-r-4 border-r-primary" : "hover:bg-muted/30"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {t.userA?.avatarUrl ? (
                    <img src={t.userA.avatarUrl} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] sm:text-xs font-bold">{t.userA?.name?.[0] || "?"}</div>
                  )}
                  <span className="text-[10px] sm:text-xs text-muted-foreground">↔</span>
                  {t.userB?.avatarUrl ? (
                    <img src={t.userB.avatarUrl} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-secondary/20 flex items-center justify-center text-[10px] sm:text-xs font-bold">{t.userB?.name?.[0] || "?"}</div>
                  )}
                  <div className="flex-1 min-w-0 ms-1">
                    <div className="text-[10px] sm:text-xs font-bold truncate">{t.userA?.name} و {t.userB?.name}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] flex-shrink-0">{t.totalMessages}</Badge>
                </div>
                {t.lastMessage && (
                  <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-muted-foreground mt-1">
                    <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    <span className="truncate">{t.lastMessage.body.slice(0, 40)}</span>
                    <span className="flex-shrink-0">{formatTime(t.lastMessage.createdAt)}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* conversation view */}
        <div className="bg-card border rounded-xl sm:rounded-2xl overflow-hidden">
          {!selectedThread || !conversation ? (
            <div className="p-8 sm:p-16 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-20" />
              <p className="font-bold text-sm sm:text-base">اختر محادثة لعرضها</p>
            </div>
          ) : (
            <>
              {/* header */}
              <div className="p-3 sm:p-4 border-b bg-muted/30 flex items-center gap-2 sm:gap-3">
                <Button size="sm" variant="ghost" onClick={() => setSelectedThread(null)} className="p-1 h-7 sm:h-8">
                  <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 flex-wrap">
                  <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                    {conversation.userA?.avatarUrl && <img src={conversation.userA.avatarUrl} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover" />}
                    {!conversation.userA?.avatarUrl && <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs sm:text-sm font-bold">{conversation.userA?.name?.[0] || "?"}</div>}
                    <span className="text-xs sm:text-sm font-bold truncate">{conversation.userA?.name}</span>
                  </div>
                  <span className="text-muted-foreground text-[10px] sm:text-xs">↔</span>
                  <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                    {conversation.userB?.avatarUrl && <img src={conversation.userB.avatarUrl} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover" />}
                    {!conversation.userB?.avatarUrl && <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-secondary/20 flex items-center justify-center text-xs sm:text-sm font-bold">{conversation.userB?.name?.[0] || "?"}</div>}
                    <span className="text-xs sm:text-sm font-bold truncate">{conversation.userB?.name}</span>
                  </div>
                </div>
              </div>

              {/* messages */}
              <div className="max-h-[40vh] sm:max-h-[60vh] overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3 bg-gradient-to-b from-muted/10 to-background">
                {!conversation.messages.length && (
                  <div className="text-center text-muted-foreground text-xs sm:text-sm py-8">لا توجد رسائل</div>
                )}
                {conversation.messages.map((m) => {
                  const isUserA = m.fromId === conversation.userA?.id;
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-start gap-1.5 sm:gap-2 ${isUserA ? "flex-row" : "flex-row-reverse"}`}
                    >
                      <div className="flex-shrink-0">
                        {m.fromAvatar ? (
                          <img src={m.fromAvatar} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover" />
                        ) : (
                          <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold ${isUserA ? "bg-primary/20 text-primary" : "bg-secondary/20 text-secondary"}`}>
                            {m.fromName[0]}
                          </div>
                        )}
                      </div>
                      <div className={`max-w-[75%] sm:max-w-[70%] ${isUserA ? "ms-1" : "me-1"}`}>
                        <div className="text-[10px] text-muted-foreground mb-0.5">{m.fromName}</div>
                        <div className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm ${isUserA ? "bg-primary/10 rounded-se-none" : "bg-muted rounded-sw-none"}`}>
                          {m.body}
                        </div>
                        <div className={`text-[10px] text-muted-foreground mt-0.5 ${isUserA ? "text-start" : "text-end"}`}>
                          {formatISOTime(m.createdAt)}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
