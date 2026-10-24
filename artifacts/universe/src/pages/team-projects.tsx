import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  CircleCheck, CircleX, Loader2, Plus, Search, Send, Trash2, UserPlus, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  useCreateTeamProject, useDecideJoinRequest, useDeleteTeamProject,
  useJoinTeamProject, useTeamProjects, useUpdateTeamProject,
  type JoinRequestRow, type TeamProject as Project,
} from "@/lib/api";

const QUICK_ROLES = ["مطور", "مصمم UI", "محتوى", "تسويق", "مراجع", "CI/CD"];

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("ar-EG", { year: "numeric", month: "short" });
  } catch {
    return "—";
  }
}

export default function TeamProjectsPage() {
  const { toast } = useToast();
  const { data, isLoading } = useTeamProjects();
  const create = useCreateTeamProject();
  const update = useUpdateTeamProject();
  const removeProject = useDeleteTeamProject();
  const join = useJoinTeamProject();
  const decide = useDecideJoinRequest();

  const [tab, setTab] = useState<"all" | "mine">("all");
  const [q, setQ] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requestsFor, setRequestsFor] = useState<Project | null>(null);
  const [joinFor, setJoinFor] = useState<Project | null>(null);
  const [joinRole, setJoinRole] = useState("");
  const [joinMessage, setJoinMessage] = useState("");
  const [form, setForm] = useState({ title: "", description: "", lookingFor: "", tags: "" });

  const projects = data?.projects ?? [];
  const mine = projects.filter((p) => p.mine);
  const activeList = tab === "mine" ? mine : projects;
  const filtered = activeList
    .filter((p) => !openOnly || p.status === "open")
    .filter((p) => {
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return (
        p.title.toLowerCase().includes(needle) ||
        (p.description || "").toLowerCase().includes(needle) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(needle))
      );
    });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function saveProject() {
    const title = form.title.trim();
    if (title.length < 2) {
      toast({ title: "عنوان المشروع مطلوب", variant: "destructive" });
      return;
    }
    setSaving(true);
    create.mutate(
      {
        title,
        description: form.description.trim(),
        lookingFor: form.lookingFor.split(",").map((r) => r.trim()).filter(Boolean),
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      },
      {
        onSuccess: () => {
          toast({ title: "تم نشر المشروع — الطلبة من كل الكليات يقدروا ينضموا" });
          setCreateOpen(false);
          setForm({ title: "", description: "", lookingFor: "", tags: "" });
          setSaving(false);
        },
        onError: (e: any) => {
          toast({ title: e?.message || "تعذر نشر المشروع", variant: "destructive" });
          setSaving(false);
        },
      },
    );
  }

  function doJoin() {
    if (!joinFor) return;
    join.mutate(
      { id: joinFor.id, role: joinRole.trim(), message: joinMessage.trim() },
      {
        onSuccess: () => {
          toast({ title: "تبعت طلب الانضمام — صاحب المشروع هيحسمه" });
          setJoinFor(null);
          setJoinRole("");
          setJoinMessage("");
        },
        onError: (e: any) => toast({ title: e?.message || "تعذر إرسال الطلب", variant: "destructive" }),
      },
    );
  }

  function decideRequest(reqId: number, action: "accept" | "reject") {
    decide.mutate(
      { reqId, action },
      {
        onSuccess: () =>
          toast({ title: action === "accept" ? "تم قبول العضو في الفريق" : "تم رفض الطلب" }),
        onError: (e: any) => toast({ title: e?.message || "تعذر تحديد الطلب", variant: "destructive" }),
      },
    );
  }

  function toggleStatus(project: Project) {
    update.mutate(
      { id: project.id, status: project.status === "open" ? "closed" : "open" },
      {
        onSuccess: () => toast({ title: project.status === "open" ? "تم إقفال المشروع" : "المشروع مفتوح تاني" }),
        onError: (e: any) => toast({ title: e?.message || "تعذر تعديل حالة المشروع", variant: "destructive" }),
      },
    );
  }

  function remove(project: Project) {
    if (!window.confirm(`حذف مشروع "${project.title}"؟`)) return;
    removeProject.mutate(project.id, {
      onSuccess: () => toast({ title: "تم حذف المشروع" }),
      onError: (e: any) => toast({ title: e?.message || "تعذر حذف المشروع", variant: "destructive" }),
    });
  }

  function footer(project: Project) {
    if (project.mine) {
      return (
        <div className="flex items-center gap-2 pt-3 border-t">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] gap-1 px-3"
            onClick={() => setRequestsFor(requestsFor?.id === project.id ? null : project)}
          >
            <Users className="h-3 w-3" /> مقدمي الطلبات
            {project.pendingCount > 0 && <span className="text-[10px] text-red-600 font-bold">({project.pendingCount})</span>}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 px-3" onClick={() => toggleStatus(project)}>
            {project.status === "open" ? "إقفال" : "فتح"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[10px] gap-1 px-3 mr-auto text-red-600 hover:text-red-700 hover:bg-red-50"
            disabled={removeProject.isPending}
            onClick={() => remove(project)}
          >
            <Trash2 className="h-3 w-3" /> حذف
          </Button>
        </div>
      );
    }
    if (project.myRequest?.status === "accepted") {
      return (
        <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold pt-3 border-t">
          <CircleCheck className="h-3.5 w-3.5" /> عضو في الفريق{project.myRequest?.role ? ` — ${project.myRequest.role}` : ""}
        </div>
      );
    }
    if (project.myRequest?.status === "pending") {
      return (
        <div className="flex items-center gap-1 text-[10px] text-amber-600 font-bold pt-3 border-t">
          <Send className="h-3.5 w-3.5" /> طلبك معلّق{project.myRequest?.role ? ` — ${project.myRequest.role}` : ""}
        </div>
      );
    }
    if (project.myRequest?.status === "rejected") {
      return (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-3 border-t">
          <CircleX className="h-3.5 w-3.5" /> طلبك اترفض
        </div>
      );
    }
    if (project.status === "closed") {
      return <div className="text-[10px] text-muted-foreground pt-3 border-t">المشروع مقفول</div>;
    }
    return (
      <Button
        size="sm"
        className="h-7 text-[10px] gap-1 px-3 bg-sky-600 hover:bg-sky-700 text-white"
        disabled={join.isPending}
        onClick={() => {
          setJoinFor(project);
          setJoinRole("");
          setJoinMessage("");
        }}
      >
        <UserPlus className="h-3 w-3" /> انضم للفريق
      </Button>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl space-y-4 sm:space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-700 via-blue-700 to-indigo-900 text-white p-4 sm:p-6"
      >
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -right-10 w-52 h-52 rounded-full bg-white/5" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0 border border-white/20">
            <Users className="h-6 w-6 text-sky-50" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="font-bold text-lg sm:text-xl">فرق المشاريع</h1>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/15 text-sky-50 border border-white/20">مشروعات مشتركة بين الكليات</span>
            </div>
            <p className="text-[11px] sm:text-xs text-sky-50/90 max-w-xl">
              عندك فكرة؟ انشرها بالأدوار اللي محتاجها — وأول ما الناس توافق على الأدوار، اخلق فريق مشترك بين الكليات.
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Button onClick={() => setCreateOpen(true)} size="sm" className="bg-white text-sky-800 hover:bg-sky-50 gap-1 h-8 text-[11px]">
              <Plus className="h-3.5 w-3.5" /> مشروع جديد
            </Button>
            <div className="flex gap-2">
              <span className="rounded-xl bg-white/10 backdrop-blur px-3 py-1.5 text-center min-w-14 border border-white/15 flex-1">
                <span className="font-bold text-sm leading-none block">{projects.length}</span>
                <span className="text-[9px] text-sky-100/80">مشروع</span>
              </span>
              <span className="rounded-xl bg-white/10 backdrop-blur px-3 py-1.5 text-center min-w-14 border border-white/15 flex-1">
                <span className="font-bold text-sm leading-none block">{projects.filter((p) => p.status === "open").length}</span>
                <span className="text-[9px] text-sky-100/80">مفتوح</span>
              </span>
              <span className="rounded-xl bg-white/10 backdrop-blur px-3 py-1.5 text-center min-w-14 border border-white/15 flex-1">
                <span className="font-bold text-sm leading-none block">{mine.length}</span>
                <span className="text-[9px] text-sky-100/80">لك</span>
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="py-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center">
          <Users className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <h2 className="font-bold text-sm sm:text-base mb-1">
            {tab === "mine" ? "لسه منشرتش مشروع" : "مفيش مشروع بالفلتر ده"}
          </h2>
          <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
            لما تنشر مشروع، حدد الأدوار اللي محتاجها (تطوير، تصميم، محتوى...) — والفريق بيتكون بأعضاء من كل الكليات.
          </p>
          {tab !== "mine" && (
            <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> مشروع جديد
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {filtered.map((project) => (
            <motion.article
              key={project.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border rounded-2xl p-4 sm:p-5 space-y-3 hover:shadow-md hover:border-primary/30 transition"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-60">
                  <h2 className="font-bold text-sm sm:text-base leading-snug break-words">{project.title}</h2>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {project.owner && (
                      <span className="inline-flex items-center gap-1.5">
                        {project.owner.avatarUrl ? (
                          <img src={project.owner.avatarUrl} alt={project.owner.name} className="w-6 h-6 rounded-full object-cover border" />
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center border">
                            {(project.owner.name || "?").slice(0, 1)}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {project.owner.name}
                          {project.owner.faculty ? ` — ${project.owner.faculty}` : ""}
                          <span className="text-[9px]"> · {fmtDate(project.createdAt)}</span>
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full text-[9px] border font-bold px-2.5 py-1 shrink-0 ${project.status === "open" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                  {project.status === "open" ? "مفتوح للانضمام" : "مقفول"}
                </span>
              </div>

              {project.description && (
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">{project.description}</p>
              )}

              {project.lookingFor.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {project.lookingFor.map((rf) => (
                    <span
                      key={rf.role}
                      className={`text-[10px] rounded-full px-2.5 py-1 border inline-flex items-center gap-1 ${
                        rf.filled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {rf.filled ? <CircleCheck className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                      {rf.role}{rf.filled ? " — اتسد" : ""}
                    </span>
                  ))}
                </div>
              )}

              {project.members.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] text-muted-foreground">الفريق:</span>
                  <div className="flex -space-x-2 space-x-reverse">
                    {project.members.slice(0, 5).map((m) => (
                      <span
                        key={m.userId}
                        title={`${m.name}${m.faculty ? ` — ${m.faculty}` : ""}`}
                        className="w-6 h-6 rounded-full border-2 border-card bg-muted text-[9px] font-bold flex items-center justify-center"
                      >
                        {(m.name || "?").slice(0, 1)}
                      </span>
                    ))}
                    {project.members.length > 5 && (
                      <span className="w-6 h-6 rounded-full border-2 border-card bg-muted text-[9px] font-bold flex items-center justify-center">
                        +{project.members.length - 5}
                      </span>
                    )}
                  </div>
                  {project.members.map((m) => (
                    <span key={m.userId} className="text-[9px] text-muted-foreground">
                      {m.name}{m.faculty ? ` (${m.faculty})` : ""}
                    </span>
                  ))}
                </div>
              )}

              {!!project.tags?.length && (
                <div className="flex flex-wrap gap-1">
                  {project.tags.map((tag) => (
                    <span key={tag} className="text-[9px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">#{tag}</span>
                  ))}
                </div>
              )}

              {footer(project)}

              {project.mine && requestsFor?.id === project.id && (
                <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
                  <p className="text-[11px] font-bold">مقدمي الطلبات</p>
                  <RequestsInline projectId={project.id} onDecide={decideRequest} />
                </div>
              )}
            </motion.article>
          ))}
        </div>
      )}

      <Dialog open={!!joinFor} onOpenChange={(v) => !v && setJoinFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>انضم للفريق: {joinFor?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">دورك</Label>
              <Input value={joinRole} onChange={(e) => setJoinRole(e.target.value)} placeholder="مثال: مطور" maxLength={40} />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {joinFor?.lookingFor.filter((rf) => !rf.filled).map((rf) => (
                  <button
                    key={rf.role}
                    type="button"
                    onClick={() => setJoinRole(rf.role)}
                    className="text-[9px] rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5"
                  >
                    {rf.role}
                  </button>
                ))}
                {QUICK_ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setJoinRole(r)}
                    className="text-[9px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground hover:bg-muted/70"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">ليه انت مناسب؟</Label>
              <Textarea value={joinMessage} onChange={(e) => setJoinMessage(e.target.value)} rows={3} maxLength={500} placeholder="خبرتك أو وقتك المتاح..." />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setJoinFor(null)} disabled={join.isPending}>
              إلغاء
            </Button>
            <Button size="sm" onClick={doJoin} disabled={join.isPending} className="gap-1 bg-sky-600 hover:bg-sky-700 text-white">
              {join.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              إرسال الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>مشروع جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">عنوان المشروع *</Label>
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="مثال: منصة تنظيم فريقي FIFA بين الكليات"
                maxLength={120}
              />
            </div>
            <div>
              <Label className="text-xs">فكرة المشروع / الوصف</Label>
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="الفكرة، الممكن يستفيد مين، ونتوقع قدمه لأي مرة..."
                rows={4}
                maxLength={3000}
              />
            </div>
            <div>
              <Label className="text-xs">الأدوار اللي محتاجها (فاصلة بينهم)</Label>
              <Input
                value={form.lookingFor}
                onChange={(e) => set("lookingFor", e.target.value)}
                placeholder="مطور, مصمم UI, محتوى"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {QUICK_ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => set("lookingFor", form.lookingFor ? `${form.lookingFor}, ${r}` : r)}
                    className="text-[9px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground hover:bg-muted/70"
                  >
                    + {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">الوسوم (فاصلة بينهم)</Label>
              <Input
                value={form.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="Flutter, Health"
              />
            </div>
            <div className="rounded-xl bg-sky-50 border border-sky-100 p-2.5">
              <p className="text-[10px] text-sky-800 leading-relaxed">
                بعد النشر، تطام تطام الطلبات من كل الكليات في «مقدمي الطلبات» في كارت مشروعك — تقبل لحد ما الأدوار تكتمل وتقفل المشروع.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button size="sm" onClick={saveProject} disabled={saving} className="gap-1 bg-sky-600 hover:bg-sky-700 text-white">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              نشر المشروع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RequestsInline({ projectId, onDecide }: { projectId: number; onDecide: (reqId: number, action: "accept" | "reject") => void }) {
  const [rows, setRows] = useState<JoinRequestRow[] | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    api.get<JoinRequestRow[]>("/v2/team-projects/requests")
      .then((j) => setRows(Array.isArray(j) ? j.filter((x) => x.projectId === projectId) : []))
      .catch(() => {
        toast({ title: "تعذر تحميل الطلبات", variant: "destructive" });
        setRows([]);
      });
  }, [projectId, toast]);

  if (rows === null) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />;
  if (rows.length === 0) return <p className="text-[10px] text-muted-foreground">لسه مفيش طلبات معلّقة</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="rounded-lg border bg-card p-2.5 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold">{r.memberName}</span>
            {r.memberFaculty && <span className="text-[9px] text-muted-foreground">— {r.memberFaculty}</span>}
            {r.role && <span className="text-[9px] rounded-full bg-primary/10 text-primary px-2 py-0.5 font-bold">{r.role}</span>}
          </div>
          {r.message && <p className="text-[10px] text-muted-foreground leading-relaxed">{r.message}</p>}
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-6 text-[9px] px-2.5 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onDecide(r.id, "accept")}>
              <CircleCheck className="h-2.5 w-2.5" /> قبول
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-[9px] px-2.5 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onDecide(r.id, "reject")}>
              <CircleX className="h-2.5 w-2.5" /> رفض
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
