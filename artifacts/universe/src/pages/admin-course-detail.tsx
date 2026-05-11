import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, Trash2, BookOpen, Video, FileText,
  HelpCircle, Send, Play, CheckCircle, Loader2, Upload,
  Users, Eye, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  useCourseLectures,
  useCreateLecture,
  useDeleteLecture,
  useAddVideo,
  useDeleteVideo,
  useAddLecturePdf,
  useDeleteLecturePdf,
  useCreateLectureQuiz,
  useAddQuizQuestion,
  useAddLectureQuizQuestion,
  useDeleteLectureQuiz,
  useDeleteQuizQuestion,
  useDeleteLectureQuizQuestion,
  useMarkVideoWatched,
  useSubmitLectureQuiz,
  useCourseProgress,
  useCourseVideoProgress,
  useMeV2,
  useLectureQuizAttempts,
  LectureFull,
  LectureVideo,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import FileUpload from "@/components/file-upload";

function PdfViewer({ pdf, isSuper, onDelete }: { pdf: { name: string; url: string }; isSuper: boolean; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isDataUrl = pdf.url.startsWith("data:");

  const handleOpen = () => {
    setLoading(true);
    setOpen(true);
    setTimeout(() => setLoading(false), 500);
  };

  const handleDelete = async () => {
    if (!confirm("حذف الملف؟")) return;
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  };

  return (
    <>
      <div className="flex items-center gap-3 p-2 border rounded-lg">
        <FileText className="h-5 w-5 text-primary" />
        <span className="text-sm flex-1 truncate">{pdf.name}</span>
        <Button size="sm" variant="outline" onClick={handleOpen} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>عرض</>}
        </Button>
        <a href={pdf.url} download={pdf.name} target="_blank" rel="noreferrer"><Button size="sm" variant="outline">تحميل</Button></a>
        {isSuper && (
          <button onClick={handleDelete} disabled={deleting} className="p-1 rounded hover:bg-destructive/10 disabled:opacity-50">
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
          </button>
        )}
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

function extractYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([^&?\s]+)/);
  return m ? m[1] : null;
}

function VideoPlayer({ video, completed, onWatch, loading }: { video: LectureVideo; completed: boolean; onWatch: () => void; loading?: boolean }) {
  const ytId = extractYoutubeId(video.youtubeUrl);
  if (!ytId) return null;
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
          <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> تمت المشاهدة</span>
        ) : (
          <Button size="sm" variant="outline" onClick={onWatch} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Play className="h-3.5 w-3.5 me-1" /> حدد كمكتمل</>}
          </Button>
        )}
      </div>
    </div>
  );
}

