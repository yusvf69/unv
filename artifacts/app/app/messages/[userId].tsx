import * as Haptics from "expo-haptics";
import { useState, useRef } from "react";
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { SafeImage } from "@/components/Image";
import { useDmConversation, useSendDm } from "@/hooks/useApi";
import { useLocalSearchParams, router } from "expo-router";
import { ArrowLeft, Send } from "lucide-react-native";

export default function DmThreadScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const otherId = Number(userId);

  const { data, isLoading } = useDmConversation(otherId);
  const sendDm = useSendDm();
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList>(null);

  const other = data?.other;
  const messages = data?.messages ?? [];

  const handleSend = async () => {
    if (!input.trim() || sendDm.isPending) return;
    try {
      await sendDm.mutateAsync({ userId: otherId, body: input.trim() });
      setInput("");
    } catch {}
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <GradientBackground>
        <GlassCard style={{
          paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12,
          borderBottomWidth: 1, borderBottomColor: colors.border,
          marginHorizontal: 16, marginTop: 16,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} style={{
              width: 36, height: 36, borderRadius: 12,
              backgroundColor: colors.primary + "10",
              alignItems: "center", justifyContent: "center",
            }}>
              <ArrowLeft size={20} color={colors.text} />
            </Pressable>
            <SafeImage uri={other?.avatarUrl} size={36} />
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600" }} numberOfLines={1}>
              {other?.name || "Loading..."}
            </Text>
          </View>
        </GlassCard>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{
              paddingHorizontal: 16, paddingVertical: 16,
              flexGrow: 1, justifyContent: "flex-end",
            }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item: msg }) => (
              <View style={{
                alignSelf: msg.fromMe ? "flex-end" : "flex-start",
                maxWidth: "78%", marginBottom: 8,
              }}>
                {msg.fromMe ? (
                  <View style={{
                    padding: 12, borderRadius: 18,
                    borderBottomRightRadius: 4,
                    backgroundColor: colors.primary,
                  }}>
                    <Text style={{ color: "#FFF", fontSize: 15, lineHeight: 21 }}>{msg.body}</Text>
                  </View>
                ) : (
                  <GlassCard style={{
                    padding: 12, borderRadius: 18,
                    borderBottomLeftRadius: 4,
                  }}>
                    <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21 }}>{msg.body}</Text>
                  </GlassCard>
                )}
              </View>
            )}
            ListEmptyComponent={
              <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center" }}>
                No messages yet. Say hello!
              </Text>
            }
          />
        )}

        <View style={{
          paddingHorizontal: 16, paddingBottom: insets.bottom + 10, paddingTop: 10,
          flexDirection: "row", gap: 10, alignItems: "flex-end",
        }}>
          <View style={{
            flex: 1, flexDirection: "row", alignItems: "center",
            backgroundColor: colors.card, borderRadius: 20,
            borderWidth: 1, borderColor: colors.border,
            paddingHorizontal: 16,
          }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
              placeholderTextColor={colors.textSecondary}
              multiline
              style={{
                flex: 1, paddingVertical: 12,
                color: colors.text, fontSize: 15, maxHeight: 100,
              }}
            />
          </View>
          <Pressable
            onPress={handleSend}
            disabled={!input.trim() || sendDm.isPending}
            style={{
              width: 46, height: 46, borderRadius: 23,
              backgroundColor: input.trim() ? colors.secondary : colors.border,
              alignItems: "center", justifyContent: "center",
            }}
          >
            {sendDm.isPending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Send size={18} color={input.trim() ? "#FFF" : colors.textSecondary} />
            )}
          </Pressable>
        </View>
      </GradientBackground>
    </KeyboardAvoidingView>
  );
}
