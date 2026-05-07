import { motion } from "framer-motion";
import { ShieldAlert, Sparkles, Eye, AlertOctagon, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetMe } from "@workspace/api-client-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface Talent {
  id: number;
  title: string;
  description: string;
  category: string;
  mediaUrl: string | null;
  status: string;
  votes: number;
  ownerId: number;
  ownerName?: string;
  ownerGroup?: string | null;
  createdAt: string;
}

export default function AdminTalents() {
  const { data: me } = useGetMe();
  const isAdmin = me?.role === "admin" || me?.role === "super_admin";
  const [talents, setTalents] = useState<Talent[]>([]);
  const [tab, setTab] = useState<"active" | "removed">("active");
  const [pick, setPick] = useState<Talent | null>(null);
  const [warning, setWarning] = useState("يرجى مراجعة سياسة المحتوى. هذه الموهبة لا تتوافق مع شروط النشر.");
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const load = async () => {
    if (!isAdmin) return;
    try {
      const data = await api.get<Talent[]>("/v2/admin/talents");
      setTalents(data);
    } catch {}
  };

  useEffect(() => { load(); }, [isAdmin]);

  if (!isAdmin) return <div className="container mx-auto p-12 text-center text-muted-foreground">صلاحياتك غير كافية.</div>;

  const submit = async () => {
    if (!pick) return;
    try {
      const r = await api.post<{ applied: boolean }>("/v2/admin/proposals", {
        action: "remove_talent",
        resourceKind: "talent",
        resourceId: pick.id,
        payload: { warning },
        reason,
      });
      toast({
        title: r.applied ? "تم الحذف وإرسال التحذير" : "أُرسل للموافقة",
        description: r.applied ? "تم بنجاح." : "ينتظر قرار السوبر أدمن.",
      });
      setPick(null); setReason("");
      load();
      qc.invalidateQueries({ queryKey: ["v2", "proposals"] });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  const list = talents.filter((t) => t.status === tab);

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl md:text-4xl font-serif font-bold flex items-center gap-2 sm:gap-3">
          <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-primary" /> مراجعة المواهب
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1 sm:mt-2">
          راجع المواهب المنشورة، وأرسل تحذيرات مخصصة للطلاب عند الحاجة.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="h-9 sm:h-10">
          <TabsTrigger value="active" data-testid="tab-active" className="text-xs sm:text-sm"><Eye className="me-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" /> نشطة ({talents.filter((t) => t.status === "active").length})</TabsTrigger>
          <TabsTrigger value="removed" data-testid="tab-removed" className="text-xs sm:text-sm"><Trash2 className="me-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" /> محذوفة ({talents.filter((t) => t.status === "removed").length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-6">
        {list.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="bg-card border-2 border-border rounded-xl sm:rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            {t.mediaUrl && <img src={t.mediaUrl} className="w-full h-32 sm:h-40 object-cover" alt="" />}
            <div className="p-3 sm:p-4">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className="text-[10px] bg-secondary/15 text-secondary-foreground px-2 py-0.5 rounded-full font-bold">{t.category}</span>
                {t.ownerGroup && (
                  <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-bold">مجموعة {t.ownerGroup}</span>
                )}
                {t.status === "removed" && (
                  <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">محذوفة</span>
                )}
              </div>
              <h3 className="font-bold text-sm sm:text-base">{t.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
              <div className="text-xs text-muted-foreground mt-2">بواسطة: <strong>{t.ownerName}</strong></div>
              {t.status === "active" && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="w-full mt-3 text-xs h-8 sm:h-9"
                  onClick={() => setPick(t)}
                  data-testid={`button-warn-${t.id}`}
                >
                  <AlertOctagon className="me-1.5 h-3 w-3 sm:h-4 sm:w-4" /> حذف وإرسال تحذير
                </Button>
              )}
            </div>
          </motion.div>
        ))}
        {list.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3 text-center bg-muted/30 rounded-xl sm:rounded-2xl p-8 sm:p-12 text-muted-foreground text-sm">
            لا توجد مواهب في هذه الحالة.
          </div>
        )}
      </div>

      <Dialog open={!!pick} onOpenChange={(o) => !o && setPick(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5 text-rose-600" /> حذف الموهبة "{pick?.title}"
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">سبب الحذف (داخلي)</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} data-testid="input-reason" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">رسالة التحذير المُرسَلة للطالب</Label>
              <Textarea rows={4} value={warning} onChange={(e) => setWarning(e.target.value)} data-testid="input-warning" className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPick(null)} className="text-xs sm:text-sm">إلغاء</Button>
            <Button variant="destructive" onClick={submit} data-testid="button-submit-warn" className="text-xs sm:text-sm">
              {me?.role === "super_admin" ? "حذف فوري" : "إرسال للموافقة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
