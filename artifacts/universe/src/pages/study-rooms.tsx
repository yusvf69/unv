import { useState } from "react";
import { motion } from "framer-motion";
import {
  Users, BookOpen, Plus, LogIn, LogOut, ChevronRight,
  MessageSquare, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStudyRooms, useCreateStudyRoom, useJoinStudyRoom, useLeaveStudyRoom } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function StudyRooms() {
  const [, setLocation] = useLocation();
  const { data: rooms = [], isLoading } = useStudyRooms();
  const createRoom = useCreateStudyRoom();
  const joinRoom = useJoinStudyRoom();
  const leaveRoom = useLeaveStudyRoom();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      await createRoom.mutateAsync({ title: newTitle, description: newDesc });
      toast({ title: "تم إنشاء الغرفة" });
      setShowCreate(false);
      setNewTitle("");
      setNewDesc("");
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <button onClick={() => setLocation("/skills")} className="inline-flex items-center text-xs sm:text-sm text-muted-foreground hover:text-primary mb-3 transition-colors">
          <ChevronRight className="h-3.5 w-3.5 ml-1" />العودة
        </button>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary/10 via-secondary/5 to-background border rounded-xl sm:rounded-2xl p-3 sm:p-5 mb-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10"><Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /></div>
              <div>
                <h1 className="font-bold text-base sm:text-xl">غرف الدراسة الجماعية</h1>
                <p className="text-xs text-muted-foreground">ادرس مع زملائك في نفس المسار</p>
              </div>
            </div>
            <Button size="sm" onClick={() => setShowCreate(!showCreate)} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> غرفة جديدة
            </Button>
          </div>
        </motion.div>

        {showCreate && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border rounded-xl p-3 sm:p-4 mb-4 space-y-2"
          >
            <div>
              <Label className="text-xs">عنوان الغرفة</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="مثال: مراجعة تربة 2" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">وصف (اختياري)</Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="مثال: للمجموعة 3 - وقاية نبات" className="h-9 text-sm" />
            </div>
            <Button size="sm" onClick={handleCreate} disabled={createRoom.isPending || !newTitle.trim()} className="w-full">
              {createRoom.isPending ? "..." : "إنشاء"}
            </Button>
          </motion.div>
        )}

        {isLoading ? (
          <div className="text-center py-16 text-sm text-muted-foreground">جاري التحميل...</div>
        ) : (
          <div className="space-y-2">
            {rooms.map((room, i) => (
              <motion.div key={room.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="bg-card border rounded-xl p-3 sm:p-4 flex items-center gap-3"
              >
                <div className="p-2 rounded-lg bg-primary/5"><BookOpen className="h-4 w-4 text-primary" /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm flex items-center gap-2">
                    {room.title}
                    {room.isMember && <Badge className="text-[9px] bg-emerald-500">عضو</Badge>}
                  </div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                    <span>{room.createdByName}</span>
                    {room.trackTitle && <><span>·</span><span>{room.trackTitle}</span></>}
                    <span>·</span>
                    <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{room.memberCount}</span>
                  </div>
                  {room.description && <p className="text-[10px] text-muted-foreground mt-0.5">{room.description}</p>}
                </div>
                {room.isMember ? (
                  <Button size="sm" variant="outline" className="h-8 text-[10px]" onClick={async () => {
                    try { await leaveRoom.mutateAsync(room.id); toast({ title: "غادرت الغرفة" }); }
                    catch (e) { toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" }); }
                  }}>
                    <LogOut className="h-3 w-3 ml-1" /> مغادرة
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-8 text-[10px]" onClick={async () => {
                    try { await joinRoom.mutateAsync(room.id); toast({ title: "انضممت للغرفة" }); }
                    catch (e) { toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" }); }
                  }}>
                    <LogIn className="h-3 w-3 ml-1" /> انضمام
                  </Button>
                )}
              </motion.div>
            ))}
            {!rooms.length && <p className="text-center py-16 text-sm text-muted-foreground">لا توجد غرف بعد. أنشئ أول غرفة!</p>}
          </div>
        )}
      </div>
    </div>
  );
}
