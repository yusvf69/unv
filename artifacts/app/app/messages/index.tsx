import * as Haptics from "expo-haptics";
import { useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { SafeImage } from "@/components/Image";
import { useDmThreads } from "@/hooks/useApi";
import { router } from "expo-router";
import { MessageSquare, ChevronRight } from "lucide-react-native";

export default function MessagesInboxScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { data: threads, isLoading, refetch } = useDmThreads();
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
            <MessageSquare size={18} color={colors.primary} />
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700", letterSpacing: -0.5 }}>Messages</Text>
        </View>
      </GlassCard>

      {isLoading && !threads ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !threads || threads.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: colors.primary + "10",
            alignItems: "center", justifyContent: "center", marginBottom: 16,
          }}>
            <MessageSquare size={28} color={colors.textSecondary} />
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: "center" }}>No messages yet</Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => String(item.threadId)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item: thread }) => (
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/messages/${thread.other?.id}`); }}>
              <GlassCard style={{
                padding: 14, marginBottom: 10,
                flexDirection: "row", alignItems: "center",
              }}>
                <SafeImage
                  uri={thread.other?.avatarUrl}
                  size={48}
                />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                      {thread.other?.name || "Unknown"}
                    </Text>
                    {thread.unread > 0 && (
                      <View style={{
                        backgroundColor: colors.secondary,
                        borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
                        minWidth: 22, alignItems: "center",
                      }}>
                        <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "700" }}>{thread.unread}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 3 }} numberOfLines={1}>
                    {thread.lastMessage?.body || "No messages"}
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textSecondary} style={{ marginLeft: 8 }} />
              </GlassCard>
            </Pressable>
          )}
        />
      )}
    </GradientBackground>
  );
}
