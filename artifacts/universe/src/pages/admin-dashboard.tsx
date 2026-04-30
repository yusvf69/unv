import { useGetAdminOverview, useGetMe } from "@workspace/api-client-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Users,
  GraduationCap,
  Activity,
  Brain,
  AlertTriangle,
  ArrowLeft,
  Newspaper,
  Sparkles,
  ShieldCheck,
  BookOpen,
  ClipboardCheck,
  Trophy,
  ClipboardList,
  Calendar,
  FolderUp,
  Bell,
  Send,
  Megaphone,
  CheckCircle,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotifications, useSendSystemNotification } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
const AR_WEEKDAYS = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

const ADMIN_MODULES_ALL = [
  { href: "/admin/news", icon: Newspaper, title: "إدارة الأخبار", desc: "إضافة وتعديل الأخبار", color: "from-sky-500 to-sky-600", roles: ["admin", "super_admin"] },
  { href: "/admin/staff", icon: GraduationCap, title: "هيئة التدريس", desc: "إضافة وحذف الأعضاء", color: "from-emerald-500 to-emerald-600", roles: ["admin", "super_admin"] },
  { href: "/admin/users", icon: Users, title: "الطلاب", desc: "بيانات وأداء الطلاب", color: "from-amber-500 to-amber-600", roles: ["super_admin"] },
  { href: "/admin/courses", icon: BookOpen, title: "إدارة المقررات", desc: "إضافة وتنظيم المقررات", color: "from-teal-500 to-teal-600", roles: ["admin", "super_admin"] },
  { href: "/admin/quizzes", icon: ClipboardList, title: "إدارة الاختبارات", desc: "فتح/إغلاق + المحاولات", color: "from-indigo-500 to-indigo-600", roles: ["admin", "super_admin"] },
  { href: "/admin/materials", icon: FolderUp, title: "ملفات المواد", desc: "رفع PDF وملفات للطلاب", color: "from-cyan-500 to-cyan-600", roles: ["admin", "super_admin"] },
  { href: "/admin/schedule", icon: Calendar, title: "جداول المجموعات", desc: "محاضرات لكل مجموعة + سنة", color: "from-purple-500 to-purple-600", roles: ["super_admin"] },
  { href: "/admin/talents", icon: Sparkles, title: "مراجعة المواهب", desc: "حذف وتحذير المخالف", color: "from-rose-500 to-rose-600", roles: ["admin", "super_admin"] },
  { href: "/admin/proposals", icon: ShieldCheck, title: "الاقتراحات", desc: "موافقة السوبر أدمن", color: "from-violet-500 to-violet-600", roles: ["super_admin"] },
  { href: "/admin/dm", icon: MessageSquare, title: "مراقبة المحادثات", desc: "عرض محادثات الطلاب", color: "from-pink-500 to-pink-600", roles: ["super_admin"] },
  { href: "/leaderboard", icon: Trophy, title: "لوحة الشرف", desc: "ترتيب الطلاب", color: "from-orange-500 to-orange-600", roles: ["super_admin"] },
];

