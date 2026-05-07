import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Search, User, Shield, GraduationCap, CheckCircle2, XCircle, Clock, Trash2, Copy, Key, Mail, Phone, AtSign, Award, Star, Plus, Minus, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useGetMe } from "@workspace/api-client-react";
import { api } from "@/lib/api";

const AVAILABLE_TITLES = [
  "طالب متميز",
  "نجم الأسبوع",
  "متفوق أكاديمياً",
  "عضو فعال",
  "مساعد دكتور",
  "رائد الفصل",
  "مجتهد",
  "خبير المحتوى",
  "أفضل طالب",
  "طالب الشهر",
];

interface AdminUser {
  id: number;
  name: string;
  username: string;
  email: string;
  phone: string | null;
  role: string;
  department: string;
  yearInCollege: number | null;
  specialization: string | null;
  avatarUrl: string | null;
  status: string;
  points: number;
  title: string | null;
  uniqueCode: string;
  lastSeen: string;
}

export default function AdminUsers() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: me } = useGetMe();
  const [role, setRole] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [grantPoints, setGrantPoints] = useState(0);
  const [selectedTitle, setSelectedTitle] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const url = role !== "all" ? `/admin/users?role=${role}` : "/admin/users";
      const data = await api.get<any[]>(url);
      setUsers(data);
    } catch (err) {
      toast({ title: "خطأ", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, [role]);

  const deleteUser = async (userId: number, userName: string, userRole: string) => {
    if (userRole === "super_admin") {
      toast({ title: "لا يمكن حذف سوبر أدمن", variant: "destructive" });
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف ${userName}؟`)) return;
    try {
      await api.del(`/v2/admin/users/${userId}`);
      toast({ title: "تم حذف المستخدم" });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      toast({ title: "خطأ", description: (err as Error).message, variant: "destructive" });
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "تم نسخ الكود", description: code });
  };

  const handleGrant = async () => {
    if (!selectedUser) return;
    if (grantPoints === 0 && !selectedTitle) {
      toast({ title: "أدخل نقاط أو اختر لقب", variant: "destructive" });
      return;
    }
    try {
      const body: { points?: number; title?: string } = {};
      if (grantPoints !== 0) body.points = grantPoints;
      if (selectedTitle) body.title = selectedTitle;
      const data = await api.patch<any>(`/v2/admin/users/${selectedUser.id}/grant`, body);
      toast({ title: "تم المنح بنجاح", description: `النقاط الجديدة: ${data.points}` });
      setGrantPoints(0);
      setSelectedTitle("");
      setSelectedUser({ ...selectedUser, points: data.points, title: data.title });
      setUsers((prev) => prev.map((u) => u.id === selectedUser.id ? { ...u, points: data.points, title: data.title } : u));
    } catch (err) {
      toast({ title: "خطأ", description: (err as Error).message, variant: "destructive" });
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.uniqueCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <div className="mb-4 sm:mb-6">
        <button onClick={() => setLocation("/admin")} className="inline-flex items-center text-xs sm:text-sm font-medium text-muted-foreground hover:text-primary mb-2 sm:mb-4 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
          العودة للوحة التحكم
        </button>
        <h1 className="text-xl sm:text-3xl font-serif font-bold text-primary">إدارة المستخدمين</h1>
      </div>

      <div className="bg-card rounded-xl sm:rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-[calc(100vh-10rem)] sm:h-[calc(100vh-12rem)] min-h-[400px] sm:min-h-[500px]">
        <div className="p-3 sm:p-4 border-b border-border flex flex-col sm:flex-row gap-3 sm:gap-4 items-center justify-between bg-muted/20 shrink-0">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
            <Input
              placeholder="ابحث بالاسم أو الإيميل أو اليوزر أو الكود..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background h-9 text-sm"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={role} onValueChange={(v) => setRole(v)}>
              <SelectTrigger className="w-full sm:w-[180px] bg-background h-9 text-sm">
                <SelectValue placeholder="تصفية حسب الدور" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأدوار</SelectItem>
                <SelectItem value="student">طلاب</SelectItem>
                <SelectItem value="doctor">دكاترة</SelectItem>
                <SelectItem value="ta">معيدين</SelectItem>
                <SelectItem value="admin">أدمن</SelectItem>
                <SelectItem value="super_admin">سوبر أدمن</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => void fetchUsers()} variant="outline" size="sm" className="h-9 text-sm">تحديث</Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10">
              <TableRow>
                <TableHead>المستخدم</TableHead>
                <TableHead>اليوزر</TableHead>
                <TableHead>الكود الخاص</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead>القسم</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-right">النقاط</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">جاري التحميل...</TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">لا يوجد مستخدمين مطابقين.</TableCell>
                </TableRow>
              ) : (
                filteredUsers.map(user => (
                  <TableRow key={user.id} className="cursor-pointer hover:bg-muted/30">
                    <TableCell onClick={() => setSelectedUser(user)}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                          {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" alt="" /> : <User className="w-4 h-4 text-primary" />}
                        </div>
                        <div>
                          <div className="font-bold text-sm">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => setSelectedUser(user)}>
                      <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{user.username}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Key className="w-3.5 h-3.5 text-primary" />
                        <span className="text-sm font-mono font-bold text-primary">{user.uniqueCode}</span>
                        <button onClick={() => copyCode(user.uniqueCode)} className="text-muted-foreground hover:text-primary" title="نسخ الكود">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {user.role === "admin" || user.role === "super_admin" ? <Shield className="w-3.5 h-3.5 text-accent" /> : null}
                        {user.role === "student" ? <GraduationCap className="w-3.5 h-3.5 text-primary" /> : null}
                        <span className="capitalize text-sm font-medium">{user.role.replace("_", " ")}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{user.department}</TableCell>
                    <TableCell>
                      {user.status === "active" && <Badge variant="default" className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> نشط</Badge>}
                      {user.status === "blocked" && <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20"><XCircle className="w-3 h-3 mr-1" /> محظور</Badge>}
                      {user.status === "pending" && <Badge variant="outline" className="bg-muted text-muted-foreground"><Clock className="w-3 h-3 mr-1" /> معلق</Badge>}
                    </TableCell>
                    <TableCell className="text-right font-medium">{user.points}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8"
                          onClick={() => setSelectedUser(user)}
                        >
                          <ChevronRight className="w-3.5 h-3.5 mr-1" /> عرض
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deleteUser(user.id, user.name, user.role)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> حذف
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="p-4 border-t border-border bg-muted/20 text-xs text-muted-foreground flex justify-between shrink-0">
          <span>عرض {filteredUsers.length} مستخدم</span>
          <span>آخر تحديث: الآن</span>
        </div>
      </div>

      <Sheet open={!!selectedUser} onOpenChange={(open) => { if (!open) { setSelectedUser(null); setGrantPoints(0); setSelectedTitle(""); } }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selectedUser && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                    {selectedUser.avatarUrl ? <img src={selectedUser.avatarUrl} className="w-full h-full object-cover" alt="" /> : <User className="w-6 h-6 text-primary" />}
                  </div>
                  <div>
                    <div className="text-lg">{selectedUser.name}</div>
                    <div className="text-xs text-muted-foreground">@{selectedUser.username}</div>
                  </div>
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/40 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Mail className="w-3.5 h-3.5" /> البريد الإلكتروني
                    </div>
                    <div className="text-sm font-medium">{selectedUser.email}</div>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Phone className="w-3.5 h-3.5" /> رقم الهاتف
                    </div>
                    <div className="text-sm font-medium">{selectedUser.phone || "—"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/40 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <AtSign className="w-3.5 h-3.5" /> اليوزر
                    </div>
                    <div className="text-sm font-mono font-medium">{selectedUser.username}</div>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Key className="w-3.5 h-3.5" /> الكود
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-mono font-bold text-primary">{selectedUser.uniqueCode}</span>
                      <button onClick={() => copyCode(selectedUser.uniqueCode)} className="text-muted-foreground hover:text-primary">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/40 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <GraduationCap className="w-3.5 h-3.5" /> السنة الدراسية
                    </div>
                    <div className="text-sm font-medium">{selectedUser.yearInCollege ? `السنة ${selectedUser.yearInCollege}` : "—"}</div>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Star className="w-3.5 h-3.5" /> التخصص
                    </div>
                    <div className="text-sm font-medium">{selectedUser.specialization || "—"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/40 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Award className="w-3.5 h-3.5" /> النقاط
                    </div>
                    <div className="text-2xl font-bold text-primary">{selectedUser.points}</div>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Shield className="w-3.5 h-3.5" /> اللقب
                    </div>
                    <div className="text-sm font-medium">{selectedUser.title || "—"}</div>
                  </div>
                </div>

                {me?.role === "super_admin" && (
                  <div className="border rounded-2xl p-4 space-y-3 bg-muted/20">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Award className="w-4 h-4 text-primary" /> منح نقاط وألقاب
                    </h3>

                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">النقاط (موجب لزيادة، سالب لنقصان)</label>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setGrantPoints((p) => p + 10)}><Plus className="w-3 h-3" /></Button>
                        <Button variant="outline" size="sm" onClick={() => setGrantPoints((p) => p - 10)}><Minus className="w-3 h-3" /></Button>
                        <Input
                          type="number"
                          value={grantPoints}
                          onChange={(e) => setGrantPoints(Number(e.target.value))}
                          className="h-9"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">اختر لقب</label>
                      <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                        {AVAILABLE_TITLES.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setSelectedTitle(selectedTitle === t ? "" : t)}
                            className={`text-xs px-2 py-1.5 rounded-md border transition ${selectedTitle === t ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted/50"}`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button onClick={handleGrant} className="w-full bg-gradient-to-r from-primary to-secondary">
                      <Award className="w-4 h-4 mr-2" />
                      منح
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
