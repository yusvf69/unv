import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, MapPin, User as UserIcon, ChevronLeft, ChevronRight, FileText, AlertCircle, Award, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMyGroupSchedule, useMyExamSchedule, useMeV2 } from "@/lib/api";

const DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
const JS_TO_AR: Record<number, string> = { 6: "السبت", 0: "الأحد", 1: "الاثنين", 2: "الثلاثاء", 3: "الأربعاء", 4: "الخميس", 5: "الجمعة" };

const TYPE_LABEL: Record<string, string> = { lecture: "محاضرة", lab: "معمل", practical: "تدريب" };
const TYPE_COLOR: Record<string, string> = {
  lecture: "from-primary/20 to-primary/5 border-primary/30",
  lab: "from-secondary/20 to-secondary/5 border-secondary/30",
  practical: "from-accent/30 to-accent/10 border-accent/40",
};

const EXAM_TYPE_LABEL: Record<string, string> = { midterm: "نصفي", final: "نهائي", quiz: "اختبار", practical: "عملي" };
const EXAM_TYPE_COLOR: Record<string, string> = {
  midterm: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
  final: "from-red-500/20 to-red-500/5 border-red-500/30",
  quiz: "from-blue-500/20 to-blue-500/5 border-blue-500/30",
  practical: "from-green-500/20 to-green-500/5 border-green-500/30",
};

type ViewMode = "day" | "week" | "month";
type TabMode = "schedule" | "exams";

// Date helpers
const parseDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const getWeekRange = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diffToSaturday = (day + 1) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - diffToSaturday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
};

