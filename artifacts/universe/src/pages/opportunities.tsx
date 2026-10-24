import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Briefcase, BookOpen, GraduationCap, HeartHandshake, MapPin, Wifi, Clock,
  Search, Plus, Users, CalendarDays, ArrowRight, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  useCreateOpportunity, useMeV2, useOpportunities, type Opportunity, type OpportunityType,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const TYPE_META: Record<OpportunityType, { label: string; icon: any; cls: string; dot: string }> = {
  job: { label: "وظيفة", icon: Briefcase, cls: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800", dot: "from-blue-500 to-indigo-600" },
  internship: { label: "تدريب", icon: GraduationCap, cls: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800", dot: "from-emerald-500 to-teal-600" },
  training: { label: "برنامج تدريبي", icon: BookOpen, cls: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800", dot: "from-amber-500 to-orange-500" },
  volunteer: { label: "تطوع", icon: HeartHandshake, cls: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800", dot: "from-rose-500 to-pink-600" },
};

const APP_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "قيد الانتظار", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  reviewing: { label: "تحت المراجعة", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  accepted: { label: "مقبول", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  rejected: { label: "مرفوض", cls: "bg-red-100 text-red-700 border-red-200" },
};

function fmtDate(value: string | null) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return value;
  }
}

function daysLeft(deadline: string | null) {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
}

function DeadlineChip({ deadline }: { deadline: string | null }) {
  const left = daysLeft(deadline);
  if (left === null) return null;
  const expired = left < 0;
  const urgent = !expired && left <= 7;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] ${expired ? "text-muted-foreground" : urgent ? "text-rose-600 font-bold" : "text-muted-foreground"}`}>
      <Clock className="h-3 w-3" />
      {expired ? "انتهى التقديم" : left === 0 ? "آخر يوم" : `باقي ${left} يوم`}
    </span>
  );
}

export default function OpportunitiesPage() {
  const { data: me } = useMeV2({ retry: false });
  const { data: opportunities = [], isLoading } = useOpportunities();
  const create = useCreateOpportunity();
  const { toast } = useToast();

  const isAdmin = me?.role === "admin" || me?.role === "super_admin";

  const [type, setType] = useState<"all" | OpportunityType>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", company: "", description: "", type: "internship" as OpportunityType,
    location: "", remote: false, category: "", requiredSkills: "", salary: "",
    deadline: "", contactEmail: "",
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return opportunities.filter((o) => {
      if (type !== "all" && o.type !== type) return false;
      if (!q) return true;
      return (
        o.title.toLowerCase().includes(q) ||
        o.company.toLowerCase().includes(q) ||
        (o.category ?? "").toLowerCase().includes(q) ||
        o.requiredSkills.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [opportunities, type, query]);

  const resetForm = () => setForm({
    title: "", company: "", description: "", type: "internship", location: "",
    remote: false, category: "", requiredSkills: "", salary: "", deadline: "", contactEmail: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({
        title: form.title,
        company: form.company,
        description: form.description,
        type: form.type,
        location: form.location || null,
        remote: form.remote,
        category: form.category || null,
        requiredSkills: form.requiredSkills.split(",").map((s) => s.trim()).filter(Boolean),
        salary: form.salary || null,
        deadline: form.deadline || null,
        contactEmail: form.contactEmail || null,
      } as any);
      toast({ title: "تم نشر الفرصة بنجاح" });
      setOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ title: err?.message || "تعذر نشر الفرصة", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 sm:mb-6 flex items-start justify-between gap-2 sm:gap-3 flex-wrap"
      >
        <div>
          <h1 className="text-xl sm:text-3xl md:text-4xl font-serif font-bold flex items-center gap-2 sm:gap-3">
            <Briefcase className="h-6 w-6 sm:h-8 sm:w-8 text-primary" /> مركز الفرص
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
            وظائف وتدريبات وبرامج تدريبية — قدّم بجواز مهاراتك الموثّق.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setOpen(true)} className="gap-1.5 text-xs sm:text-sm h-9 sm:h-10">
            <Plus className="h-4 w-4" /> إضافة فرصة
          </Button>
        )}
      </motion.div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="inline-flex bg-muted rounded-full p-0.5 sm:p-1 overflow-x-auto scrollbar-hide">
          {([["all", "الكل"], ["job", "وظائف"], ["internship", "تدريبات"], ["training", "برامج"], ["volunteer", "تطوع"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setType(key as any)}
              className={`px-2.5 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-full transition whitespace-nowrap ${type === key ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن فرصة أو شركة..."
            className="ps-9 h-9 text-sm"
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12 sm:py-16 bg-card border rounded-xl sm:rounded-2xl">
          <Briefcase className="h-8 w-8 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-2 sm:mb-3" />
          <p className="text-muted-foreground text-sm">مفيش فرص متاحة دلوقتي{isAdmin ? " — أضف أول فرصة من الزرار فوق." : "."}</p>
        </div>
      )}

      <div className="space-y-2.5 sm:space-y-3">
        {filtered.map((o, i) => {
          const meta = TYPE_META[o.type] ?? TYPE_META.internship;
          const Icon = meta.icon;
          const appMeta = o.myApplication ? APP_META[o.myApplication.status] ?? APP_META.pending : null;
          const closed = o.status === "closed" || (daysLeft(o.deadline) ?? 0) < 0;
          return (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
            >
              <Link href={`/opportunities/${o.id}`}>
                <div className="bg-card border rounded-xl p-3.5 sm:p-4 hover:border-primary/40 hover:shadow-sm transition cursor-pointer">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] gap-1 ${meta.cls}`}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </Badge>
                      {closed && <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">مغلقة</Badge>}
                      {appMeta && (
                        <Badge variant="outline" className={`text-[10px] ${appMeta.cls}`}>{appMeta.label}</Badge>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Users className="h-3 w-3" /> {o.applicantsCount} متقدم
                    </span>
                  </div>

                  <div className="mt-2 flex items-start gap-2 sm:gap-3">
                    <div className={`hidden sm:flex w-10 h-10 rounded-lg bg-gradient-to-br ${meta.dot} items-center justify-center shrink-0`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm sm:text-base leading-snug">{o.title}</h3>
                      <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground mt-0.5">
                        <span className="font-medium text-foreground/80">{o.company}</span>
                        {o.location && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{o.location}</span>}
                        {o.remote && <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400"><Wifi className="h-3 w-3" />عن بُعد</span>}
                      </div>
                      <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 line-clamp-2">{o.description}</p>
                      {o.requiredSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {o.requiredSkills.slice(0, 5).map((s) => (
                            <span key={s} className="text-[9px] sm:text-[10px] bg-muted px-1.5 py-0.5 rounded">{s}</span>
                          ))}
                          {o.requiredSkills.length > 5 && (
                            <span className="text-[9px] sm:text-[10px] text-muted-foreground">+{o.requiredSkills.length - 5}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2.5 border-t flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {o.deadline && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <CalendarDays className="h-3 w-3" /> {fmtDate(o.deadline)}
                        </span>
                      )}
                      <DeadlineChip deadline={o.deadline} />
                    </div>
                    <span className="text-[10px] text-primary inline-flex items-center gap-0.5 font-bold">
                      التفاصيل <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة فرصة جديدة</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">المسمى الوظيفي *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">الشركة / الجهة *</Label>
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} required className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">النوع</Label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as OpportunityType })}
                  className="mt-1 w-full h-10 border rounded-md bg-background px-2 text-sm"
                >
                  <option value="job">وظيفة</option>
                  <option value="internship">تدريب</option>
                  <option value="training">برنامج تدريبي</option>
                  <option value="volunteer">تطوع</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">المكان</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1" />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.remote} onChange={(e) => setForm({ ...form, remote: e.target.checked })} />
                  عن بُعد
                </label>
              </div>
              <div>
                <Label className="text-xs">التصنيف</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="تقنية، بيانات..." className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">آخر موعد</Label>
                <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="mt-1" dir="ltr" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">المهارات المطلوبة (مفصولة بفاصلة)</Label>
                <Input value={form.requiredSkills} onChange={(e) => setForm({ ...form, requiredSkills: e.target.value })} placeholder="React, SQL, التواصل" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">المكافأة / الراتب</Label>
                <Input value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">إيميل التواصل</Label>
                <Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className="mt-1" dir="ltr" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">الوصف *</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} required className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "نشر الفرصة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
