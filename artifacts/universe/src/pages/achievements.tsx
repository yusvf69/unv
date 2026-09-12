import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, ChevronRight, Sparkles, Target, Star, Medal, BookOpen, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAchievements } from "@/lib/api";
import { useLocation } from "wouter";

export default function Achievements() {
  const { data: achievements, isLoading } = useAchievements();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState("all");

  const completed = achievements?.filter((a: any) => a.completed) ?? [];
  const locked = achievements?.filter((a: any) => !a.completed) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <button
          onClick={() => setLocation("/profile")}
          className="inline-flex items-center text-xs sm:text-sm text-muted-foreground hover:text-primary mb-3 transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5 ml-1" />
          العودة
        </button>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-amber-500/10 via-primary/5 to-background border rounded-xl sm:rounded-2xl p-3 sm:p-5 mb-4 sm:mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20">
              <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
            </div>
            <div className="flex-1">
              <h1 className="font-bold text-base sm:text-xl">الإنجازات</h1>
              <p className="text-xs text-muted-foreground">
                {completed.length}/{achievements?.length ?? 0} مكتمل
              </p>
            </div>
            <Badge variant="outline" className="text-xs">{Math.round((completed.length / Math.max(achievements?.length ?? 1, 1)) * 100)}%</Badge>
          </div>
          <Progress value={Math.round((completed.length / Math.max(achievements?.length ?? 1, 1)) * 100)} className="mt-3 h-2" />
        </motion.div>

        {isLoading ? (
          <div className="text-center py-16 text-sm text-muted-foreground">جاري التحميل...</div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">الكل ({achievements?.length})</TabsTrigger>
              <TabsTrigger value="completed">مكتمل ({completed.length})</TabsTrigger>
              <TabsTrigger value="locked">مقفل ({locked.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(achievements ?? []).map((a: any, i: number) => (
                  <AchievementCard key={a.id} achievement={a} index={i} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="completed" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {completed.map((a: any, i: number) => (
                  <AchievementCard key={a.id} achievement={a} index={i} />
                ))}
                {completed.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">لا توجد إنجازات مكتملة بعد</div>}
              </div>
            </TabsContent>

            <TabsContent value="locked" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {locked.map((a: any, i: number) => (
                  <AchievementCard key={a.id} achievement={a} index={i} />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

function AchievementCard({ achievement, index }: { achievement: any; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`p-4 rounded-2xl border-2 ${achievement.completed ? "bg-emerald-500/10 border-emerald-500/40" : "bg-card border"}`}
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl">{achievement.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">{achievement.title}</div>
          <div className="text-[10px] text-muted-foreground">{achievement.desc}</div>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-amber-500 rounded-full transition-all" style={{ width: `${achievement.percent}%` }} />
          </div>
          <div className="text-[10px] mt-0.5 flex items-center justify-between">
            <span className="text-muted-foreground">{achievement.value} / {achievement.target}</span>
            {achievement.completed && <span className="text-emerald-600 font-bold flex items-center gap-0.5"><Zap className="h-2.5 w-2.5" /> مكتمل</span>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
