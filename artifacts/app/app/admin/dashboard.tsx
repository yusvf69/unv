import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GlassCard } from "@/components/GlassCard";
import { useMe } from "@/hooks/useApi";
import { router } from "expo-router";
import { ArrowLeft, BarChart3, Users, BookOpen, TrendingUp } from "lucide-react-native";

export default function AdminDashboardScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { data: me } = useMe();

  const stats = [
    { icon: Users, label: "Total Users", value: "—", color: colors.primary },
    { icon: BookOpen, label: "Courses", value: "—", color: colors.secondary },
    { icon: TrendingUp, label: "Active Today", value: "—", color: colors.accentGold },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 60 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Pressable onPress={() => router.back()}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <BarChart3 size={22} color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>Dashboard</Text>
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          {stats.map((stat) => (
            <GlassCard key={stat.label} style={{ flex: 1, padding: 16, alignItems: "center" }}>
              <stat.icon size={24} stroke={stat.color} />
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700", marginTop: 8 }}>{stat.value}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{stat.label}</Text>
            </GlassCard>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
