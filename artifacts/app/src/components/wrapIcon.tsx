import React from "react";
import { View } from "react-native";

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function wrapIcon(Icon: React.ComponentType<any>) {
  return function WrappedIcon({ size = 24, color = "#000", strokeWidth = 2 }: IconProps) {
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Icon
          width={size}
          height={size}
          stroke={color}
          strokeWidth={strokeWidth}
        />
      </View>
    );
  };
}
