import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { View, ActivityIndicator } from "react-native";
import { useThemeStore, initTheme } from "@/hooks/useTheme";
import * as SplashScreen from "expo-splash-screen";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const colors = useThemeStore((s) => s.colors);

  useEffect(() => {
    initTheme().then(() => {
      setReady(true);
      SplashScreen.hideAsync();
    });
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={"dark"} />
        <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="course/[id]" />
          <Stack.Screen name="quiz/[id]" />
          <Stack.Screen name="community/[id]" />
          <Stack.Screen name="ai/[id]" />
          <Stack.Screen name="messages" />
          <Stack.Screen name="messages/[userId]" />
          <Stack.Screen name="schedule" />
          <Stack.Screen name="talents" />
          <Stack.Screen name="games" />
          <Stack.Screen name="skills" />
          <Stack.Screen name="news" />
          <Stack.Screen name="news/[id]" />
          <Stack.Screen name="staff" />
          <Stack.Screen name="events" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="admin/users" />
          <Stack.Screen name="admin/courses" />
          <Stack.Screen name="admin/quizzes" />
          <Stack.Screen name="admin/news" />
          <Stack.Screen name="admin/dashboard" />
          <Stack.Screen name="admin/forum" />
          <Stack.Screen name="admin/settings" />
          <Stack.Screen name="admin/schedule" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