export default function Schedule() {
  const { data: me } = useMeV2();
  const { data: rows = [], isLoading: scheduleLoading } = useMyGroupSchedule();
  const { data: exams = [], isLoading: examLoading } = useMyExamSchedule();
  const [scheduleView, setScheduleView] = useState<ViewMode>("week");
  const [examView, setExamView] = useState<ViewMode>("week");
  const [tab, setTab] = useState<TabMode>("schedule");
  const [scheduleCursor, setScheduleCursor] = useState(new Date());
  const [examCursor, setExamCursor] = useState(new Date());
  const [upcomingAlerts, setUpcomingAlerts] = useState<any[]>([]);

  const byDay = useMemo(() => {
    const m: Record<string, typeof rows> = {};
    for (const d of DAYS) m[d] = [];
    for (const r of rows) {
      const day = r.day in m ? r.day : DAYS.find((d) => r.day.includes(d.replace("ال", ""))) || r.day;
      m[day] ||= [];
      m[day].push(r);
    }
    for (const d of Object.keys(m)) m[d].sort((a, b) => a.startTime.localeCompare(b.startTime));
    return m;
  }, [rows]);

  // Compute upcoming exam alerts (within 24 hours)
  useEffect(() => {
    if (!exams.length) return;
    const now = new Date();
    const alerts: any[] = [];
    for (const e of exams) {
      if (!e.date || !e.time) continue;
      const examDateTime = new Date(`${e.date}T${e.time}`);
      const diffMs = examDateTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours > 0 && diffHours <= 24) {
        const hoursLeft = Math.floor(diffHours);
        const minsLeft = Math.floor((diffMs - hoursLeft * 3600000) / 60000);
        alerts.push({ ...e, hoursLeft, minsLeft, examDateTime });
      }
    }
    alerts.sort((a, b) => a.examDateTime.getTime() - b.examDateTime.getTime());
    setUpcomingAlerts(alerts);
  }, [exams]);

  const scheduleTodayName = JS_TO_AR[scheduleCursor.getDay()];

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold flex items-center gap-3">
          <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-primary" /> الجداول
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-2">
          {me?.groupName ? `مجموعة G${me.groupName}` : ""} {me?.yearInCollege ? `— السنة ${me.yearInCollege}` : ""}.
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setTab("schedule")}
          className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 transition shrink-0 whitespace-nowrap ${tab === "schedule" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
        >
          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> جدول المحاضرات
        </button>
        <button
          onClick={() => setTab("exams")}
          className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 transition shrink-0 whitespace-nowrap ${tab === "exams" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
        >
          <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> جدول الامتحانات
        </button>
      </div>

      {/* Upcoming Exam Alerts */}
      {tab === "exams" && upcomingAlerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {upcomingAlerts.map((alert) => (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={alert.id} className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-3">
              <Bell className="h-5 w-5 text-amber-600 animate-pulse" />
              <div className="flex-1">
                <div className="font-bold text-sm text-amber-800 dark:text-amber-300">تنبيه: امتحان {alert.courseTitle} بعد {alert.hoursLeft} ساعة {alert.minsLeft > 0 && `و ${alert.minsLeft} دقيقة`}!</div>
                <div className="text-xs text-amber-700/80 dark:text-amber-400/80">القاعة: {alert.room} · {EXAM_TYPE_LABEL[alert.type]}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {tab === "schedule" ? (
        <>
          {scheduleLoading ? (
            <p className="text-center text-muted-foreground py-12">جاري التحميل...</p>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 bg-card border rounded-2xl">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">لم يُحدَّد جدول لمجموعتك بعد. اطلب من الإدارة إضافته.</p>
            </div>
          ) : scheduleView === "day" ? (
            <>
              <ViewToggle view={scheduleView} setView={setScheduleView} />
              <DayView day={scheduleTodayName} items={byDay[scheduleTodayName] ?? []} cursor={scheduleCursor} setCursor={setScheduleCursor} />
            </>
          ) : scheduleView === "week" ? (
            <>
              <ViewToggle view={scheduleView} setView={setScheduleView} />
              <WeekView byDay={byDay} />
            </>
          ) : (
            <>
              <ViewToggle view={scheduleView} setView={setScheduleView} />
              <MonthView byDay={byDay} cursor={scheduleCursor} setCursor={setScheduleCursor} />
            </>
          )}
        </>
      ) : (
        <>
          {examLoading ? (
            <p className="text-center text-muted-foreground py-12">جاري التحميل...</p>
          ) : exams.length === 0 ? (
            <div className="text-center py-16 bg-card border rounded-2xl">
              <Award className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">لم يتم نشر جدول الامتحانات بعد.</p>
            </div>
          ) : (
            <ExamScheduleView exams={exams} view={examView} setView={setExamView} cursor={examCursor} setCursor={setExamCursor} />
          )}
        </>
      )}
    </div>
  );
}

function ViewToggle({ view, setView }: { view: ViewMode; setView: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex bg-muted rounded-full p-1 mb-4">
      {(["day", "week", "month"] as const).map((v) => (
        <button
          key={v}
          onClick={() => setView(v)}
          className={`px-4 py-1.5 text-xs font-medium rounded-full transition ${view === v ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"}`}
        >
          {v === "day" ? "يوم" : v === "week" ? "أسبوع" : "شهر"}
        </button>
      ))}
    </div>
  );
}

function ExamScheduleView({ exams, view, setView, cursor, setCursor }: { exams: any[]; view: ViewMode; setView: (v: ViewMode) => void; cursor: Date; setCursor: (d: Date) => void }) {
  const todayName = JS_TO_AR[cursor.getDay()];
  const shift = (n: number) => {
    const d = new Date(cursor);
    if (view === "day") d.setDate(d.getDate() + n);
    else if (view === "week") d.setDate(d.getDate() + n * 7);
    else d.setMonth(d.getMonth() + n);
    setCursor(d);
  };

  const todayStr = cursor.toISOString().split("T")[0];
  const { start: weekStart, end: weekEnd } = getWeekRange(cursor);

  const dayExams = exams.filter((e) => e.date === todayStr).sort((a, b) => a.time.localeCompare(b.time));
  const weekExams = exams.filter((e) => { if (!e.date) return false; const d = parseDate(e.date); return d >= weekStart && d <= weekEnd; }).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const monthExams = exams.filter((e) => { if (!e.date) return false; const d = parseDate(e.date); return d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear(); }).sort((a, b) => a.date.localeCompare(b.date));

  const displayExams = view === "day" ? dayExams : view === "week" ? weekExams : monthExams;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {Object.entries(EXAM_TYPE_LABEL).map(([key, label]) => {
          const count = exams.filter((e) => e.type === key).length;
          return (
            <div key={key} className="bg-card border rounded-xl p-3 text-center">
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          );
        })}
      </div>

      <ViewToggle view={view} setView={setView} />

      <div className="flex items-center justify-between mb-4 bg-card border rounded-xl p-3">
        <Button size="sm" variant="ghost" onClick={() => shift(-1)}><ChevronRight className="h-4 w-4" /></Button>
        <div className="text-center">
          <div className="font-bold text-lg">{view === "day" ? todayName : view === "month" ? "" : "الأسبوع الحالي"}</div>
          <div className="text-xs text-muted-foreground">
            {view === "day" && cursor.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {view === "week" && (() => { const { start, end } = getWeekRange(cursor); return `${start.toLocaleDateString("ar-EG", { month: "short", day: "numeric" })} — ${end.toLocaleDateString("ar-EG", { month: "short", day: "numeric", year: "numeric" })}`; })()}
            {view === "month" && cursor.toLocaleDateString("ar-EG", { year: "numeric", month: "long" })}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => shift(1)}><ChevronLeft className="h-4 w-4" /></Button>
      </div>

      {view === "day" ? (
        displayExams.length === 0 ? (
          <div className="text-center py-12 bg-card border rounded-2xl text-muted-foreground">لا توجد امتحانات في هذا اليوم. استخدم الأسهم للتنقل بين الأيام.</div>
        ) : (
          <div className="space-y-3">
            {displayExams.map((e, i) => <ExamCard key={e.id} exam={e} delay={i * 0.05} />)}
          </div>
        )
      ) : view === "week" ? (
        <WeekViewExams exams={weekExams} cursor={cursor} />
      ) : (
        <MonthViewExams exams={monthExams} cursor={cursor} />
      )}
    </div>
  );
}

function WeekViewExams({ exams, cursor }: { exams: any[]; cursor: Date }) {
  const { start, end } = getWeekRange(cursor);
  const examsByDate = new Map<string, any[]>();
  for (const e of exams) { if (!e.date) continue; const key = e.date; if (!examsByDate.has(key)) examsByDate.set(key, []); examsByDate.get(key)!.push(e); }
  const days: Date[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {days.map((d) => {
        const dateStr = d.toISOString().split("T")[0];
        const dayExams = examsByDate.get(dateStr) ?? [];
        return (
          <div key={dateStr} className="bg-card border rounded-2xl p-3 min-h-[200px]">
            <h3 className="font-bold text-sm mb-2 pb-2 border-b">{JS_TO_AR[d.getDay()]} {d.getDate()}</h3>
            <div className="space-y-2">
              {dayExams.length ? dayExams.map((e) => <ExamCard key={e.id} exam={e} compact />) : <p className="text-xs text-muted-foreground text-center py-6">لا امتحانات</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthViewExams({ exams, cursor }: { exams: any[]; cursor: Date }) {
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const first = new Date(year, month, 1), last = new Date(year, month + 1, 0);
  const startOffset = (first.getDay() + 1) % 7;
  const cells: { date?: Date }[] = [];
  for (let i = 0; i < startOffset; i++) cells.push({});
  for (let d = 1; d <= last.getDate(); d++) cells.push({ date: new Date(year, month, d) });
  while (cells.length % 7 !== 0) cells.push({});
  const examsByDate = new Map<string, any[]>();
  for (const e of exams) { if (!e.date) continue; if (!examsByDate.has(e.date)) examsByDate.set(e.date, []); examsByDate.get(e.date)!.push(e); }
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted-foreground mb-1">{DAYS.map((d) => <div key={d}>{d.replace("ال", "")}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c.date) return <div key={i} className="aspect-square" />;
          const dateStr = c.date.toISOString().split("T")[0];
          const items = examsByDate.get(dateStr) ?? [];
          const isToday = c.date.toDateString() === new Date().toDateString();
          return (
            <div key={i} className={`aspect-square p-1.5 rounded-lg border bg-card text-xs flex flex-col gap-0.5 ${isToday ? "border-primary border-2" : ""}`}>
              <div className={`text-end font-bold ${isToday ? "text-primary" : "text-muted-foreground"}`}>{c.date.getDate()}</div>
              {items.slice(0, 2).map((e) => (<div key={e.id} className="text-[9px] truncate bg-amber-500/10 text-amber-700 px-1 rounded">{e.courseTitle}</div>))}
              {items.length > 2 && <div className="text-[9px] text-muted-foreground">+{items.length - 2}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExamCard({ exam, compact, delay }: { exam: any; compact?: boolean; delay?: number }) {
  const color = EXAM_TYPE_COLOR[exam.type] || EXAM_TYPE_COLOR.midterm;
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay || 0 }} className={`bg-gradient-to-br ${color} border-2 rounded-xl p-3 flex items-center gap-3 ${compact ? "" : "p-4"}`}>
      <div className="bg-white/60 dark:bg-black/30 rounded-lg p-2">
        <FileText className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm">{exam.courseTitle}</div>
        {exam.courseCode && <div className="text-[10px] text-muted-foreground">{exam.courseCode}</div>}
        <div className="flex items-center gap-2 text-xs mt-1 text-muted-foreground flex-wrap">
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {exam.time}</span>
          {exam.date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {exam.date}</span>}
          {exam.room && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {exam.room}</span>}
        </div>
      </div>
      <span className="text-[10px] bg-white/60 dark:bg-black/30 px-2 py-1 rounded-full font-bold">{EXAM_TYPE_LABEL[exam.type] ?? exam.type}</span>
    </motion.div>
  );
}

function DayView({ day, items, cursor, setCursor }: { day: string; items: any[]; cursor: Date; setCursor: (d: Date) => void }) {
  const shift = (n: number) => { const d = new Date(cursor); d.setDate(d.getDate() + n); setCursor(d); };
  return (
    <div>
      <div className="flex items-center justify-between mb-4 bg-card border rounded-xl p-3">
        <Button size="sm" variant="ghost" onClick={() => shift(-1)}><ChevronRight className="h-4 w-4" /></Button>
        <div className="text-center">
          <div className="font-bold text-lg">{day}</div>
          <div className="text-xs text-muted-foreground">{cursor.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => shift(1)}><ChevronLeft className="h-4 w-4" /></Button>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-12 bg-card border rounded-2xl text-muted-foreground">لا توجد محاضرات اليوم.</div>
      ) : (
        <div className="space-y-3">
          {items.map((r, i) => <ClassCard key={r.id} r={r} delay={i * 0.05} />)}
        </div>
      )}
    </div>
  );
}

function WeekView({ byDay }: { byDay: Record<string, any[]> }) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {DAYS.map((d) => (
        <div key={d} className="bg-card border rounded-2xl p-3 min-h-[200px]">
          <h3 className="font-bold text-sm mb-2 pb-2 border-b">{d}</h3>
          <div className="space-y-2">
            {byDay[d]?.length ? byDay[d].map((r) => <ClassCard key={r.id} r={r} compact />) : (
              <p className="text-xs text-muted-foreground text-center py-6">لا محاضرات</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function MonthView({ byDay, cursor, setCursor }: { byDay: Record<string, any[]>; cursor: Date; setCursor: (d: Date) => void }) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startOffset = (first.getDay() + 1) % 7;
  const cells: { date?: Date }[] = [];
  for (let i = 0; i < startOffset; i++) cells.push({});
  for (let d = 1; d <= last.getDate(); d++) cells.push({ date: new Date(year, month, d) });
  while (cells.length % 7 !== 0) cells.push({});
  const shift = (n: number) => { const d = new Date(cursor); d.setMonth(d.getMonth() + n); setCursor(d); };
  return (
    <div>
      <div className="flex items-center justify-between mb-4 bg-card border rounded-xl p-3">
        <Button size="sm" variant="ghost" onClick={() => shift(-1)}><ChevronRight className="h-4 w-4" /></Button>
        <div className="font-bold">{cursor.toLocaleDateString("ar-EG", { year: "numeric", month: "long" })}</div>
        <Button size="sm" variant="ghost" onClick={() => shift(1)}><ChevronLeft className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted-foreground mb-1">
        {DAYS.map((d) => <div key={d}>{d.replace("ال", "")}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c.date) return <div key={i} className="aspect-square" />;
          const dayName = JS_TO_AR[c.date.getDay()];
          const items = byDay[dayName] ?? [];
          const isToday = c.date.toDateString() === new Date().toDateString();
          return (
            <div key={i} className={`aspect-square p-1.5 rounded-lg border bg-card text-xs flex flex-col gap-0.5 ${isToday ? "border-primary border-2" : ""}`}>
              <div className={`text-end font-bold ${isToday ? "text-primary" : "text-muted-foreground"}`}>{c.date.getDate()}</div>
              {items.slice(0, 2).map((r) => (
                <div key={r.id} className="text-[9px] truncate bg-primary/10 text-primary px-1 rounded">{r.courseTitle}</div>
              ))}
              {items.length > 2 && <div className="text-[9px] text-muted-foreground">+{items.length - 2}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClassCard({ r, compact, delay }: { r: any; compact?: boolean; delay?: number }) {
  const color = TYPE_COLOR[r.type] || TYPE_COLOR.lecture;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay || 0 }}
      className={`bg-gradient-to-br ${color} border-2 rounded-xl p-3 ${compact ? "" : "p-4"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-bold text-sm">{r.courseTitle}</div>
        <span className="text-[10px] bg-white/60 dark:bg-black/30 px-2 py-0.5 rounded-full font-bold">{TYPE_LABEL[r.type] ?? r.type}</span>
      </div>
      {r.courseCode && <div className="text-[10px] text-muted-foreground">{r.courseCode}</div>}
      <div className="text-xs mt-2 flex flex-wrap items-center gap-2 text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {r.startTime} - {r.endTime}</span>
        {r.room && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.room}</span>}
        {r.instructor && <span className="inline-flex items-center gap-1"><UserIcon className="h-3 w-3" /> {r.instructor}</span>}
      </div>
    </motion.div>
  );
}
