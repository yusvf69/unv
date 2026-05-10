import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, BookOpen, Video, FileText,
  HelpCircle, Play, CheckCircle, Loader2, Download, Eye, Send,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  useCourseLectures,
  useMarkVideoWatched,
  useSubmitLectureQuiz,
  useCourseProgress,
  useCourseVideoProgress,
  LectureFull,
  LectureVideo,
} from "@/lib/api";
import { useTranslation, globalI18n } from "@/lib/i18n";

function extractYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([^&?\s]+)/);
  return m ? m[1] : null;
}

function VideoPlayer({ video, completed, onWatch, loading }: { video: LectureVideo; completed: boolean; onWatch: () => void; loading?: boolean }) {
  const ytId = extractYoutubeId(video.youtubeUrl);
  if (!ytId) return null;
  const t = useTranslation(globalI18n);
  return (
    <div className="border rounded-xl overflow-hidden bg-black">
      <iframe
        width="100%"
        height="400"
        src={`https://www.youtube.com/embed/${ytId}`}
        title={video.title}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
      <div className="p-3 bg-card flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold">{video.title}</span>
        </div>
        {completed ? (
          <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> {t("watched")}</span>
        ) : (
          <Button size="sm" variant="outline" onClick={onWatch} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Play className="h-3.5 w-3.5 me-1" /> {t("markAsComplete")}</>}
          </Button>
        )}
      </div>
    </div>
  );
}

