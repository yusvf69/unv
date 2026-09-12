import { Tabs } from "expo-router";
import { View, Text, Pressable, Animated } from "react-native";
import { useColors, useThemeStore } from "@/hooks/useTheme";
import { BlurView } from "expo-blur";
import { Home, BookOpen, Bot, Users, User } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRef, useEffect, useCallback } from "react";

const tabs = [
  { name: "index", label: "Home", icon: Home },
  { name: "courses", label: "Courses", icon: BookOpen },
  { name: "ai", label: "AI", icon: Bot },
  { name: "community", label: "Community", icon: Users },
  { name: "profile", label: "Profile", icon: User },
];

function TabButton({ route, index, state, navigation }: { route: any; index: number; state: any; navigation: any }) {
  const isFocused = state.index === index;
  const colors = useColors();
  const Icon = tabs[index]?.icon || Home;
  const translateY = useRef(new Animated.Value(isFocused ? -4 : 0)).current;
  const labelOpacity = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(isFocused ? 1 : 0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: isFocused ? -4 : 0, useNativeDriver: true, damping: 18, stiffness: 200, mass: 0.6 }),
      Animated.timing(labelOpacity, { toValue: isFocused ? 1 : 0, duration: 200, useNativeDriver: true }),
      Animated.spring(scale, { toValue: isFocused ? 1 : 0.95, useNativeDriver: true, damping: 18, stiffness: 200, mass: 0.6 }),
    ]).start();
  }, [isFocused]);

  const onPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const event = navigation.emit({ type: "tabPress", target: route.key });
    if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
  }, [isFocused, navigation, route]);

  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: isFocused ? 18 : 10,
        borderRadius: 24,
        backgroundColor: isFocused ? colors.primary : "transparent",
        gap: 6,
        transform: [{ translateY }, { scale }],
        shadowColor: isFocused ? colors.primary : "transparent",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isFocused ? 0.4 : 0,
        shadowRadius: 10,
        elevation: isFocused ? 8 : 0,
      }}>
        <Icon size={22} stroke={isFocused ? "#FFFFFF" : colors.textSecondary} />
        {isFocused && (
          <Animated.View style={{ opacity: labelOpacity }}>
            <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "600" }}>{tabs[index]?.label}</Text>
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

function FloatingTabBar({ state, descriptors, navigation }: any) {
  const colors = useColors();
  const isDark = useThemeStore((s) => s.isDark);

  return (
    <View style={{
      position: "absolute", bottom: 16, left: 16, right: 16, alignItems: "center",
      shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 12,
    }}>
      <BlurView
        intensity={40}
        tint={isDark ? "dark" : "light"}
        style={{
          flexDirection: "row",
          borderRadius: 32,
          paddingHorizontal: 6,
          paddingVertical: 6,
          backgroundColor: isDark ? "rgba(17,31,25,0.75)" : "rgba(255,255,255,0.72)",
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {state.routes.map((route: any, index: number) => (
          <TabButton key={route.key} route={route} index={index} state={state} navigation={navigation} />
        ))}
      </BlurView>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} />}>
      {tabs.map((tab) => <Tabs.Screen key={tab.name} name={tab.name} />)}
    </Tabs>
  );
}
