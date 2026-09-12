import { useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy, Star, Zap, Brain, Wheat, Timer, Sprout, Beaker,
  Medal, ChevronRight, Clock, TrendingUp, Target, Calendar, Search, Sword,
  Shield, Droplets, FlaskConical, Warehouse, ShieldAlert, TreePine, Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMyGameScores, useGameStats } from "@/lib/api";
import { useTranslation, globalI18n } from "@/lib/i18n";
import { useLocation } from "wouter";

const GAME_LABELS: Record<string, { labelAr: string; icon: any; color: string }> = {
  soil_match: { labelAr: "ذاكرة المحاصيل", icon: Brain, color: "text-blue-500" },
  plant_quiz: { labelAr: "اختبار النبات", icon: Wheat, color: "text-emerald-500" },
  harvest_run: { labelAr: "موسم الحصاد", icon: Trophy, color: "text-amber-500" },
  plant_id: { labelAr: "تعرّف على النبات", icon: Sprout, color: "text-green-500" },
  soil_ph: { labelAr: "توازن التربة", icon: Beaker, color: "text-purple-500" },
  crop_match: { labelAr: "مطابقة المحاصيل", icon: Calendar, color: "text-orange-500" },
  disease_detect: { labelAr: "كشف الأمراض", icon: Search, color: "text-red-500" },
  case_battle: { labelAr: "معركة القرار", icon: Sword, color: "text-indigo-500" },
  pest_defender: { labelAr: "مدافع الآفات", icon: Shield, color: "text-lime-600" },
  irrigation_planner: { labelAr: "مخطط الري", icon: Droplets, color: "text-cyan-600" },
  fertilizer_lab: { labelAr: "مختبر التسميد", icon: FlaskConical, color: "text-teal-600" },
  greenhouse_manager: { labelAr: "مدير الصوبة", icon: Warehouse, color: "text-emerald-700" },
  lab_safety: { labelAr: "سلامة المعمل", icon: ShieldAlert, color: "text-yellow-600" },
  seed_to_harvest: { labelAr: "من البذرة للحصاد", icon: TreePine, color: "text-green-700" },
  exam_blitz: { labelAr: "الاجتياح", icon: Gauge, color: "text-rose-600" },
};

function starsForScore(score: number, maxScore: number): number {
  if (score >= maxScore * 0.8) return 3;
  if (score >= maxScore * 0.5) return 2;
  if (score > 0) return 1;
  return 0;
}

function starDisplay(stars: number) {
  return [1, 2, 3].map((s) => (
    <Star key={s} className={`h-3 w-3 ${s <= stars ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"}`} />
  ));
}

