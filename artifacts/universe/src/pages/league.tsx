import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Trophy, Medal, Crown, Users, Building2, GraduationCap, Clock, CalendarDays,
  Loader2, Plus, Sparkles, Target, Award, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCreateLeagueSeason, useLeague, useMeV2, type LeagueEntity } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const RANK_BADGE = [
  "bg-amber-400 text-amber-950 border-amber-500",
  "bg-slate-300 text-slate-800 border-slate-400",
  "bg-orange-300 text-orange-950 border-orange-400",
];

const CATEGORY_ICONS: Record<string, any> = {
  academic: GraduationCap,
  practical: Target,
  career: Building2,
  soft_skills: Sparkles,
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return value ?? "—";
  }
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const Icon = rank === 1 ? Crown : Medal;
    return (
      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full border-2 font-bold text-xs ${RANK_BADGE[rank - 1]}`}>
        <Icon className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground font-bold text-xs">
      {rank}
    </span>
  );
}

function EntityTable({
  rows,
  showUniversity,
  sort,
}: {
  rows: LeagueEntity[];
  showUniversity: boolean;
  sort: "total" | "average";
}) {
  const sorted = useMemo(() => {
    return [...rows]
      .sort((a, b) =>
        sort === "average"
          ? b.avgPointsPerActive - a.avgPointsPerActive || b.totalPoints - a.totalPoints
          : b.totalPoints - a.totalPoints || b.activeStudents - a.activeStudents
      )
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [rows, sort]);

  if (sorted.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-10">مفيش بيانات كفاية لسه.</p>;
  }

  return (
    <div className="space-y-2">
      {sorted.map((row) => (
        <motion.div
          key={row.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border rounded-xl p-3 sm:p-4"
        >
          <div className="flex items-center gap-3">
            <RankBadge rank={row.rank} />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm truncate">{row.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">
                {showUniversity ? row.universityName : null}
                {showUniversity && row.universityName ? " · " : ""}
                {row.activeStudents} طالب نشط من {row.totalStudents}
              </div>
            </div>
            <div className="text-end shrink-0">
              <div className="font-bold text-sm text-primary">{row.totalPoints.toLocaleString("ar-EG")} نقطة</div>
              <div className="text-[10px] text-muted-foreground">متوسط {row.avgPointsPerActive.toLocaleString("ar-EG")} / نشط</div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-secondary rounded-full" style={{ width: `${Math.round(row.activeRatio * 100)}%` }} />
            </div>
            <span className="text-[9px] text-muted-foreground w-10 text-end">{Math.round(row.activeRatio * 100)}% نشاط</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default function LeaguePage() {
  const { data: me } = useMeV2({ retry: false });
  const { data, isLoading, isError } = useLeague();
  const createSeason = useCreateLeagueSeason();
  const { toast } = useToast();
  const [tab, setTab] = useState<"students" | "faculties" | "universities" | "skills">("students");
  const [entitySort, setEntitySort] = useState<"total" | "average">("total");
  const [open, setOpen] = useState(false);
  const [seasonForm, setSeasonForm] = useState({ name: "", durationDays: 90 });

  const isAdmin = me?.role === "admin" || me?.role === "super_admin";

  const startSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSeason.mutateAsync({
        name: seasonForm.name.trim() || `موسم UniVerse League #${(data?.seasons.length ?? 0) + 1}`,
        durationDays: seasonForm.durationDays,
      });
      toast({ title: "بدأ الموسم الجديد واتقفل الموسم السابق" });
      setOpen(false);
    } catch (err: any) {
      toast({ title: err?.message || "تعذر بدء الموسم", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-lg text-center">
        <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h1 className="font-bold text-lg">تعذر تحميل الدوري</h1>
        <p className="text-xs text-muted-foreground mt-1">حاول تحدّث الصفحة تاني.</p>
      </div>
    );
  }

  const { season, myRank } = data;

  const tabs = [
    { key: "students", label: "الطلاب", icon: Users },
    { key: "faculties", label: "الكليات", icon: GraduationCap },
    { key: "universities", label: "الجامعات", icon: Building2 },
    { key: "skills", label: "المهارات", icon: Award },
  ] as const;

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white p-5 sm:p-8 mb-4"
      >
        <div className="absolute -top-10 -end-10 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute -bottom-14 start-1/4 w-48 h-48 bg-white/10 rounded-full" />
        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-2.5 py-0.5 text-[10px] font-bold mb-2">
              <Trophy className="h-3 w-3" /> UniVerse League
            </div>
            <h1 className="text-2xl sm:text-4xl font-serif font-bold">{season.name}</h1>
            <div className="flex items-center gap-3 flex-wrap text-[11px] sm:text-xs text-white/90 mt-2">
              <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {fmtDate(season.startsAt)} — {fmtDate(season.endsAt)}</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> باقي {season.daysLeft} يوم</span>
            </div>
          </div>
          {isAdmin && (
            <Button
              onClick={() => {
                setSeasonForm({ name: `موسم UniVerse League #${data.seasons.length + 1}`, durationDays: 90 });
                setOpen(true);
              }}
              variant="secondary"
              className="gap-1.5 text-xs h-9 bg-white/20 text-white hover:bg-white/30 border-0"
            >
              <Plus className="h-4 w-4" /> بدء موسم جديد
            </Button>
          )}
        </div>
      </motion.div>

      {myRank && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          <div className="bg-card border rounded-xl p-3 text-center">
            <div className="text-[10px] text-muted-foreground">ترتيبك (طلاب)</div>
            <div className="text-xl font-bold text-primary mt-0.5">#{myRank.studentRank ?? "—"}</div>
            <div className="text-[9px] text-muted-foreground">{myRank.seasonPoints.toLocaleString("ar-EG")} نقطة</div>
          </div>
          <div className="bg-card border rounded-xl p-3 text-center">
            <div className="text-[10px] text-muted-foreground">ترتيب كليتك</div>
            <div className="text-xl font-bold text-secondary mt-0.5">#{myRank.faculty?.rank ?? "—"}</div>
            <div className="text-[9px] text-muted-foreground truncate">{myRank.faculty?.name ?? "غير محدد"}</div>
          </div>
          <div className="bg-card border rounded-xl p-3 text-center">
            <div className="text-[10px] text-muted-foreground">ترتيب جامعتك</div>
            <div className="text-xl font-bold text-amber-600 mt-0.5">#{myRank.university?.rank ?? "—"}</div>
            <div className="text-[9px] text-muted-foreground truncate">{myRank.university?.name ?? "غير محدد"}</div>
          </div>
        </div>
      )}

      <div className="inline-flex bg-muted rounded-full p-0.5 sm:p-1 mb-3 overflow-x-auto scrollbar-hide max-w-full">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1 px-2.5 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-full transition whitespace-nowrap ${tab === t.key ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"}`}
            >
              <Icon className="h-3 w-3" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "students" && (
        <div className="space-y-2">
          {data.students.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">مفيش مشاركين لسه في الموسم ده.</p>
          )}
          {data.students.map((s) => {
            const mine = me?.id === s.userId;
            return (
              <motion.div
                key={s.userId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`border rounded-xl p-3 flex items-center gap-3 ${mine ? "bg-primary/5 border-primary/40" : "bg-card"}`}
              >
                <RankBadge rank={s.rank} />
                <div className="w-9 h-9 rounded-full bg-primary/10 overflow-hidden shrink-0">
                  {s.avatarUrl ? (
                    <img src={s.avatarUrl} alt={s.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary font-bold text-xs">
                      {s.name?.trim()?.[0] ?? "?"}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs sm:text-sm truncate">{s.name}</span>
                    {mine && <Badge className="text-[8px] h-4 px-1">أنت</Badge>}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {s.faculty ?? "بدون كلية"}{s.university ? ` · ${s.university}` : ""}
                  </div>
                </div>
                <div className="text-end shrink-0">
                  <div className="font-bold text-sm text-primary">{s.seasonPoints.toLocaleString("ar-EG")}</div>
                  <div className="text-[9px] text-muted-foreground">نقاط الموسم</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {(tab === "faculties" || tab === "universities") && (
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-[10px] text-muted-foreground">
              الترتيب بيحسب نقاط الموسم من أنشطة موثقة داخل المنصة فقط.
            </p>
            <div className="inline-flex bg-muted rounded-full p-0.5 shrink-0">
              <button
                onClick={() => setEntitySort("total")}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-full ${entitySort === "total" ? "bg-background shadow" : "text-muted-foreground"}`}
              >
                الإجمالي
              </button>
              <button
                onClick={() => setEntitySort("average")}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-full ${entitySort === "average" ? "bg-background shadow" : "text-muted-foreground"}`}
              >
                المتوسط
              </button>
            </div>
          </div>
          <EntityTable
            rows={tab === "faculties" ? data.faculties : data.universities}
            showUniversity={tab === "faculties"}
            sort={entitySort}
          />
        </div>
      )}

      {tab === "skills" && (
        <div className="grid sm:grid-cols-2 gap-3">
          {data.skills.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.category] ?? Award;
            return (
              <div key={cat.category} className="bg-card border rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 font-bold text-sm mb-2">
                  <Icon className="h-4 w-4 text-primary" /> {cat.label}
                </div>
                {cat.entries.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground py-4 text-center">لسه محدش أنجز دروس في التصنيف ده.</p>
                ) : (
                  <div className="space-y-1.5">
                    {cat.entries.map((e) => (
                      <Link key={e.userId} href={`/passport/${e.userId}`} className="flex items-center gap-2 text-[11px] hover:bg-muted/40 rounded-lg p-1.5 transition">
                        <RankBadge rank={e.rank} />
                        <span className="font-medium flex-1 truncate">{e.name}</span>
                        <span className="text-muted-foreground">{e.completedLessons} درس</span>
                        <Badge variant="outline" className={`text-[8px] ${e.avgScore >= 70 ? "text-emerald-700 border-emerald-300" : "text-amber-700 border-amber-300"}`}>
                          {e.avgScore}%
                        </Badge>
                        {e.certificates > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-600">
                            <ShieldCheck className="h-3 w-3" /> {e.certificates}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {data.seasons.length > 1 && (
        <div className="mt-5">
          <h2 className="text-xs font-bold mb-2 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> المواسم</h2>
          <div className="flex flex-wrap gap-1.5">
            {data.seasons.map((s) => (
              <span
                key={s.id}
                className={`text-[9px] px-2 py-1 rounded-full border ${s.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}
              >
                {s.name} · {s.status === "active" ? "نشط" : "منتهي"}
              </span>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>بدء موسم جديد</DialogTitle>
          </DialogHeader>
          <form onSubmit={startSeason} className="space-y-3">
            <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
              الموسم الحالي هيتقفل، وهتتحفظ نتيجة الطلاب والكليات والجامعات في سجل المواسم، وبعدها كل المشاركين هيبدأوا من نقاط الموسم الجديد.
            </div>
            <div>
              <Label className="text-xs">اسم الموسم</Label>
              <Input
                value={seasonForm.name}
                onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">المدة</Label>
              <select
                value={seasonForm.durationDays}
                onChange={(e) => setSeasonForm({ ...seasonForm, durationDays: Number(e.target.value) })}
                className="mt-1 w-full h-10 border rounded-md bg-background px-2 text-sm"
              >
                <option value={30}>30 يوم</option>
                <option value={60}>60 يوم</option>
                <option value={90}>90 يوم</option>
                <option value={180}>180 يوم</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={createSeason.isPending}>
                {createSeason.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "ابدأ الموسم"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
