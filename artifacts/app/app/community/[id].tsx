import * as Haptics from "expo-haptics";
import { useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { SafeImage } from "@/components/Image";
import { useForumPosts, useForumReplies, useCreateReply, useUpvotePost } from "@/hooks/useApi";
import { ArrowUp, MessageSquare, Send, Award, ChevronLeft } from "lucide-react-native";
import { useLocalSearchParams, router } from "expo-router";
import type { ForumReply } from "@/hooks/useApi";

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

export default function ForumDetailScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);

  const { data: posts } = useForumPosts();
  const post = posts?.find((p) => p.id === postId);
  const { data: replies, isLoading: repliesLoading } = useForumReplies(postId);
  const createReply = useCreateReply();
  const upvotePost = useUpvotePost();

  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const handleUpvote = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    upvotePost.mutate(postId);
  }, [postId, upvotePost]);

  const handleReply = useCallback(async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await createReply.mutateAsync({ postId, body: replyText.trim() });
      setReplyText("");
    } catch {}
    setSending(false);
  }, [replyText, postId, createReply]);

  const renderReply = useCallback(({ item }: { item: ForumReply }) => (
    <GlassCard style={{ padding: 14, marginBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <SafeImage uri={item.authorAvatar} size={28} />
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600", marginLeft: 8, flex: 1 }}>
          {item.authorName}
        </Text>
        {item.isBest && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.accentGold + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Award size={12} stroke={colors.accentGold} />
            <Text style={{ color: colors.accentGold, fontSize: 10, fontWeight: "700" }}>Best</Text>
          </View>
        )}
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>
        {item.body}
      </Text>
    </GlassCard>
  ), [colors]);

  const renderPostDetail = () => {
    if (!post) return null;
    const catColor = getCategoryColor(post.category);
    return (
      <GlassCard style={{ padding: 18, marginBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <SafeImage uri={post.authorAvatar} size={36} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
              {post.authorName}
            </Text>
          </View>
          <View style={{ backgroundColor: catColor + "20", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: catColor, fontSize: 11, fontWeight: "600" }}>
              {post.category}
            </Text>
          </View>
        </View>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700", marginBottom: 8 }}>
          {post.title}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 12 }}>
          {post.body}
        </Text>
        <Pressable
          onPress={handleUpvote}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-start",
            gap: 6,
            backgroundColor: colors.card,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <ArrowUp size={16} stroke={colors.secondary} />
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
            {post.upvotes}
          </Text>
        </Pressable>
      </GlassCard>
    );
  };

  const renderEmptyReplies = () => {
    if (repliesLoading) return null;
    return (
      <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", marginTop: 12 }}>
        No replies yet. Be the first!
      </Text>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <GradientBackground>
        <GlassCard style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, marginHorizontal: 16, marginTop: 16, alignSelf: "flex-start" }}>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <ChevronLeft size={22} stroke={colors.text} />
            <Text style={{ color: colors.text, fontSize: 16 }}>Back</Text>
          </Pressable>
        </GlassCard>

        <FlatList
          data={replies ?? []}
          renderItem={renderReply}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          ListHeaderComponent={renderPostDetail}
          ListEmptyComponent={renderEmptyReplies}
          ListFooterComponent={
            repliesLoading ? (
              <View style={{ alignItems: "center", paddingVertical: 20 }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        <View style={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          flexDirection: "row",
          gap: 8,
          alignItems: "flex-end",
        }}>
          <TextInput
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Write a reply..."
            placeholderTextColor={colors.textSecondary}
            multiline
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 10,
              maxHeight: 100,
              color: colors.text,
              fontSize: 14,
            }}
          />
          <Pressable
            onPress={handleReply}
            disabled={!replyText.trim() || sending}
            style={({ pressed }) => ({
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: replyText.trim() ? colors.primary : colors.border,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Send size={18} stroke={replyText.trim() ? "#FFF" : colors.textSecondary} />
            )}
          </Pressable>
        </View>
      </GradientBackground>
    </KeyboardAvoidingView>
  );
}
