import * as Haptics from "expo-haptics";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useColors, useThemeStore } from "@/hooks/useTheme";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { NeoButton } from "@/components/NeoButton";
import { SafeImage } from "@/components/Image";
import { useMe, useAchievements, useLogout } from "@/hooks/useApi";
import {
  Award, Moon, Sun, LogOut, Medal, Zap, BookOpen, MessageSquare,
} from "lucide-react-native";
import { router } from "expo-router";

const AVATAR_SIZE = 100;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const isDark = useThemeStore((s) => s.isDark);
  const toggle = useThemeStore((s) => s.toggle);
  const { data: me } = useMe();
  const { data: achievements } = useAchievements();
  const logout = useLogout();

  const handleLogout = async () => {
    await logout.mutateAsync();
    router.replace("/login");
  };

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 100,
        }}
      >
        <View style={{ alignItems: "center", paddingVertical: 32 }}>
          <View style={{ width: AVATAR_SIZE + 16, height: AVATAR_SIZE + 16, alignItems: "center", justifyContent: "center" }}>
            <LinearGradient
              colors={["rgba(232,184,75,0.4)", "rgba(255,255,255,0)", "rgba(43,92,69,0.3)"]}
              style={{
                position: "absolute", width: AVATAR_SIZE + 16, height: AVATAR_SIZE + 16,
                borderRadius: (AVATAR_SIZE + 16) / 2,
              }}
            />
            <SafeImage
              uri={me?.avatarUrl}
              size={AVATAR_SIZE}
              fallback={me?.avatarUrl || undefined}
            />
          </View>

          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700", marginTop: 16 }}>
            {me?.name || "Student"}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 2 }}>
            {me?.department && me?.groupName ? `${me.department} · ${me.groupName}` : me?.department || me?.groupName || ""}
          </Text>
          <View
            style={{
              marginTop: 8, paddingHorizontal: 16, paddingVertical: 4,
              borderRadius: 20, backgroundColor: colors.primary + "18",
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
              {me?.title || me?.role || "Student"}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 28 }}>
          <GlassCard style={{ flex: 1, padding: 14, alignItems: "center" }}>
            <View
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: colors.accentGold + "20",
                alignItems: "center", justifyContent: "center",
                marginBottom: 6,
              }}
            >
              <Zap size={18} color={colors.accentGold} />
            </View>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>
              {me?.points ?? 0}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>XP</Text>
          </GlassCard>
          <GlassCard style={{ flex: 1, padding: 14, alignItems: "center" }}>
            <View
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: colors.primary + "20",
                alignItems: "center", justifyContent: "center",
                marginBottom: 6,
              }}
            >
              <Medal size={18} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>
              {me?.level ?? 1}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Level</Text>
          </GlassCard>
          <GlassCard style={{ flex: 1, padding: 14, alignItems: "center" }}>
            <View
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: colors.secondary + "20",
                alignItems: "center", justifyContent: "center",
                marginBottom: 6,
              }}
            >
              <BookOpen size={18} color={colors.secondary} />
            </View>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>
              {me?.streak ?? 0}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Streak</Text>
          </GlassCard>
        </View>

        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 12 }}>
          Achievements
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>
          {achievements?.slice(0, 6).map((ach: any) => (
            <GlassCard key={ach.id} style={{ width: "30%", padding: 14, alignItems: "center" }}>
              <View
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: ach.completed ? colors.accentGold + "20" : colors.textSecondary + "15",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Award size={20} color={ach.completed ? colors.accentGold : colors.textSecondary} />
              </View>
              <Text
                style={{
                  color: ach.completed ? colors.text : colors.textSecondary,
                  fontSize: 10, fontWeight: "500", textAlign: "center", marginTop: 6,
                  lineHeight: 14,
                }}
                numberOfLines={2}
              >
                {ach.title}
              </Text>
            </GlassCard>
          ))}
        </View>

        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 12 }}>
          Settings
        </Text>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/messages"); }}>
          <GlassCard style={{ padding: 16, marginBottom: 8, flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: colors.primary + "18",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <MessageSquare size={18} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontSize: 16, marginLeft: 12, flex: 1 }}>
              Messages
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>View all</Text>
          </GlassCard>
        </Pressable>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggle(); }}>
          <GlassCard style={{ padding: 16, marginBottom: 8, flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: colors.primary + "18",
                alignItems: "center", justifyContent: "center",
              }}
            >
              {isDark ? <Sun size={18} color={colors.primary} /> : <Moon size={18} color={colors.primary} />}
            </View>
            <Text style={{ color: colors.text, fontSize: 16, marginLeft: 12, flex: 1 }}>
              {isDark ? "Light Mode" : "Dark Mode"}
            </Text>
            <View
              style={{
                width: 44, height: 24, borderRadius: 12,
                backgroundColor: isDark ? colors.primary : colors.textSecondary + "40",
                padding: 2, justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 20, height: 20, borderRadius: 10,
                  backgroundColor: "#FFF",
                  alignSelf: isDark ? "flex-end" : "flex-start",
                }}
              />
            </View>
          </GlassCard>
        </Pressable>

        <NeoButton
          variant="ghost"
          label="Logout"
          icon={<LogOut size={18} color={colors.danger} />}
          onPress={handleLogout}
          loading={logout.isPending}
          style={{ marginTop: 16 }}
        />
      </ScrollView>
    </GradientBackground>
  );
}
