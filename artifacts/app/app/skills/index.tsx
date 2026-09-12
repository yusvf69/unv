import * as Haptics from "expo-haptics";
import { useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { useSkillTracks } from "@/hooks/useApi";
import { BookOpen, CheckCircle, Circle, ChevronRight } from "lucide-react-native";

export default function SkillsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { data: tracks, isLoading, refetch } = useSkillTracks();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <GradientBackground>
      <GlassCard style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12, marginHorizontal: 16, marginTop: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: colors.primary + "15",
            alignItems: "center", justifyContent: "center",
          }}>
            <BookOpen size={18} color={colors.primary} />
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700", letterSpacing: -0.5 }}>Skills</Text>
        </View>
      </GlassCard>

      {isLoading && !tracks ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !tracks || tracks.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: colors.primary + "10",
            alignItems: "center", justifyContent: "center", marginBottom: 16,
          }}>
            <BookOpen size={28} color={colors.textSecondary} />
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: "center" }}>No skill tracks found</Text>
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item: track }) => {
            const completed = track.lessons.filter((l) => l.completed).length;
            const total = track.lessons.length;
            const progress = total > 0 ? completed / total : 0;

            return (
              <Pressable onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
                <GlassCard style={{ padding: 20, marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600", marginBottom: 4 }}>
                        {track.title}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 14 }}>
                        {track.description}
                      </Text>
                    </View>
                    <ChevronRight size={20} color={colors.textSecondary} style={{ marginLeft: 8, marginTop: 2 }} />
                  </View>

                  <View style={{
                    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12,
                  }}>
                    <View style={{
                      flex: 1, height: 6, borderRadius: 3,
                      backgroundColor: colors.border, overflow: "hidden",
                    }}>
                      <View style={{
                        width: `${progress * 100}%`, height: "100%",
                        backgroundColor: colors.primary,
                        borderRadius: 3,
                      }} />
                    </View>
                    <Text style={{
                      color: colors.textSecondary, fontSize: 13, fontWeight: "500",
                    }}>
                      {completed}/{total}
                    </Text>
                  </View>

                  {track.lessons.map((lesson) => (
                    <View
                      key={lesson.id}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}
                    >
                      {lesson.completed ? (
                        <CheckCircle size={16} color={colors.success} />
                      ) : (
                        <Circle size={16} color={colors.textSecondary} />
                      )}
                      <Text style={{
                        color: lesson.completed ? colors.text : colors.textSecondary,
                        fontSize: 14, fontWeight: lesson.completed ? "500" : "400",
                        flex: 1,
                      }} numberOfLines={1}>
                        {lesson.title}
                      </Text>
                    </View>
                  ))}
                </GlassCard>
              </Pressable>
            );
          }}
        />
      )}
    </GradientBackground>
  );
}
