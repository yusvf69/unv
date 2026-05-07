import { useGetLeaderboard } from "@workspace/api-client-react";
import { useTranslation, globalI18n } from "@/lib/i18n";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";

type GetLeaderboardPeriod = "weekly" | "monthly" | "all";

export default function Leaderboard() {
  const [period, setPeriod] = useState<GetLeaderboardPeriod>("weekly");
  const { data: leaderboard, isLoading } = useListLeaderboard(period);
  const t = useTranslation(globalI18n);

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl">
      <div className="flex flex-col items-center mb-8 sm:mb-12">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-accent/20 rounded-full flex items-center justify-center mb-3 sm:mb-4">
          <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-accent" />
        </div>
        <h1 className="text-2xl sm:text-4xl font-serif font-bold text-primary mb-4 sm:mb-6 text-center">{t("leaderboard")}</h1>
        
        <Tabs value={period} onValueChange={(v) => setPeriod(v as GetLeaderboardPeriod)}>
          <TabsList className="grid w-full grid-cols-4 max-w-[320px] sm:max-w-[400px]">
            <TabsTrigger value="daily" className="text-xs sm:text-sm">Daily</TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs sm:text-sm">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs sm:text-sm">Monthly</TabsTrigger>
            <TabsTrigger value="alltime" className="text-xs sm:text-sm">All Time</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {isLoading ? (
        <div className="p-8 text-center">Loading...</div>
      ) : (
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {leaderboard?.map((entry) => (
              <div key={entry.userId} className="flex items-center p-3 sm:p-4 hover:bg-muted/50 transition-colors gap-2 sm:gap-0">
                <div className="w-8 sm:w-12 text-center font-bold text-base sm:text-xl text-muted-foreground shrink-0">
                  #{entry.rank}
                </div>
                <div className="w-6 sm:w-8 flex justify-center shrink-0">
                  {entry.deltaRank > 0 ? (
                    <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                  ) : entry.deltaRank < 0 ? (
                    <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-destructive" />
                  ) : (
                    <Minus className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 overflow-hidden shrink-0">
                  {entry.avatarUrl ? (
                    <img src={entry.avatarUrl} alt={entry.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary font-bold text-xs sm:text-base">
                      {entry.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="ms-2 sm:ml-4 flex-1 min-w-0">
                  <div className="font-bold text-sm sm:text-base truncate">{entry.name}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{entry.department} • Year {entry.year}</div>
                </div>
                <div className="text-end shrink-0">
                  <div className="font-bold text-secondary text-xs sm:text-sm">{entry.points} pts</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">Level {entry.level} • 🔥 {entry.streak}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function useListLeaderboard(period: GetLeaderboardPeriod) {
  return useGetLeaderboard({ period: period as any });
}
