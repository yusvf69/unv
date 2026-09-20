import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Eye, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  useCourseExams, useCreateCourseExam, useCourseExamDetail,
  useAddCourseExamQuestion, useUpdateCourseExamQuestion, useDeleteCourseExamQuestion,
  useCourseExamAttempts, useSubmitCourseExamAttempt,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function AdminCourseExams() {
  const params = new URLSearchParams(window.location.search);
  const courseId = Number(params.get("courseId") || 0);
  const { toast } = useToast();

  const { data: exams = [], isLoading } = useCourseExams(courseId);
  const createExam = useCreateCourseExam(courseId);
  const addQuestion = useAddCourseExamQuestion(courseId, 0);
  const updateQuestion = useUpdateCourseExamQuestion(courseId, 0, 0);
  const deleteQuestion = useDeleteCourseExamQuestion(courseId, 0);
  const submitAttempt = useSubmitCourseExamAttempt(courseId, 0);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDuration, setNewDuration] = useState(30);
  const [newPoints, setNewPoints] = useState(100);

  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [showQForm, setShowQForm] = useState(false);
  const [qText, setQText] = useState("");
  const [qType, setQType] = useState<"mc" | "tf" | "complete">("mc");
  const [qOptions, setQOptions] = useState(["", "", "", ""]);
  const [qCorrect, setQCorrect] = useState(0);
  const [qPoints, setQPoints] = useState(10);
  const [editingQId, setEditingQId] = useState<number | null>(null);

  const [attemptsExamId, setAttemptsExamId] = useState<number | null>(null);
  const examDetail = useCourseExamDetail(courseId, selectedExamId || 0);
  const attemptsData = useCourseExamAttempts(courseId, attemptsExamId || 0);

  const resetQ = () => { setQText(""); setQType("mc"); setQCorrect(0); setQPoints(10); setQOptions(["", "", "", ""]); setEditingQId(null); };
  const showAddQ = () => { resetQ(); setShowQForm(true); };

  const handleCreateExam = async () => {
    if (!newTitle.trim()) { toast({ title: "العنوان مطلوب", variant: "destructive" }); return; }
    try { await createExam.mutateAsync({ title: newTitle, description: newDesc, durationMinutes: newDuration, totalPoints: newPoints }); setNewTitle(""); setNewDesc(""); setShowCreate(false); toast({ title: "تم إنشاء الامتحان" }); } catch (e: any) { toast({ title: e?.message || "خطأ", variant: "destructive" }); }
  };

  const handleAddQ = async () => {
    if (!qText.trim()) { toast({ title: "نص السؤال مطلوب", variant: "destructive" }); return; }
    if (qType === "mc" && qOptions.some((o) => !o.trim())) { toast({ title: "جميع الخيارات مطلوبة", variant: "destructive" }); return; }
    if (!selectedExamId) return;
    try { await addQuestion.mutateAsync({ text: qText, options: qOptions.filter((o) => o.trim()), correctIndex: qCorrect, points: qPoints, type: qType }); resetQ(); toast({ title: "تم إضافة السؤال" }); } catch (e: any) { toast({ title: e?.message || "خطأ", variant: "destructive" }); }
  };

  const handleUpdateQ = async () => {
    if (!qText.trim() || !selectedExamId || editingQId === null) return;
    try { await updateQuestion.mutateAsync({ text: qText, options: qOptions.filter((o) => o.trim()), correctIndex: qCorrect, points: qPoints, type: qType }); setEditingQId(null); setShowQForm(false); toast({ title: "تم تحديث السؤال" }); } catch (e: any) { toast({ title: e?.message || "خطأ", variant: "destructive" }); }
  };

  const handleDeleteQ = async (qid: number) => {
    if (!selectedExamId || !confirm("هل أنت متأكد؟")) return;
    try { await deleteQuestion.mutateAsync(qid); toast({ title: "تم حذف السؤال" }); } catch (e: any) { toast({ title: e?.message || "خطأ", variant: "destructive" }); }
  };

  const openEditQ = (q: any) => { setEditingQId(q.id); setQText(q.text); setQType(q.type); setQCorrect(q.correct_index); setQPoints(q.points); setQOptions(q.options || [""]); setShowQForm(true); };

  const questionOpts = qType === "tf" ? ["صح", "خطأ"] : qType === "complete" ? [qOptions[0] || ""] : qOptions;
  const exam = examDetail.data;
  const questions = exam?.questions || [];

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">امتحانات الكورس</h1>
        <Button onClick={() => setShowCreate(true)}><Plus className="me-2 h-4 w-4" />امتحان جديد</Button>
      </div>

      {!isLoading && exams.length === 0 && <div className="text-center text-muted-foreground py-12">لا توجد امتحانات بعد</div>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {exams.map((exam: any) => (
          <motion.div key={exam.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div><h3 className="font-bold text-lg">{exam.title}</h3><p className="text-sm text-muted-foreground">المدة: {exam.duration_minutes}د | النقاط: {exam.total_points}</p></div>
              <Badge variant={exam.is_open ? "default" : "secondary"}>{exam.is_open ? "مفتوح" : "مغلق"}</Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setSelectedExamId(exam.id); setShowQForm(false); }}><Eye className="h-4 w-4" /> الأسئلة</Button>
              <Button variant="outline" size="sm" onClick={() => setAttemptsExamId(exam.id)}><Users className="h-4 w-4" /> المحاولات</Button>
            </div>
            <p className="text-xs text-muted-foreground">عدد الأسئلة: {questions.length}</p>
          </motion.div>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>إنشاء امتحان جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>العنوان</Label><Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} /></div>
            <div><Label>الوصف</Label><Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>المدة (دقائق)</Label><Input type="number" value={newDuration} onChange={(e) => setNewDuration(Number(e.target.value))} /></div>
              <div><Label>النقاط</Label><Input type="number" value={newPoints} onChange={(e) => setNewPoints(Number(e.target.value))} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setShowCreate(false)}>إلغاء</Button><Button onClick={handleCreateExam} disabled={createExam.isPending}>{createExam.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}إنشاء</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showQForm} onOpenChange={setShowQForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingQId ? "تعديل سؤال" : "إضافة سؤال"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>نوع السؤال</Label><select className="w-full border rounded-md p-2" value={qType} onChange={(e) => setQType(e.target.value as any)}><option value="mc">اختيار متعدد</option><option value="tf">صح / خطأ</option><option value="complete">إكمال</option></select></div>
            <div><Label>نص السؤال</Label><Textarea value={qText} onChange={(e) => setQText(e.target.value)} /></div>
            {qType === "mc" && <div><Label>الخيارات</Label>{qOptions.map((opt, i) => <div key={i} className="flex gap-2 mt-1"><Input value={opt} onChange={(e) => { const n = [...qOptions]; n[i] = e.target.value; setQOptions(n); }} placeholder={`الخيار ${i + 1}`} /><Button variant="ghost" size="sm" onClick={() => setQOptions(qOptions.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button></div>)}<Button variant="outline" size="sm" className="mt-1" onClick={() => setQOptions([...qOptions, ""])}>+ إضافة خيار</Button></div>}
            {qType === "tf" && <div className="flex gap-4"><label className="flex items-center gap-1"><input type="radio" checked={qCorrect === 0} onChange={() => setQCorrect(0)} /> صح</label><label className="flex items-center gap-1"><input type="radio" checked={qCorrect === 1} onChange={() => setQCorrect(1)} /> خطأ</label></div>}
            {qType === "complete" && <div><Label>الإجابة الصحيحة</Label><Input value={qOptions[0] || ""} onChange={(e) => setQOptions([e.target.value])} /></div>}
            <div><Label>النقاط</Label><Input type="number" value={qPoints} onChange={(e) => setQPoints(Number(e.target.value))} /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setShowQForm(false)}>إلغاء</Button>{editingQId ? <Button onClick={handleUpdateQ} disabled={updateQuestion.isPending}>تحديث</Button> : <Button onClick={handleAddQ} disabled={addQuestion.isPending}>إضافة</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!attemptsExamId} onOpenChange={() => setAttemptsExamId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>محاولات الامتحان</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-96 overflow-auto">{(attemptsData.data || []).map((a: any) => <div key={a.id} className="flex justify-between border rounded p-2"><span>المستخدم #{a.user_id}</span><span>{a.score}/{a.total}</span></div>)}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
