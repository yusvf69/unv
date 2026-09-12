import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GlassCard } from "@/components/GlassCard";
import { useForumPosts } from "@/hooks/useApi";
import { router } from "expo-router";
import { ArrowLeft, MessageSquare, ThumbsUp, MessageCircle } from "lucide-react-native";

export default function AdminForumScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { data: posts, isLoading } = useForumPosts();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 60 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Pressable onPress={() => router.back()}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <MessageSquare size={22} color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>Forum</Text>
        </View>

        {isLoading ? (
          <Text style={{ color: colors.textSecondary, textAlign: "center", marginTop: 40 }}>Loading posts...</Text>
        ) : (
          posts?.map((post: any) => (
            <Pressable key={post.id} onPress={() => router.push(`/community/${post.id}` as any)}>
              <GlassCard style={{ padding: 16, marginBottom: 10 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>{post.title}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }} numberOfLines={2}>{post.content}</Text>
                <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <ThumbsUp size={14} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{post.upvotes || 0}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <MessageCircle size={14} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{post.repliesCount || 0}</Text>
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
