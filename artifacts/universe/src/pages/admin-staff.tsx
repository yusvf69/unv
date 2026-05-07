import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Plus, Mail, Phone, Briefcase, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGetMe } from "@workspace/api-client-react";
import { api, useDeleteStaff, useCreateStaff } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import FileUpload from "@/components/file-upload";

interface Staff {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  department: string;
  title: string | null;
  avatarUrl: string | null;
}

const ROLES = ["doctor", "ta", "admin"] as const;
const ROLE_LABEL: Record<string, string> = {
  doctor: "دكتور",
  ta: "معيد",
  admin: "مسؤول إداري",
  super_admin: "سوبر أدمن",
};

export default function AdminStaff() {
  const { data: me } = useGetMe();
  const isAdmin = me?.role === "admin" || me?.role === "super_admin";
  const isSuper = me?.role === "super_admin";
  const [staff, setStaff] = useState<Staff[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", role: "doctor" as "doctor" | "ta" | "admin",
    department: "", title: "", bio: "", officeHours: "", avatarUrl: "",
    username: "", password: "",
  });
  const { toast } = useToast();
  const deleteStaff = useDeleteStaff();
  const createStaff = useCreateStaff();

  const handleDelete = async (s: Staff) => {
    if (s.role === "super_admin") { toast({ title: "لا يمكن حذف السوبر أدمن", variant: "destructive" }); return; }
    if (!confirm(`حذف ${s.name} نهائياً؟`)) return;
    try {
      await deleteStaff.mutateAsync(s.id);
      toast({ title: "تم الحذف" });
      load();
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  const load = async () => {
    if (!isAdmin) return;
    try {
      setStaff(await api.get<Staff[]>("/v2/admin/staff"));
    } catch {}
  };

  useEffect(() => { load(); }, [isAdmin]);

  if (!isAdmin) return <div className="container mx-auto p-12 text-center text-muted-foreground">صلاحياتك غير كافية.</div>;

  const submit = async () => {
    if (!form.name || !form.email) {
      toast({ title: "الاسم والبريد مطلوبان", variant: "destructive" });
      return;
    }
    try {
      await createStaff.mutateAsync({
        name: form.name,
        username: form.username || undefined,
        email: form.email,
        phone: form.phone || undefined,
        role: form.role,
        department: form.department || "غير محدد",
        title: form.title || undefined,
        bio: form.bio || undefined,
        officeHours: form.officeHours || undefined,
        avatarUrl: form.avatarUrl || undefined,
        password: form.password || undefined,
      });
      toast({ title: "تمت إضافة العضو" });
      setOpen(false);
      setForm({ name: "", email: "", phone: "", role: "doctor", department: "", title: "", bio: "", officeHours: "", avatarUrl: "", username: "", password: "" });
      load();
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  const grouped: Record<string, Staff[]> = {};
  for (const s of staff) {
    grouped[s.role] = grouped[s.role] || [];
    grouped[s.role].push(s);
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
      <div className="flex items-start justify-between mb-4 sm:mb-6 flex-wrap gap-2 sm:gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl md:text-4xl font-serif font-bold flex items-center gap-2 sm:gap-3">
            <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary" /> إدارة هيئة التدريس
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 sm:mt-2">
            أضف الدكاترة والمعيدين والإداريين بصورهم الشخصية لظهورهم في صفحة الكادر وفي اختيار دكتور المقرر.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="button-add-staff" className="h-9 sm:h-10 text-xs sm:text-sm">
          <Plus className="me-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> عضو جديد
        </Button>
      </div>

      {Object.entries(grouped).map(([role, members]) => (
        <div key={role} className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {ROLE_LABEL[role] || role}
            </span>
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] sm:text-xs text-muted-foreground">{members.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {members.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-card border-2 border-border rounded-xl sm:rounded-2xl p-3 sm:p-4 flex gap-2 sm:gap-3 items-start hover:shadow-md transition-shadow"
              >
                <img
                  src={s.avatarUrl || "https://i.pravatar.cc/80"}
                  alt=""
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover ring-2 ring-primary/20 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <div className="font-bold text-xs sm:text-sm truncate flex-1">{s.name}</div>
                    {isSuper && s.role !== "super_admin" && (
                      <button
                        onClick={() => handleDelete(s)}
                        className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-1 rounded-md flex-shrink-0"
                        title="حذف"
                        data-testid={`button-delete-staff-${s.id}`}
                      ><Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" /></button>
                    )}
                  </div>
                  {s.title && <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{s.title}</div>}
                  <div className="text-[10px] sm:text-xs flex items-center gap-1 mt-1 sm:mt-1.5 text-muted-foreground">
                    <Briefcase className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {s.department}
                  </div>
                  <div className="text-[10px] sm:text-xs flex items-center gap-1 mt-0.5 text-muted-foreground truncate">
                    <Mail className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {s.email}
                  </div>
                  {s.phone && (
                    <div className="text-[10px] sm:text-xs flex items-center gap-1 mt-0.5 text-muted-foreground">
                      <Phone className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {s.phone}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">إضافة عضو هيئة تدريس</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">أضف دكتور أو معيد أو إداري جديد</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pe-2">
            <div>
              <Label className="text-xs">الصورة الشخصية</Label>
              <FileUpload value={form.avatarUrl || null} onChange={(d) => setForm({ ...form, avatarUrl: d || "" })} accept="image/*" maxSizeKb={500} />
            </div>
            <div>
              <Label className="text-xs">الاسم</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">اسم المستخدم</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="يُحسب تلقائياً من الاسم لو ساب فاضي" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">كلمة المرور <span className="text-muted-foreground">(افتراضي: Staff123!)</span></Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="اتركه فاضي للكلمة الافتراضية" className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">الدور</Label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                  className="w-full h-9 px-3 border-2 border-input rounded-md bg-background text-sm"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">القسم</Label>
                <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">المسمى الوظيفي</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="أستاذ مساعد..." className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">البريد</Label>
                <Input type="text" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">الهاتف</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">السيرة الذاتية المختصرة</Label>
              <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="text-sm" />
            </div>
            <div>
              <Label className="text-xs">ساعات الإرشاد المكتبي</Label>
              <Input value={form.officeHours} onChange={(e) => setForm({ ...form, officeHours: e.target.value })} placeholder="الأحد والثلاثاء 10:00-12:00" className="h-9 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-xs sm:text-sm">إلغاء</Button>
            <Button onClick={submit} className="text-xs sm:text-sm">
              <Send className="me-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
