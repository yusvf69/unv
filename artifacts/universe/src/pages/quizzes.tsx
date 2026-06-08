import { useState, useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { motion } from "framer-motion";
import {
  Brain, Clock, Target, Play, Trophy, AlertCircle,
  ArrowLeft, CheckCircle, XCircle, Loader2, HelpCircle, Eye,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useTranslation, globalI18n } from "@/lib/i18n";

interface Quiz {
  id: number; title: string; description: string; courseId: number; courseTitle: string;
  durationMinutes: number; totalPoints: number; difficulty: string;
  groupOnly: string | null; yearOnly: number | null; isOpen: boolean;
  randomize: boolean; passPercent: number; createdAt: string;
  myAttemptsCount: number; myBestScore: number;
}

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useTranslation(globalI18n);

  useEffect(() => {
    api.get<Quiz[]>("/v2/quizzes/open").then((data) => { setQuizzes(data); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-muted-foreground">{t("loading")}</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-3xl md:text-4xl font-serif font-bold flex items-center gap-3">
          <Brain className="h-8 w-8 text-primary" /> {t("quizzes")}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">{t("quizSubtitle")}</p>
      </motion.div>

      {!quizzes.length && (
        <div className="text-center py-16 bg-card border rounded-2xl">
          <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t("noOpenQuizzes")}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {quizzes.map((q) => (
          <Link key={q.id} href={`/quizzes/${q.id}`} className="block">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-2xl p-5 hover:shadow-lg transition h-full flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <Badge variant="outline" className="bg-muted">{q.courseTitle}</Badge>
                <Badge variant={q.difficulty === "hard" ? "destructive" : q.difficulty === "medium" ? "secondary" : "default"}>{q.difficulty === "easy" ? t("diffEasy") : q.difficulty === "medium" ? t("diffMedium") : t("diffHard")}</Badge>
              </div>
              <h3 className="font-bold text-lg mb-2 line-clamp-1">{q.title}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">{q.description}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {q.durationMinutes} {t("minutes")}</span>
                <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> {q.totalPoints} {t("point")}</span>
              </div>
              {q.myAttemptsCount > 0 && (
                <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                  {t("myAttempts")} {q.myAttemptsCount} · {t("bestScore")} {q.myBestScore}/{q.totalPoints}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t("passRate")} {q.passPercent}%</span>
                <Play className="h-5 w-5 text-primary" />
              </div>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function QuizTakePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const t = useTranslation(globalI18n);
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(-1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [page, setPage] = useState(0);
  const PER_PAGE = 25;

  useEffect(() => {
    if (!id) return;
    api.get<any>(`/v2/quizzes/${id}/start`).then((data) => {
      setQuiz(data.quiz);
      setQuestions(data.questions);
      setTimeLeft(data.quiz.durationMinutes * 60);
    }).catch((e) => {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (timeLeft < 0) return;
    if (timeLeft === 0) {
      setTimeUp(true);
      handleSubmit();
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  const handleSubmit = async () => {
    if (submitting || !quiz) return;
    setSubmitting(true);
    setShowConfirm(false);
    try {
      const ansArr = questions.map((q) => ({
        questionId: q.id,
        chosenOriginalIndex: q.type === "complete" ? 0 : q.optionMap[answers[q.id] ?? 0] ?? 0,
        ...(q.type === "complete" ? { textAnswer: answers[q.id] || "" } : {}),
      }));
      const durationSec = quiz.durationMinutes * 60 - Math.max(timeLeft, 0);
      const res = await api.post(`/v2/quizzes/${quiz.id}/submit`, { answers: ansArr, durationSec });
      setResult(res);
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">{t("loading")}</div>;
  if (!quiz) return <div className="p-8 text-center text-muted-foreground">{t("quizNotFound")}</div>;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;
  const totalPages = Math.ceil(questions.length / PER_PAGE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const pageStart = safePage * PER_PAGE;
  const pageQuestions = questions.slice(pageStart, pageStart + PER_PAGE);

  if (result) {
    const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
    const details = result.questionDetails || [];
    return (
      <div className="container mx-auto px-3 py-6 max-w-3xl">
        {/* Score header */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border rounded-2xl p-6 text-center mb-6">
          <div className={`text-5xl mb-3 ${result.passed ? "text-green-600" : "text-destructive"}`}>
            {result.passed ? "✅" : "❌"}
          </div>
          <div className={`text-3xl font-bold mb-1 ${result.passed ? "text-green-600" : "text-destructive"}`}>
            {result.score}/{result.total} ({pct}%)
          </div>
          <p className="text-base text-muted-foreground mb-3">
            {result.passed ? t("quizPassed") : t("quizFailed")}
          </p>
          {result.pointsAwarded > 0 && (
            <div className="inline-flex items-center gap-2 bg-amber-500/15 text-amber-700 px-4 py-2 rounded-full font-bold mb-4">
              <Trophy className="h-5 w-5" /> +{result.pointsAwarded} {t("point")}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>{details.filter((d: any) => d.correct).length} {t("correct")}</span>
            <XCircle className="h-4 w-4 text-destructive ms-2" />
            <span>{details.filter((d: any) => !d.correct).length} {t("incorrect")}</span>
          </div>
        </motion.div>

        {/* Detailed review */}
        <div className="space-y-3 mb-6">
          {details.map((d: any, i: number) => (
            <motion.div
              key={d.questionId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`bg-card border-2 rounded-xl overflow-hidden ${d.correct ? "border-green-500/30" : "border-red-500/30"}`}
            >
              {/* Question header */}
              <div className={`px-4 py-3 flex items-center gap-2 ${d.correct ? "bg-green-500/10" : "bg-red-500/10"}`}>
                <span className="text-xs font-bold bg-muted px-2 py-0.5 rounded-full">{i + 1}</span>
                {d.correct ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                <span className="font-bold text-sm flex-1">{d.text}</span>
                <span className="text-[10px] bg-amber-500/15 text-amber-600 px-1.5 py-0.5 rounded-full">{d.points} {t("point")}</span>
              </div>

              {/* Options */}
              <div className="px-4 py-3 space-y-2">
                {d.type === "complete" ? (
                  <div className="space-y-2">
                    <div className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm ${d.correct ? "bg-green-500/10 border-green-500" : "bg-red-500/10 border-red-500"}`}>
                      {d.correct ? <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" /> : <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
                      <span className="font-bold text-xs">إجابتك:</span>
                      <span className="flex-1">{d.textAnswer ? d.textAnswer : "(لم تجب)"}</span>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-lg border text-sm bg-green-500/10 border-green-500">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="font-bold text-xs">الإجابة الصحيحة:</span>
                      <span className="flex-1">{d.options[d.correctIndex]}</span>
                    </div>
                  </div>
                ) : (
                  d.options.map((opt: string, oi: number) => {
                    const isCorrect = oi === d.correctIndex;
                    const isUserChoice = oi === d.userChosen;
                    let cls = "border-muted";
                    if (isCorrect) cls = "bg-green-500/10 border-green-500";
                    if (isUserChoice && !d.correct) cls = "bg-red-500/10 border-red-500";
                    return (
                      <div key={oi} className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm ${cls}`}>
                        {isCorrect ? <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" /> : isUserChoice ? <XCircle className="h-4 w-4 text-destructive flex-shrink-0" /> : <div className="h-4 w-4 flex-shrink-0" />}
                        <span className="flex-1">{opt}</span>
                        {isCorrect && <span className="text-[10px] font-bold text-green-600">{t("correctAnswer")}</span>}
                        {isUserChoice && !d.correct && <span className="text-[10px] font-bold text-destructive">{t("yourAnswer")}</span>}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Explanation */}
              {d.explanation && (
                <div className="px-4 pb-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <span className="font-bold text-xs text-muted-foreground">💡 {t("explanation")}:</span>
                    <p className="mt-1">{d.explanation}</p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center pb-6">
          <Button onClick={() => navigate("/quizzes")}><ArrowLeft className="me-2 h-4 w-4" /> {t("backToQuizzes")}</Button>
          <Button variant="outline" onClick={() => { setResult(null); setAnswers({}); setTimeLeft(quiz.durationMinutes * 60); setTimeUp(false); }}>{t("retry")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 py-6 max-w-3xl">
      {/* Header with timer and question count */}
      <div className="bg-card border rounded-xl p-3 mb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h1 className="text-sm sm:text-lg font-bold truncate">{quiz.title}</h1>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-sm whitespace-nowrap ${timeLeft < 60 ? "bg-destructive/15 text-destructive animate-pulse" : timeLeft < 180 ? "bg-amber-500/15 text-amber-700" : "bg-emerald-500/15 text-emerald-700"}`}>
            <Clock className="h-4 w-4" /> {formatTime(timeLeft)}
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> {answeredCount}/{questions.length}</span>
            {totalPages > 1 && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">صفحة {safePage + 1}/{totalPages}</span>}
          </div>
          <span className="flex items-center gap-1"><Trophy className="h-3.5 w-3.5" /> {quiz.totalPoints} {t("point")}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5 mt-2">
          <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
        </div>
      </div>

      {/* Page navigation top */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mb-3">
          <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="text-xs h-8">
            <ChevronRight className="h-3.5 w-3.5 ms-1" /> السابق
          </Button>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`w-7 h-7 rounded-full text-xs font-bold transition ${i === safePage ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} className="text-xs h-8">
            التالي <ChevronLeft className="h-3.5 w-3.5 me-1" />
          </Button>
        </div>
      )}

      {/* Questions (current page) */}
      <div className="space-y-3 mb-6">
        {pageQuestions.map((q, qi) => {
          const globalIdx = pageStart + qi;
          return (
            <div key={q.id} className="bg-card border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">سؤال {globalIdx + 1}</span>
                <span className="font-bold text-sm flex-1">{q.text}</span>
                <span className="text-[10px] bg-amber-500/15 text-amber-600 px-1.5 py-0.5 rounded-full">{q.points} {t("point")}</span>
              </div>
              {q.type === "complete" ? (
                <div>
                  <Input
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    placeholder="اكتب إجابتك..."
                    className="h-10 text-sm"
                    dir="auto"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  {q.options.map((opt: string, oi: number) => (
                    <label key={oi} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${answers[q.id] === oi ? "bg-primary/10 border-primary" : "hover:bg-muted"}`}>
                      <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === oi} onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))} className="accent-primary w-4 h-4" />
                      <span className="text-sm">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation + Submit */}
      <div className="sticky bottom-0 bg-background/80 backdrop-blur p-3 border-t rounded-t-xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage(Math.max(0, safePage - 1))} className="text-xs h-8">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[10px] text-muted-foreground font-bold">{safePage + 1}/{Math.max(totalPages, 1)}</span>
            <Button variant="outline" size="sm" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} className="text-xs h-8">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground flex-1 text-center">
            {!allAnswered && <span className="flex items-center gap-1 justify-center"><AlertCircle className="h-3.5 w-3.5" /> {t("unansweredQuestions").replace("{count}", String(questions.length - answeredCount))}</span>}
            {allAnswered && <span className="flex items-center gap-1 text-emerald-600 font-bold justify-center"><CheckCircle className="h-3.5 w-3.5" /> تمت الإجابة على الكل</span>}
          </div>
          <Button onClick={() => setShowConfirm(true)} disabled={!allAnswered && !timeUp} className="h-9 text-sm flex-shrink-0">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="me-2 h-4 w-4" /> {t("submit")}</>}
          </Button>
        </div>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("confirmSubmission")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {!allAnswered && <span>⚠️ {t("notAllAnswered")}. </span>}
            {t("confirmSubmitPrompt")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>{t("cancel")}</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("yesSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
