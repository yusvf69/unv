import { motion } from "framer-motion";
import {
  Target, CheckCircle2, Circle, Zap, Sparkles, ChevronRight,
  BookOpen, Gamepad2, ClipboardList, MessageSquare, TrendingUp, Flame,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDailyMissions, useCompleteMission, useStreak } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const MISSION_ICONS: Record<string, any> = {
  skill: BookOpen,
  game: Gamepad2,
  quiz: ClipboardList,
  forum: MessageSquare,
  focus: TrendingUp,
  streak: Flame,
  challenge: Zap,
};

const MISSION_COLORS: Record<string, string> = {
  skill: "text-blue-500",
  game: "text-amber-500",
  quiz: "text-purple-500",
  forum: "text-emerald-500",
  focus: "text-rose-500",
  streak: "text-orange-500",
  challenge: "text-cyan-500",
};

export default function Missions() {
  const { data: missions, isLoading } = useDailyMissions();
  const { data: streak } = useStreak();
  const complete = useCompleteMission();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const handleComplete = async (id: number) => {
    try {
      await complete.mutateAsync(id);
      toast({ title: "تم!", description: "اكسبت XP إضافي" });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  const done = missions?.filter((m) => m.completed).length ?? 0;
  const total = missions?.length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <button
          onClick={() => setLocation("/games")}
          className="inline-flex items-center text-xs sm:text-sm text-muted-foreground hover:text-primary mb-3 transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5 ml-1" />
          العودة
        </button>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary/10 via-secondary/5 to-background border rounded-xl sm:rounded-2xl p-3 sm:p-5 mb-4 sm:mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Target className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="font-bold text-base sm:text-xl">المهام اليومية</h1>
              <p className="text-xs text-muted-foreground">
                {done}/{total} مكتمل · اكسب XP يومياً
              </p>
              {streak && (
                <div className="flex items-center gap-1 mt-1">
                  <Flame className={`h-3 w-3 ${streak.activeToday ? "text-orange-500" : "text-muted-foreground"}`} />
                  <span className={`text-[10px] font-bold ${streak.currentStreak > 0 ? "text-orange-600" : "text-muted-foreground"}`}>
                    {streak.currentStreak} يوم متتالي
                  </span>
                  {streak.currentStreak >= 7 && <Sparkles className="h-2.5 w-2.5 text-amber-400" />}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className="text-xs">{done === total ? "مكتمل!" : `${Math.round((done / Math.max(total, 1)) * 100)}%`}</Badge>
              {streak && (
                <span className="text-[9px] text-muted-foreground">أطول: {streak.longestStreak} يوم</span>
              )}
            </div>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="text-center py-16 text-sm text-muted-foreground">جاري التحميل...</div>
        ) : (
          <div className="space-y-2">
            {missions?.map((mission, i) => {
              const Icon = MISSION_ICONS[mission.kind] || Target;
              const color = MISSION_COLORS[mission.kind] || "text-muted-foreground";
              return (
                <motion.div
                  key={mission.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`bg-card border rounded-xl p-3 sm:p-4 flex items-center gap-3 ${mission.completed ? "border-emerald-500/30 bg-emerald-500/5" : ""}`}
                >
                  <div className={`p-1.5 rounded-lg bg-muted ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold flex items-center gap-2">
                      {mission.title}
                      {mission.completed && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{mission.description}</div>
                  </div>
                  <div className="text-xs font-bold text-amber-600 whitespace-nowrap">+{mission.points} XP</div>
                  {!mission.completed && (
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => handleComplete(mission.id)} disabled={complete.isPending}>
                      {complete.isPending ? <Zap className="h-3 w-3 animate-pulse" /> : "أكملت"}
                    </Button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
