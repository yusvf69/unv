import { useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy, Users, ChevronRight, Gamepad2, Target, CheckCircle2, Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useCoopChallenges, useJoinCoopChallenge, useCoopChallengeScore } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function CoopChallenges() {
  const [, setLocation] = useLocation();
  const { data: challenges = [], isLoading } = useCoopChallenges();
  const joinChallenge = useJoinCoopChallenge();
  const submitScore = useCoopChallengeScore();
  const { toast } = useToast();
  const [teamNames, setTeamNames] = useState<Record<number, string>>({});

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <button onClick={() => setLocation("/games")} className="inline-flex items-center text-xs sm:text-sm text-muted-foreground hover:text-primary mb-3 transition-colors">
          <ChevronRight className="h-3.5 w-3.5 ml-1" />العودة
        </button>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-amber-500/10 via-primary/5 to-background border rounded-xl sm:rounded-2xl p-3 sm:p-5 mb-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10"><Users className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" /></div>
            <div>
              <h1 className="font-bold text-base sm:text-xl">التحديات الجماعية</h1>
              <p className="text-xs text-muted-foreground">تنافس مع زملائك في فرق وحقق أعلى النقاط</p>
            </div>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="text-center py-16 text-sm text-muted-foreground">جاري التحميل...</div>
        ) : (
          <div className="space-y-3">
            {challenges.map((ch, i) => (
              <motion.div key={ch.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card border rounded-xl p-3 sm:p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10"><Trophy className="h-4 w-4 text-amber-500" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm flex items-center gap-2">{ch.title}</div>
                    <div className="text-[10px] text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[9px]">{ch.gameKey}</Badge>
                      <span>الهدف: {ch.targetScore} نقطة</span>
                      <span>+{ch.xpReward} XP</span>
                      <span>تنتهي: {ch.endDate}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {ch.joined
                        ? `فريقك: ${ch.myTeamName || "بدون اسم"} · ${ch.myScore > 0 ? `نقاطك: ${ch.myScore}` : "لم تسجل بعد"}`
                        : "لم تنضم بعد"}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {ch.joined ? (
                      ch.myScore === 0 ? (
                        <Button size="sm" variant="outline" className="h-8 text-[10px]" disabled>
                          انتظر النتيجة
                        </Button>
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      )
                    ) : (
                      <div className="flex items-center gap-1">
                        <Input
                          value={teamNames[ch.id] || ""}
                          onChange={(e) => setTeamNames({ ...teamNames, [ch.id]: e.target.value })}
                          placeholder="اسم الفريق"
                          className="h-8 text-[10px] w-24"
                        />
                        <Button size="sm" className="h-8 text-[10px]" onClick={async () => {
                          try {
                            await joinChallenge.mutateAsync({ id: ch.id, teamName: teamNames[ch.id] || "" });
                            toast({ title: "انضممت للتحدي!" });
                          } catch (e) {
                            toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
                          }
                        }}>
                          <Target className="h-3 w-3 ml-1" /> اشترك
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            {!challenges.length && <p className="text-center py-16 text-sm text-muted-foreground">لا توجد تحديات نشطة حالياً</p>}
          </div>
        )}
      </div>
    </div>
  );
}
