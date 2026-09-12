import { motion } from "framer-motion";
import {
  BookOpen, Target, Zap, BarChart3, ChevronRight,
  Brain, Sprout, Beaker, Briefcase, TrendingUp, Medal, Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useMySkills, useBadges, useActivityHeatmap } from "@/lib/api";
import { useTranslation, globalI18n } from "@/lib/i18n";
import { useLocation } from "wouter";

const LEVEL_META: Record<string, { label: string; color: string }> = {
  beginner: { label: "مبتدئ", color: "text-blue-500" },
  learner: { label: "متعلّم", color: "text-emerald-500" },
  practitioner: { label: "ممارس", color: "text-amber-500" },
  mastered: { label: "متقن", color: "text-purple-500" },
};

const CATEGORY_META: Record<string, { label: string; icon: any; color: string }> = {
  academic: { label: "أكاديمية", icon: Brain, color: "text-blue-500" },
  practical: { label: "عملية", icon: Sprout, color: "text-emerald-500" },
  career: { label: "مهنية", icon: Briefcase, color: "text-amber-500" },
  soft_skills: { label: "مهارات شخصية", icon: TrendingUp, color: "text-purple-500" },
};

export default function SkillsMe() {
  const t = useTranslation(globalI18n);
  const [, setLocation] = useLocation();
  const { data, isLoading } = useMySkills();
  const { data: badges } = useBadges();
  const { data: heatmap } = useActivityHeatmap();

  const levelMeta = LEVEL_META[data?.level ?? "beginner"];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        <button
          onClick={() => setLocation("/skills")}
          className="inline-flex items-center text-xs sm:text-sm text-muted-foreground hover:text-primary mb-3 transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5 ml-1" />
          العودة إلى المهارات
        </button>

        {isLoading ? (
          <div className="text-center py-16 text-sm text-muted-foreground">جاري التحميل...</div>
        ) : !data ? (
          <div className="text-center py-16 text-muted-foreground">لا توجد بيانات</div>
        ) : (
          <>
            {/* Hero */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-primary/10 via-secondary/5 to-background border rounded-xl sm:rounded-2xl p-3 sm:p-5 mb-4 sm:mb-6"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-muted ${levelMeta.color}`}>
                  <Medal className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="flex-1">
                  <h1 className="font-bold text-base sm:text-xl">مستوى المهارات</h1>
                  <p className="text-xs text-muted-foreground">
                    {levelMeta.label} · {Math.round(data.progress * 100)}% إتمام
                  </p>
                </div>
                <Badge className={`text-xs ${levelMeta.color}`}>{data.level}</Badge>
              </div>
              <Progress value={Math.round(data.progress * 100)} className="mt-3 h-2" />
            </motion.div>

            {/* Stats strip */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6"
            >
              {[
                { icon: BookOpen, label: "المسارات", value: data.totalTracks, color: "text-blue-500" },
                { icon: Target, label: "الدروس المكتملة", value: `${data.completedLessons}/${data.totalLessons}`, color: "text-emerald-500" },
                { icon: Zap, label: "XP من المهارات", value: data.xpFromSkills, color: "text-amber-500" },
                { icon: BarChart3, label: "إجمالي النقاط", value: data.points, color: "text-purple-500" },
              ].map((stat, i) => (
                <div key={i} className="bg-card border rounded-xl p-3 flex items-center gap-2 sm:gap-3">
                  <div className={`p-1.5 sm:p-2 rounded-lg bg-muted ${stat.color}`}>
                    <stat.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div>
                    <div className="text-lg sm:text-2xl font-bold">{stat.value}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Activity Heatmap */}
            {heatmap && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border rounded-xl p-3 sm:p-4 mb-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    سجل النشاط
                  </h2>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{heatmap.activeDays}/{heatmap.totalDays} يوم</span>
                    <span>·</span>
                    <span>{heatmap.totalMinutes} دقيقة</span>
                    <span>·</span>
                    <span>أطول: {heatmap.longestStreak} يوم</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-0.5" dir="ltr">
                  {heatmap.data.filter((_, i) => i % 7 === 0).map((day, i) => {
                    const levels = ["bg-muted/30", "bg-emerald-500/20", "bg-emerald-500/40", "bg-emerald-500/60", "bg-emerald-500"];
                    return (
                      <div
                        key={i}
                        title={`${day.date}: ${day.minutes} دقيقة`}
                        className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm ${levels[day.level] || levels[0]}`}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center gap-1 mt-2 text-[8px] text-muted-foreground justify-end">
                  <span>أقل</span>
                  <div className="w-2.5 h-2.5 rounded-sm bg-muted/30" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/60" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  <span>أكثر</span>
                </div>
              </motion.div>
            )}

            {/* Badges */}
            {badges && badges.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border rounded-xl p-3 sm:p-4 mb-4"
              >
                <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <Medal className="h-4 w-4 text-amber-500" />
                  الشارات
                </h2>
                <div className="flex flex-wrap gap-2">
                  {badges.map((badge) => (
                    <div
                      key={badge.id}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs ${
                        badge.completed
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-700"
                          : "bg-muted/30 border text-muted-foreground opacity-60"
                      }`}
                    >
                      <span className="text-sm">{badge.icon}</span>
                      <span className="font-medium">{badge.title}</span>
                      {badge.completed && <Zap className="h-3 w-3 text-amber-500" />}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Per-track cards */}
            <div className="space-y-3">
              <h2 className="font-bold text-base sm:text-lg flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                تقدم المسارات
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {data.tracks.map((track, i) => {
                  const catMeta = CATEGORY_META[track.category] ?? { label: track.category, icon: BookOpen, color: "text-muted-foreground" };
                  const lvlMeta = LEVEL_META[track.level] ?? { label: track.level, color: "text-muted-foreground" };
                  return (
                    <motion.div
                      key={track.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-card border rounded-xl sm:rounded-2xl p-3 sm:p-4 cursor-pointer hover:border-primary/30 transition"
                      onClick={() => setLocation(`/skills/${track.id}`)}
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <div className={`p-1.5 rounded-lg bg-muted ${catMeta.color}`}>
                          <catMeta.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm truncate">{track.title}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[9px]">{catMeta.label}</Badge>
                            <Badge variant="outline" className={`text-[9px] ${lvlMeta.color}`}>{track.level}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                        <span>{track.completedLessons}/{track.totalLessons} درس</span>
                        <span>{Math.round(track.progress * 100)}%</span>
                      </div>
                      <Progress value={Math.round(track.progress * 100)} className="h-1.5" />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
