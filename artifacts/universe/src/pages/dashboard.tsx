import { useGetDashboard, useCompleteMission, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useTranslation, globalI18n } from "@/lib/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { useMyGroupSchedule, useLogStudyActivity, useRecommendations, useCoachPlan, useMarket, useTeamProjects, type CoachStep } from "@/lib/api";
import PersonalizationDialog from "@/components/personalization-dialog";
import { CheckCircle2, Circle, AlertCircle, TrendingUp, Sparkles, BookOpen, Clock, Calendar as CalendarIcon, CheckSquare, Target, MapPin, User as UserIcon, Play, Square, Timer, Briefcase, ArrowLeft, Bot, Compass, Store, Users as UsersIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useState, useEffect } from "react";
import { AR_DAYS, AR_SHORT_DAYS } from "@/lib/dates";

const AR_WEEKDAYS = AR_SHORT_DAYS;
const DAY_NAMES = AR_DAYS;

function getGreeting(name: string, t: (key: string) => string) {
  const h = new Date().getHours();
  if (h < 5) return `${t("nightGreeting")}${name}`;
  if (h < 12) return `${t("morningGreeting")}${name}`;
  if (h < 17) return `${t("afternoonGreeting")}${name}${t("afternoonGreetingSuffix")}`;
  if (h < 21) return `${t("eveningGreeting")}${name}`;
  return `${t("lateNightGreeting")}${name}`;
}

const STEP_ICONS: Record<string, any> = {
  lesson: BookOpen,
  track: Sparkles,
  certificate: Target,
  opportunity: Briefcase,
  explore: Compass,
};

const STEP_HINTS: Record<string, string> = {
  lesson: "درس",
  track: "مسار جديد",
  certificate: "شهادة",
  opportunity: "فرصة",
  explore: "استكشف",
};

function CoachCard({ onEdit }: { onEdit?: () => void }) {
  const { data: plan, isLoading } = useCoachPlan();
  if (!plan || isLoading) return null;
  const progressPct = plan.stats.totalLessons > 0 ? Math.round((plan.stats.completedLessons / plan.stats.totalLessons) * 100) : 0;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-teal-700 to-emerald-900 text-white p-4 sm:p-6">
      <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-white/10" />
      <div className="absolute -bottom-16 -right-10 w-52 h-52 rounded-full bg-white/5" />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
        <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-2xl shrink-0 border border-white/20">
          🤖
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h2 className="font-bold text-lg">المدرّب الذكي</h2>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/15 text-emerald-50 border border-white/20">خطة شخصية</span>
          </div>
          <p className="text-[11px] sm:text-xs text-emerald-50/90">{plan.summary}</p>
        </div>
        <div className="flex flex-row sm:flex-col gap-2 shrink-0">
          {plan.personalized ? (
            <div className="rounded-xl bg-white/10 backdrop-blur px-3 py-2 text-center min-w-16 border border-white/15">
              <div className="font-bold text-base leading-none">{progressPct}%</div>
              <div className="text-[9px] text-emerald-100/80 mt-1">تقدمك</div>
            </div>
          ) : (
            onEdit && (
              <Button size="sm" onClick={onEdit} className="bg-white text-emerald-800 hover:bg-emerald-50 text-[11px] h-8">
                اختار اهتماماتك
              </Button>
            )
          )}
          <div className="rounded-xl bg-white/10 backdrop-blur px-3 py-2 text-center min-w-16 border border-white/15">
            <div className="font-bold text-base leading-none">{plan.stats.certificates}</div>
            <div className="text-[9px] text-emerald-100/80 mt-1">شهادة</div>
          </div>
        </div>
      </div>

      <div className="relative mb-4">
        <div className="flex items-center justify-between text-[10px] mb-1 text-emerald-100/90">
          <span className="inline-flex items-center gap-1"><Target className="h-3 w-3" /> هدف الأسبوع</span>
          {plan.stats.totalLessons > 0 && (
            <span className="tabular-nums">{plan.stats.completedLessons}/{plan.stats.totalLessons} درس</span>
          )}
        </div>
        <p className="text-xs font-bold mb-2">{plan.weeklyGoal}</p>
        <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
          <div className="h-1.5 rounded-full bg-gradient-to-l from-amber-300 to-yellow-400 transition-all" style={{ width: `${Math.max(progressPct, 3)}%` }} />
        </div>
      </div>

      <div className="relative space-y-2">
        {plan.coachMessage && (
          <div className="rounded-xl bg-white/10 backdrop-blur border border-white/15 p-3 text-[11px] leading-relaxed mb-1">
            {plan.coachMessage}
          </div>
        )}
        {plan.steps.map((step: CoachStep, i: number) => {
          const StepIcon = STEP_ICONS[step.kind] ?? Sparkles;
          return (
            <Link
              key={`${step.kind}-${step.refId ?? i}`}
              href={step.link}
              className="group flex items-center gap-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur border border-white/10 p-3 transition"
            >
              <span className="relative w-8 h-8 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                <StepIcon className="h-4 w-4" />
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 text-emerald-900 text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-bold line-clamp-1">{step.title}</span>
                  <span className="text-[9px] rounded-full bg-white/15 border border-white/20 px-2 py-0.5 text-emerald-50 shrink-0">{STEP_HINTS[step.kind] ?? "خطوة"}</span>
                  {step.etaMinutes && <span className="text-[9px] text-emerald-100/80 shrink-0">~{step.etaMinutes} دقيقة</span>}
                </span>
                <span className="block text-[10px] text-emerald-100/80 mt-0.5 line-clamp-1">{step.subtitle ? `${step.subtitle} — ` : ""}{step.reason}</span>
              </span>
               <ArrowLeft className="h-4 w-4 text-emerald-100/70 group-hover:text-white group-hover:-translate-x-0.5 transition shrink-0" />
             </Link>
           );
         })}
       </div>
     </div>
   );
 }

