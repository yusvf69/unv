import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight, Briefcase, GraduationCap, BookOpen, HeartHandshake, MapPin, Wifi,
  Clock, Users, CalendarDays, Building2, Mail, ShieldCheck, Loader2,
  CheckCircle2, XCircle, Power, Trash2, ExternalLink, FolderKanban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useApplyToOpportunity, useDeleteOpportunity, useMeV2, useOpportunity,
  useOpportunityApplicants, useToggleOpportunityStatus, useUpdateApplicationStatus,
  type OpportunityType,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const TYPE_META: Record<OpportunityType, { label: string; icon: any; cls: string }> = {
  job: { label: "وظيفة", icon: Briefcase, cls: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800" },
  internship: { label: "تدريب", icon: GraduationCap, cls: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" },
  training: { label: "برنامج تدريبي", icon: BookOpen, cls: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" },
  volunteer: { label: "تطوع", icon: HeartHandshake, cls: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800" },
};

const APP_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "قيد الانتظار", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  reviewing: { label: "تحت المراجعة", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  accepted: { label: "مقبول", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  rejected: { label: "مرفوض", cls: "bg-red-100 text-red-700 border-red-200" },
};

const LEVEL_LABELS: Record<string, string> = {
  mastered: "متقن", practitioner: "ممارس", learner: "متعلم", beginner: "مبتدئ",
};

function fmtDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return value ?? "—";
  }
}

function daysLeft(deadline: string | null) {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
}

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const opportunityId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: me } = useMeV2({ retry: false });
  const { data: opportunity, isLoading, isError } = useOpportunity(opportunityId || null);
  const { data: applicants = [], isLoading: loadingApplicants } = useOpportunityApplicants(
    opportunityId || null,
    !!opportunity?.canManage,
  );
  const apply = useApplyToOpportunity(opportunityId);
  const updateStatus = useUpdateApplicationStatus(opportunityId);
  const toggleStatus = useToggleOpportunityStatus();
  const remove = useDeleteOpportunity();
  const [cover, setCover] = useState("");
  const [applyOpen, setApplyOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !opportunity) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-lg text-center">
        <XCircle className="h-12 w-12 mx-auto text-red-500 mb-3" />
        <h1 className="font-bold text-lg">الفرصة غير موجودة</h1>
        <Link href="/opportunities" className="text-sm text-primary mt-2 inline-block">العودة لمركز الفرص</Link>
      </div>
    );
  }

  const meta = TYPE_META[opportunity.type] ?? TYPE_META.internship;
  const Icon = meta.icon;
  const left = daysLeft(opportunity.deadline);
  const expired = left !== null && left < 0;
  const closed = opportunity.status === "closed" || expired;
  const myApp = opportunity.myApplication;
  const myAppMeta = myApp ? APP_META[myApp.status] ?? APP_META.pending : null;

  const submitApplication = async () => {
    try {
      await apply.mutateAsync(cover);
      toast({ title: "تم إرسال طلبك، وجواز مهاراتك اتضم تلقائيًا" });
      setApplyOpen(false);
      setCover("");
    } catch (err: any) {
      toast({ title: err?.message || "تعذر إرسال الطلب", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-5xl">
      <Link href="/opportunities" className="text-xs text-muted-foreground hover:text-primary transition inline-flex items-center gap-1 mb-3">
        <ArrowRight className="h-3.5 w-3.5" /> مركز الفرص
      </Link>

      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-xl sm:rounded-2xl p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              <Badge variant="outline" className={`text-[10px] gap-1 ${meta.cls}`}>
                <Icon className="h-3 w-3" /> {meta.label}
              </Badge>
              {opportunity.category && <Badge variant="outline" className="text-[10px]">{opportunity.category}</Badge>}
              {opportunity.status === "closed" && <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">مغلقة</Badge>}
              {myAppMeta && <Badge variant="outline" className={`text-[10px] ${myAppMeta.cls}`}>{myAppMeta.label}</Badge>}
            </div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold leading-snug">{opportunity.title}</h1>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs text-muted-foreground mt-1.5">
              <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                <Building2 className="h-3.5 w-3.5" /> {opportunity.company}
              </span>
              {opportunity.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{opportunity.location}</span>}
              {opportunity.remote && <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Wifi className="h-3.5 w-3.5" />عن بُعد</span>}
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{opportunity.applicantsCount} متقدم</span>
            </div>
          </div>

          {opportunity.canManage && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1"
                onClick={() => toggleStatus.mutate({ id: opportunity.id, status: opportunity.status === "closed" ? "active" : "closed" })}
              >
                <Power className="h-3.5 w-3.5" /> {opportunity.status === "closed" ? "إعادة فتح" : "إغلاق"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" /> حذف
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>حذف الفرصة؟</AlertDialogTitle>
                    <AlertDialogDescription>هيتم حذف الفرصة وكل طلبات التقديم المرتبطة بيها نهائيًا.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700"
                      onClick={async () => {
                        await remove.mutateAsync(opportunity.id);
                        toast({ title: "تم حذف الفرصة" });
                        setLocation("/opportunities");
                      }}
                    >
                      حذف
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-3 sm:gap-4 mt-3 sm:mt-4">
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          <div className="bg-card border rounded-xl p-4 sm:p-5">
            <h2 className="font-bold text-sm sm:text-base mb-2">عن الفرصة</h2>
            <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{opportunity.description}</p>
          </div>

          {opportunity.requiredSkills.length > 0 && (
            <div className="bg-card border rounded-xl p-4 sm:p-5">
              <h2 className="font-bold text-sm sm:text-base mb-2">المهارات المطلوبة</h2>
              <div className="flex flex-wrap gap-1.5">
                {opportunity.requiredSkills.map((s) => (
                  <span key={s} className="text-[11px] bg-muted px-2 py-1 rounded-md">{s}</span>
                ))}
              </div>
            </div>
          )}

          {(opportunity.contactEmail || opportunity.applyUrl) && (
            <div className="bg-card border rounded-xl p-4 sm:p-5">
              <h2 className="font-bold text-sm sm:text-base mb-2">للتواصل</h2>
              <div className="space-y-1.5 text-xs sm:text-sm">
                {opportunity.contactEmail && (
                  <a href={`mailto:${opportunity.contactEmail}`} className="flex items-center gap-1.5 text-primary hover:underline" dir="ltr">
                    <Mail className="h-3.5 w-3.5" /> {opportunity.contactEmail}
                  </a>
                )}
                {opportunity.applyUrl && (
                  <a href={opportunity.applyUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline" dir="ltr">
                    <ExternalLink className="h-3.5 w-3.5" /> {opportunity.applyUrl}
                  </a>
                )}
              </div>
            </div>
          )}

          {opportunity.canManage && (
            <div className="bg-card border rounded-xl p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="font-bold text-sm sm:text-base flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> المتقدمون ({applicants.length})
                </h2>
              </div>

              {loadingApplicants && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto my-6" />}

              {!loadingApplicants && applicants.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">مفيش متقدمين لسه.</p>
              )}

              <div className="space-y-2.5">
                {applicants.map((a) => (
                  <div key={a.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                          {a.name?.trim()?.[0] ?? "?"}
                        </div>
                        <div>
                          <div className="text-xs font-bold">{a.name}</div>
                          <div className="text-[10px] text-muted-foreground">@{a.username} · {fmtDate(a.createdAt)}</div>
                        </div>
                      </div>
                      <select
                        value={a.status}
                        onChange={(e) => updateStatus.mutate({ applicationId: a.id, status: e.target.value })}
                        className="h-7 px-2 border rounded-md bg-background text-[11px]"
                      >
                        <option value="pending">قيد الانتظار</option>
                        <option value="reviewing">تحت المراجعة</option>
                        <option value="accepted">مقبول</option>
                        <option value="rejected">مرفوض</option>
                      </select>
                    </div>

                    {a.coverLetter && (
                      <p className="text-[11px] text-muted-foreground mt-2 bg-muted/40 rounded p-2 whitespace-pre-line">{a.coverLetter}</p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      <Link href={`/passport/${a.userId}`} className="text-[10px] text-primary hover:underline">جواز المهارات</Link>
                      {a.passport?.verifiedCertificates?.length ? (
                        a.passport.verifiedCertificates.map((c) => (
                          <span key={c.code} className="inline-flex items-center gap-1 text-[9px] border rounded-full px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800">
                            <ShieldCheck className="h-2.5 w-2.5" /> {c.trackTitle} · {c.score}%
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-muted-foreground">لا توجد شهادات موثقة وقت التقديم</span>
                      )}
                    </div>

                    <div className="mt-2 pt-2 border-t">
                      <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground mb-1">
                        <BookOpen className="h-3 w-3" /> تقدمه الحالي:
                        <span>{a.live?.stats.completedLessons ?? 0} درس مكتمل</span>
                        <span>·</span>
                        <span>{a.live?.stats.certificates ?? 0} شهادة</span>
                        <span>·</span>
                        <span>{a.live?.projects?.length ?? 0} مشروع</span>
                        {a.live?.level && <span>· مستوى {LEVEL_LABELS[a.live.level] ?? a.live.level}</span>}
                      </div>
                      {a.live?.tracks?.length ? (
                        <div className="space-y-1">
                          {a.live.tracks.map((t) => (
                            <div key={t.id} className="flex items-center gap-2 text-[10px]">
                              <span className="min-w-0 flex-1 truncate">{t.title}</span>
                              <div className="h-1 w-20 bg-muted rounded-full overflow-hidden shrink-0">
                                <div
                                  className={`h-1 rounded-full ${t.status === "completed" ? "bg-emerald-500" : "bg-primary"}`}
                                  style={{ width: `${Math.round((t.progress || 0) * 100)}%` }}
                                />
                              </div>
                              <span className="text-muted-foreground tabular-nums shrink-0">{t.completedLessons}/{t.totalLessons}</span>
                              {t.status === "completed" && <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">لسه مبدأش أي مسار مهارات.</p>
                      )}
                      {!!a.live?.certificates?.length && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {a.live.certificates.map((c) => (
                            <span key={c.code} className="inline-flex items-center gap-1 text-[9px] border rounded-full px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800">
                              <ShieldCheck className="h-2.5 w-2.5" /> {c.trackTitle} · {c.score}%
                            </span>
                          ))}
                        </div>
                      )}
                      {!!a.live?.projects?.length && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {a.live.projects.slice(0, 4).map((p) => (
                            <Link key={p.id} href="/passport" className="inline-flex items-center gap-1 text-[9px] border rounded-full px-1.5 py-0.5 bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-800">
                              <FolderKanban className="h-2.5 w-2.5" /> {p.title}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div className="bg-card border rounded-xl p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-bold mb-3">
              <Clock className="h-4 w-4 text-primary" /> تفاصيل التقديم
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">آخر موعد</span>
                <span className="font-medium inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {fmtDate(opportunity.deadline)}</span>
              </div>
              {left !== null && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">المتبقي</span>
                  <span className={`font-bold ${expired ? "text-muted-foreground" : left <= 7 ? "text-rose-600" : "text-emerald-600"}`}>
                    {expired ? "انتهى التقديم" : left === 0 ? "آخر يوم" : `${left} يوم`}
                  </span>
                </div>
              )}
              {opportunity.salary && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">المكافأة</span>
                  <span className="font-medium">{opportunity.salary}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">عدد المتقدمين</span>
                <span className="font-medium">{opportunity.applicantsCount}</span>
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-4 sm:p-5">
            {myApp && myAppMeta ? (
              <div className="text-center">
                <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                <div className="text-sm font-bold">قدمت على الفرصة دي</div>
                <Badge variant="outline" className={`mt-2 text-[10px] ${myAppMeta.cls}`}>{myAppMeta.label}</Badge>
                <div className="text-[10px] text-muted-foreground mt-2">تاريخ التقديم: {fmtDate(myApp.createdAt)}</div>
                <div className="text-[10px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" /> تم إرفاق جواز مهاراتك تلقائيًا
                </div>
                <Link href="/passport" className="block text-[10px] text-primary hover:underline mt-2">عرض جواز المهارات</Link>
              </div>
            ) : closed ? (
              <div className="text-center">
                <XCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <div className="text-sm font-bold text-muted-foreground">التقديم مغلق</div>
                <p className="text-[10px] text-muted-foreground mt-1">انتهت مدة التقديم على الفرصة دي.</p>
              </div>
            ) : !me ? (
              <div className="text-center">
                <div className="text-sm font-bold mb-2">عايز تقدم؟</div>
                <p className="text-[10px] text-muted-foreground mb-3">سجل دخولك وقدّم بجواز مهاراتك.</p>
                <Button asChild className="w-full"><Link href="/login">تسجيل الدخول</Link></Button>
              </div>
            ) : (
              <div>
                <div className="text-sm font-bold mb-1">جاهز للتقديم؟</div>
                <p className="text-[10px] text-muted-foreground mb-3">
                  هيتم إرفاق شهاداتك الموثقة من جواز المهارات مع الطلب تلقائيًا.
                </p>
                <Button className="w-full gap-1.5" onClick={() => setApplyOpen(true)}>
                  <Briefcase className="h-4 w-4" /> قدّم على الفرصة
                </Button>
              </div>
            )}
          </div>

          <div className="bg-muted/40 border rounded-xl p-3 text-[10px] text-muted-foreground leading-relaxed">
            نصيحة: كل ما تخلص مسارات وتاخد شهادات موثقة في جواز المهارات، فرصك في القبول بتزيد.
          </div>
        </div>
      </div>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>التقديم على: {opportunity.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">رسالة التقديم (اختياري)</Label>
              <Textarea
                value={cover}
                onChange={(e) => setCover(e.target.value)}
                rows={5}
                placeholder="اكتب سطرين عن نفسك وليه مهتم بالفرصة..."
                className="mt-1"
              />
            </div>
            <div className="flex items-start gap-1.5 text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>هيتم إرفاق جواز مهاراتك وشهاداتك الموثقة مع الطلب تلقائيًا.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>إلغاء</Button>
            <Button onClick={submitApplication} disabled={apply.isPending}>
              {apply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إرسال الطلب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
