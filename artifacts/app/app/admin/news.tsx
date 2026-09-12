import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GlassCard } from "@/components/GlassCard";
import { useApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, Newspaper, Clock } from "lucide-react-native";

export default function AdminNewsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const api = useApi();
  const { data: news, isLoading } = useQuery({
    queryKey: ["admin-news"],
    queryFn: () => api.get("/v2/news"),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 60 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Pressable onPress={() => router.back()}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <Newspaper size={22} color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>News</Text>
        </View>

        {isLoading ? (
          <Text style={{ color: colors.textSecondary, textAlign: "center", marginTop: 40 }}>Loading news...</Text>
        ) : (
          news?.map((item: any) => (
            <GlassCard key={item.id} style={{ padding: 16, marginBottom: 10 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>{item.title}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>{item.excerpt}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
                <Clock size={14} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
            </GlassCard>
          ))
        )}
      </ScrollView>
    </View>
  );
}
