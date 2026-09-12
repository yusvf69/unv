import { View, type ViewProps, Pressable, type GestureResponderEvent } from "react-native";
import { useColors, useThemeStore } from "@/hooks/useTheme";
import { BlurView } from "expo-blur";

type GlassCardProps = ViewProps & {
  intensity?: number;
  onPress?: (e: GestureResponderEvent) => void;
};

export function GlassCard({ style, intensity = 45, onPress, children, ...props }: GlassCardProps) {
  const colors = useColors();
  const isDark = useThemeStore((s) => s.isDark);

  const card = (
    <BlurView
      intensity={intensity}
      tint={isDark ? "dark" : "light"}
      style={[
        {
          borderRadius: 28,
          overflow: "hidden",
          backgroundColor: isDark ? "rgba(22,36,30,0.65)" : "rgba(255,255,255,0.55)",
          borderWidth: 1,
          borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.5)",
          shadowColor: isDark ? "rgba(0,0,0,0.5)" : "rgba(43,92,69,0.15)",
          shadowOffset: { width: 0, height: isDark ? 4 : 8 },
          shadowOpacity: 1,
          shadowRadius: isDark ? 16 : 30,
          elevation: isDark ? 4 : 8,
        },
        style,
      ]}
    >
      <View {...props}>{children}</View>
    </BlurView>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{card}</Pressable>;
  }
  return card;
}
