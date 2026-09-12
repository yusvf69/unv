import * as Haptics from "expo-haptics";
import { useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { CoverImage } from "@/components/Image";
import { useNews } from "@/hooks/useApi";
import { router } from "expo-router";
import { Newspaper, ChevronRight } from "lucide-react-native";

export default function NewsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { data: articles, isLoading, refetch } = useNews();
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
            <Newspaper size={18} color={colors.primary} />
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700", letterSpacing: -0.5 }}>News</Text>
        </View>
      </GlassCard>

      {isLoading && !articles ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !articles || articles.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: colors.primary + "10",
            alignItems: "center", justifyContent: "center", marginBottom: 16,
          }}>
            <Newspaper size={28} color={colors.textSecondary} />
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: "center" }}>No news</Text>
        </View>
      ) : (
        <FlatList
          data={articles}
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
          renderItem={({ item }) => (
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/news/${item.id}`); }}>
              <GlassCard style={{ marginBottom: 14, overflow: "hidden" }}>
                {item.coverUrl && <CoverImage uri={item.coverUrl} height={160} />}
                <View style={{ padding: 16 }}>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600", marginBottom: 6 }}>
                    {item.title}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 10 }} numberOfLines={2}>
                    {item.excerpt || item.body}
                  </Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      {item.category && (
                        <View style={{
                          backgroundColor: colors.primary + "12",
                          paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
                        }}>
                          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>{item.category}</Text>
                        </View>
                      )}
                      <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-US", {
                          month: "short", day: "numeric",
                        }) : ""}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={colors.textSecondary} />
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          )}
        />
      )}
    </GradientBackground>
  );
}
