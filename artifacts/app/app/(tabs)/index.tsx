import { View, Text, ScrollView, RefreshControl, Pressable, Animated, Easing, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, useThemeStore } from "@/hooks/useTheme";
import { GlassCard } from "@/components/GlassCard";
import { AIOrb } from "@/components/AIOrb";
import { SafeImage } from "@/components/Image";
import { useMe } from "@/hooks/useApi";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState, useCallback } from "react";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

const { width: W } = Dimensions.get("window");
const PAD = 20;
const GAP = 12;
const HALF = (W - PAD * 2 - GAP) / 2;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const isDark = useThemeStore((s) => s.isDark);
  const [refreshing, setRefreshing] = useState(false);
  const { data: me, refetch } = useMe();

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(24)).current;
  const breathe = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const b = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1.04, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    b.start();
    const r = Animated.loop(Animated.timing(rotate, { toValue: 1, duration: 15000, easing: Easing.linear, useNativeDriver: true }));
    r.start();
    return () => { b.stop(); r.stop(); };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, []);

  const onPress = useCallback((href: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(href as any);
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const row1 = [
    { icon: "📚", label: "Courses", desc: "Continue learning", href: "/(tabs)/courses", color: colors.primary },
    { icon: "🧠", label: "Quizzes", desc: "Test knowledge", href: "/(tabs)/courses", color: colors.secondary },
  ];

  const row2 = [
    { icon: "📅", label: "Schedule", href: "/schedule", color: colors.primaryLight },
    { icon: "👥", label: "Community", href: "/(tabs)/community", color: colors.secondary },
    { icon: "💬", label: "Messages", href: "/messages", color: colors.primary },
    { icon: "🎮", label: "Games", href: "/games", color: colors.secondary },
    { icon: "⭐", label: "Talents", href: "/talents", color: colors.accentGold },
    { icon: "📰", label: "News", href: "/news", color: colors.primaryLight },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View style={{ position: "absolute", top: -100, right: -100, width: 300, height: 300, opacity: 0.08, transform: [{ rotate: spin }] }}>
        <View style={{ flex: 1, borderRadius: 150, backgroundColor: colors.primary }} />
      </Animated.View>
      <Animated.View style={{ position: "absolute", bottom: 100, left: -60, width: 200, height: 200, opacity: 0.05, transform: [{ rotate: spin }] }}>
        <View style={{ flex: 1, borderRadius: 100, backgroundColor: colors.secondary }} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 130, paddingHorizontal: PAD }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 28, opacity: fadeIn, transform: [{ translateY: slideUp }] }}>
          <View>
            <Text style={{ color: colors.textSecondary, fontSize: 14, letterSpacing: 0.3, marginBottom: 2 }}>Welcome back</Text>
            <Text style={{ color: colors.text, fontSize: 32, fontWeight: "800", letterSpacing: -0.5 }}>{me?.name || "Student"}</Text>
          </View>
          <SafeImage uri={me?.avatarUrl} size={52} />
        </Animated.View>

        {/* Hero AI */}
        <Animated.View style={{ marginBottom: 28, transform: [{ scale: breathe }] }}>
          <LinearGradient
            colors={isDark ? ["#1A3329", "#2B5C45", "#3E7A5E"] : ["#2B5C45", "#3E7A5E", "#2B5C45"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1.3 }}
            style={{ borderRadius: 32, padding: 28, overflow: "hidden" }}
          >
            <View style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.04)" }} />
            <View style={{ position: "absolute", bottom: -30, left: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.03)" }} />
            <View style={{ position: "absolute", top: -5, right: -5 }}>
              <AIOrb size={90} state="idle" />
            </View>
            <Text style={{ color: "#FFF", fontSize: 14, fontWeight: "600", letterSpacing: 1, marginBottom: 8, opacity: 0.8 }}>AI ASSISTANT</Text>
            <Text style={{ color: "#FFF", fontSize: 26, fontWeight: "800", letterSpacing: -0.5, marginBottom: 8, maxWidth: "70%" }}>
              Your smart study partner
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, lineHeight: 20, marginBottom: 20, maxWidth: "70%" }}>
              Ask anything about your courses
            </Text>
            <Pressable
              onPress={() => onPress("/(tabs)/ai")}
              style={{
                alignSelf: "flex-start", flexDirection: "row", alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 16,
                paddingVertical: 12, paddingHorizontal: 20, gap: 8,
              }}
            >
              <Text style={{ color: "#FFF", fontSize: 15, fontWeight: "600" }}>Ask AI</Text>
              <Text style={{ color: "#FFF", fontSize: 16 }}>→</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>

        {/* Stats */}
        <View style={{ flexDirection: "row", gap: GAP, marginBottom: 32 }}>
          <GlassCard style={{ flex: 1, padding: 20, alignItems: "center" }}>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>{me?.points || 0}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500", marginTop: 4 }}>XP</Text>
          </GlassCard>
          <GlassCard style={{ flex: 1, padding: 20, alignItems: "center" }}>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>{me?.streak || 0}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500", marginTop: 4 }}>Streak</Text>
          </GlassCard>
          <GlassCard style={{ flex: 1, padding: 20, alignItems: "center" }}>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>{me?.level || 1}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500", marginTop: 4 }}>Level</Text>
          </GlassCard>
        </View>

        {/* Bento Row 1 - Large cards */}
        <View style={{ flexDirection: "row", gap: GAP, marginBottom: GAP }}>
          <Pressable onPress={() => onPress("/(tabs)/courses")} style={{ width: HALF }}>
            <GlassCard style={{ padding: 22 }}>
              <Text style={{ fontSize: 28, marginBottom: 12 }}>📚</Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 4 }}>Courses</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 17 }}>Continue where you left off</Text>
            </GlassCard>
          </Pressable>
          <Pressable onPress={() => onPress("/schedule")} style={{ width: HALF }}>
            <GlassCard style={{ padding: 22 }}>
              <Text style={{ fontSize: 28, marginBottom: 12 }}>📅</Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 4 }}>Schedule</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 17 }}>Your weekly plan</Text>
            </GlassCard>
          </Pressable>
        </View>

        {/* Bento Row 2 - Wide card */}
        <Pressable onPress={() => onPress("/(tabs)/ai")} style={{ marginBottom: GAP }}>
          <GlassCard style={{ padding: 22, flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: colors.accentGold + "20", alignItems: "center", justifyContent: "center", marginRight: 16 }}>
              <Text style={{ fontSize: 26 }}>🤖</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700", marginBottom: 2 }}>AI Coach</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Get personalized help anytime</Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 18 }}>→</Text>
          </GlassCard>
        </Pressable>

        {/* Bento Row 3 - Small icons grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
          {[
            { icon: "🧠", label: "Quizzes", href: "/(tabs)/courses" },
            { icon: "👥", label: "Community", href: "/(tabs)/community" },
            { icon: "💬", label: "Messages", href: "/messages" },
            { icon: "🎮", label: "Games", href: "/games" },
            { icon: "⭐", label: "Talents", href: "/talents" },
            { icon: "📰", label: "News", href: "/news" },
          ].map((item) => (
            <Pressable key={item.label} onPress={() => onPress(item.href)} style={{ width: "30%" }}>
              <GlassCard style={{ padding: 18, alignItems: "center" }}>
                <Text style={{ fontSize: 26, marginBottom: 8 }}>{item.icon}</Text>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600", textAlign: "center" }}>{item.label}</Text>
              </GlassCard>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
