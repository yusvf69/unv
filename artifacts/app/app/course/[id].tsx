import * as Haptics from "expo-haptics";
import { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { NeoButton } from "@/components/NeoButton";
import { CoverImage } from "@/components/Image";
import { useLocalSearchParams, router } from "expo-router";
import { useCourseDetail, useCourseLectures } from "@/hooks/useApi";
import { Play, FileText, Edit3, BookOpen, User, Clock, ChevronLeft } from "lucide-react-native";

export default function CourseDetailScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const courseId = Number(id);

  const { data: course, isLoading: courseLoading } = useCourseDetail(courseId);
  const { data: lectures, isLoading: lecturesLoading, refetch } = useCourseLectures(courseId);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const typeIcon = (type: string) => {
    switch (type) {
      case "lecture":
      case "video":
        return Play;
      case "section":
      case "file":
        return FileText;
      case "quiz":
      case "edit":
        return Edit3;
      default:
        return BookOpen;
    }
  };

  if (courseLoading || lecturesLoading) {
    return (
      <GradientBackground style={{ alignItems: "center", justifyContent: "center" }}>
        <BookOpen size={32} color={colors.primary} />
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <CoverImage uri={course?.coverUrl} height={200} />

        <View style={{ paddingTop: 0, paddingHorizontal: 16 }}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: -44,
              marginBottom: 16,
              alignSelf: "flex-start",
              backgroundColor: colors.surface,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
            }}
          >
            <ChevronLeft size={20} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>Back</Text>
          </Pressable>

          <GlassCard style={{ padding: 16, marginBottom: 12 }}>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700", marginBottom: 4 }}>
              {course?.title || `Course ${id}`}
            </Text>

            {course?.instructor && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <User size={14} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{course.instructor}</Text>
              </View>
            )}

            {course?.description && (
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 0, lineHeight: 18 }}>
                {course.description}
              </Text>
            )}
          </GlassCard>

          <GlassCard style={{ padding: 14, marginBottom: 20, flexDirection: "row", justifyContent: "space-around" }}>
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>{course?.credits ?? "-"}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Credits</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>{course?.enrollmentCount ?? course?.enrolled ?? "-"}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Enrolled</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>{lectures?.length ?? 0}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Lectures</Text>
            </View>
          </GlassCard>

          <GlassCard style={{ paddingHorizontal: 16, paddingVertical: 10, marginBottom: 16, alignSelf: "flex-start" }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>
              Lectures & Materials
            </Text>
          </GlassCard>

          {lectures?.length === 0 && (
            <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", marginTop: 20 }}>
              No lectures yet
            </Text>
          )}

          {lectures?.map((lecture) => {
            const Icon = typeIcon(lecture.type);
            return (
              <GlassCard key={lecture.id} style={{ padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center" }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 14,
                  backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={20} stroke="#FFF" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>{lecture.title}</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
                    {(lecture.videoCount ?? lecture.videos?.length) > 0 && (
                      <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                        {lecture.videoCount ?? lecture.videos?.length} videos
                      </Text>
                    )}
                    {(lecture.pdfCount ?? lecture.pdfs?.length) > 0 && (
                      <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                        {lecture.pdfCount ?? lecture.pdfs?.length} PDFs
                      </Text>
                    )}
                    {(lecture.quizCount ?? lecture.quizzes?.length) > 0 && (
                      <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: "600" }}>
                        {lecture.quizCount ?? lecture.quizzes?.length} quiz
                      </Text>
                    )}
                  </View>
                </View>
                {(lecture.hasQuiz ?? lecture.quizzes?.length > 0) ? (
                  <Pressable
                    onPress={() => {
                      const quizId = lecture.quizId ?? lecture.quizzes?.[0]?.id;
                      if (quizId) router.push(`/quiz/${quizId}`);
                    }}
                    style={{
                      backgroundColor: colors.secondary,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: "#FFF", fontSize: 13, fontWeight: "600" }}>Quiz</Text>
                  </Pressable>
                ) : null}
              </GlassCard>
            );
          })}
        </View>
      </ScrollView>
    </GradientBackground>
  );
}
