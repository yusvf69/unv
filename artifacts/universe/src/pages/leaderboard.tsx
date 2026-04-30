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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-col items-center mb-12">
        <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mb-4">
          <Trophy className="w-10 h-10 text-accent" />
        </div>
        <h1 className="text-4xl font-serif font-bold text-primary mb-6 text-center">{t("leaderboard")}</h1>
        
        <Tabs value={period} onValueChange={(v) => setPeriod(v as GetLeaderboardPeriod)}>
          <TabsList className="grid w-full grid-cols-4 max-w-[400px]">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="alltime">All Time</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {isLoading ? (
        <div className="p-8 text-center">Loading...</div>
      ) : (
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {leaderboard?.map((entry) => (
              <div key={entry.userId} className="flex items-center p-4 hover:bg-muted/50 transition-colors">
                <div className="w-12 text-center font-bold text-xl text-muted-foreground">
                  #{entry.rank}
                </div>
                <div className="w-8 flex justify-center mr-4">
                  {entry.deltaRank > 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : entry.deltaRank < 0 ? (
                    <TrendingDown className="w-4 h-4 text-destructive" />
                  ) : (
                    <Minus className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/10 overflow-hidden shrink-0">
                  {entry.avatarUrl ? (
                    <img src={entry.avatarUrl} alt={entry.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary font-bold">
                      {entry.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="ml-4 flex-1">
                  <div className="font-bold">{entry.name}</div>
                  <div className="text-xs text-muted-foreground">{entry.department} • Year {entry.year}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-secondary">{entry.points} pts</div>
                  <div className="text-xs text-muted-foreground">Level {entry.level} • 🔥 {entry.streak}</div>
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
