import { useState, useMemo, useEffect } from "react";
import { useParams, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, PlayCircle, CheckCircle2, Circle,
  Clock, FileText, Target, Trophy, Sparkles, BookOpen,
  Zap, Star, Lock, Award, ArrowRight, Volume2,
  Brain, Wheat, Beaker, StickyNote, Flame, Gamepad2, Download, WifiOff, Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { saveSummaryOffline } from "@/lib/offline";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useSkillTracks, useCompleteLesson, useSubmitQuickCheck, useLab, useLessonNote, useSaveLessonNote, useStreak, useVisualCard, useCertificate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useTranslation, globalI18n } from "@/lib/i18n";
import LabPlayer from "@/components/lab-player";

export default function SkillDetail() {
  const { id } = useParams<{ id: string }>();
  const trackId = Number(id);
  const { data: tracks = [] } = useSkillTracks();
  const { data: streak } = useStreak();
  const track = tracks.find((t) => t.id === trackId);
  const complete = useCompleteLesson();
  const { toast } = useToast();
  const t = useTranslation(globalI18n);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [qcAnswers, setQcAnswers] = useState<Record<number, number>>({});
  const [qcResults, setQcResults] = useState<Record<number, { correct: boolean; correctIndex: number; explanation: string } | null>>({});
  const [activeLabId, setActiveLabId] = useState<number | null>(null);
  const [aiLessonId, setAiLessonId] = useState<number | null>(null);
  const [activeVisualId, setActiveVisualId] = useState<number | null>(null);
  const submitQc = useSubmitQuickCheck();
  const { data: labData } = useLab(activeLabId);
  const { data: visualData } = useVisualCard(activeVisualId);
  const { data: certificate } = useCertificate(id ? Number(id) : null);

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
  const avgScore = track ? Math.round(
    track.lessons
      .filter((l: any) => l.quickCheckScore > 0)
      .reduce((s: number, l: any) => s + l.quickCheckScore, 0) /
    Math.max(track.lessons.filter((l: any) => l.quickCheckScore > 0).length, 1)
  ) : 0;
  const practiceDone = track ? track.lessons.filter((l) => l.kind === "practice" && l.completed).length : 0;
  const practiceTotal = track ? track.lessons.filter((l) => l.kind === "practice").length : 0;
  const lastActivity = track
    ? track.lessons.filter((l) => l.completed).length > 0
      ? "اليوم"
      : "لم يبدأ بعد"
    : "";

  // Estimated finish date: assume 1 lesson per day for remaining
  const estimatedFinish = (() => {
    if (!track) return null;
    const remaining = track.lessons.filter((l) => !l.completed).length;
    if (remaining === 0) return null;
    const date = new Date();
    date.setDate(date.getDate() + remaining);
    return date.toLocaleDateString("ar-EG", { weekday: "long", month: "long", day: "numeric" });
  })();

  // Teacher name based on track category
  const teacherName = track?.category === "academic" ? "د. أحمد السيد" :
    track?.category === "practical" ? "د. محمد علي" :
    track?.category === "career" ? "أ. ناهد حسن" :
    "د. سارة عبد الرحمن";

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
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1.5">
                    <Award className="h-3 w-3" />
                    <span>المدرس: <strong className="text-foreground">{teacherName}</strong></span>
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
                      {done}/{total} مكتمل
                    </span>
                    {avgScore > 0 && (
                      <span className="flex items-center gap-1">
                        <Target className="h-3.5 w-3.5 text-primary" />
                        متوسط الاختبارات: {avgScore}%
                      </span>
                    )}
                    {practiceTotal > 0 && (
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        تطبيقات: {practiceDone}/{practiceTotal}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 sm:gap-4 mt-1 text-[10px] sm:text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      آخر نشاط: {lastActivity}
                    </span>
                    {estimatedFinish && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        متوقع الإنتهاء: {estimatedFinish}
                      </span>
                    )}
                    {streak && (
                      <span className="flex items-center gap-1">
                        <Flame className="h-3.5 w-3.5 text-orange-500" />
                        {streak.currentStreak} يوم متتالي
                      </span>
                    )}
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
                            {(() => {
                            // Determine lesson state: locked, available, completed, mastered
                            const isQCScoreGood = (lesson as any).quickCheckScore >= 80;
                            const isMastered = lesson.completed && isQCScoreGood && lesson.kind !== "lesson" && lesson.kind !== "visual";
                            const isCompleted = lesson.completed && !isMastered;
                            // Check if previous lesson is completed
                            const prevIdx = li > 0 ? mod.lessons[li - 1] : null;
                            const prevDone = prevIdx ? prevIdx.completed : true;
                            const isLocked = !prevDone && !lesson.completed;
                            const isAvailable = !isLocked && !lesson.completed;

                            let stateClass = "hover:bg-muted/20";
                            let stateIcon = <Circle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />;
                            let iconBg = "bg-muted";
                            let stateLabel = "";

                            if (isLocked) {
                              stateClass = "opacity-50";
                              stateIcon = <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />;
                              iconBg = "bg-muted/50";
                              stateLabel = "مقفل";
                            } else if (isMastered) {
                              stateClass = "bg-emerald-500/10";
                              stateIcon = <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600" />;
                              iconBg = "bg-amber-500/20";
                              stateLabel = "متقن";
                            } else if (isCompleted) {
                              stateClass = "bg-emerald-500/5";
                              stateIcon = <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" />;
                              iconBg = "bg-emerald-500/20";
                              stateLabel = "مكتمل";
                            } else {
                              stateClass = "hover:bg-muted/20 border-primary/10";
                              stateIcon = <PlayCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />;
                              iconBg = "bg-primary/10";
                              stateLabel = "متاح";
                            }

                            return (
                            <div className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 transition ${stateClass}`}>
                              <div className={`shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center ${iconBg}`}>
                                {stateIcon}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-muted-foreground">{mi * 3 + li + 1}.</span>
                                  <span className={`text-xs sm:text-sm font-medium truncate ${isCompleted ? "line-through text-muted-foreground" : isMastered ? "text-amber-700 font-bold" : ""}`}>
                                    {lesson.title}
                                  </span>
                                  <Badge variant="outline" className="text-[8px] sm:text-[10px] h-4 sm:h-5 px-1 gap-0.5 hidden sm:inline-flex">
                                    {lesson.kind === "lesson" && <PlayCircle className="h-2.5 w-2.5" />}
                                    {lesson.kind === "task" && <FileText className="h-2.5 w-2.5" />}
                                    {lesson.kind === "quiz" && <Target className="h-2.5 w-2.5" />}
                                    {lesson.kind === "challenge" && <Trophy className="h-2.5 w-2.5" />}
                                    {lesson.kind === "lab" && <FlaskConical className="h-2.5 w-2.5" />}
                                    {lesson.kind === "practice" && <Target className="h-2.5 w-2.5" />}
                                    {lesson.kind === "visual" && <BookOpen className="h-2.5 w-2.5" />}
                                    {lesson.kind}
                                  </Badge>
                                  {(lesson as any).quickCheckScore > 0 && (
                                    <span className={`text-[9px] font-bold ${(lesson as any).quickCheckScore >= 90 ? "text-emerald-600" : (lesson as any).quickCheckScore >= 70 ? "text-amber-600" : "text-red-600"}`}>
                                      {(lesson as any).quickCheckScore}%
                                    </span>
                                  )}
                                  {isMastered && <Award className="h-3 w-3 text-amber-500" />}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" />
                                  {lesson.durationMinutes}
                                </span>
                                {isLocked ? (
                                  <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />
                                ) : !lesson.completed ? (
                                  lesson.kind === "lab" ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 sm:h-7 text-[10px] px-1.5 sm:px-2 gap-1"
                                      onClick={() => setActiveLabId(lesson.id)}
                                    >
                                      <FlaskConical className="h-3 w-3" /> مختبر
                                    </Button>
                                  ) : lesson.kind === "visual" ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 sm:h-7 text-[10px] px-1.5 sm:px-2 gap-1"
                                      onClick={() => setActiveVisualId(lesson.id)}
                                    >
                                      <BookOpen className="h-3 w-3" /> عرض
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 sm:h-7 text-[10px] px-1.5 sm:px-2"
                                      onClick={() => onComplete(lesson.id)}
                                      disabled={isBusy}
                                    >
                                      {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : "أكمل"}
                                    </Button>
                                  )
                                ) : (
                                  (lesson as any).quickCheckScore > 0 ? (
                                    <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${(lesson as any).quickCheckScore >= 70 ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                                      {(lesson as any).quickCheckScore}%
                                    </div>
                                  ) : (
                                    isMastered ? <Award className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                  )
                                )}
                              </div>
                            </div>);
                          })()}

                            {/* Notes + AI Coach inline */}
                            {lesson.completed && (
                              <div className="px-3 sm:px-6 pb-2 space-y-1">
                                {/* Notes */}
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => setAiLessonId(aiLessonId === lesson.id ? null : lesson.id)}
                                    className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary transition-colors"
                                  >
                                    <Sparkles className="h-3 w-3" />
                                    {aiLessonId === lesson.id ? "إخفاء المساعد" : "المساعد الذكي"}
                                  </button>
                                  <NoteButton lessonId={lesson.id} />
                                  <SaveOfflineButton lessonTitle={lesson.title} lessonId={lesson.id} trackTitle={track?.title || ""} />
                                </div>
                                {aiLessonId === lesson.id && (
                                  <div className="p-3 bg-gradient-to-r from-primary/5 to-secondary/5 border rounded-xl space-y-1.5">
                                    <p className="text-[10px] text-muted-foreground mb-1">ماذا تريد أن تفعل بهذا الدرس؟</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {[
                                        { label: "اشرحلي", action: `اشرح لي درس: ${lesson.title} باللغة العربية الفصحى` },
                                        { label: "اختبرني", action: `اختبرني في 5 أسئلة عن: ${lesson.title}` },
                                        { label: "لخص", action: `لخص لي درس: ${lesson.title} في 3 نقاط` },
                                        { label: "أمثلة", action: `أعطني 3 أمثلة من الزراعة المصرية عن: ${lesson.title}` },
                                        { label: "فلاش كاردز", action: `اعمل لي 5 فلاش كاردز عن: ${lesson.title}` },
                                        { label: "الفرق", action: `اشرح الفرق بين المفاهيم الرئيسية في: ${lesson.title}` },
                                        { label: "قيّم إجابتي", action: `قيّم هذه الإجابة على سؤال عن ${lesson.title}: [ضع إجابتك هنا] وأعطني تقييماً مفصلاً` },
                                      ].map((action, ai) => (
                                        <Link
                                          key={ai}
                                          href={`/ai?q=${encodeURIComponent(action.action)}`}
                                          className="text-[10px] bg-background border rounded-full px-2.5 py-1 hover:bg-primary/5 transition"
                                        >
                                          {action.label}
                                        </Link>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

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

                            {/* Practice Task — show inline when lesson kind is practice */}
                            {lesson.kind === "practice" && lesson.completed && (
                              <div className="px-3 sm:px-6 pb-3">
                                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 sm:p-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Target className="h-3.5 w-3.5 text-blue-500" />
                                    <span className="text-xs font-bold">تطبيق عملي</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-2">طبّق ما تعلمته في هذا الدرس عملياً:</p>
                                  <textarea
                                    className="w-full bg-background border rounded-lg p-2 text-xs resize-none"
                                    rows={3}
                                    placeholder="اكتب تطبيقك العملي هنا..."
                                  />
                                  <div className="flex gap-1.5 mt-2">
                                    <button className="px-3 py-1 bg-blue-500 text-white rounded-lg text-[10px] font-bold hover:bg-blue-600 transition">حفظ التطبيق</button>
                                    <button className="px-3 py-1 bg-background border rounded-lg text-[10px] hover:bg-muted/30 transition">تقييم ذاتي</button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Boss Challenge — show inline when lesson kind is challenge */}
                            {lesson.kind === "challenge" && lesson.completed && (
                              <div className="px-3 sm:px-6 pb-3">
                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 sm:p-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Trophy className="h-3.5 w-3.5 text-amber-500" />
                                    <span className="text-xs font-bold text-amber-600">اختبار التحدي</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-3">اختبر نفسك في هذا التحدي الشامل:</p>
                                  <div className="space-y-2">
                                    {[{ q: "ما هي الخطوة الأولى في هذه العملية؟", o: ["الفهم", "التنفيذ", "التقييم", "التخطيط"] }, { q: "ما أهم نتيجة توقعتها؟", o: ["تحسين الإنتاج", "توفير الوقت", "تقليل التكاليف", "جميع ما سبق"] }].map((q: any, qi) => (
                                      <div key={qi} className="bg-background border rounded-lg p-2.5">
                                        <p className="text-xs font-medium mb-1.5">{q.q}</p>
                                        <div className="flex flex-wrap gap-1">
                                          {q.o.map((o: string, oi: number) => (
                                            <button key={oi} className="px-2 py-1 border rounded-md text-[10px] hover:bg-amber-500/10 transition">{o}</button>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <button className="mt-3 w-full py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition flex items-center justify-center gap-1">
                                    <Zap className="h-3.5 w-3.5" />
                                    بدء التحدي
                                  </button>
                                </div>
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

            {/* AI COACH + Capstone + Flashcards */}
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
              <div className="mt-2 pt-2 border-t space-y-1">
                {done === total && total > 0 && (
                  <Link href={`/ai?q=${encodeURIComponent(`أختبرني في challenge نهائي لمسار ${track.title} — 10 أسئلة`)}`} className="flex items-center gap-1.5 text-[10px] text-amber-600 hover:text-amber-700 transition">
                    <Trophy className="h-3 w-3" /> Capstone Challenge
                  </Link>
                )}
                <Link href={`/ai?q=${encodeURIComponent(`اعمل لي فلاش كاردز عن مسار ${track.title}`)}`} className="flex items-center gap-1.5 text-[10px] text-primary hover:text-primary/80 transition">
                  <Sparkles className="h-3 w-3" /> توليد فلاش كاردز
                </Link>
              </div>
            </motion.div>

            {/* CERTIFICATE (when completed) */}
            {certificate && done === total && total > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 sm:p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Award className="h-5 w-5 text-amber-600" />
                  <h3 className="font-bold text-sm">شهادة إتمام</h3>
                </div>
                <div className="bg-white dark:bg-background border-2 border-amber-300 dark:border-amber-700 rounded-lg p-3 text-center">
                  <Award className="h-8 w-8 mx-auto text-amber-500 mb-1" />
                  <div className="font-bold text-xs">{certificate.trackTitle}</div>
                  <div className="text-[10px] text-muted-foreground">{certificate.userName}</div>
                  <div className="inline-block mt-1 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-700 dark:text-amber-400">
                    {certificate.mastery}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {certificate.lessonsCompleted}/{certificate.totalLessons} دروس · {certificate.averageScore}% · {certificate.totalXP} XP
                  </div>
                  <Button size="sm" variant="outline" className="mt-2 text-xs border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => window.print()}>
                    <Download className="h-3 w-3 ml-1" /> تحميل الشهادة
                  </Button>
                </div>
              </motion.div>
            )}

            {/* RELATED CONTENT */}
            {(true) && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-card border rounded-xl p-3 sm:p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-sm">محتويات مرتبطة</h3>
                </div>
                <div className="space-y-2">
                  {/* Games */}
                  <div>
                    <h4 className="text-[10px] font-bold text-muted-foreground mb-1 flex items-center gap-1">
                      <Gamepad2 className="h-3 w-3" /> ألعاب
                    </h4>
                    <div className="space-y-1">
                      {(() => {
                        const cats = track.category;
                        const links: { href: string; label: string; icon: any }[] = [];
                        if (cats === "practical" || track.title.toLowerCase().includes("تربة") || track.title.toLowerCase().includes("ph") || track.title.toLowerCase().includes("soil") || track.title.toLowerCase().includes("مختبر") || track.title.toLowerCase().includes("معمل")) {
                          links.push({ href: "/games", label: "لعبة توازن التربة", icon: Beaker });
                        }
                        if (cats === "academic" || track.title.toLowerCase().includes("نبات") || track.title.toLowerCase().includes("محصول")) {
                          links.push({ href: "/games", label: "لعبة اختبار النبات", icon: Wheat });
                          links.push({ href: "/games", label: "لعبة ذاكرة المحاصيل", icon: Brain });
                        }
                        if (links.length === 0) links.push({ href: "/games", label: "جميع الألعاب", icon: Trophy });
                        return links.map((l, i) => (
                          <Link key={i} href={l.href} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/30 transition text-[10px]">
                            <l.icon className="h-3 w-3 text-amber-500" />
                            <span>{l.label}</span>
                          </Link>
                        ));
                      })()}
                    </div>
                  </div>
                  {/* Courses */}
                  <div>
                    <h4 className="text-[10px] font-bold text-muted-foreground mb-1 flex items-center gap-1">
                      <BookOpen className="h-3 w-3" /> مقررات دراسية
                    </h4>
                    <div className="space-y-1">
                      {[
                        track.category === "academic" ? "أساسيات الإنتاج النباتي" :
                        track.category === "practical" ? "مختبر علوم التربة" :
                        track.category === "career" ? "الإرشاد الزراعي" :
                        "مهارات جامعية",
                        track.difficulty === "advanced" ? "وقاية النبات المتقدمة" : "مقدمة في الزراعة",
                      ].map((course, ci) => (
                        <div key={ci} className="flex items-center gap-2 p-1.5 rounded-lg text-[10px] text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          <span>{course}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Quizzes */}
                  <div>
                    <h4 className="text-[10px] font-bold text-muted-foreground mb-1 flex items-center gap-1">
                      <Target className="h-3 w-3" /> اختبارات
                    </h4>
                    <Link href="/quizzes" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/30 transition text-[10px]">
                      <Target className="h-3 w-3 text-primary" />
                      <span>اختبارات ذات صلة بهذا المسار</span>
                    </Link>
                  </div>
                  {/* Videos */}
                  <div>
                    <h4 className="text-[10px] font-bold text-muted-foreground mb-1 flex items-center gap-1">
                      <PlayCircle className="h-3 w-3" /> فيديوهات
                    </h4>
                    <div className="flex items-center gap-2 p-1.5 rounded-lg text-[10px] text-muted-foreground">
                      <Volume2 className="h-3 w-3" />
                      <span>شرح {track.title} — يوتيوب</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Visual Card Overlay */}
      <AnimatePresence>
        {activeVisualId && visualData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 overflow-y-auto"
            onClick={() => setActiveVisualId(null)}
          >
            <div className="w-full max-w-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="bg-card border rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-base sm:text-lg">{visualData.lesson.title}</h2>
                  <button onClick={() => setActiveVisualId(null)} className="text-muted-foreground hover:text-foreground text-xs">إغلاق</button>
                </div>
                <div className="space-y-4">
                  {visualData.cards.map((card) => (
                    <div key={card.id} className="bg-gradient-to-br from-primary/5 to-secondary/5 border rounded-xl p-4">
                      <div className="bg-muted/30 rounded-lg h-32 sm:h-40 flex items-center justify-center mb-3 border-2 border-dashed border-muted-foreground/20">
                        <div className="text-center">
                          <BookOpen className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground/40 mx-auto mb-1" />
                          <span className="text-[10px] text-muted-foreground">{card.imageUrl ? card.imageUrl.replace("/images/", "").replace(".svg", "") : "صورة توضيحية"}</span>
                        </div>
                      </div>
                      <h3 className="font-bold text-sm mb-1">{card.title}</h3>
                      <p className="text-xs text-muted-foreground whitespace-pre-line">{card.description}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => onComplete(activeVisualId)} className="text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 ml-1" />
                    أكملت المشاهدة
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lab Player Overlay */}
      <AnimatePresence>
        {activeLabId && labData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 overflow-y-auto"
            onClick={() => setActiveLabId(null)}
          >
            <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <LabPlayer
                steps={labData.steps}
                lessonTitle={labData.lesson.title}
                onComplete={() => {
                  onComplete(activeLabId);
                  setActiveLabId(null);
                }}
                onClose={() => setActiveLabId(null)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

function NoteButton({ lessonId }: { lessonId: number }) {
  const [open, setOpen] = useState(false);
  const { data: note } = useLessonNote(open ? lessonId : null);
  const save = useSaveLessonNote();
  const [content, setContent] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (note) setContent(note.content);
  }, [note]);

  const handleSave = async () => {
    try {
      await save.mutateAsync({ lessonId, content });
      toast({ title: "تم الحفظ" });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors mr-2">
        <StickyNote className="h-3 w-3" />
        {open ? "إخفاء" : "ملاحظات"}
      </button>
      {open && (
        <div className="mt-1 p-2 bg-background border rounded-lg">
          <Textarea
            placeholder="اكتب ملاحظاتك عن هذا الدرس..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="text-[11px] min-h-[60px]"
          />
          <Button size="sm" variant="outline" className="mt-1 h-6 text-[10px]" onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </div>
      )}
    </>
  );
}

function SaveOfflineButton({ lessonTitle, lessonId, trackTitle }: { lessonTitle: string; lessonId: number; trackTitle: string }) {
  const { toast } = useToast();
  return (
    <button onClick={() => {
      const ok = saveSummaryOffline({
        lessonId,
        lessonTitle,
        trackTitle,
        summary: `ملخص ${lessonTitle} من مسار ${trackTitle}`,
        savedAt: new Date().toISOString(),
      });
      toast({ title: ok ? "تم الحفظ للاستخدام دون اتصال" : "فشل الحفظ" });
    }} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors mr-2">
      <Download className="h-3 w-3" />
      احفظ دون اتصال
    </button>
  );
}