function CommunityCards() {
  const { data: market } = useMarket();
  const { data: teams } = useTeamProjects();
  if (!market && !teams) return null;
  const openTeams = (teams?.projects ?? []).filter((p) => p.status === "open").length;
  const myTeams = (teams?.projects ?? []).filter((p) => p.mine || p.myRequest).length;
  const libraryCount = (market?.listings ?? []).filter((l) => l.purchased).length;
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Link
        href="/market"
        className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-purple-700 to-fuchsia-800 text-white p-4 hover:shadow-lg transition"
      >
        <div className="absolute -top-8 -left-8 w-28 h-28 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
            <Store className="h-5 w-5 text-violet-50" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm flex items-center gap-1.5">
              سوق المعرفة
              {(market?.myPoints ?? 0) > 0 && (
                <span className="text-[9px] rounded-full bg-white/15 border border-white/20 px-1.5 py-0.5 text-violet-50">
                  {market?.myPoints} نقطة
                </span>
              )}
            </div>
            <p className="text-[10px] text-violet-100/85 mt-0.5">
              بِع ملخصاتك وشروحاتك — والنقاط ليك
            </p>
          </div>
          <span className="text-[9px] text-violet-100/80 group-hover:text-white transition shrink-0">
            {(market?.myPoints ?? 0) > 0 ? `${libraryCount} مكتبتك` : "شوف السوق"}
          </span>
          <ArrowLeft className="h-4 w-4 text-violet-100/70 group-hover:text-white group-hover:-translate-x-0.5 transition shrink-0" />
        </div>
      </Link>

      <Link
        href="/teams"
        className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-700 via-blue-700 to-indigo-800 text-white p-4 hover:shadow-lg transition"
      >
        <div className="absolute -top-8 -left-8 w-28 h-28 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
            <UsersIcon className="h-5 w-5 text-sky-50" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm flex items-center gap-1.5">
              فرق المشاريع
              <span className="text-[9px] rounded-full bg-white/15 border border-white/20 px-1.5 py-0.5 text-sky-50">
                {openTeams} مفتوحة
              </span>
            </div>
            <p className="text-[10px] text-sky-100/85 mt-0.5">
              اعمل فريق من كل الكليات لأفكارك
            </p>
          </div>
          <span className="text-[9px] text-sky-100/80 group-hover:text-white transition shrink-0">
            {myTeams > 0 ? `مشروعك: ${myTeams}` : "انضم دلوقتي"}
          </span>
          <ArrowLeft className="h-4 w-4 text-sky-100/70 group-hover:text-white group-hover:-translate-x-0.5 transition shrink-0" />
        </div>
      </Link>
    </div>
  );
}

