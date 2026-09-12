import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GlassCard } from "@/components/GlassCard";
import { useOpenQuizzes } from "@/hooks/useApi";
import { router } from "expo-router";
import { ArrowLeft, Brain, Clock } from "lucide-react-native";

export default function AdminQuizzesScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { data: quizzes, isLoading } = useOpenQuizzes();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 60 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Pressable onPress={() => router.back()}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <Brain size={22} color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>Quizzes</Text>
        </View>

        {isLoading ? (
          <Text style={{ color: colors.textSecondary, textAlign: "center", marginTop: 40 }}>Loading quizzes...</Text>
        ) : (
          quizzes?.map((quiz: any) => (
            <Pressable key={quiz.id} onPress={() => router.push(`/quiz/${quiz.id}` as any)}>
              <GlassCard style={{ padding: 16, marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" }}>
                    <Brain size={20} stroke="#FFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>{quiz.title}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <Clock size={14} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{quiz.timeLimit || "No limit"}</Text>
                    </View>
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
