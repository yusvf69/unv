import { View, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useTheme";
import { useEffect, useRef } from "react";

type AIOrbProps = {
  size?: number;
  state?: "idle" | "listening" | "thinking" | "speaking";
};

export function AIOrb({ size = 80, state = "idle" }: AIOrbProps) {
  const colors = useColors();
  const pulse = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  const config = (() => {
    switch (state) {
      case "listening":
        return { scale: 1.12, duration: 800, gradient: ["#4A90D9", "#357ABD"] as [string, string], shadow: "#4A90D9" };
      case "thinking":
        return { scale: 1.1, duration: 1200, gradient: [colors.primary, colors.accentGold] as [string, string], shadow: colors.accentGold };
      case "speaking":
        return { scale: 1.15, duration: 500, gradient: ["#FFD700", "#FFA500"] as [string, string], shadow: "#FFD700" };
      default:
        return { scale: 1.08, duration: 2000, gradient: [colors.primary, colors.secondary] as [string, string], shadow: colors.primary };
    }
  })();

  useEffect(() => {
    pulse.setValue(1);
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: config.scale, duration: config.duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: config.duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const rotateAnim = Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true }),
    );
    pulseAnim.start();
    rotateAnim.start();
    return () => { pulseAnim.stop(); rotateAnim.stop(); };
  }, [state, config.scale, config.duration]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", transform: [{ scale: pulse }] }]}>
        <LinearGradient
          colors={[config.gradient[0], config.gradient[1], colors.accentGold]}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            opacity: 0.15,
            transform: [{ scale: 1.8 }],
          }}
        />
      </Animated.View>
      <Animated.View
        style={{
          transform: [{ rotate: spin }],
          shadowColor: config.shadow,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 20,
          elevation: 10,
        }}
      >
        <LinearGradient
          colors={config.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LinearGradient
            colors={["rgba(255,255,255,0.3)", "transparent"]}
            style={{
              width: size * 0.7,
              height: size * 0.7,
              borderRadius: size * 0.35,
              position: "absolute",
              top: -size * 0.05,
              right: -size * 0.05,
            }}
          />
          <View
            style={{
              width: size * 0.35,
              height: size * 0.35,
              borderRadius: size * 0.175,
              backgroundColor: "rgba(255,255,255,0.6)",
            }}
          />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}
