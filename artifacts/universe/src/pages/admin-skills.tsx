import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, BookOpen, Trash2, Pencil, ChevronDown, ChevronUp, Save, X, Clock, Brain, FlaskConical, Briefcase, UserCheck, ArrowLeft, Target, PlayCircle, FileText, Trophy, Award } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useMeV2, useAdminSkillTracks, useCreateAdminSkillTrack, useUpdateAdminSkillTrack, useDeleteAdminSkillTrack,
  useCreateAdminSkillLesson, useUpdateAdminSkillLesson, useDeleteAdminSkillLesson,
} from "@/lib/api";

const CATEGORIES = [
  { key: "academic", label: "أكاديمية", icon: Brain },
  { key: "practical", label: "عملية", icon: FlaskConical },
  { key: "career", label: "سوق العمل", icon: Briefcase },
  { key: "soft_skills", label: "مهارات شخصية", icon: UserCheck },
];
const DIFFICULTIES = ["beginner", "intermediate", "advanced"];
const LESSON_KINDS = ["lesson", "quiz", "practice", "challenge", "lab", "visual", "task"];

const emptyTrackForm = () => ({
  title: "", category: "academic", description: "", difficulty: "beginner",
  coverUrl: "", yearInCollege: 0, prerequisites: "",
});
const emptyLessonForm = () => ({
  title: "", durationMinutes: 10, kind: "lesson", ord: 0,
});

