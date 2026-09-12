import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Sparkles, CheckCircle2, Circle, Clock, Loader2, ArrowRight,
  GraduationCap, FlaskConical, Briefcase, UserCheck, Target,
  Trophy, Zap, Flame, BookOpen, Star, ChevronDown, Filter, Award, Medal, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSkillTracks, useCompleteLesson, useSkillRecommendations, useStreak } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useTranslation, globalI18n } from "@/lib/i18n";

const CATEGORIES = [
  { key: "academic", labelAr: "مهارات أكاديمية", icon: GraduationCap },
  { key: "practical", labelAr: "مهارات عملية", icon: FlaskConical },
  { key: "career", labelAr: "مهارات سوق العمل", icon: Briefcase },
  { key: "soft_skills", labelAr: "مهارات شخصية", icon: UserCheck },
] as const;

const DIFFICULTIES = ["beginner", "intermediate", "advanced"];
const DURATION_RANGES = [
  { key: "short", label: "قصير (< 30 د)", max: 30 },
  { key: "medium", label: "متوسط (30-60 د)", max: 60 },
  { key: "long", label: "طويل (> 60 د)", max: Infinity },
];

export default function Skills() {
  const { data: tracks = [], isLoading } = useSkillTracks();
  const { data: streak } = useStreak();
  const complete = useCompleteLesson();
  const { toast } = useToast();
  const t = useTranslation(globalI18n);
  const [, setLocation] = useLocation();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const onComplete = async (id: number) => {
    setBusyId(id);
    try {
      await complete.mutateAsync(id);
      toast({ title: t("goodJobPoints") });
    } catch (e) {
      toast({ title: t("error"), description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const currentTrack = useMemo(() => {
    const inProgress = tracks
      .filter((t) => t.progress > 0 && t.progress < 1)
      .sort((a, b) => b.progress - a.progress);
    return inProgress[0] || null;
  }, [tracks]);

  const nextLesson = useMemo(() => {
    if (!currentTrack) return null;
    return currentTrack.lessons.find((l) => !l.completed) || null;
  }, [currentTrack]);

  const remainingMinutes = currentTrack
    ? currentTrack.lessons.filter((l) => !l.completed).reduce((s, l) => s + l.durationMinutes, 0)
    : 0;

  const doneXP = useMemo(() => {
    let xp = 0;
    for (const t of tracks) {
      xp += t.lessons.filter((l) => l.completed).length * 5;
    }
    return xp;
  }, [tracks]);
  const remainingRewardXP = currentTrack
    ? currentTrack.lessons.filter((l) => !l.completed).length * 5
    : 0;

  const completedCount = tracks.filter((t) => t.progress === 1).length;
  const totalBadges = completedCount;
  const totalLessons = tracks.reduce((s, t) => s + t.lessons.length, 0);
  const completedLessons = tracks.reduce((s, t) => s + t.lessons.filter((l) => l.completed).length, 0);

  const strengths = useMemo(() => {
    const cats = tracks.reduce((acc, t) => {
      const done = t.lessons.filter((l) => l.completed).length;
      const total = t.lessons.length || 1;
      acc[t.category] = (acc[t.category] || 0) + done / total;
      return acc;
    }, {} as Record<string, number>);
    const entries = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    return {
      strongest: entries[0]?.[0] || null,
      weakest: entries[entries.length - 1]?.[0] || null,
    };
  }, [tracks]);

  const { data: apiRecs } = useSkillRecommendations();
  const recommendations = useMemo(() => {
    if (apiRecs) {
      // New format: { summary, weakAreas, tracks }
      if (Array.isArray(apiRecs)) return { tracks: apiRecs, summary: null, weakAreas: [] };
      if (apiRecs.tracks && apiRecs.tracks.length > 0) return apiRecs as { summary: string | null; weakAreas: string[]; tracks: { trackId: number; reason: string; priority?: number; xpEstimate?: number; durationMinutes?: number }[] };
    }
    const recs: { trackId: number; reason: string; priority?: number; xpEstimate?: number; durationMinutes?: number }[] = [];
    for (const t of tracks) {
      if (t.progress === 1) continue;
      const done = t.lessons.filter((l) => l.completed).length;
      if (done === 0) {
        recs.push({ trackId: t.id, reason: `ابدأ مسار ${t.title} — ${t.lessons.length} دروس` });
      }
    }
    if (strengths.weakest) {
      const weakTracks = tracks.filter((t) => t.category === strengths.weakest && t.progress < 1);
      if (weakTracks.length) {
        recs.push({ trackId: weakTracks[0].id, reason: `حسّن مستواك في ${weakTracks[0].category} — ${weakTracks[0].title}` });
      }
    }
    return { tracks: recs.slice(0, 3), summary: null, weakAreas: [] };
  }, [tracks, strengths, apiRecs]);

  const trackDurations = useMemo(() => {
    const map: Record<number, number> = {};
    for (const t of tracks) {
      map[t.id] = t.lessons.reduce((s, l) => s + l.durationMinutes, 0);
    }
    return map;
  }, [tracks]);

  const filteredTracks = useMemo(() => {
    return tracks.filter((t) => {
      if (selectedCategory && t.category !== selectedCategory) return false;
      if (selectedDifficulty && t.difficulty !== selectedDifficulty) return false;
      if (selectedYear !== null && (t as any).yearInCollege && (t as any).yearInCollege !== selectedYear) return false;
      if (selectedDuration) {
        const dur = trackDurations[t.id] || 0;
        const range = DURATION_RANGES.find((r) => r.key === selectedDuration);
        if (range) {
          const prev = DURATION_RANGES[DURATION_RANGES.indexOf(range) - 1];
          const min = prev ? prev.max : 0;
          if (dur < min || dur >= range.max) return false;
        }
      }
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tracks, selectedCategory, selectedDifficulty, selectedYear, selectedDuration, search, trackDurations]);

  const tracksByCategory = useMemo(() => {
    const map: Record<string, typeof tracks> = {};
    for (const t of filteredTracks) {
      const cat = CATEGORIES.find((c) => c.key === t.category)?.key || t.category;
      if (!map[cat]) map[cat] = [];
      map[cat].push(t);
    }
    return map;
  }, [filteredTracks]);

  return (
    <div className="min-h-screen bg-background">
      {/* ===== HERO — Current Track ===== */}
      {currentTrack && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b"
        >
          <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-2">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span>أكمل رحلتك الحالية</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-2xl font-bold truncate">{currentTrack.title}</h2>
                {nextLesson && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    <ArrowRight className="h-3 w-3 text-primary" />
                    <span>التالي: <strong className="text-foreground">{nextLesson.title}</strong></span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {nextLesson.durationMinutes} د
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-xs sm:text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Target className="h-3.5 w-3.5" />
                    التقدم: {Math.round(currentTrack.progress * 100)}%
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    {currentTrack.lessons.filter((l) => !l.completed).length} دروس متبقية
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    ~{remainingMinutes} دقيقة
                  </span>
                  <span className="flex items-center gap-1 text-amber-600 font-bold">
                    <Zap className="h-3.5 w-3.5" />
                    +{remainingRewardXP} XP عند الإنهاء
                  </span>
                </div>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden max-w-md">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${currentTrack.progress * 100}%` }}
                    className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                  />
                </div>
              </div>
              <Button onClick={() => setLocation(`/skills/${currentTrack.id}`)} className="shrink-0 gap-2">
                <span>استمر</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center justify-between mb-3">
          <div />
          <button onClick={() => setLocation("/skills/me")} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
            <Medal className="h-3.5 w-3.5" /> ملفي
          </button>
        </div>
        {/* ===== TOP STATS SNAPSHOT ===== */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6"
        >
          {[
            { icon: Trophy, label: "المسارات المكتملة", value: completedCount, color: "text-emerald-600" },
            { icon: Zap, label: "XP من المهارات", value: doneXP, color: "text-amber-600" },
            { icon: Star, label: "الشارات", value: totalBadges, color: "text-purple-600" },
            { icon: Flame, label: "الأيام المتتالية", value: streak?.currentStreak ?? 0, color: "text-orange-600" },
          ].map((stat, i) => (
            <div key={i} className="bg-card border rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className={`p-1.5 sm:p-2 rounded-lg bg-muted ${stat.color}`}>
                <stat.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-lg sm:text-2xl font-bold">{stat.value}</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{stat.label}</div>
                {i === 1 && doneXP > 0 && <div className="text-[9px] text-amber-600">+{doneXP} XP</div>}
              </div>
            </div>
          ))}
        </motion.div>
        {strengths.strongest && (
          <div className="flex items-center gap-2 mb-4 text-[10px] sm:text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-emerald-500" />
              أقوى مجال: <strong className="text-foreground">{strengths.strongest === "academic" ? "أكاديمية" : strengths.strongest === "practical" ? "عملية" : strengths.strongest === "career" ? "سوق العمل" : "شخصية"}</strong>
            </span>
            {strengths.weakest && (
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3 text-amber-500" />
                يحتاج تحسين: <strong className="text-foreground">{strengths.weakest === "academic" ? "أكاديمية" : strengths.weakest === "practical" ? "عملية" : strengths.weakest === "career" ? "سوق العمل" : "شخصية"}</strong>
              </span>
            )}
          </div>
        )}

        {/* ===== RECOMMENDATIONS ===== */}
        {recommendations.tracks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-primary/5 to-secondary/5 border rounded-xl p-3 sm:p-4 mb-4 sm:mb-6"
          >
            <div className="flex items-center gap-2 text-sm font-bold mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>مقترح لك</span>
            </div>
            {recommendations.summary && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-2">{recommendations.summary}</p>
            )}
            {recommendations.weakAreas.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {recommendations.weakAreas.map((w: string, wi: number) => (
                  <Badge key={wi} variant="destructive" className="text-[9px]">{w}</Badge>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              {recommendations.tracks.map((rec: any, i: number) => {
                const track = tracks.find((t) => t.id === rec.trackId);
                if (!track) return null;
                return (
                  <button
                    key={i}
                    onClick={() => setLocation(`/skills/${track.id}`)}
                    className="w-full text-right flex items-center gap-2 p-2 rounded-lg hover:bg-background transition text-xs sm:text-sm"
                  >
                    <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                    <span className="flex-1">{rec.reason}</span>
                    {rec.xpEstimate > 0 && (
                      <span className="text-[10px] font-bold text-amber-600 whitespace-nowrap">+{rec.xpEstimate} XP</span>
                    )}
                    {rec.durationMinutes > 0 && (
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">~{rec.durationMinutes} د</span>
                    )}
                    <Badge variant="outline" className="text-[10px]">{track.difficulty}</Badge>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ===== FILTERS ===== */}
        <div className="mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Input
                placeholder="ابحث في المهارات..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 text-sm pr-8"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-9 gap-2"
            >
              <Filter className="h-3.5 w-3.5" />
              <span className="text-xs">تصفية</span>
              <ChevronDown className={`h-3 w-3 transition ${showFilters ? "rotate-180" : ""}`} />
            </Button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-2 pt-3">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-muted-foreground self-center ml-1">التصنيف:</span>
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`text-xs px-2.5 py-1 rounded-full transition ${!selectedCategory ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
                    >
                      الكل
                    </button>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.key}
                        onClick={() => setSelectedCategory(selectedCategory === cat.key ? null : cat.key)}
                        className={`text-xs px-2.5 py-1 rounded-full transition flex items-center gap-1 ${selectedCategory === cat.key ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
                      >
                        <cat.icon className="h-3 w-3" />
                        {cat.labelAr}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-muted-foreground self-center ml-1">الصعوبة:</span>
                    <button
                      onClick={() => setSelectedDifficulty(null)}
                      className={`text-xs px-2.5 py-1 rounded-full transition ${!selectedDifficulty ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
                    >
                      الكل
                    </button>
                    {DIFFICULTIES.map((d) => (
                      <button
                        key={d}
                        onClick={() => setSelectedDifficulty(selectedDifficulty === d ? null : d)}
                        className={`text-xs px-2.5 py-1 rounded-full transition ${selectedDifficulty === d ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
                      >
                        {d === "beginner" ? "مبتدئ" : d === "intermediate" ? "متوسط" : "متقدم"}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-muted-foreground self-center ml-1">السنة:</span>
                    <button onClick={() => setSelectedYear(null)} className={`text-xs px-2.5 py-1 rounded-full transition ${selectedYear === null ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}>الكل</button>
                    {[1, 2, 3, 4].map((y) => (
                      <button key={y} onClick={() => setSelectedYear(selectedYear === y ? null : y)} className={`text-xs px-2.5 py-1 rounded-full transition ${selectedYear === y ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}>
                        {y}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-muted-foreground self-center ml-1">المدة:</span>
                    <button onClick={() => setSelectedDuration(null)} className={`text-xs px-2.5 py-1 rounded-full transition ${selectedDuration === null ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}>الكل</button>
                    {DURATION_RANGES.map((r) => (
                      <button key={r.key} onClick={() => setSelectedDuration(selectedDuration === r.key ? null : r.key)} className={`text-xs px-2.5 py-1 rounded-full transition ${selectedDuration === r.key ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ===== LOADING ===== */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* ===== EMPTY ===== */}
        {!isLoading && !tracks.length && (
          <div className="text-center py-16 border-2 border-dashed rounded-2xl">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{t("noTracksYet")}</p>
          </div>
        )}

        {/* ===== TRACKS BY CATEGORY ===== */}
        {!isLoading && tracks.length > 0 && Object.entries(tracksByCategory).length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            لا توجد نتائج تطابق بحثك
          </div>
        )}

        {!isLoading && Object.entries(tracksByCategory).map(([catKey, catTracks]) => {
          const catDef = CATEGORIES.find((c) => c.key === catKey);
          const CatIcon = catDef?.icon || Sparkles;
          return (
            <div key={catKey} className="mb-6 sm:mb-8">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <CatIcon className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-bold text-base sm:text-lg">{catDef?.labelAr || catKey}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {catTracks.map((track, ti) => {
                  const done = track.lessons.filter((l) => l.completed).length;
                  const pct = track.lessons.length ? Math.round((done / track.lessons.length) * 100) : 0;
                  const levelColors: Record<string, string> = {
                    beginner: "bg-slate-100 text-slate-700 border-slate-300",
                    learner: "bg-blue-100 text-blue-700 border-blue-300",
                    practitioner: "bg-emerald-100 text-emerald-700 border-emerald-300",
                    mastered: "bg-amber-100 text-amber-700 border-amber-300",
                  };
                  const levelLabels: Record<string, string> = {
                    beginner: "مبتدئ", learner: "متعلم", practitioner: "ممارس", mastered: "متقن",
                  };
                  const levelIcons: Record<string, any> = {
                    beginner: Circle, learner: Zap, practitioner: Award, mastered: Trophy,
                  };
                  const LevelIcon = levelIcons[track.level] || Circle;
                  return (
                    <motion.button
                      key={track.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: ti * 0.05 }}
                      onClick={() => setLocation(`/skills/${track.id}`)}
                      className="bg-card border rounded-xl sm:rounded-2xl p-3 sm:p-5 text-right hover:border-primary/30 transition text-left"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-bold text-sm sm:text-lg truncate">{track.title}</h3>
                            <span className={`inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${levelColors[track.level] || levelColors.beginner}`}>
                              <LevelIcon className="h-2.5 w-2.5" />
                              {levelLabels[track.level] || "مبتدئ"}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mt-0.5">{track.description}</p>
                        </div>
                        <Badge variant={track.difficulty === "advanced" ? "destructive" : track.difficulty === "intermediate" ? "secondary" : "default"} className="text-[10px] shrink-0">
                          {track.difficulty === "beginner" ? "مبتدئ" : track.difficulty === "intermediate" ? "متوسط" : "متقدم"}
                        </Badge>
                        {(track as any).yearInCollege > 0 && (
                          <Badge variant="outline" className="text-[8px] shrink-0">سنة {(track as any).yearInCollege}</Badge>
                        )}
                      </div>

                      {(track as any).prerequisites?.length > 0 && (
                        <div className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground">
                          <Lock className="h-2.5 w-2.5" />
                          <span>يتطلب: مسارات {((track as any).prerequisites as number[]).length}</span>
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-3 text-[10px] sm:text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {done}/{track.lessons.length}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {track.lessons.reduce((s, l) => s + l.durationMinutes, 0)} د
                        </span>
                      </div>

                      <div className="mt-2 h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                        />
                      </div>

                      <div className="mt-2 flex items-center gap-1">
                        {track.lessons.slice(0, 5).map((l) => (
                          <div
                            key={l.id}
                            className={`h-1.5 flex-1 rounded-full ${l.completed ? "bg-emerald-500" : "bg-muted-foreground/20"}`}
                          />
                        ))}
                        {track.lessons.length > 5 && (
                          <span className="text-[10px] text-muted-foreground mr-1">+{track.lessons.length - 5}</span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
