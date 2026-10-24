import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ExternalLink, EyeOff, FolderKanban, Github, Globe,
  Loader2, Pencil, Plus, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  useCreatePortfolioProject, useDeletePortfolioProject,
  useMyPortfolio, useUpdatePortfolioProject,
  type PortfolioProject, type PortfolioProjectInput,
} from "@/lib/api";

type FormState = {
  title: string;
  description: string;
  role: string;
  projectUrl: string;
  repoUrl: string;
  imageUrl: string;
  tags: string;
  visibility: "public" | "private";
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  role: "",
  projectUrl: "",
  repoUrl: "",
  imageUrl: "",
  tags: "",
  visibility: "public",
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("ar-EG", { year: "numeric", month: "short" });
  } catch {
    return "—";
  }
}

export default function PortfolioPage() {
  const { toast } = useToast();
  const { data: projects = [], isLoading } = useMyPortfolio();
  const createProject = useCreatePortfolioProject();
  const updateProject = useUpdatePortfolioProject();
  const deleteProject = useDeletePortfolioProject();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PortfolioProject | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const publicCount = projects.filter((p) => p.visibility === "public").length;
  const saving = createProject.isPending || updateProject.isPending;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(project: PortfolioProject) {
    setEditing(project);
    setForm({
      title: project.title,
      description: project.description ?? "",
      role: project.role ?? "",
      projectUrl: project.projectUrl ?? "",
      repoUrl: project.repoUrl ?? "",
      imageUrl: project.imageUrl ?? "",
      tags: (project.tags ?? []).join(", "),
      visibility: project.visibility === "private" ? "private" : "public",
    });
    setOpen(true);
  }

  function save() {
    const title = form.title.trim();
    if (title.length < 2) {
      toast({ title: "عنوان المشروع مطلوب", variant: "destructive" });
      return;
    }
    const body: PortfolioProjectInput = {
      title,
      description: form.description.trim(),
      role: form.role.trim(),
      projectUrl: form.projectUrl.trim(),
      repoUrl: form.repoUrl.trim(),
      imageUrl: form.imageUrl.trim(),
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      visibility: form.visibility,
    };
    const onError = (e: any) =>
      toast({ title: e?.message || "تعذر حفظ المشروع", variant: "destructive" });
    if (editing) {
      updateProject.mutate(
        { id: editing.id, ...body },
        {
          onSuccess: () => {
            toast({ title: "تم تحديث المشروع" });
            setOpen(false);
          },
          onError,
        },
      );
    } else {
      createProject.mutate(body, {
        onSuccess: () => {
          toast({ title: "تمت إضافة المشروع" });
          setOpen(false);
        },
        onError,
      });
    }
  }

  function remove(project: PortfolioProject) {
    if (!window.confirm(`حذف مشروع "${project.title}"؟`)) return;
    deleteProject.mutate(project.id, {
      onSuccess: () => toast({ title: "تم حذف المشروع" }),
      onError: (e: any) => toast({ title: e?.message || "تعذر حذف المشروع", variant: "destructive" }),
    });
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl space-y-4 sm:space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-teal-700 to-emerald-900 text-white p-4 sm:p-6"
      >
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -right-10 w-52 h-52 rounded-full bg-white/5" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0 border border-white/20">
            <FolderKanban className="h-6 w-6 text-emerald-50" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="font-bold text-lg sm:text-xl">معرض الأعمال</h1>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/15 text-emerald-50 border border-white/20">معرض أعمالك على UniVerse</span>
            </div>
            <p className="text-[11px] sm:text-xs text-emerald-50/90 max-w-xl">
              اعرض مشاريعك وأعمالك جانب شهاداتك في جواز المهارات — عشان أصحاب الفرص يشوفوا شغلك الحقيقي.
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <div className="flex gap-2">
              <Button onClick={openCreate} size="sm" className="bg-white text-emerald-800 hover:bg-emerald-50 gap-1 h-8 text-[11px]">
                <Plus className="h-3.5 w-3.5" /> مشروع جديد
              </Button>
            </div>
            <div className="flex gap-2">
              <span className="rounded-xl bg-white/10 backdrop-blur px-3 py-1.5 text-center min-w-14 border border-white/15 flex-1">
                <span className="font-bold text-sm leading-none block">{projects.length}</span>
                <span className="text-[9px] text-emerald-100/80">مشروع</span>
              </span>
              <span className="rounded-xl bg-white/10 backdrop-blur px-3 py-1.5 text-center min-w-14 border border-white/15 flex-1">
                <span className="font-bold text-sm leading-none block">{publicCount}</span>
                <span className="text-[9px] text-emerald-100/80">عام</span>
              </span>
              <span className="rounded-xl bg-white/10 backdrop-blur px-3 py-1.5 text-center min-w-14 border border-white/15 flex-1">
                <span className="font-bold text-sm leading-none block">{projects.length - publicCount}</span>
                <span className="text-[9px] text-emerald-100/80">خاص</span>
              </span>
            </div>
            <Link href="/passport" className="text-[10px] text-emerald-100/90 hover:text-white transition text-center">
              شوف مشاريعك في جواز المهارات →
            </Link>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="py-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
        </div>
      ) : projects.length === 0 ? (
        <div className="border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center">
          <FolderKanban className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <h2 className="font-bold text-sm sm:text-base mb-1">لسه مفيش مشاريع</h2>
          <p className="text-xs text-muted-foreground mb-4">
            ضيف أول مشروع ليك — سواء مشروع تخرج، تطبيق، تصميم، أو أي حاجة اشتغلت عليها.
          </p>
          <Button onClick={openCreate} size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> أضف مشروعك الأول
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {projects.map((project) => (
            <motion.article
              key={project.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border rounded-2xl overflow-hidden flex flex-col hover:shadow-md hover:border-primary/30 transition"
            >
              {project.imageUrl && (
                <div className="relative h-36">
                  <img src={project.imageUrl} alt={project.title} className="w-full h-full object-cover" />
                  <span className={`absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] border font-bold ${project.visibility === "public" ? "bg-emerald-50/95 text-emerald-700 border-emerald-200" : "bg-slate-900/90 text-slate-100 border-slate-700"}`}>
                    {project.visibility === "public" ? <Globe className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                    {project.visibility === "public" ? "عام" : "خاص"}
                  </span>
                </div>
              )}
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold text-sm leading-snug min-w-0 break-words">{project.title}</h2>
                  {!project.imageUrl && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] border font-bold shrink-0 ${project.visibility === "public" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      {project.visibility === "public" ? <Globe className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                      {project.visibility === "public" ? "عام" : "خاص"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                  {project.role && (
                    <span className="text-[9px] rounded-full bg-primary/10 text-primary px-2 py-0.5 font-bold">{project.role}</span>
                  )}
                  <span className="text-[9px] text-muted-foreground">{fmtDate(project.createdAt)}</span>
                </div>
                {project.description && (
                  <p className="text-[11px] text-muted-foreground mt-2 line-clamp-3 leading-relaxed">{project.description}</p>
                )}
                {!!project.tags?.length && (
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {project.tags.map((tag) => (
                      <span key={tag} className="text-[9px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">#{tag}</span>
                    ))}
                  </div>
                )}
                {(project.projectUrl || project.repoUrl) && (
                  <div className="flex items-center gap-3 mt-3">
                    {project.projectUrl && (
                      <a href={project.projectUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" /> زيارة المشروع
                      </a>
                    )}
                    {project.repoUrl && (
                      <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                        <Github className="h-3 w-3" /> الكود
                      </a>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-auto pt-3 border-t mt-3">
                  <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 px-3" onClick={() => openEdit(project)}>
                    <Pencil className="h-3 w-3" /> تعديل
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px] gap-1 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={deleteProject.isPending}
                    onClick={() => remove(project)}
                  >
                    <Trash2 className="h-3 w-3" /> حذف
                  </Button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل المشروع" : "مشروع جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">عنوان المشروع *</Label>
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="مثال: تطبيق إدارة المزارع الذكي"
                maxLength={120}
              />
            </div>
            <div>
              <Label className="text-xs">دورك في المشروع</Label>
              <Input
                value={form.role}
                onChange={(e) => set("role", e.target.value)}
                placeholder="مثال: مطور واجهات أمامية"
                maxLength={80}
              />
            </div>
            <div>
              <Label className="text-xs">وصف المشروع</Label>
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="المشكلة اللي بيحلها، التقنيات المستخدمة، وإنجازاتك..."
                rows={4}
                maxLength={3000}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">رابط المشروع</Label>
                <Input dir="ltr" value={form.projectUrl} onChange={(e) => set("projectUrl", e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <Label className="text-xs">رابط الكود</Label>
                <Input dir="ltr" value={form.repoUrl} onChange={(e) => set("repoUrl", e.target.value)} placeholder="https://github.com/..." />
              </div>
            </div>
            <div>
              <Label className="text-xs">رابط صورة المشروع</Label>
              <Input dir="ltr" value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label className="text-xs">المهارات / الوسوم (فاصلة بينهم)</Label>
              <Input
                value={form.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="React, Node.js, UI/UX"
              />
            </div>
            <div>
              <Label className="text-xs">الظهور</Label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => set("visibility", "public")}
                  className={`flex-1 inline-flex items-center justify-center gap-1 text-[11px] rounded-lg border px-3 py-2 transition ${
                    form.visibility === "public" ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-bold" : "border-border text-muted-foreground"
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" /> عام — يظهر في الجواز
                </button>
                <button
                  type="button"
                  onClick={() => set("visibility", "private")}
                  className={`flex-1 inline-flex items-center justify-center gap-1 text-[11px] rounded-lg border px-3 py-2 transition ${
                    form.visibility === "private" ? "border-slate-500 bg-slate-100 text-slate-700 font-bold" : "border-border text-muted-foreground"
                  }`}
                >
                  <EyeOff className="h-3.5 w-3.5" /> خاص — ليك بس
                </button>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button size="sm" onClick={save} disabled={saving} className="gap-1">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editing ? "حفظ التعديلات" : "إضافة المشروع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
