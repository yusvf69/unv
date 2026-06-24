import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import {
  ChevronLeft, ChevronRight, PlayCircle, CheckCircle2, Circle,
  Clock, FileText, Target, Trophy, Sparkles, BookOpen,
  Zap, Star, Lock, Award, ArrowRight, Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSkillTracks, useCompleteLesson, useSubmitQuickCheck } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useTranslation, globalI18n } from "@/lib/i18n";

export default function SkillDetail() {
  const { id } = useParams<{ id: string }>();
  const trackId = Number(id);
  const { data: tracks = [] } = useSkillTracks();
  const track = tracks.find((t) => t.id === trackId);
  const complete = useCompleteLesson();
  const { toast } = useToast();
  const t = useTranslation(globalI18n);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [qcAnswers, setQcAnswers] = useState<Record<number, number>>({});
  const [qcResults, setQcResults] = useState<Record<number, { correct: boolean; correctIndex: number; explanation: string } | null>>({});
  const submitQc = useSubmitQuickCheck();

  const onComplete = async (lessonId: number) => {
    setBusyId(lessonId);
    try {
      await complete.mutateAsync(lessonId);
      toast({ title: t("goodJobPoints") });
    } catch (e) {
      toast({ title: t("error"), description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const done = track ? track.lessons.filter((l) => l.completed).length : 0;
  const total = track ? track.lessons.length : 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const modules = useMemo(() => {
    if (!track) return [];
    const lessons = track.lessons;
    const moduleSize = 3;
    const mods: { title: string; lessons: typeof lessons }[] = [];
    for (let i = 0; i < lessons.length; i += moduleSize) {
      mods.push({
        title: `Module ${Math.floor(i / moduleSize) + 1}`,
        lessons: lessons.slice(i, i + moduleSize),
      });
    }
    return mods;
  }, [track]);

  if (!track) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  const handleQuickCheck = async (qcId: number, answer: number, lessonId: number) => {
    setQcAnswers((a) => ({ ...a, [qcId]: answer }));
    try {
      const res = await submitQc.mutateAsync({ qcId, answer, lessonId });
      setQcResults((r) => ({ ...r, [qcId]: res }));
    } catch {}
  };

  const levelLabels: Record<string, string> = {
    beginner: "مبتدئ", learner: "متعلم", practitioner: "ممارس", mastered: "متقن",
  };
  const levelColors: Record<string, string> = {
    beginner: "text-slate-600 bg-slate-100 border-slate-300",
    learner: "text-blue-600 bg-blue-100 border-blue-300",
    practitioner: "text-emerald-600 bg-emerald-100 border-emerald-300",
    mastered: "text-amber-600 bg-amber-100 border-amber-300",
  };
  const levelIcons: Record<string, any> = {
    beginner: Circle, learner: Zap, practitioner: Award, mastered: Trophy,
  };
  const currentLevel = (track as any).level || "beginner";
  const LevelIcon = levelIcons[currentLevel] || Circle;

  const nextLevel = currentLevel === "beginner" ? "learner" : currentLevel === "learner" ? "practitioner" : currentLevel === "practitioner" ? "mastered" : null;
  const levelThresholds: Record<string, { need: string }> = {
    beginner: { need: "أكمل 50% من الدروس" },
    learner: { need: "أكمل كل الدروس + 70% في الاختبارات" },
    practitioner: { need: "أكمل كل الدروس + 90% في الاختبارات" },
  };

  const rewards = [
    { label: "إنهاء أول 3 دروس", xp: 10, icon: Star, unlocked: done >= 3 },
    { label: "إكمال Module 1", xp: 20, icon: Award, unlocked: done >= 3 },
    { label: "إكمال المسار", xp: 100, icon: Trophy, unlocked: done >= total && total > 0 },
    { label: "90%+ في الاختبارات", xp: 50, icon: Zap, unlocked: false },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        {/* ===== BACK ===== */}
        <Link href="/skills" className="inline-flex items-center text-xs sm:text-sm text-muted-foreground hover:text-primary mb-3 sm:mb-4 transition-colors">
          <ChevronRight className="h-3.5 w-3.5 ml-1" />
          العودة إلى المهارات
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* ===== MAIN CONTENT ===== */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* HEADER */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border rounded-xl sm:rounded-2xl p-4 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                {track.coverUrl ? (
                  <div className="w-full sm:w-32 h-32 rounded-xl overflow-hidden shrink-0 border">
                    <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-full sm:w-32 h-32 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border">
                    <Target className="h-12 w-12 text-primary/30" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-[10px]">{track.category}</Badge>
                    <Badge variant={track.difficulty === "advanced" ? "destructive" : track.difficulty === "intermediate" ? "secondary" : "default"} className="text-[10px]">
                      {track.difficulty === "beginner" ? "مبتدئ" : track.difficulty === "intermediate" ? "متوسط" : "متقدم"}
                    </Badge>
                    {(track as any).level && (
                      <Badge variant="outline" className={`text-[10px] gap-1 ${
                        (track as any).level === "mastered" ? "text-amber-600 border-amber-300 bg-amber-50" :
                        (track as any).level === "practitioner" ? "text-emerald-600 border-emerald-300 bg-emerald-50" :
                        (track as any).level === "learner" ? "text-blue-600 border-blue-300 bg-blue-50" :
                        "text-slate-600 border-slate-300 bg-slate-50"
                      }`}>
                        {(track as any).level === "mastered" ? "متقن" : (track as any).level === "practitioner" ? "ممارس" : (track as any).level === "learner" ? "متعلم" : "مبتدئ"}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <BookOpen className="h-3 w-3" /> {total} دروس
                    </Badge>
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Clock className="h-3 w-3" /> {track.lessons.reduce((s, l) => s + l.durationMinutes, 0)} د
                    </Badge>
                  </div>
                  <h1 className="text-xl sm:text-3xl font-serif font-bold">{track.title}</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">{track.description}</p>

                  <div className="mt-3 sm:mt-4">
                    <div className="flex items-center justify-between text-xs sm:text-sm mb-1">
                      <span className="font-medium">التقدم</span>
                      <span className="font-bold">{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>

                  <div className="flex flex-wrap gap-2 sm:gap-4 mt-2 sm:mt-3 text-[10px] sm:text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      {done} مكتمل
                    </span>
                    <span className="flex items-center gap-1">
                      <Circle className="h-3.5 w-3.5" />
                      {total - done} متبقي
                    </span>
                    <span>
                      آخر نشاط: {done > 0 ? "منذ يوم" : "لم يبدأ بعد"}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ROADMAP / MODULES */}
            <div className="space-y-3 sm:space-y-4">
              {modules.map((mod, mi) => {
                const modDone = mod.lessons.filter((l) => l.completed).length;
                const modPct = Math.round((modDone / mod.lessons.length) * 100);
                const allDone = modDone === mod.lessons.length;
                return (
                  <motion.div
                    key={mi}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: mi * 0.1 }}
                    className={`bg-card border rounded-xl overflow-hidden ${allDone ? "border-emerald-500/30" : ""}`}
                  >
                    <div className={`px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 ${allDone ? "bg-emerald-500/10" : "bg-muted/30"}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`p-1 rounded-lg ${allDone ? "bg-emerald-500/20" : "bg-primary/10"}`}>
                          {allDone ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <BookOpen className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm">{mod.title}</h3>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                            <span>{modDone}/{mod.lessons.length} دروس</span>
                            {modPct > 0 && <span>· {modPct}%</span>}
                          </div>
                        </div>
                      </div>
                      <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden hidden sm:block">
                        <div className={`h-full rounded-full ${allDone ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${modPct}%` }} />
                      </div>
                    </div>

                    <div className="divide-y">
                      {mod.lessons.map((lesson, li) => {
                        const isBusy = busyId === lesson.id;
                        return (
                          <div key={lesson.id}>
                            <div className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 transition ${lesson.completed ? "bg-emerald-500/5" : "hover:bg-muted/20"}`}>
                              <div className={`shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center ${lesson.completed ? "bg-emerald-500/20" : "bg-muted"}`}>
                                {lesson.completed ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" />
                                ) : (
                                  <Circle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-muted-foreground">{mi * 3 + li + 1}.</span>
                                  <span className={`text-xs sm:text-sm font-medium truncate ${lesson.completed ? "line-through text-muted-foreground" : ""}`}>
                                    {lesson.title}
                                  </span>
                                  <Badge variant="outline" className="text-[8px] sm:text-[10px] h-4 sm:h-5 px-1 gap-0.5 hidden sm:inline-flex">
                                    {lesson.kind === "lesson" && <PlayCircle className="h-2.5 w-2.5" />}
                                    {lesson.kind === "task" && <FileText className="h-2.5 w-2.5" />}
                                    {lesson.kind === "quiz" && <Target className="h-2.5 w-2.5" />}
                                    {lesson.kind === "challenge" && <Trophy className="h-2.5 w-2.5" />}
                                    {lesson.kind === "lab" && <FlaskConical className="h-2.5 w-2.5" />}
                                    {lesson.kind}
                                  </Badge>
                                  {(lesson as any).quickCheckScore > 0 && (
                                    <span className={`text-[9px] font-bold ${(lesson as any).quickCheckScore >= 90 ? "text-emerald-600" : (lesson as any).quickCheckScore >= 70 ? "text-amber-600" : "text-red-600"}`}>
                                      {(lesson as any).quickCheckScore}%
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" />
                                  {lesson.durationMinutes}
                                </span>
                                {!lesson.completed ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 sm:h-7 text-[10px] px-1.5 sm:px-2"
                                    onClick={() => onComplete(lesson.id)}
                                    disabled={isBusy}
                                  >
                                    {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : "أكمل"}
                                  </Button>
                                ) : (
                                  (lesson as any).quickCheckScore > 0 ? (
                                    <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${(lesson as any).quickCheckScore >= 70 ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                                      {(lesson as any).quickCheckScore}%
                                    </div>
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                  )
                                )}
                              </div>
                            </div>

                            {/* Quick Checks — show inline when lesson completed + has questions */}
                            {(lesson as any).quickChecks && (lesson as any).quickChecks.length > 0 && lesson.completed && (
                              <div className="px-3 sm:px-6 pb-3 space-y-2">
                                {(lesson as any).quickChecks.map((qc: any) => {
                                  const result = qcResults[qc.id];
                                  const selected = qcAnswers[qc.id];
                                  return (
                                    <div key={qc.id} className="bg-background border rounded-lg p-3">
                                      <p className="text-xs sm:text-sm font-medium mb-2">{qc.question}</p>
                                      <div className="space-y-1">
                                        {qc.options.map((opt: string, oi: number) => {
                                          let cls = "border-muted hover:bg-muted/30";
                                          if (result) {
                                            if (oi === result.correctIndex) cls = "border-emerald-500 bg-emerald-50";
                                            else if (selected === oi && !result.correct) cls = "border-red-500 bg-red-50";
                                          } else if (selected === oi) {
                                            cls = "border-primary bg-primary/5";
                                          }
                                          return (
                                            <button
                                              key={oi}
                                              onClick={() => !result && handleQuickCheck(qc.id, oi, lesson.id)}
                                              disabled={!!result}
                                              className={`w-full text-right flex items-center gap-2 p-2 rounded-lg border text-xs sm:text-sm transition ${cls}`}
                                            >
                                              <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${result && oi === result.correctIndex ? "border-emerald-500 bg-emerald-500" : selected === oi ? "border-primary" : "border-muted-foreground/30"}`}>
                                                {result && oi === result.correctIndex && <CheckCircle2 className="h-3 w-3 text-white" />}
                                              </div>
                                              <span className="flex-1">{opt}</span>
                                              {result && oi === result.correctIndex && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {result && result.explanation && (
                                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 pt-2 border-t">{result.explanation}</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* ===== SIDEBAR ===== */}
          <div className="space-y-3 sm:space-y-4">
            {/* SKILL LEVEL */}
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-card border rounded-xl p-3 sm:p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <h3 className="font-bold text-sm">المستوى</h3>
              </div>
              <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${levelColors[currentLevel]}`}>
                <LevelIcon className="h-5 w-5" />
                <div>
                  <div className="font-bold text-sm">{levelLabels[currentLevel]}</div>
                  {nextLevel && (
                    <div className="text-[10px] opacity-70">التالي: {levelThresholds[currentLevel]?.need}</div>
                  )}
                </div>
              </div>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-secondary rounded-full" style={{
                  width: `${currentLevel === "beginner" ? Math.min((done / Math.max(total, 1)) * 100, 50) : currentLevel === "learner" ? 50 + Math.min((done / Math.max(total, 1)) * 25, 25) : currentLevel === "practitioner" ? 75 + Math.min((done / Math.max(total, 1)) * 25, 25) : 100}%`
                }} />
              </div>
              <div className="flex justify-between mt-1 text-[8px] text-muted-foreground">
                <span>مبتدئ</span>
                <span>متعلم</span>
                <span>ممارس</span>
                <span>متقن</span>
              </div>
            </motion.div>

            {/* REWARDS & MILESTONES */}
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-card border rounded-xl p-3 sm:p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-4 w-4 text-amber-500" />
                <h3 className="font-bold text-sm">المكافآت</h3>
              </div>
              <div className="space-y-2">
                {rewards.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 p-2 rounded-lg text-xs ${r.unlocked ? "bg-emerald-500/10" : "bg-muted/30 opacity-60"}`}
                  >
                    <div className={`p-1 rounded ${r.unlocked ? "bg-emerald-500/20" : "bg-muted"}`}>
                      <r.icon className={`h-3 w-3 ${r.unlocked ? "text-emerald-600" : "text-muted-foreground"}`} />
                    </div>
                    <span className="flex-1">{r.label}</span>
                    <span className="font-bold text-amber-600">+{r.xp} XP</span>
                    {r.unlocked && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* AI COACH */}
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-primary/5 to-secondary/5 border rounded-xl p-3 sm:p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm">المساعد الذكي</h3>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-2">
                اسأل AI عن أي درس في هذا المسار
              </p>
              <div className="flex flex-wrap gap-1">
                {["اشرحلي الدرس", "اختبرني", "لخص", "أمثلة"].map((action, i) => (
                  <Link
                    key={i}
                    href={`/ai?skill=${track.id}&q=${encodeURIComponent(action + " " + track.title)}`}
                    className="text-[10px] sm:text-xs bg-background border rounded-full px-2 py-0.5 hover:bg-primary/5 transition"
                  >
                    {action}
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* RELATED CONTENT */}
            {(true) && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-card border rounded-xl p-3 sm:p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-sm">محتويات مرتبطة</h3>
                </div>
                <div className="space-y-1.5">
                  {track.category === "practical" || track.title.toLowerCase().includes("soil") || track.title.toLowerCase().includes("ph") ? (
                    <Link
                      href="/games"
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/30 transition text-[10px] sm:text-xs"
                    >
                      <Trophy className="h-3 w-3 text-amber-500" />
                      <span>لعبة Soil pH</span>
                    </Link>
                  ) : null}
                  <Link
                    href={`/quizzes`}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/30 transition text-[10px] sm:text-xs"
                  >
                    <Target className="h-3 w-3 text-primary" />
                    <span>اختبارات ذات صلة</span>
                  </Link>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FlaskConical({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
      <path d="M8.5 2h7" />
      <path d="M7 16h10" />
    </svg>
  );
}
