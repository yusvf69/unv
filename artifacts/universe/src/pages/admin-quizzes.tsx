import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Plus, Trash2, Eye, Users, Clock, Trophy,
  Send, Loader2, Edit2, CheckCircle, XCircle,
  HelpCircle, AlertCircle, BookOpen, Settings, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  useAdminQuizzes, useToggleQuiz, useQuizAttempts, useMeV2,
  useAdminCourses, api, useAdminQuizAttemptDetail,
} from "@/lib/api";
import { formatISODateTime } from "@/lib/dates";
import { useToast } from "@/hooks/use-toast";

function useCreateQuiz() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const create = async (data: any) => {
    setIsPending(true);
    try {
      const res = await api.post("/v2/admin/quizzes", data);
      toast({ title: "تم إنشاء الاختبار" });
      return res;
    } finally { setIsPending(false); }
  };
  return { mutateAsync: create, isPending };
}

function useDeleteQuiz() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const remove = async (id: number) => {
    setIsPending(true);
    try {
      await api.del(`/v2/admin/quizzes/${id}`);
      toast({ title: "تم حذف الاختبار" });
    } finally { setIsPending(false); }
  };
  return { mutateAsync: remove, isPending };
}

function useAddQuizQuestion() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const add = async (quizId: number, data: any) => {
    setIsPending(true);
    try {
      return await api.post(`/v2/admin/quizzes/${quizId}/questions`, data);
    } finally { setIsPending(false); }
  };
  return { mutateAsync: add, isPending };
}

function useDeleteQuizQuestion() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const remove = async (id: number) => {
    setIsPending(true);
    try {
      await api.del(`/v2/admin/quiz-questions/${id}`);
      toast({ title: "تم حذف السؤال" });
    } finally { setIsPending(false); }
  };
  return { mutateAsync: remove, isPending };
}

