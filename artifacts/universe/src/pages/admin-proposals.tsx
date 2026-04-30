import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Check,
  X,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGetMe } from "@workspace/api-client-react";
import { useProposals, api, type AdminProposal } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const ACTION_LABEL: Record<string, string> = {
  create: "إضافة",
  update: "تعديل",
  delete: "حذف",
  remove_talent: "حذف موهبة + تحذير",
};

const RES_LABEL: Record<string, string> = {
  news: "خبر",
  user: "مستخدم",
  talent: "موهبة",
  course: "مقرر",
  material: "مادة دراسية",
  quiz: "اختبار",
  question: "سؤال",
};

function statusPill(s: string) {
  if (s === "pending") return { Icon: Clock, color: "bg-amber-100 text-amber-800 border-amber-300", label: "بانتظار الموافقة" };
  if (s === "approved") return { Icon: CheckCircle2, color: "bg-emerald-100 text-emerald-800 border-emerald-300", label: "مقبول" };
  return { Icon: XCircle, color: "bg-rose-100 text-rose-800 border-rose-300", label: "مرفوض" };
}

function DecideDialog({
  proposal,
  decision,
  open,
  onClose,
}: {
  proposal: AdminProposal | null;
  decision: "approve" | "reject" | null;
  open: boolean;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  if (!proposal || !decision) return null;

  const submit = async () => {
    try {
      await api.post(`/v2/admin/proposals/${proposal.id}/decide`, { decision, note });
      toast({ title: decision === "approve" ? "تمت الموافقة" : "تم الرفض" });
      onClose();
      setNote("");
      qc.invalidateQueries({ queryKey: ["v2", "proposals"] });
      qc.invalidateQueries({ queryKey: ["v2", "notifications"] });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {decision === "approve" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <XCircle className="h-5 w-5 text-rose-600" />
            )}
            {decision === "approve" ? "موافقة على الاقتراح" : "رفض الاقتراح"}
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <div className="text-sm text-muted-foreground">
            {ACTION_LABEL[proposal.action] || proposal.action} على {RES_LABEL[proposal.resourceKind] || proposal.resourceKind}
            {proposal.reason && <div className="mt-1 italic">"{proposal.reason}"</div>}
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ملاحظة (اختياري)..."
            data-testid="input-decision-note"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button
            variant={decision === "approve" ? "default" : "destructive"}
            onClick={submit}
            data-testid="button-confirm-decision"
          >
            {decision === "approve" ? "موافقة وتنفيذ" : "رفض"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminProposalsPage() {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const { data: proposals, isLoading } = useProposals(tab);
  const { data: me } = useGetMe();
  const isSuper = me?.role === "super_admin";
  const [pickProposal, setPickProposal] = useState<AdminProposal | null>(null);
  const [pickDecision, setPickDecision] = useState<"approve" | "reject" | null>(null);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            {isSuper ? "اقتراحات الإدارة بانتظار موافقتك" : "اقتراحاتي"}
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            {isSuper
              ? "أي تعديل يقترحه مدير عادي يحتاج موافقتك قبل التطبيق. وعند الموافقة أو الرفض يصل إشعار للمدير."
              : "تقدر تتابع حالة اقتراحاتك هنا. ستصلك إشعارات بأي قرار."}
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending"><Clock className="me-1.5 h-3.5 w-3.5" /> بانتظار</TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved"><Check className="me-1.5 h-3.5 w-3.5" /> مقبول</TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected"><X className="me-1.5 h-3.5 w-3.5" /> مرفوض</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3 mt-6">
        {isLoading && <div className="text-center text-sm text-muted-foreground">جاري التحميل...</div>}
        {!isLoading && (proposals?.length ?? 0) === 0 && (
          <div className="text-center bg-card border-2 border-dashed border-border rounded-2xl p-12 text-muted-foreground">
            لا توجد اقتراحات في هذه الحالة.
          </div>
        )}

        <AnimatePresence>
          {(proposals ?? []).map((p, i) => {
            const sp = statusPill(p.status);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ delay: i * 0.04 }}
                className="bg-card rounded-2xl border-2 border-border p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${sp.color}`}>
                        <sp.Icon className="h-3 w-3" /> {sp.label}
                      </span>
                      <span className="text-sm font-bold">
                        {ACTION_LABEL[p.action] || p.action} → {RES_LABEL[p.resourceKind] || p.resourceKind}
                        {p.resourceId && ` #${p.resourceId}`}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1.5">
                      اقترحه: <strong>{p.proposerName}</strong> ({p.proposerRole}) · {new Date(p.createdAt).toLocaleString("ar-EG")}
                    </div>
                    {p.reason && (
                      <div className="text-sm mt-2 bg-muted/40 rounded-lg p-2">
                        <strong>السبب:</strong> {p.reason}
                      </div>
                    )}
                    {p.action === "remove_talent" && (p.payload as any).warning && (
                      <div className="text-sm mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-amber-900">
                        <AlertTriangle className="inline h-3.5 w-3.5 me-1" />
                        <strong>التحذير المُرسَل للطالب:</strong> {(p.payload as any).warning as string}
                      </div>
                    )}
                    {Object.keys(p.payload).length > 0 && p.action !== "remove_talent" && (
                      <details className="text-xs mt-2">
                        <summary className="cursor-pointer text-muted-foreground hover:text-primary">عرض البيانات</summary>
                        <pre className="bg-muted/40 rounded-lg p-2 mt-1 overflow-x-auto">{JSON.stringify(p.payload, null, 2)}</pre>
                      </details>
                    )}
                    {p.decisionNote && (
                      <div className="text-xs mt-2 italic text-muted-foreground">
                        ملاحظة القرار: {p.decisionNote}
                      </div>
                    )}
                  </div>

                  {isSuper && p.status === "pending" && (
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => { setPickProposal(p); setPickDecision("approve"); }}
                        data-testid={`button-approve-${p.id}`}
                      >
                        <Check className="me-1.5 h-3.5 w-3.5" /> موافقة
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => { setPickProposal(p); setPickDecision("reject"); }}
                        data-testid={`button-reject-${p.id}`}
                      >
                        <X className="me-1.5 h-3.5 w-3.5" /> رفض
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <DecideDialog
        proposal={pickProposal}
        decision={pickDecision}
        open={!!pickProposal && !!pickDecision}
        onClose={() => { setPickProposal(null); setPickDecision(null); }}
      />
    </div>
  );
}
