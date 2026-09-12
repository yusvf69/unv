import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GlassCard } from "@/components/GlassCard";
import { useCourses } from "@/hooks/useApi";
import { router } from "expo-router";
import { ArrowLeft, BookOpen, Plus } from "lucide-react-native";

export default function AdminCoursesScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { data: courses, isLoading } = useCourses();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 60 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Pressable onPress={() => router.back()}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <BookOpen size={22} color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>Courses</Text>
        </View>

        {isLoading ? (
          <Text style={{ color: colors.textSecondary, textAlign: "center", marginTop: 40 }}>Loading courses...</Text>
        ) : (
          courses?.map((course: any) => (
            <Pressable key={course.id} onPress={() => router.push(`/course/${course.id}` as any)}>
              <GlassCard style={{ padding: 16, marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                    <BookOpen size={20} stroke="#FFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>{course.title}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{course.instructor} · {course.lectures?.length || 0} lectures</Text>
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