export default function AdminSkills() {
  const { data: me, isLoading: meLoading, error: meError } = useMeV2();
  const { data: tracks = [], isLoading } = useAdminSkillTracks();


  const createTrack = useCreateAdminSkillTrack();
  const updateTrack = useUpdateAdminSkillTrack();
  const deleteTrack = useDeleteAdminSkillTrack();
  const createLesson = useCreateAdminSkillLesson();
  const updateLesson = useUpdateAdminSkillLesson();
  const deleteLesson = useDeleteAdminSkillLesson();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [trackForm, setTrackForm] = useState(emptyTrackForm());
  const [lessonForm, setLessonForm] = useState(emptyLessonForm());
  const [editTrackId, setEditTrackId] = useState<number | null>(null);
  const [editLessonId, setEditLessonId] = useState<number | null>(null);
  const [expandedTrack, setExpandedTrack] = useState<number | null>(null);
  const [showTrackForm, setShowTrackForm] = useState(false);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [lessonTrackId, setLessonTrackId] = useState<number | null>(null);

  if (meLoading) {
    return <div className="p-12 text-center text-muted-foreground">جاري التحميل...</div>;
  }
  if (meError) {
    return <div className="p-12 text-center text-muted-foreground">خطأ في تحميل البيانات: {(meError as Error).message}</div>;
  }
  if (!me || (me.role !== "admin" && me.role !== "super_admin")) {
    return <div className="p-12 text-center text-muted-foreground">صلاحياتك غير كافية</div>;
  }

  const resetTrackForm = () => { setTrackForm(emptyTrackForm()); setEditTrackId(null); setShowTrackForm(false); };
  const openEditTrack = (t: any) => {
    setTrackForm({ title: t.title, category: t.category, description: t.description, difficulty: t.difficulty, coverUrl: t.coverUrl || "", yearInCollege: t.yearInCollege || 0, prerequisites: (t.prerequisites || []).join(",") });
    setEditTrackId(t.id); setShowTrackForm(true);
  };
  const openNewLesson = (trackId: number) => {
    setLessonForm(emptyLessonForm());
    setEditLessonId(null);
    setLessonTrackId(trackId);
    setShowLessonForm(true);
  };
  const openEditLesson = (l: any) => {
    setLessonForm({ title: l.title, durationMinutes: l.durationMinutes, kind: l.kind, ord: l.ord });
    setEditLessonId(l.id);
    setLessonTrackId(l.trackId);
    setShowLessonForm(true);
  };

  const saveTrack = async () => {
    if (!trackForm.title) { toast({ title: "العنوان مطلوب", variant: "destructive" }); return; }
    try {
      const data: any = { title: trackForm.title, category: trackForm.category, description: trackForm.description, difficulty: trackForm.difficulty, coverUrl: trackForm.coverUrl || undefined, yearInCollege: Number(trackForm.yearInCollege) || 0, prerequisites: trackForm.prerequisites ? trackForm.prerequisites.split(",").map(Number).filter(Boolean) : [] };
      if (editTrackId) await updateTrack.mutateAsync({ id: editTrackId, ...data });
      else await createTrack.mutateAsync(data);
      toast({ title: editTrackId ? "تم تحديث المسار" : "تم إنشاء المسار" });
      resetTrackForm();
    } catch (e) { toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" }); }
  };

  const saveLesson = async () => {
    if (!lessonForm.title || !lessonTrackId) { toast({ title: "العنوان مطلوب", variant: "destructive" }); return; }
    try {
      const data: any = { trackId: lessonTrackId, title: lessonForm.title, durationMinutes: Number(lessonForm.durationMinutes) || 10, kind: lessonForm.kind, ord: Number(lessonForm.ord) || 0 };
      if (editLessonId) await updateLesson.mutateAsync({ id: editLessonId, ...data });
      else await createLesson.mutateAsync(data);
      toast({ title: editLessonId ? "تم تحديث الدرس" : "تم إضافة الدرس" });
      setShowLessonForm(false);
    } catch (e) { toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" }); }
  };

  const removeTrack = async (id: number) => {
    if (!confirm("حذف المسار نهائيًا؟")) return;
    try { await deleteTrack.mutateAsync(id); toast({ title: "تم الحذف" }); } catch (e) { toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" }); }
  };

  const removeLesson = async (id: number) => {
    if (!confirm("حذف الدرس نهائيًا؟")) return;
    try { await deleteLesson.mutateAsync(id); toast({ title: "تم الحذف" }); } catch (e) { toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" }); }
  };

  const CatIcon = (cat: string) => CATEGORIES.find((c) => c.key === cat)?.icon || BookOpen;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        <button onClick={() => setLocation("/admin")} className="inline-flex items-center text-xs sm:text-sm text-muted-foreground hover:text-primary mb-3 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5 ml-1" />
          العودة للوحة التحكم
        </button>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="font-bold text-lg">إدارة المهارات</h1>
          </div>
          <Button size="sm" onClick={() => { resetTrackForm(); setShowTrackForm(true); }} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> مسار جديد
          </Button>
        </div>

        {/* Track Form Dialog */}
        <AnimatePresence>
          {showTrackForm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
              <div className="w-full max-w-lg bg-card border rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-base">{editTrackId ? "تعديل المسار" : "مسار جديد"}</h2>
                  <button onClick={resetTrackForm}><X className="h-4 w-4 text-muted-foreground" /></button>
                </div>
                <div className="space-y-2">
                  <div><Label className="text-xs">العنوان</Label><Input value={trackForm.title} onChange={(e) => setTrackForm((f) => ({ ...f, title: e.target.value }))} className="h-9 text-sm" /></div>
                  <div><Label className="text-xs">الوصف</Label><Textarea value={trackForm.description} onChange={(e) => setTrackForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="text-sm" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">التصنيف</Label>
                      <select value={trackForm.category} onChange={(e) => setTrackForm((f) => ({ ...f, category: e.target.value }))} className="w-full h-9 text-sm bg-background border rounded-lg px-2">
                        {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                    </div>
                    <div><Label className="text-xs">الصعوبة</Label>
                      <select value={trackForm.difficulty} onChange={(e) => setTrackForm((f) => ({ ...f, difficulty: e.target.value }))} className="w-full h-9 text-sm bg-background border rounded-lg px-2">
                        {DIFFICULTIES.map((d) => <option key={d} value={d}>{d === "beginner" ? "مبتدئ" : d === "intermediate" ? "متوسط" : "متقدم"}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">السنة الدراسية</Label><Input type="number" min={0} max={4} value={trackForm.yearInCollege} onChange={(e) => setTrackForm((f) => ({ ...f, yearInCollege: Number(e.target.value) }))} className="h-9 text-sm" /></div>
                    <div><Label className="text-xs">رابط الصورة</Label><Input value={trackForm.coverUrl} onChange={(e) => setTrackForm((f) => ({ ...f, coverUrl: e.target.value }))} className="h-9 text-sm" /></div>
                  </div>
                  <div><Label className="text-xs">متطلبات مسبقة (ids مفصولة بفاصلة)</Label><Input value={trackForm.prerequisites} onChange={(e) => setTrackForm((f) => ({ ...f, prerequisites: e.target.value }))} className="h-9 text-sm" /></div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button size="sm" variant="outline" onClick={resetTrackForm}>إلغاء</Button>
                  <Button size="sm" onClick={saveTrack} disabled={createTrack.isPending || updateTrack.isPending}>{editTrackId ? "تحديث" : "إنشاء"}</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lesson Form Dialog */}
        <AnimatePresence>
          {showLessonForm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
              <div className="w-full max-w-md bg-card border rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-base">{editLessonId ? "تعديل الدرس" : "درس جديد"}</h2>
                  <button onClick={() => setShowLessonForm(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
                </div>
                <div className="space-y-2">
                  <div><Label className="text-xs">العنوان</Label><Input value={lessonForm.title} onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))} className="h-9 text-sm" /></div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-xs">المدة (د)</Label><Input type="number" min={1} value={lessonForm.durationMinutes} onChange={(e) => setLessonForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))} className="h-9 text-sm" /></div>
                    <div><Label className="text-xs">الترتيب</Label><Input type="number" min={0} value={lessonForm.ord} onChange={(e) => setLessonForm((f) => ({ ...f, ord: Number(e.target.value) }))} className="h-9 text-sm" /></div>
                    <div><Label className="text-xs">النوع</Label>
                      <select value={lessonForm.kind} onChange={(e) => setLessonForm((f) => ({ ...f, kind: e.target.value }))} className="w-full h-9 text-sm bg-background border rounded-lg px-2">
                        {LESSON_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button size="sm" variant="outline" onClick={() => setShowLessonForm(false)}>إلغاء</Button>
                  <Button size="sm" onClick={saveLesson} disabled={createLesson.isPending || updateLesson.isPending}>{editLessonId ? "تحديث" : "إضافة"}</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tracks List */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">جاري التحميل...</div>
        ) : tracks.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed rounded-2xl">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">لا توجد مسارات مهارات بعد</p>
            <Button size="sm" className="mt-3" onClick={() => { resetTrackForm(); setShowTrackForm(true); }}>أضف أول مسار</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {tracks.map((track, i) => {
              const expanded = expandedTrack === track.id;
              const catMeta = CATEGORIES.find((c) => c.key === track.category);
              const Icon = catMeta?.icon || BookOpen;
              return (
                <motion.div
                  key={track.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="bg-card border rounded-xl overflow-hidden"
                >
                  <div className="p-3 sm:p-4 flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm truncate">{track.title}</h3>
                        <Badge variant="outline" className="text-[9px]">{catMeta?.label || track.category}</Badge>
                        <Badge variant="outline" className="text-[9px]">{track.difficulty === "beginner" ? "مبتدئ" : track.difficulty === "intermediate" ? "متوسط" : "متقدم"}</Badge>
                        {track.yearInCollege > 0 && <Badge variant="outline" className="text-[9px]">سنة {track.yearInCollege}</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{track.description}</p>
                      <div className="flex items-center gap-2 text-[9px] text-muted-foreground mt-1">
                        <span className="flex items-center gap-0.5"><PlayCircle className="h-2.5 w-2.5" />{track.lessons.length} درس</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditTrack(track)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => removeTrack(track.id)}><Trash2 className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setExpandedTrack(expanded ? null : track.id)}>
                        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t px-3 sm:px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted-foreground">الدروس</span>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => openNewLesson(track.id)}>
                          <Plus className="h-3 w-3" /> درس
                        </Button>
                      </div>
                      {track.lessons.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-4">لا توجد دروس</p>
                      ) : (
                        <div className="space-y-1">
                          {track.lessons.sort((a: any, b: any) => a.ord - b.ord).map((lesson: any) => (
                            <div key={lesson.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                              <div className="p-0.5 rounded bg-background">
                                {lesson.kind === "lesson" && <PlayCircle className="h-3 w-3 text-primary" />}
                                {lesson.kind === "practice" && <Target className="h-3 w-3 text-blue-500" />}
                                {lesson.kind === "quiz" && <FileText className="h-3 w-3 text-amber-500" />}
                                {lesson.kind === "challenge" && <Trophy className="h-3 w-3 text-amber-600" />}
                                {lesson.kind === "lab" && <FlaskConical className="h-3 w-3 text-emerald-500" />}
                                {lesson.kind === "visual" && <Award className="h-3 w-3 text-purple-500" />}
                              </div>
                              <span className="flex-1 truncate">{lesson.title}</span>
                              <span className="flex items-center gap-0.5 text-muted-foreground"><Clock className="h-2.5 w-2.5" />{lesson.durationMinutes}د</span>
                              <Badge variant="outline" className="text-[8px]">{lesson.kind}</Badge>
                              <span className="text-muted-foreground">#{lesson.ord}</span>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEditLesson(lesson)}><Pencil className="h-2.5 w-2.5" /></Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => removeLesson(lesson.id)}><Trash2 className="h-2.5 w-2.5" /></Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}