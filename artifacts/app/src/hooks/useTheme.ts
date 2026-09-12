import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors, type ColorScheme, type ThemeColors } from "@/constants/theme";

const THEME_KEY = "uv-theme";

type ThemeStore = {
  scheme: ColorScheme | "system";
  colors: ThemeColors;
  isDark: boolean;
  setScheme: (scheme: ColorScheme | "system") => Promise<void>;
  toggle: () => Promise<void>;
};

export const useThemeStore = create<ThemeStore>((set, get) => ({
  scheme: "system",
  colors: Colors.light as ThemeColors,
  isDark: false,

  setScheme: async (scheme) => {
    await AsyncStorage.setItem(THEME_KEY, scheme);
    const isDark = scheme === "dark";
    set({ scheme, isDark, colors: (isDark ? Colors.dark : Colors.light) as ThemeColors });
  },

  toggle: async () => {
    const next = get().isDark ? "light" : "dark";
    await AsyncStorage.setItem(THEME_KEY, next);
    set({ scheme: next, isDark: !get().isDark, colors: (get().isDark ? Colors.light : Colors.dark) as ThemeColors });
  },
}));

export function useColors(): ThemeColors {
  return useThemeStore((s) => s.colors);
}

export async function initTheme() {
  const stored = await AsyncStorage.getItem(THEME_KEY);
  const scheme = (stored as ColorScheme | "system") || "system";
  const isDark = scheme === "dark";
  useThemeStore.setState({ scheme, isDark, colors: (isDark ? Colors.dark : Colors.light) as ThemeColors });
}
