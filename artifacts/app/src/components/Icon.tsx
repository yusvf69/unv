import React from "react";

type IconElement = React.ReactElement<{ width?: number; height?: number; stroke?: string; strokeWidth?: number }>;

type IconProps = {
  icon: (props: any) => IconElement;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ icon: LucideIcon, size = 24, color = "#000", strokeWidth = 2 }: IconProps) {
  const el = LucideIcon({ size, color, strokeWidth });
  if (el && React.isValidElement(el)) {
    return React.cloneElement(el, { width: size, height: size, stroke: color, strokeWidth });
  }
  return el;
}
