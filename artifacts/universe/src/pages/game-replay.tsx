import { useParams } from "wouter";
import { motion } from "framer-motion";
import { Gamepad2, Trophy, Clock, RotateCcw, ChevronRight, User } from "lucide-react";
import { useGameReplay, useMyGameScores } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from "wouter";

export default function GameReplay() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { data: replay, isLoading } = useGameReplay(id ? Number(id) : null);
  const { data: myScores = [] } = useMyGameScores(10);

  if (isLoading) return <div className="container mx-auto px-4 py-32 text-center text-sm text-muted-foreground">جاري التحميل...</div>;
  if (!replay) return <div className="container mx-auto px-4 py-32 text-center text-sm text-muted-foreground">لم يتم العثور على الإعادة</div>;

  const durationSec = Math.floor((replay.durationMs || 0) / 1000);
  const maxPossible = 1000;
  const accuracy = maxPossible > 0 ? Math.round((replay.score / maxPossible) * 100) : 0;
  const stars = replay.score >= maxPossible * 0.8 ? 3 : replay.score >= maxPossible * 0.5 ? 2 : replay.score > 0 ? 1 : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <button onClick={() => setLocation("/games")} className="inline-flex items-center text-xs sm:text-sm text-muted-foreground hover:text-primary mb-3 transition-colors">
          <ChevronRight className="h-3.5 w-3.5 ml-1" />العودة
        </button>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4"
        >
          <div className="text-center mb-4">
            <Gamepad2 className="h-10 w-10 mx-auto text-primary mb-2" />
            <h1 className="font-bold text-lg">إعادة اللعبة</h1>
            <p className="text-xs text-muted-foreground">{replay.gameKey}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <Trophy className="h-4 w-4 mx-auto text-amber-500 mb-1" />
              <div className="text-xl font-bold">{replay.score}</div>
              <div className="text-[10px] text-muted-foreground">النتيجة</div>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <div className="flex justify-center gap-0.5 mb-1">
                {[1, 2, 3].map((s) => (
                  <span key={s} className={`text-sm ${s <= stars ? "text-amber-500" : "text-muted-foreground/30"}`}>⭐</span>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground">النجوم</div>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <Clock className="h-4 w-4 mx-auto text-primary mb-1" />
              <div className="text-xl font-bold">{durationSec}s</div>
              <div className="text-[10px] text-muted-foreground">المدة</div>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <User className="h-4 w-4 mx-auto text-blue-500 mb-1" />
              <div className="text-sm font-bold truncate">{replay.user.name}</div>
              <div className="text-[10px] text-muted-foreground">اللاعب</div>
            </div>
          </div>

          {accuracy > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>الدقة</span>
                <span>{accuracy}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${accuracy >= 80 ? "bg-emerald-500" : accuracy >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${accuracy}%` }} />
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-center">
            <Link href="/games">
              <Button size="sm" variant="outline"><ChevronRight className="h-3.5 w-3.5 ml-1" />الألعاب</Button>
            </Link>
            <Link href={`/games/profile`}>
              <Button size="sm">ملفي</Button>
            </Link>
          </div>
        </motion.div>

        {myScores.length > 1 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-card border rounded-xl p-3 sm:p-4"
          >
            <h3 className="font-bold text-sm mb-2">أحدث نتائجك</h3>
            <div className="space-y-1">
              {myScores.slice(0, 5).map((s: any) => (
                <div key={s.id} className="flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-muted/30">
                  <Trophy className="h-3 w-3 text-amber-500" />
                  <span className="flex-1">{s.gameKey}</span>
                  <span className="font-bold">{s.score}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(s.createdAt).toLocaleDateString("ar-EG")}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
