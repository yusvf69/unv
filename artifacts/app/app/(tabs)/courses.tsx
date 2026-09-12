import * as Haptics from "expo-haptics";
import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { CoverImage } from "@/components/Image";
import { useCourses } from "@/hooks/useApi";
import { BookOpen, GraduationCap, User, ChevronRight } from "lucide-react-native";
import { useState, useCallback } from "react";
import { router } from "expo-router";

export default function CoursesScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { data: courses, isLoading, refetch } = useCourses();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, []);

  if (isLoading && !courses) {
    return (
      <GradientBackground style={{ justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: insets.bottom + 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={{ marginBottom: 28, padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <View style={{
              width: 40, height: 40, borderRadius: 16,
              backgroundColor: colors.primary + "18",
              alignItems: "center", justifyContent: "center",
            }}>
              <GraduationCap size={22} stroke={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 }}>
              Courses
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 14, marginLeft: 50 }}>
            {courses?.length ?? 0} {courses?.length === 1 ? "course" : "courses"} available
          </Text>
        </GlassCard>

        {courses?.map((course) => {
          const cap = 75;
          const enrolledPct = course.enrolled ? Math.min(Math.round((course.enrolled / cap) * 100), 100) : 0;

          return (
            <Pressable key={course.id} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/course/${course.id}`); }}>
              <GlassCard style={{ marginBottom: 16, borderRadius: 24, overflow: "hidden", padding: 0 }}>
                <CoverImage uri={course.coverUrl} height={160} />
                <View style={{ padding: 16, gap: 8 }}>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700", letterSpacing: -0.3 }} numberOfLines={2}>
                    {course.title}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <User size={12} stroke={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
                      {course.instructor}
                    </Text>
                  </View>
                  <View style={{
                    flexDirection: "row", alignItems: "center", gap: 6,
                    backgroundColor: colors.primary + "0d",
                    alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4,
                    borderRadius: 20,
                  }}>
                    <BookOpen size={12} stroke={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>
                      {course.credits} {course.credits === 1 ? "Credit" : "Credits"}
                    </Text>
                  </View>
                  {course.enrolled > 0 && (
                    <View style={{ marginTop: 4, gap: 6 }}>
                      <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border }}>
                        <View style={{
                          width: enrolledPct + "%" as any,
                          height: "100%",
                          borderRadius: 2,
                          backgroundColor: colors.primary,
                        }} />
                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "500" }}>
                        {course.enrolled} enrolled
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{
                  position: "absolute", right: 12, top: 12,
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: "rgba(0,0,0,0.35)",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <ChevronRight size={16} stroke="#FFF" />
                </View>
              </GlassCard>
            </Pressable>
          );
        })}
      </ScrollView>
    </GradientBackground>
  );
}