function QuizTaking({ quiz, questions }: { quiz: any; questions: any[] }) {
  const submit = useSubmitLectureQuiz();
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ score: number; total: number; passed: boolean; details: any[] } | null>(null);

  const handleSubmit = async () => {
    const ansArr = questions.map((q) => ({ questionId: q.id, chosenIndex: answers[q.id] ?? -1 }));
    try {
      const res = await submit.mutateAsync({ quizId: quiz.id, answers: ansArr });
      setResult(res as { score: number; total: number; passed: boolean; details: any[] });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
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
            {result.passed ? "✅ ممتاز! نجحت في الاختبار" : "❌ حاول مرة أخرى"}
          </div>
          <Button onClick={() => setResult(null)} className="mt-3" variant="outline">حاول مرة أخرى</Button>
        </div>
        {result.details.map((d, qi) => (
          <div key={d.questionId} className={`p-3 rounded-xl border ${d.correct ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${d.correct ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"}`}>
                {d.correct ? "✅ صح" : "❌ غلط"}
              </span>
              <span className="font-bold text-sm">{qi + 1}. {d.text}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              إجابتك: <span className={d.correct ? "text-green-700" : "text-red-700"}>{d.options[d.userChosen] || "لم تجب"}</span>
              {!d.correct && (
                <span className="text-green-700 ms-3">الإجابة الصحيحة: {d.options[d.correctIndex]}</span>
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
                <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === oi} onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))} className="accent-primary" />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <Button onClick={handleSubmit} disabled={Object.keys(answers).length < questions.length || submit.isPending} className="w-full">
        {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="me-2 h-4 w-4" /> إرسال الإجابات</>}
      </Button>
    </div>
  );
}

function QuizCard({ quiz, isSuper, onDelete, onAddQuestion, onTake, deleting, onDeleteQuestion, deletingQuestion }: {
  quiz: any; isSuper: boolean; onDelete: () => void; onAddQuestion: () => void; onTake: (id: number) => void; deleting: boolean; onDeleteQuestion: (id: number) => void; deletingQuestion: number | null;
}) {
  const { data: attempts = [] } = useLectureQuizAttempts(quiz.id);
  return (
    <div className="p-3 border rounded-xl space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary" />
          <span className="font-bold text-sm">{quiz.title}</span>
          <span className="text-xs text-muted-foreground">({quiz.questions.length} سؤال)</span>
          {attempts.length > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{attempts.length} محاولة</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => onTake(quiz.id)}>حل</Button>
          {isSuper && (
            <>
              <button onClick={onAddQuestion} className="text-xs text-primary underline">+ سؤال</button>
              <button onClick={onDelete} disabled={deleting} className="p-1 rounded hover:bg-destructive/10 disabled:opacity-50">
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
              </button>
            </>
          )}
        </div>
      </div>
      {isSuper && quiz.questions.map((qq: any, qi: number) => (
        <div key={qq.id} className="text-xs bg-muted/30 rounded-lg p-2 flex items-start justify-between gap-2">
          <div>
            <span className="font-bold">{qi + 1}.</span> {qq.text}
            <div className="text-muted-foreground mt-0.5">الإجابة الصحيحة: {qq.options[qq.correctIndex]}</div>
          </div>
          <button onClick={() => onDeleteQuestion(qq.id)} disabled={deletingQuestion === qq.id} className="text-destructive flex-shrink-0 disabled:opacity-50">
            {deletingQuestion === qq.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </button>
        </div>
      ))}
      {attempts.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="text-xs font-bold text-muted-foreground">المحاولات:</div>
          {attempts.slice(0, 5).map((a: any, i: number) => (
            <div key={a.id || i} className="text-xs bg-muted/30 rounded-lg p-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {a.userAvatar ? (
                  <img src={a.userAvatar} alt="" className="h-5 w-5 rounded-full" />
                ) : (
                  <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold">{a.userName?.[0] || "?"}</div>
                )}
                <span>{a.userName || "طالب"}</span>
                {a.userGroup && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{a.userGroup}</span>}
              </div>
              <span className={`font-bold ${((a.score / a.total) >= 0.5) ? "text-green-600" : "text-destructive"}`}>{a.score}/{a.total}</span>
            </div>
          ))}
          {attempts.length > 5 && (
            <div className="text-xs text-muted-foreground text-center py-1">...و{attempts.length - 5} محاولات أخرى</div>
          )}
        </div>
      )}
    </div>
  );
}