export default function AdminDashboard() {
  const { data: overview, isLoading } = useGetAdminOverview();
  const { data: me } = useGetMe();
  const { data: notes = [] } = useNotifications();
  const sendNotification = useSendSystemNotification();
  const { toast } = useToast();
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [notifTarget, setNotifTarget] = useState("all");
  const [notifYear, setNotifYear] = useState<number | undefined>(undefined);
  const [notifGroup, setNotifGroup] = useState("");
  const [sendSuccess, setSendSuccess] = useState(false);
  const pendingProposals = notes.filter((n) => n.title.includes("اقتراح") && !n.read).length;
  const isSuper = me?.role === "super_admin";

  const handleSendNotification = async () => {
    if (!notifTitle || !notifBody) return;
    const body: any = { title: notifTitle, body: notifBody, type: "info" };
    if (notifTarget === "student") body.targetRole = "student";
    if (notifTarget === "doctor") body.targetRole = "doctor";
    await sendNotification.mutateAsync(body);
    toast({ title: "تم الإرسال", description: "تم إرسال الإشعار بنجاح" });
    setNotifTitle("");
    setNotifBody("");
  };

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!overview) return null;

  const weeklyData = overview.weeklyEngagement.map((w) => ({
    ...w,
    dayLabel: AR_WEEKDAYS[new Date(w.date).getDay()],
  }));

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            مركز التحكم
          </h1>
          <p className="text-muted-foreground mt-1">
            {isSuper ? "صلاحياتك كـ سوبر أدمن: تنفيذ مباشر + مراجعة الاقتراحات." : "صلاحياتك كأدمن: اقتراح التعديلات للسوبر أدمن."}
          </p>
        </div>
        {isSuper && pendingProposals > 0 && (
          <Link href="/admin/proposals">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-3 rounded-2xl shadow-lg flex items-center gap-3 font-bold text-sm hover-elevate active-elevate"
            >
              <ShieldCheck className="h-5 w-5" />
              {pendingProposals} اقتراح بانتظارك
              <ArrowLeft className="h-4 w-4" />
            </motion.div>
          </Link>
        )}
      </motion.div>

      {/* MODULES GRID */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {ADMIN_MODULES_ALL.filter((m) => m.roles.includes(me?.role || "")).map((m, i) => (
          <motion.div
            key={m.href}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileHover={{ y: -4 }}
          >
            <Link href={m.href}>
              <div className={`relative overflow-hidden bg-gradient-to-br ${m.color} text-white rounded-2xl p-5 shadow-lg cursor-pointer h-full hover-elevate active-elevate`} data-testid={`admin-module-${m.href.split("/").pop()}`}>
                <m.icon className="absolute -end-3 -bottom-3 h-20 w-20 opacity-10" />
                <m.icon className="h-7 w-7 mb-3" />
                <div className="font-bold text-base">{m.title}</div>
                <div className="text-xs opacity-90 mt-0.5">{m.desc}</div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Users, value: overview.totalStudents, label: "إجمالي الطلاب", color: "primary" },
          { icon: GraduationCap, value: overview.totalStaff, label: "هيئة التدريس", color: "secondary" },
          { icon: ClipboardCheck, value: overview.activeExams, label: "اختبارات نشطة", color: "accent" },
          { icon: Brain, value: overview.aiUsageToday, label: "استخدام AI اليوم", color: "chart-4" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.05 }}
          >
            <Card className="border-2">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-3 bg-${s.color}/10 text-${s.color} rounded-xl`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold tabular-nums">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-2">
          <CardHeader>
            <CardTitle>التفاعل الأسبوعي</CardTitle>
            <CardDescription>عدد المستخدمين النشطين ودقائق المذاكرة خلال آخر 7 أيام</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-primary/10 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-primary">{overview.todayActivity}</div>
                <div className="text-[10px] text-muted-foreground">نشط اليوم</div>
              </div>
              <div className="bg-secondary/10 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-secondary">{weeklyData.reduce((s, d) => s + d.studyMinutes, 0)}</div>
                <div className="text-[10px] text-muted-foreground">دقيقة هذا الأسبوع</div>
              </div>
              <div className="bg-accent/10 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-accent">{overview.aiUsageToday}</div>
                <div className="text-[10px] text-muted-foreground">استخدام AI اليوم</div>
              </div>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <XAxis dataKey="dayLabel" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ stroke: 'var(--border)' }} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                  <Line yAxisId="left" type="monotone" dataKey="activeUsers" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))' }} name="مستخدمون نشطون" />
                  <Line yAxisId="right" type="monotone" dataKey="studyMinutes" stroke="hsl(var(--secondary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--secondary))' }} name="دقائق مذاكرة" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader><CardTitle>الأقسام</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[200px] w-full mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={overview.departmentBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="count" nameKey="department">
                    {overview.departmentBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5">
              {overview.departmentBreakdown.map((d, i) => (
                <div key={d.department} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="truncate">{d.department}</span>
                  </div>
                  <span className="font-bold tabular-nums">{d.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> تنبيهات النظام</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overview.alerts.map(alert => (
                <div key={alert.id} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card">
                  {alert.severity === "critical" ? (
                    <AlertTriangle className="shrink-0 mt-0.5 w-5 h-5 text-destructive" />
                  ) : alert.severity === "warning" ? (
                    <AlertTriangle className="shrink-0 mt-0.5 w-5 h-5 text-orange-500" />
                  ) : (
                    <CheckCircle className="shrink-0 mt-0.5 w-5 h-5 text-blue-500" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <h4 className="font-bold text-sm">{alert.title}</h4>
                      <Badge variant={alert.severity === "critical" ? "destructive" : "outline"} className="text-[10px] flex-shrink-0">
                        {alert.kind === "dropout_risk" ? "خطر" : alert.kind === "complaint" ? "شكوى" : alert.kind === "content_review" ? "مراجعة" : "نظام"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{alert.body}</p>
                  </div>
                </div>
              ))}
              {overview.alerts.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">لا توجد تنبيهات.</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-rose-500" /> إرسال تنبيه للنظام</CardTitle>
            <CardDescription>أرسل إشعاراً لجميع الطلاب أو لمجموعة محددة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>عنوان الإشعار</Label>
              <Input value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} placeholder="مثال: تذكير بالامتحان" />
            </div>
            <div className="space-y-1.5">
              <Label>نص الإشعار</Label>
              <Input value={notifBody} onChange={(e) => setNotifBody(e.target.value)} placeholder="تفاصيل الإشعار..." />
            </div>
            <div className="space-y-1.5">
              <Label>المرسل إليهم</Label>
              <select value={notifTarget} onChange={(e) => setNotifTarget(e.target.value)} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                <option value="all">جميع المستخدمين</option>
                <option value="student">الطلاب فقط</option>
                <option value="doctor">هيئة التدريس فقط</option>
              </select>
            </div>
            <Button onClick={handleSendNotification} disabled={!notifTitle || !notifBody || sendNotification.isPending} className="w-full">
              <Send className="me-2 h-4 w-4" />
              {sendNotification.isPending ? "جاري الإرسال..." : "إرسال الإشعار"}
            </Button>
            {sendNotification.isSuccess && (
              <div className="text-xs text-emerald-600 text-center font-bold">✅ تم الإرسال بنجاح</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader><CardTitle>توزيع النقاط</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overview.pointsDistribution}>
                  <XAxis dataKey="bucket" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'var(--muted)' }} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                  <Bar dataKey="count" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} name="مستخدم" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