export default function GameProfile() {
  const t = useTranslation(globalI18n);
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState("overview");
  const { data: scores, isLoading: scoresLoading } = useMyGameScores(100);
  const { data: stats, isLoading: statsLoading } = useGameStats();

  const isLoading = scoresLoading || statsLoading;

  const GAME_MAX_SCORES: Record<string, number> = {
    soil_match: 850, plant_quiz: 1000, harvest_run: 1500, plant_id: 960, soil_ph: 1500,
    crop_match: 1200, disease_detect: 1400, case_battle: 2000, pest_defender: 1600,
    irrigation_planner: 1500, fertilizer_lab: 1400, greenhouse_manager: 2800,
    lab_safety: 800, seed_to_harvest: 1800, exam_blitz: 1000,
  };

  const allStars = scores
    ? scores.reduce((acc, s) => acc + starsForScore(s.score, GAME_MAX_SCORES[s.gameKey] ?? 1000), 0)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        <button
          onClick={() => setLocation("/games")}
          className="inline-flex items-center text-xs sm:text-sm text-muted-foreground hover:text-primary mb-3 transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5 ml-1" />
          العودة إلى الألعاب
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-amber-500/10 via-primary/5 to-background border rounded-xl sm:rounded-2xl p-3 sm:p-5 mb-4 sm:mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20">
              <Medal className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-xl">ملف الألعاب</h1>
              <p className="text-xs text-muted-foreground">إحصائياتك وإنجازاتك في الألعاب</p>
            </div>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="text-center py-16 text-sm text-muted-foreground">جاري التحميل...</div>
        ) : (
          <>
            {/* Stats strip */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6"
            >
              {[
                { icon: Trophy, label: "الألعاب الملعوبة", value: stats?.totals.gamesPlayed ?? 0, color: "text-amber-600" },
                { icon: Star, label: "إجمالي النجوم", value: allStars, color: "text-amber-500" },
                { icon: Zap, label: "إجمالي XP", value: stats?.totals.totalXP ?? 0, color: "text-amber-600" },
                { icon: Target, label: "أفضل نتيجة", value: Math.max(...Object.values(stats?.byGame ?? {}).map((g) => g.best), 0), color: "text-purple-600" },
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

            <Tabs value={tab} onValueChange={setTab} className="mb-4">
              <TabsList>
                <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
                <TabsTrigger value="history">سجل النتائج</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {Object.entries(stats?.byGame ?? {}).map(([gameKey, gameStats], i) => {
                    const meta = GAME_LABELS[gameKey];
                    if (!meta) return null;
                    const maxScore = GAME_MAX_SCORES[gameKey] ?? 1000;
                    return (
                      <motion.div
                        key={gameKey}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-card border rounded-xl sm:rounded-2xl p-3 sm:p-4"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`p-1.5 rounded-lg bg-muted ${meta.color}`}>
                            <meta.icon className="h-4 w-4" />
                          </div>
                          <h3 className="font-bold text-sm">{meta.labelAr}</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">عدد المرات:</span>
                            <span className="mr-1 font-bold">{gameStats.count}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">أفضل نتيجة:</span>
                            <span className="mr-1 font-bold">{gameStats.best}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">إجمالي النقاط:</span>
                            <span className="mr-1 font-bold">{gameStats.total}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">المتوسط:</span>
                            <span className="mr-1 font-bold">{gameStats.count > 0 ? Math.round(gameStats.total / gameStats.count) : 0}</span>
                          </div>
                        </div>
                        {/* Stars distribution */}
                        <div className="mt-3 pt-3 border-t flex gap-2">
                          <div className="flex-1 text-center p-1 rounded-lg bg-amber-500/10">
                            <div className="flex justify-center gap-0.5">{starDisplay(3)}</div>
                            <div className="text-[10px] mt-0.5 text-muted-foreground">{gameStats.stars3}</div>
                          </div>
                          <div className="flex-1 text-center p-1 rounded-lg bg-amber-500/10">
                            <div className="flex justify-center gap-0.5">{starDisplay(2)}</div>
                            <div className="text-[10px] mt-0.5 text-muted-foreground">{gameStats.stars2 + gameStats.stars3}</div>
                          </div>
                          <div className="flex-1 text-center p-1 rounded-lg bg-amber-500/10">
                            <div className="flex justify-center gap-0.5">{starDisplay(1)}</div>
                            <div className="text-[10px] mt-0.5 text-muted-foreground">{gameStats.stars1 + gameStats.stars2 + gameStats.stars3}</div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  {(!stats?.byGame || Object.keys(stats.byGame).length === 0) && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      <Medal className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>لم تلعب أي لعبة بعد</p>
                      <Button size="sm" className="mt-3" onClick={() => setLocation("/games")}>
                        ابدأ اللعب
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <div className="bg-card border rounded-xl sm:rounded-2xl overflow-hidden">
                  {scores && scores.length > 0 ? (
                    <div className="divide-y">
                      {scores.map((entry, i) => {
                        const meta = GAME_LABELS[entry.gameKey];
                        const maxScore = GAME_MAX_SCORES[entry.gameKey] ?? 1000;
                        const stars = starsForScore(entry.score, maxScore);
                        return (
                          <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.02 }}
                            className="flex items-center gap-3 p-3 sm:p-4"
                          >
                            <div className={`p-1.5 rounded-lg bg-muted ${meta?.color ?? ""}`}>
                              {meta ? <meta.icon className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold">{meta?.labelAr ?? entry.gameKey}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {new Date(entry.createdAt).toLocaleDateString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                            <div className="flex gap-0.5">{starDisplay(stars)}</div>
                            <div className="text-sm font-bold text-primary min-w-[3rem] text-left">{entry.score}</div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>لا توجد نتائج بعد</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