function PdfViewer({ pdf }: { pdf: { name: string; url: string } }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isDataUrl = pdf.url.startsWith("data:");
  const t = useTranslation(globalI18n);

  const handleOpen = () => {
    setLoading(true);
    setOpen(true);
    setTimeout(() => setLoading(false), 500);
  };

  return (
    <>
      <div className="flex items-center gap-3 p-2 border rounded-lg">
        <FileText className="h-5 w-5 text-primary" />
        <span className="text-sm flex-1 truncate">{pdf.name}</span>
        <Button size="sm" variant="outline" onClick={handleOpen} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Eye className="h-3.5 w-3.5 me-1" /> {t("view")}</>}
        </Button>
        <a href={pdf.url} download={pdf.name} target="_blank" rel="noreferrer">
          <Button size="sm" variant="outline">
            <Download className="h-3.5 w-3.5 me-1" /> {t("download")}
          </Button>
        </a>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] w-[90vw]">
          <DialogHeader><DialogTitle>{pdf.name}</DialogTitle></DialogHeader>
          <div className="h-[70vh] border rounded-lg overflow-hidden">
            {isDataUrl ? (
              <iframe src={pdf.url} className="w-full h-full" title={pdf.name} />
            ) : (
              <iframe src={`${pdf.url}#toolbar=1&navpanes=0`} className="w-full h-full" title={pdf.name} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function QuizTaking({ quiz, questions }: { quiz: any; questions: any[] }) {
  const submit = useSubmitLectureQuiz();
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ score: number; total: number; passed: boolean; details: any[] } | null>(null);
  const t = useTranslation(globalI18n);

  const handleSubmit = async () => {
    const ansArr = questions.map((q) => ({ questionId: q.id, chosenIndex: answers[q.id] ?? -1 }));
    try {
      const res = await submit.mutateAsync({ quizId: quiz.id, answers: ansArr });
      setResult(res as { score: number; total: number; passed: boolean; details: any[] });
    } catch (e) {
      toast({ title: t("error"), description: (e as Error).message, variant: "destructive" });
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <div className="text-center p-4">
          <div className={`text-4xl font-bold ${result.passed ? "text-green-600" : "text-destructive"}`}>
            {result.score}/{result.total}
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            {result.passed ? t("quizPassed") : t("tryAgain")}
          </div>
          <Button onClick={() => setResult(null)} className="mt-3" variant="outline">{t("tryAgain")}</Button>
        </div>
        {result.details.map((d, qi) => (
          <div key={d.questionId} className={`p-3 rounded-xl border ${d.correct ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${d.correct ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"}`}>
                {d.correct ? t("correctShort") : t("incorrectShort")}
              </span>
              <span className="font-bold text-sm">{qi + 1}. {d.text}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {t("yourAnswer")}: <span className={d.correct ? "text-green-700" : "text-red-700"}>{d.options[d.userChosen] || t("didNotAnswer")}</span>
              {!d.correct && (
                <span className="text-green-700 ms-3">{t("correctAnswer")}: {d.options[d.correctIndex]}</span>
              )}
            </div>
            {d.explanation && (
              <div className="text-xs bg-white/60 rounded-lg p-2 mt-2 border">💡 {d.explanation}</div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {questions.map((q, qi) => (
        <div key={q.id} className="p-4 border rounded-xl space-y-3">
          <div className="font-bold text-sm">{qi + 1}. {q.text}</div>
          <div className="space-y-2">
            {q.options.map((opt: string, oi: number) => (
              <label key={oi} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${answers[q.id] === oi ? "bg-primary/10 border-primary" : "hover:bg-muted"}`}>
                <input type="radio" name={`q-${q.id}-${quiz.id}`} checked={answers[q.id] === oi} onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))} className="accent-primary" />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <Button onClick={handleSubmit} disabled={Object.keys(answers).length < questions.length || submit.isPending} className="w-full">
        {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="me-2 h-4 w-4" /> {t("submitAnswers")}</>}
      </Button>
    </div>
  );
}

function LectureCard({ lecture, videoProgress }: { lecture: LectureFull; videoProgress: Record<number, boolean> }) {
  const markWatched = useMarkVideoWatched();
  const [open, setOpen] = useState(false);
  const [quizTakeDialog, setQuizTakeDialog] = useState<number | null>(null);
  const [markingWatched, setMarkingWatched] = useState<number | null>(null);
  const t = useTranslation(globalI18n);

  const isVideoCompleted = (videoId: number) => videoProgress[videoId] || false;

  const handleMarkWatched = async (videoId: number) => {
    setMarkingWatched(videoId);
    try { await markWatched.mutateAsync(videoId); } catch {}
    finally { setMarkingWatched(null); }
  };

  const ExpandIcon = open ? ChevronUp : ChevronDown;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border-2 border-border rounded-2xl bg-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 p-4 text-start hover:bg-muted/30 transition-colors">
        {lecture.type === "lecture" ? <BookOpen className="h-5 w-5 text-primary shrink-0" /> : <FileText className="h-5 w-5 text-secondary shrink-0" />}
        <h3 className="font-bold text-lg flex-1">{lecture.title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${lecture.type === "lecture" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"}`}>
          {lecture.type === "lecture" ? t("lecture") : t("sectionType")}
        </span>
        <ExpandIcon className="w-5 h-5 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* Videos */}
          {lecture.videos.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-1"><Video className="h-4 w-4" /> {t("videos")} ({lecture.videos.length})</h4>
              <div className="space-y-3">
                {lecture.videos.map((v) => (
                  <VideoPlayer key={v.id} video={v} completed={isVideoCompleted(v.id)} onWatch={() => handleMarkWatched(v.id)} loading={markingWatched === v.id} />
                ))}
              </div>
            </div>
          )}

          {/* PDFs */}
          {lecture.pdfs.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold flex items-center gap-1"><FileText className="h-4 w-4" /> {t("files")} ({lecture.pdfs.length})</h4>
              {lecture.pdfs.map((p) => (
                <PdfViewer key={p.id} pdf={{ name: p.name, url: p.url }} />
              ))}
            </div>
          )}

          {/* Quizzes */}
          {lecture.quizzes.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold flex items-center gap-1"><HelpCircle className="h-4 w-4" /> {t("quizzes")} ({lecture.quizzes.length})</h4>
              {lecture.quizzes.map((q) => (
                <div key={q.id} className="p-3 border rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary" />
                      <span className="font-bold text-sm">{q.title}</span>
                      <span className="text-xs text-muted-foreground">({q.questions.length} {t("question")})</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setQuizTakeDialog(q.id)}>{t("solveQuiz")}</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Take Quiz Dialog */}
      <Dialog open={quizTakeDialog !== null} onOpenChange={() => setQuizTakeDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("solveQuiz")}</DialogTitle></DialogHeader>
          {quizTakeDialog && (() => {
            const quiz = lecture.quizzes.find((q) => q.id === quizTakeDialog);
            if (!quiz || !quiz.questions.length) return <p className="text-center text-muted-foreground py-4">{t("noQuestionsYet")}</p>;
            return <QuizTaking quiz={quiz} questions={quiz.questions} />;
          })()}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

export default function StudentCourseDetail() {
  const { id } = useParams<{ id: string }>();
  const courseId = Number(id);
  const [, navigate] = useLocation();
  const { data: lectures = [] } = useCourseLectures(courseId);
  const { data: progress } = useCourseProgress(courseId);
  const { data: videoProgressRaw } = useCourseVideoProgress(courseId);

  const [tab, setTab] = useState<"all" | "lecture" | "section">("all");
  const t = useTranslation(globalI18n);

  const videoProgress: Record<number, boolean> = {};
  if (videoProgressRaw) videoProgressRaw.forEach((vp) => { videoProgress[vp.videoId] = vp.completed; });

  const filtered = lectures.filter((l) => tab === "all" || l.type === tab);
  const lectureCount = lectures.filter((l) => l.type === "lecture").length;
  const sectionCount = lectures.filter((l) => l.type === "section").length;

  if (!courseId) return <div className="p-12 text-center text-muted-foreground">{t("courseNotFound")}</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/courses")}><ArrowLeft className="h-4 w-4 me-1" /> {t("back")}</Button>
        <h1 className="text-2xl font-serif font-bold flex-1">{t("courseLabel")}</h1>
      </div>

      {/* Progress Bar */}
      {progress && (
        <div className="mb-6 p-4 bg-card border rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold">{t("courseProgress")}</span>
            <span className="text-sm font-bold text-primary">{progress.percent}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div className="bg-primary h-3 rounded-full transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>{t("videosLabel")} {progress.videos.filter((v) => v.completed).length}/{progress.videos.length}</span>
            <span>{t("quizzesLabel")} {progress.quizzes.filter((q) => q.completed).length}/{progress.quizzes.length}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: "all" as const, label: `${t("all")} (${lectures.length})` },
          { key: "lecture" as const, label: `${t("lecturesLabel")} (${lectureCount})` },
          { key: "section" as const, label: `${t("sectionsLabel")} (${sectionCount})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Lectures */}
      <div className="space-y-6">
        {filtered.length === 0 && <div className="text-center text-muted-foreground py-12">{t("noLecturesYet")}</div>}
        {filtered.map((l) => (
          <LectureCard key={l.id} lecture={l} videoProgress={videoProgress} />
        ))}
      </div>
    </div>
  );
}
