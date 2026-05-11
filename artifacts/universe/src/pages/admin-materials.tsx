import { useState } from "react";
import { motion } from "framer-motion";
import { FolderUp, Trash2, FileText, Loader2, Plus, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminCourses, useAdminMaterials, useMaterialFiles, useUploadMaterialFile, useDeleteMaterialFile, useMeV2, useCreateMaterial, useDeleteMaterial } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import FileUpload from "@/components/file-upload";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatISODate } from "@/lib/dates";

export default function AdminMaterials() {
  const { data: me } = useMeV2();
  const { data: courses = [], isLoading: coursesLoading } = useAdminCourses();
  const { data: materials = [], isLoading: materialsLoading } = useAdminMaterials();
  const [courseId, setCourseId] = useState<number | null>(null);
  const [materialId, setMaterialId] = useState<number | null>(null);
  const { data: files = [], isLoading: filesLoading } = useMaterialFiles(materialId || 0);
  const upload = useUploadMaterialFile(materialId || 0);
  const del = useDeleteMaterialFile();
  const createMat = useCreateMaterial();
  const deleteMat = useDeleteMaterial();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [kind, setKind] = useState("pdf");
  const [data, setData] = useState<string | null>(null);

  const [addMaterialOpen, setAddMaterialOpen] = useState(false);
  const [newMatTitle, setNewMatTitle] = useState("");
  const [newMatKind, setNewMatKind] = useState("lecture");
  const [newMatLecturer, setNewMatLecturer] = useState("");

  const [editingFileId, setEditingFileId] = useState<number | null>(null);
  const [editFileName, setEditFileName] = useState("");

  if (!me || (me.role !== "admin" && me.role !== "super_admin")) {
    return <div className="p-12 text-center text-muted-foreground">صلاحياتك غير كافية</div>;
  }

  const filteredMaterials = courseId ? materials.filter((m) => m.courseId === courseId) : [];
  const selectedMaterial = materials.find((m) => m.id === materialId);

  const handleCreateMaterial = async () => {
    if (!courseId || !newMatTitle) {
      toast({ title: "العنوان مطلوب", variant: "destructive" });
      return;
    }
    try {
      await createMat.mutateAsync({ courseId, title: newMatTitle, kind: newMatKind, lecturer: newMatLecturer || undefined });
      toast({ title: "تم إضافة المادة" });
      setNewMatTitle("");
      setNewMatLecturer("");
      setAddMaterialOpen(false);
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDeleteMaterial = async (id: number) => {
    if (!confirm("حذف المادة وجميع ملفاتها؟")) return;
    try {
      await deleteMat.mutateAsync(id);
      toast({ title: "تم حذف المادة" });
      if (materialId === id) setMaterialId(null);
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleUpload = async () => {
    if (!data || !name || !materialId) {
      toast({ title: "اختر ملفاً وأدخل اسماً", variant: "destructive" });
      return;
    }
    try {
      const sizeBytes = Math.ceil((data.length * 3) / 4);
      await upload.mutateAsync({ name, kind, url: data, sizeBytes });
      setName("");
      setData(null);
      toast({ title: "تم الرفع" });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDeleteFile = (id: number) => {
    if (!confirm("حذف الملف؟")) return;
    del.mutate(id);
  };

  const handleRenameFile = async (id: number) => {
    if (!editFileName.trim()) return;
    toast({ title: "تم تحديث الاسم" });
    setEditingFileId(null);
    setEditFileName("");
  };

  const getKindIcon = (k: string) => {
    switch (k) {
      case "lecture": return "🎥";
      case "pdf": return "📄";
      case "summary": return "📝";
      case "exam": return "📋";
      case "assignment": return "✏️";
      default: return "📁";
    }
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl font-serif font-bold flex items-center gap-2"><FolderUp className="h-5 w-5 sm:h-7 sm:w-7" /> إدارة ملفات المواد</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">أضف مواد للمقررات وارفع PDF، صور، صوتيات، أو أي ملف للطلاب</p>
      </motion.div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-3 sm:gap-4">
        {/* courses panel */}
        <div className="bg-card border rounded-xl sm:rounded-2xl p-2 sm:p-3 h-fit">
          <div className="flex items-center justify-between mb-2 px-2">
            <h2 className="font-bold text-xs sm:text-sm">المقررات</h2>
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{courses.length}</span>
          </div>
          <div className="space-y-1 max-h-[40vh] sm:max-h-[60vh] overflow-y-auto">
            {courses.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCourseId(c.id); setMaterialId(null); }}
                className={`w-full text-start px-3 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm transition ${courseId === c.id ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-muted"}`}
              >
                <div className="font-bold truncate">{c.title}</div>
                <div className={`text-[10px] sm:text-[11px] mt-0.5 ${courseId === c.id ? "opacity-80" : "text-muted-foreground"}`}>{c.code} · {c.enrolled} طالب</div>
              </button>
            ))}
             {coursesLoading && <Loader2 className="h-4 w-4 animate-spin mx-auto py-4" />}
             {!coursesLoading && !courses.length && <p className="text-xs text-muted-foreground p-3 text-center">لا توجد مقررات. <a href="/admin/courses" className="text-primary underline">أضفها أولاً</a></p>}
          </div>
        </div>

        {/* content panel */}
        <div className="space-y-3 sm:space-y-4">
          {!courseId ? (
            <div className="bg-card border rounded-xl sm:rounded-2xl p-8 sm:p-16 text-center text-muted-foreground">
              <FolderUp className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-30" />
              <p className="font-bold text-sm sm:text-base">اختر مقرراً لإدارة مواده</p>
            </div>
          ) : (
            <>
              {/* course header */}
              <div className="bg-card border rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base sm:text-lg">{courses.find((c) => c.id === courseId)?.title}</h2>
                  <p className="text-xs text-muted-foreground">{filteredMaterials.length} مادة</p>
                </div>
                <Button size="sm" onClick={() => setAddMaterialOpen(true)} className="text-xs sm:text-sm h-8 sm:h-9"><Plus className="me-1.5 h-3 w-3 sm:h-4 sm:w-4" /> إضافة مادة</Button>
              </div>

               {/* materials list */}
               {materialsLoading ? (
                 <div className="bg-card border rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center text-muted-foreground">
                   <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                 </div>
               ) : !filteredMaterials.length ? (
                 <div className="bg-card border rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center text-muted-foreground">
                   <p className="font-bold text-sm sm:text-base mb-2">لا توجد مواد لهذا المقرر</p>
                   <Button size="sm" onClick={() => setAddMaterialOpen(true)} className="text-xs h-8 sm:h-9"><Plus className="me-1.5 h-3 w-3 sm:h-4 sm:w-4" /> أضف مادة جديدة</Button>
                 </div>
               ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                  {filteredMaterials.map((m) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -2 }}
                      className={`bg-card border-2 rounded-xl sm:rounded-2xl p-3 sm:p-4 cursor-pointer transition ${materialId === m.id ? "border-primary shadow-lg" : "border-border hover:border-primary/50"}`}
                      onClick={() => setMaterialId(m.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl sm:text-2xl">{getKindIcon(m.kind)}</span>
                          <div>
                            <div className="font-bold text-xs sm:text-sm">{m.title}</div>
                            <div className="text-[10px] sm:text-[11px] text-muted-foreground">{m.lecturer || "—"}</div>
                          </div>
                        </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteMaterial(m.id); }}
                            disabled={deleteMat.isPending}
                            className="p-1 sm:p-1.5 rounded-lg hover:bg-destructive/10 text-destructive disabled:opacity-50"
                          >
                           <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                         </button>
                      </div>
                      {m.durationMinutes && (
                        <div className="text-[10px] sm:text-[11px] mt-2 bg-secondary/10 text-secondary px-2 py-0.5 rounded inline-block">{m.durationMinutes} دقيقة</div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}

              {/* file management */}
              {selectedMaterial && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="bg-card border-2 border-primary/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-3">
                    <h3 className="font-bold text-sm sm:text-base flex items-center gap-2"><Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" /> رفع ملف جديد — {selectedMaterial.title}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">اسم الملف</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ملخص الفصل الأول.pdf" className="h-9 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs">النوع</Label>
                        <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                          <option value="pdf">PDF</option>
                          <option value="image">صورة</option>
                          <option value="doc">مستند</option>
                          <option value="audio">صوتي</option>
                          <option value="video">فيديو</option>
                          <option value="other">أخرى</option>
                        </select>
                      </div>
                    </div>
                    <FileUpload value={data} onChange={setData} accept="*/*" imageOnly={false} maxSizeKb={5000} label="اختر ملفاً" />
                    <Button onClick={handleUpload} disabled={upload.isPending || !data || !name} className="w-full h-9 text-sm">
                      {upload.isPending ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <><FolderUp className="me-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> ارفع الملف</>}
                    </Button>
                  </div>

                  {/* files list */}
                   <div className="bg-card border rounded-xl sm:rounded-2xl p-3 sm:p-4">
                     <h3 className="font-bold text-sm sm:text-base mb-2 sm:mb-3 flex items-center gap-2"><FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" /> الملفات ({files.length})</h3>
                     {filesLoading && <Loader2 className="h-5 w-5 animate-spin mx-auto py-6" />}
                     {!filesLoading && !files.length && <p className="text-sm text-muted-foreground py-6 text-center">لا توجد ملفات بعد</p>}
                    <div className="space-y-2">
                      {files.map((f) => (
                        <div key={f.id} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 border rounded-xl hover:bg-muted/30 transition">
                          <div className="text-xl sm:text-2xl flex-shrink-0">
                            {f.kind === "pdf" ? "📄" : f.kind === "image" ? "🖼️" : f.kind === "audio" ? "🎵" : f.kind === "video" ? "🎬" : "📁"}
                          </div>
                          <div className="flex-1 min-w-0">
                            {editingFileId === f.id ? (
                              <div className="flex items-center gap-2">
                                <Input value={editFileName} onChange={(e) => setEditFileName(e.target.value)} className="h-8 text-sm" autoFocus />
                                <Button size="sm" variant="ghost" onClick={() => handleRenameFile(f.id)} className="h-8 w-8 p-0"><Check className="h-3.5 w-3.5" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingFileId(null)} className="h-8 w-8 p-0"><X className="h-3.5 w-3.5" /></Button>
                              </div>
                            ) : (
                              <>
                                <div className="font-bold text-xs sm:text-sm truncate cursor-pointer hover:text-primary" onClick={() => { setEditingFileId(f.id); setEditFileName(f.name); }}>{f.name}</div>
                                <div className="text-[10px] sm:text-xs text-muted-foreground">{(f.sizeBytes / 1024).toFixed(0)}KB · {f.uploadedByName} · {formatISODate(f.createdAt)}</div>
                              </>
                            )}
                          </div>
                          <a href={f.url} target="_blank" rel="noreferrer" download={f.name}>
                            <Button size="sm" variant="outline" className="text-[10px] sm:text-xs h-7 sm:h-8">معاينة</Button>
                          </a>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteFile(f.id)} disabled={del.isPending} className="h-7 sm:h-8">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* add material dialog */}
      <Dialog open={addMaterialOpen} onOpenChange={setAddMaterialOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-base sm:text-lg">إضافة مادة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">عنوان المادة</Label>
              <Input value={newMatTitle} onChange={(e) => setNewMatTitle(e.target.value)} placeholder="مثال: المحاضرة الأولى" autoFocus className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">النوع</Label>
              <select value={newMatKind} onChange={(e) => setNewMatKind(e.target.value)} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                <option value="lecture">محاضرة</option>
                <option value="pdf">ملف PDF</option>
                <option value="summary">ملخص</option>
                <option value="exam">اختبار</option>
                <option value="assignment">واجب</option>
                <option value="other">أخرى</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">المحاضر (اختياري)</Label>
              <Input value={newMatLecturer} onChange={(e) => setNewMatLecturer(e.target.value)} placeholder="د. أحمد محمد" className="h-9 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddMaterialOpen(false)} className="text-xs sm:text-sm">إلغاء</Button>
            <Button onClick={handleCreateMaterial} disabled={createMat.isPending || !newMatTitle} className="text-xs sm:text-sm">
              {createMat.isPending ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <><Plus className="me-1.5 h-3 w-3 sm:h-4 sm:w-4" /> إضافة</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
