import * as Haptics from "expo-haptics";
import { useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { NeoButton } from "@/components/NeoButton";
import { useGameLeaderboard } from "@/hooks/useApi";
import { Gamepad2, Trophy, Medal, Zap, Brain, Timer, Puzzle } from "lucide-react-native";

const GAMES = [
  { key: "memory", label: "Memory Match", desc: "Match pairs to test your memory", icon: Brain },
  { key: "quiz-race", label: "Quiz Race", desc: "Answer fast, score big", icon: Timer },
  { key: "word-puzzle", label: "Word Puzzle", desc: "Unscramble words against time", icon: Puzzle },
];

const GAME_ICONS: Record<string, React.ElementType> = {
  memory: Brain,
  "quiz-race": Timer,
  "word-puzzle": Puzzle,
};

export default function GamesScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { data: leaderboard, isLoading: lbLoading, refetch } = useGameLeaderboard();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const topPlayers = (leaderboard || []).slice(0, 10);

  const sections = [
    { type: "games" as const, data: GAMES },
    ...(topPlayers.length > 0 ? [{ type: "leaderboard" as const, data: topPlayers }] : []),
  ];

  return (
    <GradientBackground>
      <GlassCard style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12, marginHorizontal: 16, marginTop: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: colors.secondary + "15",
            alignItems: "center", justifyContent: "center",
          }}>
            <Gamepad2 size={18} color={colors.secondary} />
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700", letterSpacing: -0.5 }}>Games</Text>
        </View>
      </GlassCard>

      {lbLoading && !leaderboard ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item, i) => item.type + i}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item: section }) => {
            if (section.type === "games") {
              return (
                <>
                  {GAMES.map((game) => {
                    const Icon = GAME_ICONS[game.key];
                    return (
                      <GlassCard key={game.key} style={{ padding: 20, marginBottom: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <View style={{
                            width: 56, height: 56, borderRadius: 18,
                            backgroundColor: colors.secondary + "18",
                            alignItems: "center", justifyContent: "center",
                          }}>
                            {Icon && <Icon size={26} color={colors.secondary} />}
                          </View>
                          <View style={{ flex: 1, marginLeft: 16 }}>
                            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600" }}>{game.label}</Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{game.desc}</Text>
                          </View>
                        </View>
                        <NeoButton
                          label="Play"
                          variant="secondary"
                          style={{ marginTop: 14 }}
                        />
                      </GlassCard>
                    );
                  })}
                  {topPlayers.length > 0 && (
                    <GlassCard style={{ paddingHorizontal: 16, paddingVertical: 10, marginBottom: 14, alignSelf: "flex-start" }}>
                      <Text style={{
                        color: colors.text, fontSize: 18, fontWeight: "700", letterSpacing: -0.3,
                      }}>
                        Leaderboard
                      </Text>
                    </GlassCard>
                  )}
                </>
              );
            }
            return (
              <>
                {topPlayers.map((entry, i) => (
                  <GlassCard key={entry.id} style={{
                    padding: 14, marginBottom: 6,
                    flexDirection: "row", alignItems: "center",
                  }}>
                    <View style={{ width: 32, alignItems: "center" }}>
                      {i === 0 ? (
                        <Trophy size={20} color={colors.accentGold} />
                      ) : i < 3 ? (
                        <Medal size={18} color={colors.secondary} />
                      ) : (
                        <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: "500" }}>{i + 1}</Text>
                      )}
                    </View>
                    <View style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: i < 3 ? colors.secondary + "20" : colors.primary + "10",
                      alignItems: "center", justifyContent: "center", marginLeft: 10,
                    }}>
                      <Text style={{
                        color: i < 3 ? colors.secondary : colors.text,
                        fontSize: 15, fontWeight: "700",
                      }}>
                        {(entry.userName || "?")[0].toUpperCase()}
                      </Text>
                    </View>
                    <Text style={{
                      color: colors.text, fontSize: 15, fontWeight: "500",
                      marginLeft: 12, flex: 1,
                    }} numberOfLines={1}>
                      {entry.userName || "Unknown"}
                    </Text>
                    <View style={{
                      flexDirection: "row", alignItems: "center", gap: 5,
                      backgroundColor: colors.accentGold + "15",
                      paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
                    }}>
                      <Zap size={14} color={colors.accentGold} />
                      <Text style={{ color: colors.accentGold, fontSize: 15, fontWeight: "700" }}>{entry.score}</Text>
                    </View>
                  </GlassCard>
                ))}
              </>
            );
          }}
        />
      )}
    </GradientBackground>
  );
}
