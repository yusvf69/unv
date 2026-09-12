import * as Haptics from "expo-haptics";
import { useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { SafeImage, CoverImage } from "@/components/Image";
import { useTalentsFeed, useTalentLike } from "@/hooks/useApi";
import { Heart, Sparkles, MessageSquare } from "lucide-react-native";

export default function TalentsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { data: talents, isLoading, refetch } = useTalentsFeed();
  const talentLike = useTalentLike();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleLike = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    talentLike.mutate(id);
  };

  return (
    <GradientBackground>
      <GlassCard style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12, marginHorizontal: 16, marginTop: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: colors.secondary + "15",
            alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={18} color={colors.secondary} />
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700", letterSpacing: -0.5 }}>Talents</Text>
        </View>
      </GlassCard>

      {isLoading && !talents ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !talents || talents.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: colors.secondary + "10",
            alignItems: "center", justifyContent: "center", marginBottom: 16,
          }}>
            <Sparkles size={28} color={colors.textSecondary} />
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: "center" }}>No talents yet</Text>
        </View>
      ) : (
        <FlatList
          data={talents}
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
          renderItem={({ item: talent }) => (
            <GlassCard style={{ marginBottom: 16, overflow: "hidden" }}>
              {talent.mediaUrl && (
                <CoverImage uri={talent.mediaUrl} height={220} />
              )}
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                  <SafeImage uri={talent.owner?.avatarUrl} size={38} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
                      {talent.owner?.name || "Anonymous"}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }}>
                      {talent.category}
                    </Text>
                  </View>
                </View>

                <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600", marginBottom: 6 }}>
                  {talent.title}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 14 }}>
                  {talent.description}
                </Text>

                <View style={{ flexDirection: "row", gap: 20, alignItems: "center" }}>
                  <Pressable
                    onPress={() => handleLike(talent.id)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                  >
                    <Heart
                      size={20}
                      color={talent.likedByMe ? colors.danger : colors.textSecondary}
                      fill={talent.likedByMe ? colors.danger : "transparent"}
                    />
                    <Text style={{
                      color: talent.likedByMe ? colors.danger : colors.textSecondary,
                      fontSize: 14, fontWeight: talent.likedByMe ? "600" : "400",
                    }}>
                      {talent.likesCount}
                    </Text>
                  </Pressable>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <MessageSquare size={20} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{talent.commentsCount}</Text>
                  </View>
                </View>
              </View>
            </GlassCard>
          )}
        />
      )}
    </GradientBackground>
  );
}
