import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDmWith, useSendDm } from "@/lib/api";

export default function DmThread() {
  const { id } = useParams();
  const userId = Number(id || 0);
  const { data, isLoading } = useDmWith(userId);
  const send = useSendDm(userId);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [data?.messages?.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const body = text.trim();
    setText("");
    try { await send.mutateAsync(body); } catch {}
  };

  if (isLoading) return <div className="p-12 text-center">جاري التحميل...</div>;

  return (
    <div className="container mx-auto max-w-2xl flex flex-col" style={{ height: "calc(100vh - 4rem)" }}>
      {/* header */}
      <div className="border-b bg-card p-3 flex items-center gap-3">
        <Link href="/messages"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        {data?.other ? (
          <>
            {data.other.avatarUrl ? (
              <img src={data.other.avatarUrl} alt={data.other.name} className="w-10 h-10 rounded-full object-cover border" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">{data.other.name?.charAt(0)}</div>
            )}
            <div>
              <div className="font-bold leading-tight">{data.other.name}</div>
              <div className="text-xs text-muted-foreground">{data.other.specialization || data.other.groupName || ""}</div>
            </div>
          </>
        ) : <div className="text-muted-foreground">غير معروف</div>}
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
        {(data?.messages ?? []).map((m) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${m.fromMe ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
              {m.body}
              <div className={`text-[10px] mt-1 ${m.fromMe ? "opacity-70" : "text-muted-foreground"}`}>
                {new Date(m.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </motion.div>
        ))}
        {!data?.messages?.length && <p className="text-center text-muted-foreground py-12">ابدأ المحادثة برسالتك الأولى</p>}
      </div>

      <form onSubmit={submit} className="border-t bg-card p-3 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب رسالة..." className="flex-1" />
        <Button type="submit" disabled={send.isPending || !text.trim()}>
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
