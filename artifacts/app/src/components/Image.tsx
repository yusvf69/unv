import { useState, useEffect, useRef } from "react";
import { Image as RNImage, Animated, View, type ImageProps, type ImageStyle } from "react-native";
import { useColors } from "@/hooks/useTheme";

type SafeImageProps = Omit<ImageProps, "source"> & {
  uri: string | null | undefined;
  size?: number;
  fallback?: string;
};

export function SafeImage({ uri, size = 40, fallback, style, ...props }: SafeImageProps) {
  const colors = useColors();
  const [errored, setErrored] = useState(false);
  const [loading, setLoading] = useState(true);
  const opacity = useRef(new Animated.Value(0)).current;
  const shimmerOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, { toValue: 0.7, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmerOpacity, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const handleLoad = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(shimmerOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setLoading(false));
  };

  if (!uri || errored) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          },
          style,
        ]}
      >
        {fallback ? (
          <RNImage source={{ uri: fallback }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: colors.border }}>
      <Animated.Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius: size / 2, opacity }, style as ImageStyle]}
        onLoad={handleLoad}
        onError={() => setErrored(true)}
        {...props}
      />
      {loading && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size,
            height: size,
            borderRadius: size / 2,
            opacity: shimmerOpacity,
            backgroundColor: colors.card,
          }}
        />
      )}
    </View>
  );
}

type CoverImageProps = {
  uri: string | null | undefined;
  height?: number;
  style?: any;
};

export function CoverImage({ uri, height = 180, style }: CoverImageProps) {
  const colors = useColors();
  const [errored, setErrored] = useState(false);
  const [loading, setLoading] = useState(true);
  const opacity = useRef(new Animated.Value(0)).current;
  const shimmerOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, { toValue: 0.7, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmerOpacity, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const handleLoad = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(shimmerOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setLoading(false));
  };

  if (!uri || errored) {
    return (
      <View
        style={[
          {
            height,
            backgroundColor: colors.primary,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
          },
          style,
        ]}
      />
    );
  }

  return (
    <View style={{ height, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", backgroundColor: colors.border }}>
      <Animated.Image
        source={{ uri }}
        style={[{ height, borderTopLeftRadius: 28, borderTopRightRadius: 28, opacity }, style]}
        onLoad={handleLoad}
        onError={() => setErrored(true)}
      />
      {loading && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: shimmerOpacity,
            backgroundColor: colors.card,
          }}
        />
      )}
    </View>
  );
}
