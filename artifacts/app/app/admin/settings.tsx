import { View, Text, ScrollView, Pressable, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, useThemeStore } from "@/hooks/useTheme";
import { GlassCard } from "@/components/GlassCard";
import { router } from "expo-router";
import { ArrowLeft, Settings, Moon, Bell, Globe } from "lucide-react-native";
import { useState } from "react";

export default function AdminSettingsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const isDark = useThemeStore((s) => s.isDark);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const [notifications, setNotifications] = useState(true);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 60 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Pressable onPress={() => router.back()}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <Settings size={22} color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>Settings</Text>
        </View>

        <GlassCard style={{ padding: 16, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Moon size={20} color={colors.primary} />
              <Text style={{ color: colors.text, fontSize: 16 }}>Dark Mode</Text>
            </View>
            <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: "#ccc", true: colors.primary }} />
          </View>
        </GlassCard>

        <GlassCard style={{ padding: 16, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Bell size={20} color={colors.primary} />
              <Text style={{ color: colors.text, fontSize: 16 }}>Notifications</Text>
            </View>
            <Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: "#ccc", true: colors.primary }} />
          </View>
        </GlassCard>

        <GlassCard style={{ padding: 16, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Globe size={20} color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 16 }}>Language: English</Text>
          </View>
        </GlassCard>
      </ScrollView>
    </View>
  );
}