export default function Dashboard() {
  const { data: dashboard, isLoading } = useGetDashboard();
  const { data: groupSchedule = [] } = useMyGroupSchedule();
  const t = useTranslation(globalI18n);
  const completeMission = useCompleteMission();
  const queryClient = useQueryClient();
  const logActivity = useLogStudyActivity();
  const { data: recs } = useRecommendations();
  const [personalizationOpen, setPersonalizationOpen] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next % 60 === 0) setElapsedMinutes(Math.floor(next / 60));
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleStop = () => {
    if (elapsedMinutes > 0) {
      logActivity.mutate(elapsedMinutes);
    }
    setIsRunning(false);
    setSeconds(0);
    setElapsedMinutes(0);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  if (isLoading) {
    return <div className="p-8 text-center">{t("loading")}</div>;
  }

  if (!dashboard) return null;

  const today = new Date().getDay();
  const todaysClasses = groupSchedule.filter((s) => s.dayNumber === today).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const aiTip = dashboard.examPrediction.recommendations[0] || t("organizeTime");

  // Prepare weekly activity data with Arabic labels
  const weeklyData = (dashboard.activity ?? []).map((a) => {
    const d = new Date(a.date);
    return {
      ...a,
      dayLabel: AR_WEEKDAYS[d.getDay()],
    };
  });
  const totalWeeklyPoints = weeklyData.reduce((sum, a) => sum + (a.pointsEarned || 0), 0);
  const avgDaily = weeklyData.length > 0
    ? Math.round(weeklyData.reduce((sum, a) => sum + (a.minutesStudied || 0), 0) / 7)
    : 0;

  const handleCompleteMission = (missionId: number) => {
    const queryKey = getGetDashboardQueryKey();
    const prev = queryClient.getQueryData<typeof dashboard>(queryKey);
    if (prev) {
      queryClient.setQueryData(queryKey, {
        ...prev,
        missions: prev.missions.map((m) => m.id === missionId ? { ...m, completed: true } : m),
      });
    }
    completeMission.mutate(
      { id: missionId },
      {
        onError: () => {
          if (prev) queryClient.setQueryData(queryKey, prev);
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey });
        },
      }
    );
  };

  const progressPercentage = ((dashboard.user.points - (dashboard.user.level - 1) * 100) / 100) * 100;

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
          >
            {getGreeting(dashboard.user.name, t)}
          </motion.h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-2 text-sm bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/15 rounded-2xl p-3 flex items-start gap-2 max-w-xl"
          >
            <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <span><strong className="text-primary">{t("aiTipLabel")}</strong> {aiTip}</span>
          </motion.div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <p className="text-muted-foreground text-sm">{t("quickDayOverview")}</p>
            {(dashboard.user as any).groupName && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="text-xs bg-primary/15 text-primary px-2.5 py-1 rounded-full font-bold"
              >
                {t("groupLabel")} {(dashboard.user as any).groupName}
              </motion.span>
            )}
            {(dashboard.user as any).department && (
              <span className="text-xs bg-secondary/15 text-secondary-foreground px-2.5 py-1 rounded-full font-medium">
                {(dashboard.user as any).department}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 bg-card px-3 sm:px-4 py-2 rounded-2xl shadow-sm border border-border w-full sm:w-auto justify-center">
          <div className="text-center px-2 sm:px-4 border-e border-border">
            <div className="text-xl sm:text-2xl font-bold text-secondary">{dashboard.user.level}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">{t("level")}</div>
          </div>
          <div className="text-center px-2 sm:px-4 border-e border-border">
            <div className="text-xl sm:text-2xl font-bold text-accent">{dashboard.user.points}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">{t("points")}</div>
          </div>
          <div className="text-center px-2 sm:px-4">
            <div className="text-xl sm:text-2xl font-bold text-orange-500 flex items-center justify-center gap-1">
              🔥 {dashboard.user.streak}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">{t("streak")}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI Exam Prediction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
              <div className="w-36 h-36 sm:w-48 sm:h-48 shrink-0 relative">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-muted" />
                  <circle 
                    cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" 
                    strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * dashboard.examPrediction.predictedScore) / 100}
                    className="text-primary transition-all duration-1000 ease-out" 
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl sm:text-4xl font-bold text-primary">{dashboard.examPrediction.predictedScore}%</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">Predicted Score</span>
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="font-bold text-lg">{dashboard.examPrediction.courseTitle}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={dashboard.examPrediction.risk === 'low' ? 'default' : dashboard.examPrediction.risk === 'medium' ? 'secondary' : 'destructive'}>
                      {dashboard.examPrediction.risk} risk
                    </Badge>
                    <span className="text-sm text-muted-foreground">{dashboard.examPrediction.confidence}% confidence</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground/80">Recommendations:</h4>
                  <ul className="space-y-1">
                    {dashboard.examPrediction.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <Target className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />
              {t("dailyMissions")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.missions.map(mission => (
              <div key={mission.id} className={`flex items-start gap-3 p-3 rounded-xl border ${mission.completed ? 'bg-muted/50 border-transparent opacity-60' : 'bg-card border-border shadow-sm'}`}>
                <button 
                  onClick={() => !mission.completed && handleCompleteMission(mission.id)}
                  disabled={mission.completed || completeMission.isPending}
                  className="mt-0.5 shrink-0 focus:outline-none"
                >
                  {mission.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <h4 className={`text-sm font-bold ${mission.completed ? 'line-through text-muted-foreground' : ''}`}>{mission.title}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-1">{mission.description}</p>
                </div>
                <div className="text-xs font-bold text-accent shrink-0">+{mission.points}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <CoachCard onEdit={() => setPersonalizationOpen(true)} />

      <CommunityCards />

      <div className="bg-card border rounded-2xl p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> مقترحات ليك
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {recs?.personalized ? "مبنية على اهتماماتك وأهدافك" : "اختار اهتماماتك عشان نقترح حاجات أدق"}
            </p>
          </div>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setPersonalizationOpen(true)}>
            {recs?.personalized ? "تعديل الاهتمامات" : "اختار اهتماماتك"}
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-muted-foreground flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> مسارات مهارات</div>
            {(recs?.tracks ?? []).map((t) => (
              <Link key={t.id} href={`/skills/${t.id}`} className="block rounded-xl border bg-background p-3 hover:border-primary/40 hover:shadow-sm transition">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold line-clamp-1">{t.title}</span>
                  <span className="text-[9px] bg-primary/10 text-primary rounded-full px-2 py-0.5 shrink-0">{t.doneLessons > 0 ? "كمّل" : "جديد"}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">{t.reason}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{t.doneLessons}/{t.lessonsCount} دروس</div>
              </Link>
            ))}
            {recs && recs.tracks.length === 0 && <div className="text-[10px] text-muted-foreground py-3 text-center">مفيش مسارات مقترحة دلوقتي.</div>}
          </div>
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-muted-foreground flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> فرص</div>
            {(recs?.opportunities ?? []).map((o) => (
              <Link key={o.id} href={`/opportunities/${o.id}`} className="block rounded-xl border bg-background p-3 hover:border-primary/40 hover:shadow-sm transition">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold line-clamp-1">{o.title}</span>
                  <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{o.company}{o.remote ? " · أونلاين" : o.location ? ` · ${o.location}` : ""}</div>
                <div className="text-[10px] text-secondary mt-1">{o.reason}</div>
              </Link>
            ))}
            {recs && recs.opportunities.length === 0 && <div className="text-[10px] text-muted-foreground py-3 text-center">مفيش فرص مقترحة دلوقتي.</div>}
          </div>
        </div>
      </div>

      <PersonalizationDialog open={personalizationOpen} onOpenChange={setPersonalizationOpen} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              {t("studyFocus")}
            </CardTitle>
            <CardDescription>{dashboard.weeklyMinutes} / {dashboard.focusGoalMinutes} {t("minutesThisWeek")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={(dashboard.weeklyMinutes / dashboard.focusGoalMinutes) * 100} className="h-2 mb-4" />

            {/* Weekly Summary */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
              <div className="bg-muted/30 rounded-lg p-2 sm:p-3 text-center">
                <div className="text-base sm:text-lg font-bold text-primary">{dashboard.weeklyMinutes}</div>
                <div className="text-[10px] text-muted-foreground">{t("minutesStudied")}</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-2 sm:p-3 text-center">
                <div className="text-base sm:text-lg font-bold text-accent">+{totalWeeklyPoints}</div>
                <div className="text-[10px] text-muted-foreground">{t("pointsEarned")}</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-2 sm:p-3 text-center">
                <div className="text-base sm:text-lg font-bold">{avgDaily} {t("minShort")}</div>
                <div className="text-[10px] text-muted-foreground">{t("dailyAverage")}</div>
              </div>
            </div>

            {/* Study Timer */}
            <div className="flex items-center justify-between bg-muted/30 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <Timer className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                <div>
                  <div className="text-xl sm:text-2xl font-bold tabular-nums">{formatTime(seconds)}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">
                    {isRunning ? t("studyingInProgress") : t("pressToStartStudying")}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant={isRunning ? "destructive" : "default"}
                onClick={isRunning ? handleStop : () => setIsRunning(true)}
                disabled={logActivity.isPending}
                className="text-xs sm:text-sm"
              >
                {isRunning ? <><Square className="me-1 h-3 w-3 sm:h-3.5 sm:w-3.5" /> {t("stop")}</> : <><Play className="me-1 h-3 w-3 sm:h-3.5 sm:w-3.5" /> {t("start")}</>}
              </Button>
            </div>

            <div className="h-[150px] sm:h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <XAxis dataKey="dayLabel" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: 'var(--muted)'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                  <Bar dataKey="minutesStudied" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              {t("todaySchedule")} — {DAY_NAMES[Number(today)]}
            </CardTitle>
            <CardDescription>{todaysClasses.length > 0 ? `${todaysClasses.length} ${t("todayClasses")}` : t("lightDay")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todaysClasses.length > 0 ? todaysClasses.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex flex-col sm:flex-row gap-2 sm:gap-3 p-3 rounded-xl border-2 border-border bg-gradient-to-r from-card to-primary/5 hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center sm:flex-col sm:items-center justify-center w-full sm:w-16 shrink-0 border-b sm:border-e sm:border-b-0 sm:pe-3 pb-2 sm:pb-0 sm:pe-3">
                    <span className="font-bold text-sm tabular-nums">{item.startTime}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums ms-2 sm:ms-0">{item.endTime}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm">{item.courseTitle}</h4>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-bold">{item.type}</span>
                      {item.room && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {item.room}</span>}
                    </div>
                    {item.instructor && <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-0.5"><UserIcon className="h-2.5 w-2.5" /> {item.instructor}</p>}
                  </div>
                </motion.div>
              )) : groupSchedule.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                  <CalendarIcon className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-sm">{t("noSchedule")}</p>
                  <p className="text-xs mt-1">{t("noScheduleContact")}</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                  <CalendarIcon className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-sm">{t("freeDay")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
