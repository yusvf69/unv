import { Pressable, Text, View, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/useTheme";
import * as Haptics from "expo-haptics";
import { useState } from "react";

type NeoButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  icon?: React.ReactNode;
  loading?: boolean;
  style?: any;
};

export function NeoButton({ label, onPress, variant = "primary", icon, loading, style }: NeoButtonProps) {
  const colors = useColors();
  const [pressed, setPressed] = useState(false);

  const bg = variant === "primary" ? colors.primary
    : variant === "secondary" ? colors.secondary
    : "transparent";

  const txt = variant === "ghost" ? colors.text : "#FFFFFF";

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 12,
          paddingHorizontal: 20,
          borderRadius: 16,
          backgroundColor: bg,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: variant === "ghost" ? colors.border : "transparent",
          gap: 8,
          transform: [{ scale: pressed ? 0.97 : 1 }],
          opacity: loading ? 0.7 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={txt} />
      ) : (
        <>
          {icon}
          <Text style={{ color: txt, fontSize: 15, fontWeight: "600", letterSpacing: 0.3 }}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
