import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, MapPin, Bell, BookOpen, Filter } from "lucide-react";
import { Link } from "wouter";
import { useEvents, useMeV2 } from "@/lib/api";
import { Button } from "@/components/ui/button";

const KIND_LABELS: Record<string, string> = {
  exam: "امتحان",
  deadline: "موعد نهائي",
  assignment: "تكليف",
  workshop: "ورشة",
  other: "آخر",
};

const KIND_COLORS: Record<string, string> = {
  exam: "from-rose-500 to-rose-600",
  deadline: "from-amber-500 to-orange-500",
  assignment: "from-sky-500 to-blue-500",
  workshop: "from-emerald-500 to-teal-500",
  other: "from-slate-500 to-slate-600",
};

function timeUntil(d: Date): string {
  const ms = d.getTime() - Date.now();
  if (ms < 0) return "انتهى";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `بعد ${days} يوم${hours > 0 ? ` و ${hours}س` : ""}`;
  if (hours > 0) return `بعد ${hours} ساعة`;
  const minutes = Math.floor(ms / (1000 * 60));
  return `بعد ${minutes} دقيقة`;
}

export default function Events() {
  const { data: me } = useMeV2();
  const { data: events = [], isLoading } = useEvents();
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("upcoming");
  const [kindFilter, setKindFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const now = Date.now();
    return events.filter((e) => {
      const t = new Date(e.dueAt).getTime();
      if (filter === "upcoming" && t < now) return false;
      if (filter === "past" && t >= now) return false;
      if (kindFilter !== "all" && e.kind !== kindFilter) return false;
      return true;
    });
  }, [events, filter, kindFilter]);

  const kinds = Array.from(new Set(events.map((e) => e.kind)));
  const isAdmin = me?.role === "admin" || me?.role === "super_admin";

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" /> الأحداث والامتحانات
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            كل المواعيد المهمة لسنتك ومجموعتك في مكان واحد — امتحانات، تسليمات، ورش، وأكثر.
          </p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link href="/admin/events">إدارة الأحداث</Link>
          </Button>
        )}
      </motion.div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="inline-flex bg-muted rounded-full p-1">
          {(["upcoming", "all", "past"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition ${filter === f ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"}`}
            >
              {f === "upcoming" ? "القادم" : f === "past" ? "المنتهي" : "الكل"}
            </button>
          ))}
        </div>
        {kinds.length > 0 && (
          <div className="inline-flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              className="h-8 px-2 border rounded-md bg-background text-xs"
            >
              <option value="all">كل الأنواع</option>
              {kinds.map((k) => <option key={k} value={k}>{KIND_LABELS[k] ?? k}</option>)}
            </select>
          </div>
        )}
      </div>

      {isLoading && <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 bg-card border rounded-2xl">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">لا توجد أحداث {filter === "upcoming" ? "قادمة" : filter === "past" ? "منتهية" : ""} حالياً.</p>
        </div>
      )}

      <div className="space-y-3">
        <AnimatePresence>
          {filtered.map((e, i) => {
            const due = new Date(e.dueAt);
            const past = due.getTime() < Date.now();
            const color = KIND_COLORS[e.kind] || KIND_COLORS.other;
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ delay: i * 0.04 }}
                className={`bg-card border-2 rounded-2xl p-4 flex gap-4 hover:shadow-lg transition ${past ? "opacity-60" : ""}`}
              >
                <div className={`w-16 flex-shrink-0 rounded-xl bg-gradient-to-br ${color} text-white text-center py-3`}>
                  <div className="text-2xl font-bold leading-none">{due.getDate()}</div>
                  <div className="text-[10px] uppercase mt-1 opacity-90">{due.toLocaleString("ar-EG", { month: "short" })}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] bg-gradient-to-r ${color} text-white px-2 py-0.5 rounded-full font-bold`}>
                      {KIND_LABELS[e.kind] ?? e.kind}
                    </span>
                    {e.yearInCollege && (
                      <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-bold">السنة {e.yearInCollege}</span>
                    )}
                    {e.groupName && (
                      <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-bold">G{e.groupName}</span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${past ? "bg-muted text-muted-foreground" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"}`}>
                      {timeUntil(due)}
                    </span>
                  </div>
                  <h3 className="font-bold text-base">{e.title}</h3>
                  {e.description && <p className="text-sm text-muted-foreground mt-1">{e.description}</p>}
                  <div className="text-xs text-muted-foreground mt-2 flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {due.toLocaleString("ar-EG", { hour: "2-digit", minute: "2-digit", weekday: "long" })}
                    </span>
                    {e.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {e.location}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {!isAdmin && me?.role === "student" && events.length > 0 && (
        <div className="mt-8 p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">المواعيد تُرشّح حسب سنتك ({me.yearInCollege ?? "—"}) ومجموعتك ({me.groupName ?? "—"}).</p>
        </div>
      )}
    </div>
  );
}