function LectureCard({ lecture, isSuper, videoProgress }: { lecture: LectureFull; isSuper: boolean; videoProgress: Record<number, boolean> }) {
  const deleteLecture = useDeleteLecture();
  const addVideo = useAddVideo();
  const deleteVideo = useDeleteVideo();
  const addPdf = useAddLecturePdf();
  const deletePdf = useDeleteLecturePdf();
  const createQuiz = useCreateLectureQuiz();
  const deleteQuiz = useDeleteLectureQuiz();
  const addQuestion = useAddLectureQuizQuestion();
  const deleteQuestion = useDeleteLectureQuizQuestion();
  const markWatched = useMarkVideoWatched();
  const { toast } = useToast();

  const [videoDialog, setVideoDialog] = useState(false);
  const [pdfDialog, setPdfDialog] = useState(false);
  const [quizDialog, setQuizDialog] = useState(false);
  const [quizTakeDialog, setQuizTakeDialog] = useState<number | null>(null);
  const [questionDialog, setQuestionDialog] = useState<number | null>(null);
  const [deletingLecture, setDeletingLecture] = useState(false);
  const [deletingVideo, setDeletingVideo] = useState<number | null>(null);
  const [deletingPdf, setDeletingPdf] = useState<number | null>(null);
  const [deletingQuiz, setDeletingQuiz] = useState<number | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<number | null>(null);
  const [markingWatched, setMarkingWatched] = useState<number | null>(null);

  const [newVideo, setNewVideo] = useState({ title: "", youtubeUrl: "" });
  const [newPdf, setNewPdf] = useState({ name: "", url: "", sizeBytes: 0 });
  const [newQuiz, setNewQuiz] = useState({ title: "" });
  const [newQuestion, setNewQuestion] = useState({ text: "", options: ["", "", "", ""], correctIndex: 0, points: 1 });

  const handleAddVideo = async () => {
    if (!newVideo.title || !newVideo.youtubeUrl) { toast({ title: "العنوان والرابط مطلوب", variant: "destructive" }); return; }
    try {
      await addVideo.mutateAsync({ lectureId: lecture.id, ...newVideo });
      setVideoDialog(false);
      setNewVideo({ title: "", youtubeUrl: "" });
      toast({ title: "تم إضافة الفيديو" });
    } catch (e) { toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" }); }
  };

  const handleAddPdf = async () => {
    if (!newPdf.name || !newPdf.url) { toast({ title: "اختر ملفاً", variant: "destructive" }); return; }
    try {
      await addPdf.mutateAsync({ lectureId: lecture.id, ...newPdf });
      setPdfDialog(false);
      setNewPdf({ name: "", url: "", sizeBytes: 0 });
      toast({ title: "تم رفع الملف" });
    } catch (e) { toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" }); }
  };

  const handleCreateQuiz = async () => {
    if (!newQuiz.title) { toast({ title: "العنوان مطلوب", variant: "destructive" }); return; }
    try {
      await createQuiz.mutateAsync({ lectureId: lecture.id, title: newQuiz.title });
      setQuizDialog(false);
      setNewQuiz({ title: "" });
      toast({ title: "تم إنشاء الاختبار" });
    } catch (e) { toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" }); }
  };

  const handleAddQuestion = async (quizId: number) => {
    if (!newQuestion.text || newQuestion.options.some((o) => !o) || typeof newQuestion.correctIndex !== "number") {
      toast({ title: "بيانات السؤال ناقصة", variant: "destructive" }); return;
    }
    try {
      await addQuestion.mutateAsync({ quizId, ...newQuestion });
      setQuestionDialog(null);
      setNewQuestion({ text: "", options: ["", "", "", ""], correctIndex: 0, points: 1 });
      toast({ title: "تم إضافة السؤال" });
    } catch (e) { toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" }); }
  };

  const handleDeleteLecture = async () => {
    if (!confirm("حذف هذه المحاضرة؟")) return;
    setDeletingLecture(true);
    try {
      await deleteLecture.mutateAsync(lecture.id);
      toast({ title: "تم الحذف" });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeletingLecture(false);
    }
  };

  const handleDeleteVideo = async (videoId: number) => {
    if (!confirm("حذف الفيديو؟")) return;
    setDeletingVideo(videoId);
    try {
      await deleteVideo.mutateAsync(videoId);
      toast({ title: "تم الحذف" });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeletingVideo(null);
    }
  };

  const handleDeletePdf = async (pdfId: number) => {
    if (!confirm("حذف الملف؟")) return;
    setDeletingPdf(pdfId);
    try {
      await deletePdf.mutateAsync(pdfId);
      toast({ title: "تم الحذف" });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeletingPdf(null);
    }
  };

  const handleDeleteQuiz = async (quizId: number) => {
    if (!confirm("حذف الاختبار؟")) return;
    setDeletingQuiz(quizId);
    try {
      await deleteQuiz.mutateAsync(quizId);
      toast({ title: "تم الحذف" });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeletingQuiz(null);
    }
  };

  const handleDeleteQuestion = async (questionId: number) => {
    setDeletingQuestion(questionId);
    try {
      await deleteQuestion.mutateAsync(questionId);
      toast({ title: "تم حذف السؤال" });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeletingQuestion(null);
    }
  };

  const handleMarkWatched = async (videoId: number) => {
    setMarkingWatched(videoId);
    try { await markWatched.mutateAsync(videoId); } catch {}
    finally { setMarkingWatched(null); }
  };

  const isVideoCompleted = (videoId: number) => videoProgress[videoId] || false;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border-2 border-border rounded-2xl p-4 space-y-4 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {lecture.type === "lecture" ? <BookOpen className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-secondary" />}
          <h3 className="font-bold text-lg">{lecture.title}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full ${lecture.type === "lecture" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"}`}>
            {lecture.type === "lecture" ? "محاضرة" : "سكشن"}
          </span>
        </div>
        {isSuper && (
          <button onClick={handleDeleteLecture} disabled={deletingLecture} className="p-1 rounded hover:bg-destructive/10 disabled:opacity-50">
            {deletingLecture ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
          </button>
        )}
      </div>

      {/* Videos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold flex items-center gap-1"><Video className="h-4 w-4" /> الفيديوهات ({lecture.videos.length})</h4>
          {isSuper && <Button size="sm" variant="outline" onClick={() => setVideoDialog(true)}><Plus className="h-3.5 w-3.5 me-1" /> فيديو</Button>}
        </div>
        <div className="space-y-3">
          {lecture.videos.map((v) => (
            <div key={v.id}>
              <VideoPlayer video={v} completed={isVideoCompleted(v.id)} onWatch={() => handleMarkWatched(v.id)} loading={markingWatched === v.id} />
              {isSuper && (
                <button onClick={() => handleDeleteVideo(v.id)} disabled={deletingVideo === v.id} className="text-xs text-destructive mt-1 flex items-center gap-1 disabled:opacity-50">
                  {deletingVideo === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Trash2 className="h-3 w-3" /> حذف</>}
                </button>
              )}
            </div>
          ))}
          {!lecture.videos.length && <p className="text-xs text-muted-foreground text-center py-2">لا توجد فيديوهات بعد</p>}
        </div>
      </div>

      {/* PDFs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold flex items-center gap-1"><FileText className="h-4 w-4" /> الملفات ({lecture.pdfs.length})</h4>
          {isSuper && <Button size="sm" variant="outline" onClick={() => setPdfDialog(true)}><Upload className="h-3.5 w-3.5 me-1" /> ملف</Button>}
        </div>
        {lecture.pdfs.map((p) => (
          <PdfViewer
            key={p.id}
            pdf={{ name: p.name, url: p.url }}
            isSuper={isSuper}
            onDelete={() => handleDeletePdf(p.id)}
          />
        ))}
      </div>

      {/* Quizzes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold flex items-center gap-1"><HelpCircle className="h-4 w-4" /> الاختبارات ({lecture.quizzes.length})</h4>
          {isSuper && <Button size="sm" variant="outline" onClick={() => setQuizDialog(true)}><Plus className="h-3.5 w-3.5 me-1" /> اختبار</Button>}
        </div>
        {lecture.quizzes.map((q) => (
          <QuizCard
            key={q.id}
            quiz={q}
            isSuper={isSuper}
            onDelete={() => handleDeleteQuiz(q.id)}
            onAddQuestion={() => setQuestionDialog(q.id)}
            onTake={(id) => setQuizTakeDialog(id)}
            deleting={deletingQuiz === q.id}
            onDeleteQuestion={(qqId) => handleDeleteQuestion(qqId)}
            deletingQuestion={deletingQuestion}
          />
        ))}
      </div>

      {/* Add Video Dialog */}
      <Dialog open={videoDialog} onOpenChange={setVideoDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>إضافة فيديو يوتيوب</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">عنوان الفيديو</Label><Input value={newVideo.title} onChange={(e) => setNewVideo({ ...newVideo, title: e.target.value })} /></div>
            <div><Label className="text-xs">رابط يوتيوب</Label><Input value={newVideo.youtubeUrl} onChange={(e) => setNewVideo({ ...newVideo, youtubeUrl: e.target.value })} placeholder="https://youtube.com/watch?v=..." /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setVideoDialog(false)}>إلغاء</Button><Button onClick={handleAddVideo} disabled={addVideo.isPending}>{addVideo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="me-2 h-4 w-4" /> إضافة</>}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add PDF Dialog */}
      <Dialog open={pdfDialog} onOpenChange={setPdfDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>رفع ملف PDF</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">اسم الملف</Label><Input value={newPdf.name} onChange={(e) => setNewPdf({ ...newPdf, name: e.target.value })} placeholder="ملخص المحاضرة.pdf" /></div>
            <FileUpload value={newPdf.url || null} onChange={(d) => setNewPdf({ ...newPdf, url: d || "", sizeBytes: d ? Math.ceil((d.length * 3) / 4) : 0 })} accept=".pdf" maxSizeKb={5000} label="اختر ملف PDF" />
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setPdfDialog(false)}>إلغاء</Button><Button onClick={handleAddPdf} disabled={addPdf.isPending || !newPdf.url || !newPdf.name}>{addPdf.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="me-2 h-4 w-4" /> رفع</>}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Quiz Dialog */}
      <Dialog open={quizDialog} onOpenChange={setQuizDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>إنشاء اختبار جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">عنوان الاختبار</Label><Input value={newQuiz.title} onChange={(e) => setNewQuiz({ title: e.target.value })} placeholder="اختبار المحاضرة الأولى" /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setQuizDialog(false)}>إلغاء</Button><Button onClick={handleCreateQuiz} disabled={createQuiz.isPending}>{createQuiz.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="me-2 h-4 w-4" /> إنشاء</>}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Question Dialog */}
      <Dialog open={questionDialog !== null} onOpenChange={() => setQuestionDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>إضافة سؤال</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">نص السؤال</Label><Input value={newQuestion.text} onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })} /></div>
            {newQuestion.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name={`cq-${questionDialog}`} checked={newQuestion.correctIndex === i} onChange={() => setNewQuestion({ ...newQuestion, correctIndex: i })} className="accent-green-600" />
                <Input value={opt} onChange={(e) => { const opts = [...newQuestion.options]; opts[i] = e.target.value; setNewQuestion({ ...newQuestion, options: opts }); }} placeholder={`الخيار ${i + 1}`} />
              </div>
            ))}
            <div className="text-xs text-muted-foreground">✓ حدد الإجابة الصحيحة</div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">النقاط</Label><Input type="number" value={newQuestion.points} onChange={(e) => setNewQuestion({ ...newQuestion, points: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setQuestionDialog(null)}>إلغاء</Button><Button onClick={() => questionDialog && handleAddQuestion(questionDialog)} disabled={addQuestion.isPending}>{addQuestion.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="me-2 h-4 w-4" /> إضافة</>}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Take Quiz Dialog */}
      <Dialog open={quizTakeDialog !== null} onOpenChange={() => setQuizTakeDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>حل الاختبار</DialogTitle></DialogHeader>
          {quizTakeDialog && (() => {
            const quiz = lecture.quizzes.find((q) => q.id === quizTakeDialog);
            if (!quiz || !quiz.questions.length) return <p className="text-center text-muted-foreground py-4">لا توجد أسئلة بعد</p>;
            return <QuizTaking quiz={quiz} questions={quiz.questions} />;
          })()}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

export default function AdminCourseDetail() {
  const { id } = useParams<{ id: string }>();
  const courseId = Number(id);
  const [, navigate] = useLocation();
  const { data: me } = useMeV2();
  const isAdmin = me?.role === "admin" || me?.role === "super_admin";
  const { data: lectures = [] } = useCourseLectures(courseId);
  const { data: progress } = useCourseProgress(courseId);
  const { data: videoProgressRaw } = useCourseVideoProgress(courseId);
  const { toast } = useToast();

  const createLecture = useCreateLecture();
  const [tab, setTab] = useState<"all" | "lecture" | "section">("all");
  const [newLectureDialog, setNewLectureDialog] = useState(false);
  const [newLecture, setNewLecture] = useState({ title: "", type: "lecture" as "lecture" | "section" });

  const videoProgress: Record<number, boolean> = {};
  if (videoProgressRaw) videoProgressRaw.forEach((vp) => { videoProgress[vp.videoId] = vp.completed; });

  const filtered = lectures.filter((l) => tab === "all" || l.type === tab);
  const lectureCount = lectures.filter((l) => l.type === "lecture").length;
  const sectionCount = lectures.filter((l) => l.type === "section").length;

  const handleCreateLecture = async () => {
    if (!newLecture.title) { toast({ title: "العنوان مطلوب", variant: "destructive" }); return; }
    try {
      await createLecture.mutateAsync({ courseId, ...newLecture });
      setNewLectureDialog(false);
      setNewLecture({ title: "", type: "lecture" });
      toast({ title: "تم الإضافة" });
    } catch (e) { toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" }); }
  };

  if (!isAdmin) return <div className="p-12 text-center text-muted-foreground">صلاحياتك غير كافية</div>;
  if (!courseId) return <div className="p-12 text-center text-muted-foreground">مقرر غير موجود</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/courses")}><ArrowLeft className="h-4 w-4 me-1" /> رجوع</Button>
        <h1 className="text-2xl font-serif font-bold flex-1">إدارة المقرر</h1>
        <Button onClick={() => setNewLectureDialog(true)}>
          <Plus className="me-2 h-4 w-4" /> إضافة
        </Button>
      </div>

      {/* Progress Bar */}
      {progress && (
        <div className="mb-6 p-4 bg-card border rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold">تقدم المقرر</span>
            <span className="text-sm font-bold text-primary">{progress.percent}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div className="bg-primary h-3 rounded-full transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>فيديوهات: {progress.videos.filter((v) => v.completed).length}/{progress.videos.length}</span>
            <span>اختبارات: {progress.quizzes.filter((q) => q.completed).length}/{progress.quizzes.length}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: "all" as const, label: `الكل (${lectures.length})` },
          { key: "lecture" as const, label: `محاضرات (${lectureCount})` },
          { key: "section" as const, label: `سكاشن (${sectionCount})` },
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
        {filtered.length === 0 && <div className="text-center text-muted-foreground py-12">لا توجد محاضرات بعد. أضف محاضرة أو سكشن.</div>}
        {filtered.map((l) => (
          <LectureCard key={l.id} lecture={l} isSuper={!!isAdmin} videoProgress={videoProgress} />
        ))}
      </div>

      {/* Add Lecture Dialog */}
      <Dialog open={newLectureDialog} onOpenChange={setNewLectureDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>إضافة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">العنوان</Label><Input value={newLecture.title} onChange={(e) => setNewLecture({ ...newLecture, title: e.target.value })} placeholder="المحاضرة الأولى" /></div>
            <div>
              <Label className="text-xs">النوع</Label>
              <select value={newLecture.type} onChange={(e) => setNewLecture({ ...newLecture, type: e.target.value as "lecture" | "section" })} className="w-full h-10 px-3 border-2 border-input rounded-md bg-background text-sm">
                <option value="lecture">محاضرة</option>
                <option value="section">سكشن</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewLectureDialog(false)}>إلغاء</Button>
            <Button onClick={handleCreateLecture} disabled={createLecture.isPending}>
              {createLecture.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="me-2 h-4 w-4" /> إضافة</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
