import { useState, useRef, useCallback } from "react";
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { AIOrb } from "@/components/AIOrb";
import { useAiChat } from "@/hooks/useApi";
import { Bot, Send, Sparkles, User } from "lucide-react-native";

const SUGGESTIONS = [
  "لخص لي محاضرة اليوم",
  "اختبرني في المادة",
  "اشرح لي النقطة دي",
  "عاوز جدول مذاكرة",
  "جهزني للاختبار",
];

export default function AIScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { messages, sendMessage, isLoading } = useAiChat();
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList>(null);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    setInput("");
    await sendMessage(text.trim());
  }, [isLoading, sendMessage]);

  const renderMessage = useCallback(({ item }: { item: { role: string; content: string } }) => {
    const isUser = item.role === "user";
    return (
      <View style={{
        flexDirection: "row",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 14,
        paddingHorizontal: 4,
      }}>
        {!isUser && (
          <View style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: colors.primary + "20",
            alignItems: "center", justifyContent: "center",
            marginRight: 8, alignSelf: "flex-end",
          }}>
            <Bot size={16} stroke={colors.primary} />
          </View>
        )}
        {isUser ? (
          <View style={{
            maxWidth: "80%",
            backgroundColor: colors.primary,
            borderRadius: 20,
            borderBottomRightRadius: 6,
            paddingHorizontal: 16,
            paddingVertical: 12,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 6,
          }}>
            <Text style={{ color: "#FFFFFF", fontSize: 15, lineHeight: 22 }}>
              {item.content}
            </Text>
          </View>
        ) : (
          <GlassCard style={{
            maxWidth: "80%",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderTopLeftRadius: 6,
          }}>
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>
              {item.content}
            </Text>
          </GlassCard>
        )}
        {isUser && (
          <View style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: colors.secondary + "20",
            alignItems: "center", justifyContent: "center",
            marginLeft: 8, alignSelf: "flex-end",
          }}>
            <User size={16} stroke={colors.secondary} />
          </View>
        )}
      </View>
    );
  }, [colors]);

  const renderEmpty = () => (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
      <AIOrb size={72} state="idle" />
      <GlassCard style={{ paddingHorizontal: 24, paddingVertical: 12, marginTop: 20 }}>
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: "800", letterSpacing: 0.5 }}>
          AI Assistant
        </Text>
      </GlassCard>
      <GlassCard style={{ paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 20 }}>
          اسأل أي سؤال عن دراستك، أو اطلب ملخصات واختبارات
        </Text>
      </GlassCard>
      <View style={{ marginTop: 28, width: "100%" }}>
        <FlatList
          data={SUGGESTIONS}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSend(item)}
              style={({ pressed }) => ({
                backgroundColor: colors.card,
                borderRadius: 16,
                paddingHorizontal: 18,
                paddingVertical: 12,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Sparkles size={14} stroke={colors.primary} />
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>
                  {item}
                </Text>
              </View>
            </Pressable>
          )}
          keyExtractor={(item) => item}
        />
      </View>
    </View>
  );

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <GlassCard style={{ marginHorizontal: 16, marginTop: insets.top + 12, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <AIOrb size={36} state="idle" />
            <View>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>
                AI Assistant
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {isLoading ? "جارٍ التفكير..." : "متاح للمساعدة"}
              </Text>
            </View>
          </View>
        </GlassCard>

        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 8,
            flexGrow: 1,
          }}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              listRef.current?.scrollToEnd({ animated: true });
            }
          }}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={
            isLoading && messages.length > 0 ? (
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14, paddingHorizontal: 4 }}>
                <View style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: colors.primary + "20",
                  alignItems: "center", justifyContent: "center",
                  marginRight: 8,
                }}>
                  <Bot size={16} stroke={colors.primary} />
                </View>
                <GlassCard style={{
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  borderTopLeftRadius: 6,
                }}>
                  <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, opacity: 0.4 }} />
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, opacity: 0.6 }} />
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, opacity: 1 }} />
                  </View>
                </GlassCard>
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
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.card,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            paddingLeft: 16,
          }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={messages.length === 0 ? "اسأل عن دراستك..." : "اكتب رسالتك..."}
              placeholderTextColor={colors.textSecondary}
              style={{
                flex: 1,
                color: colors.text,
                fontSize: 15,
                paddingVertical: 14,
                textAlign: "right",
              }}
              returnKeyType="send"
              onSubmitEditing={() => handleSend(input)}
              multiline={false}
            />
            <Pressable
              onPress={() => handleSend(input)}
              disabled={!input.trim() || isLoading}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: input.trim() ? colors.primary : colors.border,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 6,
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              })}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Send size={18} stroke={input.trim() ? "#FFF" : colors.textSecondary} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}
