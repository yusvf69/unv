import { motion } from "framer-motion";
import { Gamepad2, Trophy, Users, TrendingUp, Target, ChevronRight } from "lucide-react";
import { useGameAnalytics } from "@/lib/api";
import { useLocation } from "wouter";

export default function GameAnalytics() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useGameAnalytics();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        <button onClick={() => setLocation("/admin")} className="inline-flex items-center text-xs sm:text-sm text-muted-foreground hover:text-primary mb-3 transition-colors">
          <ChevronRight className="h-3.5 w-3.5 ml-1" />العودة
        </button>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary/10 via-amber-500/5 to-background border rounded-xl sm:rounded-2xl p-3 sm:p-5 mb-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10"><TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /></div>
            <div>
              <h1 className="font-bold text-base sm:text-xl">تحليلات الألعاب</h1>
              <p className="text-xs text-muted-foreground">إحصائيات استخدام الألعاب على المنصة</p>
            </div>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="text-center py-16 text-sm text-muted-foreground">جاري التحميل...</div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
              {[
                { icon: Gamepad2, label: "إجمالي مرات اللعب", value: data.totalGamesPlayed, color: "text-primary" },
                { icon: Users, label: "عدد اللاعبين", value: data.totalUniquePlayers, color: "text-blue-600" },
                { icon: Trophy, label: "متوسط النقاط", value: data.byGame.length ? Math.round(data.byGame.reduce((s, g) => s + g.avgScore, 0) / data.byGame.length) : 0, color: "text-amber-600" },
                { icon: Target, label: "أفضل لعبة", value: data.byGame[0]?.gameKey || "-", color: "text-purple-600" },
              ].map((stat, i) => (
                <div key={i} className="bg-card border rounded-xl p-3 flex items-center gap-2 sm:gap-3">
                  <div className={`p-1.5 sm:p-2 rounded-lg bg-muted ${stat.color}`}>
                    <stat.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div>
                    <div className="text-lg sm:text-2xl font-bold truncate max-w-[100px]">{String(stat.value)}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <h2 className="font-bold text-sm mb-2">تفاصيل حسب اللعبة</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-right p-2">اللعبة</th>
                      <th className="text-center p-2">مرات اللعب</th>
                      <th className="text-center p-2">لاعبين فريدين</th>
                      <th className="text-center p-2">متوسط النقاط</th>
                      <th className="text-center p-2">أفضل نتيجة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byGame.map((g, i) => (
                      <tr key={g.gameKey} className="border-b hover:bg-muted/30">
                        <td className="p-2 font-medium">{g.gameKey}</td>
                        <td className="text-center p-2">{g.plays}</td>
                        <td className="text-center p-2">{g.uniquePlayers}</td>
                        <td className="text-center p-2">{g.avgScore}</td>
                        <td className="text-center p-2 font-bold">{g.bestScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </>
        ) : null}
      </div>
    </div>
  );
}
