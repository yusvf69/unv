import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GlassCard } from "@/components/GlassCard";
import { useMe } from "@/hooks/useApi";
import { router } from "expo-router";
import { ArrowLeft, Shield, Users, Newspaper, BarChart3, Settings, MessageSquare, BookOpen, GraduationCap, Calendar } from "lucide-react-native";

const adminModules = [
  { icon: Newspaper, label: "News", color: "#2B5C45", href: "/admin/news" },
  { icon: Users, label: "Users", color: "#CC6B3E", href: "/admin/users" },
  { icon: BarChart3, label: "Dashboard", color: "#E8B84B", href: "/admin/dashboard" },
  { icon: MessageSquare, label: "Forum", color: "#3E7A5E", href: "/admin/forum" },
  { icon: BookOpen, label: "Courses", color: "#2B5C45", href: "/admin/courses" },
  { icon: GraduationCap, label: "Quizzes", color: "#CC6B3E", href: "/admin/quizzes" },
  { icon: Calendar, label: "Schedule", color: "#E8B84B", href: "/admin/schedule" },
  { icon: Settings, label: "Settings", color: "#4B6358", href: "/admin/settings" },
];

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { data: me } = useMe();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 60 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Pressable onPress={() => router.back()}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <Shield size={24} color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: "700" }}>Admin</Text>
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 24 }}>
          Welcome, {me?.name || "Admin"}
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {adminModules.map((mod) => (
            <Pressable key={mod.label} onPress={() => router.push(mod.href as any)} style={{ width: "46%" }}>
              <GlassCard style={{ padding: 20, alignItems: "center" }}>
                <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: mod.color, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <mod.icon size={26} stroke="#FFF" />
                </View>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>{mod.label}</Text>
              </GlassCard>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
