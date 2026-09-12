import * as Haptics from "expo-haptics";
import { useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { SafeImage } from "@/components/Image";
import { useForumPosts } from "@/hooks/useApi";
import { MessageSquare, ArrowUp, Users, ChevronRight } from "lucide-react-native";
import { router } from "expo-router";
import type { ForumPost } from "@/hooks/useApi";

function getCategoryColor(category: string) {
  const map: Record<string, string> = {
    general: "#3BA55D",
    questions: "#CC6B3E",
    ideas: "#E8B84B",
    support: "#2B5C45",
    feedback: "#D64545",
  };
  return map[category.toLowerCase()] || "#3E7A5E";
}

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { data: posts, isLoading, refetch } = useForumPosts();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderPost = useCallback(({ item }: { item: ForumPost }) => {
    const catColor = getCategoryColor(item.category);
    return (
      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/community/${item.id}`); }}>
        <GlassCard style={{ padding: 18, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <SafeImage uri={item.authorAvatar} size={36} />
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600", marginLeft: 10, flex: 1 }}>
              {item.authorName}
            </Text>
            <View style={{ backgroundColor: catColor + "20", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: catColor, fontSize: 11, fontWeight: "600" }}>
                {item.category}
              </Text>
            </View>
          </View>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: 6 }}>
            {item.title}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }} numberOfLines={2}>
            {item.body}
          </Text>
          <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <ArrowUp size={14} stroke={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.upvotes}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MessageSquare size={14} stroke={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.repliesCount}</Text>
            </View>
          </View>
        </GlassCard>
      </Pressable>
    );
  }, [colors]);

  const renderHeader = () => (
    <GlassCard style={{ marginBottom: 24, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Users size={24} stroke={colors.secondary} />
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: "700" }}>Community</Text>
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 32 }}>
        {posts?.length || 0} {posts?.length === 1 ? "post" : "posts"}
      </Text>
    </GlassCard>
  );

  if (isLoading) {
    return (
      <GradientBackground style={{ alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <FlatList
        data={posts ?? []}
        renderItem={renderPost}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 100 }}
        ListHeaderComponent={renderHeader}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />
    </GradientBackground>
  );
}