export default function AdminQuizzes() {
  const { data: me } = useMeV2();
  const { data: quizzes = [], isLoading } = useAdminQuizzes();
  const { data: courses = [] } = useAdminCourses();
  const toggle = useToggleQuiz();
  const { toast } = useToast();
  const [viewing, setViewing] = useState<number | null>(null);
  const { data: attempts = [] } = useQuizAttempts(viewing || 0);
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [managingQuestions, setManagingQuestions] = useState<number | null>(null);
  const [viewingAttempt, setViewingAttempt] = useState<number | null>(null);

  if (!me || (me.role !== "admin" && me.role !== "super_admin")) {
    return <div className="p-12 text-center text-muted-foreground">صلاحياتك غير كافية</div>;
  }
  const isSuper = me.role === "super_admin";

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 sm:mb-6 flex items-start justify-between gap-2 sm:gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-3xl font-serif font-bold">إدارة الاختبارات</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            أنشئ اختبارات مخصصة بمدة ونقاط محددة، وأضف أسئلة اختيار من متعدد وصح وخطأ
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="h-9 sm:h-10 text-xs sm:text-sm"><Plus className="me-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> إنشاء اختبار</Button>
      </motion.div>

      {isLoading && <p className="text-center text-muted-foreground py-8 text-sm">جاري التحميل...</p>}
      {!isLoading && !quizzes.length && (
        <div className="text-center py-12 sm:py-16 bg-card border rounded-xl sm:rounded-2xl">
          <HelpCircle className="h-8 w-8 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-2 sm:mb-3" />
          <p className="text-muted-foreground text-sm">لا توجد اختبارات بعد. أنشئ أول اختبار!</p>
        </div>
      )}

      <div className="space-y-2 sm:space-y-3">
        {quizzes.map((q) => (
          <motion.div key={q.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="bg-card border rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-lg truncate">{q.title}</h3>
                <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold ${q.isOpen ? "bg-emerald-500/20 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                  {q.isOpen ? "مفتوح" : "مغلق"}
                </span>
                <span className="text-[10px] sm:text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">{q.difficulty}</span>
                {q.groupOnly && <span className="text-[10px] sm:text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">G{q.groupOnly}</span>}
                {q.yearOnly && <span className="text-[10px] sm:text-xs bg-amber-500/10 text-amber-700 px-2 py-0.5 rounded-full">سنة {q.yearOnly}</span>}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">{q.courseTitle}</p>
              <div className="flex items-center gap-2 sm:gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {q.durationMinutes} دقيقة</span>
                <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> {q.totalPoints} نقطة</span>
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {q.attemptsCount} محاولة</span>
                <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> نجاح {q.passPercent ?? 50}%</span>
              </div>
            </div>
            <div className="flex gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto">
              <Button size="sm" variant="outline" onClick={() => setManagingQuestions(q.id)} className="text-xs h-8 sm:h-9">
                <Settings className="me-1 h-3 w-3 sm:h-4 sm:w-4" /> الأسئلة
              </Button>
              <Button size="sm" variant="outline" onClick={() => setViewing(q.id)} className="text-xs h-8 sm:h-9">
                <Eye className="me-1 h-3 w-3 sm:h-4 sm:w-4" /> المحاولات
              </Button>
              <Button
                size="sm"
                disabled={!isSuper || toggle.isPending}
                variant={q.isOpen ? "secondary" : "default"}
                onClick={async () => {
                  try {
                    const r = await toggle.mutateAsync(q.id);
                    toast({ title: r.isOpen ? "تم فتح الاختبار" : "تم إغلاق الاختبار" });
                  } catch (e) {
                    toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
                  }
                }}
                title={!isSuper ? "السوبر أدمن فقط" : ""}
                className="text-xs h-8 sm:h-9"
              >
                {q.isOpen ? <><XCircle className="me-1 h-3 w-3 sm:h-4 sm:w-4" /> إغلاق</> : <><CheckCircle className="me-1 h-3 w-3 sm:h-4 sm:w-4" /> فتح</>}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(q)} className="h-8 sm:h-9"><Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={async () => {
                if (!confirm("حذف هذا الاختبار؟")) return;
                await api.del(`/v2/admin/quizzes/${q.id}`);
                toast({ title: "تم الحذف" });
              }} className="h-8 sm:h-9"><Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" /></Button>
            </div>
          </motion.div>
        ))}
      </div>

      <CreateQuizDialog open={creating} onClose={() => setCreating(false)} courses={courses} />
      {editing && <EditQuizDialog quiz={editing} onClose={() => setEditing(null)} />}
      {managingQuestions && <ManageQuestionsDialog quizId={managingQuestions} onClose={() => setManagingQuestions(null)} />}

      {/* View Attempts Dialog */}
      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader><DialogTitle className="text-base sm:text-lg">محاولات الطلاب</DialogTitle></DialogHeader>
          {attempts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">لا توجد محاولات بعد</p>
          ) : (
            <div className="space-y-2 max-h-[40vh] sm:max-h-96 overflow-y-auto">
              {attempts.map((a) => {
                const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
                return (
                  <div key={a.id} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 border rounded-lg">
                    {a.userAvatar ? (
                      <img src={a.userAvatar} alt="" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">{a.userName?.charAt(0)}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs sm:text-sm truncate">{a.userName || `User #${a.userId}`}</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">{formatISODateTime(a.completedAt)} · {a.userGroup ? `G${a.userGroup}` : ""}</div>
                    </div>
                    <div className={`text-xs sm:text-sm font-bold ${pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-destructive"}`}>
                      {a.score}/{a.total} ({pct}%)
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setViewingAttempt(a.id)} className="h-8 w-8 p-0">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detailed Attempt View */}
      {viewingAttempt && <AttemptDetailDialog attemptId={viewingAttempt} onClose={() => setViewingAttempt(null)} />}
    </div>
  );
}

function AttemptDetailDialog({ attemptId, onClose }: { attemptId: number; onClose: () => void }) {
  const { data: detail, isLoading } = useAdminQuizAttemptDetail(attemptId);
  const pct = detail ? Math.round((detail.score / detail.total) * 100) : 0;
  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">تفاصيل محاولة الطالب</DialogTitle>
        </DialogHeader>
        {isLoading && <p className="text-center py-8 text-muted-foreground text-sm">جاري التحميل...</p>}
        {detail && (
          <>
            {/* Student info */}
            <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/30 rounded-xl">
              {detail.userAvatar ? (
                <img src={detail.userAvatar} alt="" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-base sm:text-lg">{detail.userName?.charAt(0)}</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm sm:text-base truncate">{detail.userName || "مستخدم محذوف"}</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">{new Date(detail.completedAt).toLocaleString("ar-EG")} · المدة: {formatDuration(detail.durationSec)}</div>
              </div>
              <div className="text-center flex-shrink-0">
                <div className={`text-xl sm:text-2xl font-bold ${detail.passed ? "text-emerald-600" : "text-destructive"}`}>{pct}%</div>
                <Badge variant={detail.passed ? "default" : "destructive"} className="text-[10px]">{detail.passed ? "ناجح" : "راسب"}</Badge>
              </div>
            </div>

            {/* Score summary */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
              <div className="bg-emerald-500/10 rounded-lg p-2 sm:p-3">
                <div className="text-base sm:text-xl font-bold text-emerald-600">{detail.questions.filter((q) => q.correct).length}</div>
                <div className="text-[10px] text-muted-foreground">إجابة صحيحة</div>
              </div>
              <div className="bg-red-500/10 rounded-lg p-2 sm:p-3">
                <div className="text-base sm:text-xl font-bold text-destructive">{detail.questions.filter((q) => !q.correct).length}</div>
                <div className="text-[10px] text-muted-foreground">إجابة خاطئة</div>
              </div>
              <div className="bg-amber-500/10 rounded-lg p-2 sm:p-3">
                <div className="text-base sm:text-xl font-bold text-amber-600">{detail.score}/{detail.total}</div>
                <div className="text-[10px] text-muted-foreground">النقاط</div>
              </div>
            </div>

            {/* Question breakdown */}
            <div className="space-y-3">
              {detail.questions.map((q, i) => (
                <div key={q.questionId} className={`border-2 rounded-xl overflow-hidden ${q.correct ? "border-emerald-500/30" : "border-red-500/30"}`}>
                  <div className={`px-4 py-2.5 flex items-center gap-2 ${q.correct ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                    <span className="text-xs font-bold bg-muted px-2 py-0.5 rounded-full">{i + 1}</span>
                    {q.correct ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    <span className="font-bold text-sm flex-1 truncate">{q.text}</span>
                    <span className="text-[10px] bg-amber-500/15 text-amber-600 px-1.5 py-0.5 rounded-full">{q.points} نقطة</span>
                  </div>
                  <div className="px-4 py-2.5 space-y-1.5">
                    {q.options.map((opt, oi) => {
                      const isCorrect = oi === q.correctIndex;
                      const isUserChoice = oi === q.userChosen;
                      let cls = "border-transparent";
                      if (isCorrect) cls = "bg-emerald-500/10 border-emerald-500";
                      else if (isUserChoice) cls = "bg-red-500/10 border-red-500";
                      return (
                        <div key={oi} className={`flex items-center gap-2 p-2 rounded border text-xs ${cls}`}>
                          {isCorrect ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" /> : isUserChoice ? <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" /> : <div className="h-3.5 w-3.5 flex-shrink-0" />}
                          <span className="flex-1 truncate">{opt}</span>
                          {isCorrect && <span className="text-[10px] font-bold text-emerald-600 flex-shrink-0">صحيحة</span>}
                          {isUserChoice && !q.correct && <span className="text-[10px] font-bold text-destructive flex-shrink-0">إجابة الطالب</span>}
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation && (
                    <div className="px-4 pb-3">
                      <div className="bg-muted/50 rounded-lg p-2.5 text-xs">
                        <span className="font-bold text-muted-foreground">💡 الشرح:</span>
                        <p className="mt-0.5">{q.explanation}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateQuizDialog({ open, onClose, courses }: { open: boolean; onClose: () => void; courses: any[] }) {
  const create = useCreateQuiz();
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: "", description: "", courseId: 0, courseTitle: "",
    durationMinutes: 30, totalPoints: 100, difficulty: "medium",
    groupOnly: "", yearOnly: 0, randomize: true, passPercent: 50,
  });

  const submit = async () => {
    if (!form.title || !form.courseId) {
      toast({ title: "العنوان والمادة مطلوبان", variant: "destructive" });
      return;
    }
    const course = courses.find((c) => c.id === form.courseId);
    await create.mutateAsync({ ...form, courseTitle: course?.title || "" });
    onClose();
    setForm({ title: "", description: "", courseId: 0, courseTitle: "", durationMinutes: 30, totalPoints: 100, difficulty: "medium", groupOnly: "", yearOnly: 0, randomize: true, passPercent: 50 });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-base sm:text-lg">إنشاء اختبار جديد</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">عنوان الاختبار</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="اختبار منتصف الفصل" className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">الوصف</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="وصف الاختبار..." rows={2} className="text-sm" />
          </div>
          <div>
            <Label className="text-xs">المادة</Label>
            <select
              value={form.courseId}
              onChange={(e) => setForm({ ...form, courseId: Number(e.target.value) })}
              className="w-full h-9 px-3 border-2 border-input rounded-md bg-background text-sm"
            >
              <option value={0}>— اختر مادة —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <div>
              <Label className="text-xs">المدة (دقائق)</Label>
              <Input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">إجمالي النقاط</Label>
              <Input type="number" value={form.totalPoints} onChange={(e) => setForm({ ...form, totalPoints: Number(e.target.value) })} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">نسبة النجاح %</Label>
              <Input type="number" value={form.passPercent} onChange={(e) => setForm({ ...form, passPercent: Number(e.target.value) })} className="h-9 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <Label className="text-xs">المستوى</Label>
              <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="w-full h-9 px-3 border-2 border-input rounded-md bg-background text-sm">
                <option value="easy">سهل</option>
                <option value="medium">متوسط</option>
                <option value="hard">صعب</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">السنة الدراسية</Label>
              <Input type="number" value={form.yearOnly || ""} onChange={(e) => setForm({ ...form, yearOnly: Number(e.target.value) || 0 })} placeholder="0 = الكل" className="h-9 text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.randomize} onChange={(e) => setForm({ ...form, randomize: e.target.checked })} id="randomize" className="accent-primary" />
            <Label htmlFor="randomize" className="text-xs sm:text-sm">خلط ترتيب الأسئلة</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-xs sm:text-sm">إلغاء</Button>
          <Button onClick={submit} disabled={create.isPending} className="text-xs sm:text-sm">
            {create.isPending ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <><Send className="me-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> إنشاء</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditQuizDialog({ quiz, onClose }: { quiz: any; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: quiz.title || "",
    description: quiz.description || "",
    durationMinutes: quiz.durationMinutes || 15,
    totalPoints: quiz.totalPoints || 100,
    difficulty: quiz.difficulty || "medium",
    passPercent: quiz.passPercent || 50,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/v2/admin/quizzes/${quiz.id}`, form);
      toast({ title: "تم التحديث" });
      onClose();
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle className="text-base sm:text-lg">تعديل الاختبار</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">العنوان</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-9 text-sm" /></div>
          <div><Label className="text-xs">الوصف</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="text-sm" /></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <div><Label className="text-xs">المدة (دقائق)</Label><Input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} className="h-9 text-sm" /></div>
            <div><Label className="text-xs">النقاط</Label><Input type="number" value={form.totalPoints} onChange={(e) => setForm({ ...form, totalPoints: Number(e.target.value) })} className="h-9 text-sm" /></div>
            <div><Label className="text-xs">نسبة النجاح %</Label><Input type="number" value={form.passPercent} onChange={(e) => setForm({ ...form, passPercent: Number(e.target.value) })} className="h-9 text-sm" /></div>
          </div>
          <div><Label className="text-xs">المستوى</Label>
            <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="w-full h-9 px-3 border-2 border-input rounded-md bg-background text-sm">
              <option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-xs sm:text-sm">إلغاء</Button>
          <Button onClick={save} disabled={saving} className="text-xs sm:text-sm">{saving ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageQuestionsDialog({ quizId, onClose }: { quizId: number; onClose: () => void }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const addQ = useAddQuizQuestion();
  const deleteQ = useDeleteQuizQuestion();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [newQ, setNewQ] = useState({ text: "", type: "mc" as "mc" | "tf", options: ["", "", "", ""], correctIndex: 0, points: 10, explanation: "" });

  const load = async () => {
    setLoading(true);
    try {
      const qs = await api.get<any[]>(`/v2/admin/quizzes/${quizId}/questions`);
      setQuestions(qs);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [quizId]);

  const submit = async () => {
    if (!newQ.text || newQ.type === "mc" && newQ.options.some((o) => !o)) {
      toast({ title: "بيانات السؤال ناقصة", variant: "destructive" });
      return;
    }
    const opts = newQ.type === "tf" ? ["صح", "خطأ"] : newQ.options;
    await addQ.mutateAsync(quizId, { ...newQ, options: opts });
    setAdding(false);
    setNewQ({ text: "", type: "mc", options: ["", "", "", ""], correctIndex: 0, points: 10, explanation: "" });
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("حذف السؤال؟")) return;
    await deleteQ.mutateAsync(id);
    load();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">إدارة الأسئلة</DialogTitle>
        </DialogHeader>

        {!adding ? (
          <Button onClick={() => setAdding(true)} className="mb-3 h-9 text-sm"><Plus className="me-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> إضافة سؤال</Button>
        ) : (
          <div className="space-y-3 p-2 sm:p-3 border rounded-xl mb-3 bg-muted/20">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div><Label className="text-xs">نوع السؤال</Label>
                <select value={newQ.type} onChange={(e) => setNewQ({ ...newQ, type: e.target.value as "mc" | "tf" })} className="w-full h-9 px-3 border-2 border-input rounded-md bg-background text-sm">
                  <option value="mc">اختيار من متعدد</option>
                  <option value="tf">صح / خطأ</option>
                </select>
              </div>
              <div><Label className="text-xs">النقاط</Label><Input type="number" value={newQ.points} onChange={(e) => setNewQ({ ...newQ, points: Number(e.target.value) })} className="h-9 text-sm" /></div>
            </div>
            <div><Label className="text-xs">نص السؤال</Label><Textarea value={newQ.text} onChange={(e) => setNewQ({ ...newQ, text: e.target.value })} placeholder="اكتب السؤال..." className="text-sm" /></div>
            {newQ.type === "mc" && (
              <div className="space-y-2">
                <Label className="text-xs">الخيارات (حدد الإجابة الصحيحة)</Label>
                {newQ.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="radio" name={`cq-${quizId}`} checked={newQ.correctIndex === i} onChange={() => setNewQ({ ...newQ, correctIndex: i })} className="accent-green-600" />
                    <Input value={opt} onChange={(e) => { const opts = [...newQ.options]; opts[i] = e.target.value; setNewQ({ ...newQ, options: opts }); }} placeholder={`الخيار ${i + 1}`} className="h-9 text-sm" />
                  </div>
                ))}
              </div>
            )}
            {newQ.type === "tf" && (
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name={`tf-${quizId}`} checked={newQ.correctIndex === 0} onChange={() => setNewQ({ ...newQ, correctIndex: 0 })} className="accent-green-600" />
                  <span className="text-xs sm:text-sm font-bold text-green-600">صح</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name={`tf-${quizId}`} checked={newQ.correctIndex === 1} onChange={() => setNewQ({ ...newQ, correctIndex: 1 })} className="accent-destructive" />
                  <span className="text-xs sm:text-sm font-bold text-destructive">خطأ</span>
                </label>
              </div>
            )}
            <div><Label className="text-xs">الشرح (اختياري)</Label><Textarea value={newQ.explanation} onChange={(e) => setNewQ({ ...newQ, explanation: e.target.value })} placeholder="شرح الإجابة..." rows={1} className="text-sm" /></div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAdding(false)} className="text-xs sm:text-sm">إلغاء</Button>
              <Button onClick={submit} disabled={addQ.isPending} className="text-xs sm:text-sm">{addQ.isPending ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : "إضافة"}</Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-center text-muted-foreground py-4">جاري التحميل...</p>
        ) : questions.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">لا توجد أسئلة بعد</p>
        ) : (
          <div className="space-y-2">
            {questions.map((q, i) => (
              <div key={q.id} className="p-3 border rounded-lg flex items-start gap-3">
                <span className="text-xs font-bold text-muted-foreground mt-1">{i + 1}.</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold">{q.text}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${q.type === "tf" ? "bg-blue-500/15 text-blue-600" : "bg-purple-500/15 text-purple-600"}`}>
                      {q.type === "tf" ? "صح/خطأ" : "اختيار"}
                    </span>
                    <span className="text-[10px] bg-amber-500/15 text-amber-600 px-1.5 py-0.5 rounded-full">{q.points} نقطة</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {q.type === "tf" ? (
                      <span className={q.correctIndex === 0 ? "text-green-600 font-bold" : "text-destructive font-bold"}>الإجابة: {q.correctIndex === 0 ? "صح" : "خطأ"}</span>
                    ) : (
                      <>الإجابة: {q.options[q.correctIndex]}</>
                    )}
                    {q.explanation && <div className="mt-0.5 text-muted-foreground/70">شرح: {q.explanation}</div>}
                  </div>
                </div>
                <button onClick={() => handleDelete(q.id)} className="p-1 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
