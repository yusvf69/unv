import { useState, useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { motion } from "framer-motion";
import {
  Brain, Clock, Target, Play, Trophy, AlertCircle,
  ArrowLeft, CheckCircle, XCircle, Loader2, HelpCircle, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

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

  useEffect(() => {
    api.get<Quiz[]>("/v2/quizzes/open").then((data) => { setQuizzes(data); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-3xl md:text-4xl font-serif font-bold flex items-center gap-3">
          <Brain className="h-8 w-8 text-primary" /> الاختبارات
        </h1>
        <p className="text-sm text-muted-foreground mt-2">اختبر معلوماتك واكسب النقاط — كل إجابة صحيحة تضيف لنقاطك</p>
      </motion.div>

      {!quizzes.length && (
        <div className="text-center py-16 bg-card border rounded-2xl">
          <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">لا توجد اختبارات متاحة حالياً</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {quizzes.map((q) => (
          <Link key={q.id} href={`/quizzes/${q.id}`} className="block">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-2xl p-5 hover:shadow-lg transition h-full flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <Badge variant="outline" className="bg-muted">{q.courseTitle}</Badge>
                <Badge variant={q.difficulty === "hard" ? "destructive" : q.difficulty === "medium" ? "secondary" : "default"}>{q.difficulty === "easy" ? "سهل" : q.difficulty === "medium" ? "متوسط" : "صعب"}</Badge>
              </div>
              <h3 className="font-bold text-lg mb-2 line-clamp-1">{q.title}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">{q.description}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {q.durationMinutes} دقيقة</span>
                <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> {q.totalPoints} نقطة</span>
              </div>
              {q.myAttemptsCount > 0 && (
                <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                  محاولاتك: {q.myAttemptsCount} · أفضل نتيجة: {q.myBestScore}/{q.totalPoints}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">نسبة النجاح: {q.passPercent}%</span>
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
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [timeUp, setTimeUp] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<any>(`/v2/quizzes/${id}/start`).then((data) => {
      setQuiz(data.quiz);
      setQuestions(data.questions);
      setTimeLeft(data.quiz.durationMinutes * 60);
    }).catch((e) => {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (timeLeft <= 0) {
      setTimeUp(true);
      handleSubmit();
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setShowConfirm(false);
    try {
      const ansArr = questions.map((q) => ({
        questionId: q.id,
        chosenOriginalIndex: q.optionMap[answers[q.id] ?? 0] ?? 0,
      }));
      const durationSec = quiz.durationMinutes * 60 - timeLeft;
      const res = await api.post(`/v2/quizzes/${quiz.id}/submit`, { answers: ansArr, durationSec });
      setResult(res);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>;
  if (!quiz) return <div className="p-8 text-center text-muted-foreground">اختبار غير موجود</div>;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

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
            {result.passed ? "ممتاز! لقد نجحت في الاختبار" : "للأسف لم تنجح. حاول مرة أخرى"}
          </p>
          {result.pointsAwarded > 0 && (
            <div className="inline-flex items-center gap-2 bg-amber-500/15 text-amber-700 px-4 py-2 rounded-full font-bold mb-4">
              <Trophy className="h-5 w-5" /> +{result.pointsAwarded} نقطة
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>{details.filter((d: any) => d.correct).length} صحيح</span>
            <XCircle className="h-4 w-4 text-destructive ms-2" />
            <span>{details.filter((d: any) => !d.correct).length} خطأ</span>
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
                <span className="text-[10px] bg-amber-500/15 text-amber-600 px-1.5 py-0.5 rounded-full">{d.points} نقطة</span>
              </div>

              {/* Options */}
              <div className="px-4 py-3 space-y-2">
                {d.options.map((opt: string, oi: number) => {
                  const isCorrect = oi === d.correctIndex;
                  const isUserChoice = oi === d.userChosen;
                  let cls = "border-muted";
                  if (isCorrect) cls = "bg-green-500/10 border-green-500";
                  if (isUserChoice && !d.correct) cls = "bg-red-500/10 border-red-500";
                  return (
                    <div key={oi} className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm ${cls}`}>
                      {isCorrect ? <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" /> : isUserChoice ? <XCircle className="h-4 w-4 text-destructive flex-shrink-0" /> : <div className="h-4 w-4 flex-shrink-0" />}
                      <span className="flex-1">{opt}</span>
                      {isCorrect && <span className="text-[10px] font-bold text-green-600">الإجابة الصحيحة</span>}
                      {isUserChoice && !d.correct && <span className="text-[10px] font-bold text-destructive">إجابتك</span>}
                    </div>
                  );
                })}
              </div>

              {/* Explanation */}
              {d.explanation && (
                <div className="px-4 pb-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <span className="font-bold text-xs text-muted-foreground">💡 الشرح:</span>
                    <p className="mt-1">{d.explanation}</p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center pb-6">
          <Button onClick={() => navigate("/quizzes")}><ArrowLeft className="me-2 h-4 w-4" /> رجوع للاختبارات</Button>
          <Button variant="outline" onClick={() => { setResult(null); setAnswers({}); setTimeLeft(quiz.durationMinutes * 60); setTimeUp(false); }}>إعادة المحاولة</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 py-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/quizzes")}><ArrowLeft className="me-1 h-3.5 w-3.5" /></Button>
        <h1 className="text-lg font-bold truncate flex-1 text-center">{quiz.title}</h1>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-xs whitespace-nowrap ${timeLeft < 60 ? "bg-destructive/15 text-destructive animate-pulse" : timeLeft < 180 ? "bg-amber-500/15 text-amber-700" : "bg-primary/10 text-primary"}`}>
          <Clock className="h-3.5 w-3.5" /> {formatTime(timeLeft)}
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4 p-3 bg-card border rounded-xl">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>تم الإجابة: {answeredCount}/{questions.length}</span>
          <span>نقاط: {quiz.totalPoints}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-3 mb-6">
        {questions.map((q, qi) => (
          <div key={q.id} className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs font-bold bg-muted px-2 py-0.5 rounded-full">{qi + 1}</span>
              <span className="font-bold text-sm">{q.text}</span>
              <span className="text-[10px] bg-amber-500/15 text-amber-600 px-1.5 py-0.5 rounded-full">{q.points} نقطة</span>
            </div>
            <div className="space-y-2">
              {q.options.map((opt: string, oi: number) => (
                <label key={oi} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${answers[q.id] === oi ? "bg-primary/10 border-primary" : "hover:bg-muted"}`}>
                  <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === oi} onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))} className="accent-primary w-4 h-4" />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Submit */}
      <div className="sticky bottom-0 bg-background/80 backdrop-blur p-4 border-t flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {!allAnswered && <span className="flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {questions.length - answeredCount} سؤال بدون إجابة</span>}
        </div>
        <Button onClick={() => setShowConfirm(true)} disabled={!allAnswered && !timeUp}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="me-2 h-4 w-4" /> تسليم</>}
        </Button>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>تأكيد التسليم</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {!allAnswered && "⚠️ لم تجب على جميع الأسئلة. "}
            هل أنت متأكد من تسليم الإجابات؟
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "نعم، تسليم"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
