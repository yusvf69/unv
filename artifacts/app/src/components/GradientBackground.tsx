import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useColors, useThemeStore } from "@/hooks/useTheme";

type Props = {
  children: React.ReactNode;
  style?: any;
};

export function GradientBackground({ children, style }: Props) {
  const colors = useColors();
  const isDark = useThemeStore((s) => s.isDark);

  return (
    <View style={[{ flex: 1 }, style]}>
      <LinearGradient
        colors={isDark ? ["#111F19", "#0D1814", "#111F19"] : ["#F7F3ED", "#F5F0E8", "#F2EDE3"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {children}
    </View>
  );
}
