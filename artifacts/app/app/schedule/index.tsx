import * as Haptics from "expo-haptics";
import { useState, useCallback } from "react";
import { View, Text, SectionList, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { useSchedule } from "@/hooks/useApi";
import { CalendarDays, Clock, MapPin, User } from "lucide-react-native";

const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAYS_AR = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { data, isLoading, refetch } = useSchedule();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const sections = DAYS.map((day, i) => ({
    title: day,
    titleAr: DAYS_AR[i],
    data: (data || []).filter((s) => s.dayNumber === i || s.day === day),
  })).filter((s) => s.data.length > 0);

  return (
    <GradientBackground>
      <GlassCard style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12, marginHorizontal: 16, marginTop: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: colors.primary + "15",
            alignItems: "center", justifyContent: "center",
          }}>
            <CalendarDays size={18} color={colors.primary} />
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700", letterSpacing: -0.5 }}>Schedule</Text>
        </View>
      </GlassCard>

      {isLoading && !data ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : sections.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: colors.primary + "10",
            alignItems: "center", justifyContent: "center", marginBottom: 16,
          }}>
            <CalendarDays size={28} color={colors.textSecondary} />
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: "center" }}>No schedule found</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          renderSectionHeader={({ section }) => (
            <GlassCard style={{ paddingHorizontal: 14, paddingVertical: 8, marginBottom: 10, marginTop: 4, alignSelf: "flex-start" }}>
              <Text style={{
                color: colors.text, fontSize: 16, fontWeight: "600",
              }}>
                {section.titleAr || section.title}
              </Text>
            </GlassCard>
          )}
          renderItem={({ item }) => (
            <GlassCard style={{ padding: 16, marginBottom: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", flex: 1 }}>
                  {item.courseTitle}
                </Text>
                <View style={{
                  flexDirection: "row", alignItems: "center", gap: 4,
                  backgroundColor: colors.secondary + "12",
                  paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
                }}>
                  <Clock size={12} color={colors.secondary} />
                  <Text style={{ color: colors.secondary, fontSize: 12, fontWeight: "600" }}>
                    {item.startTime} - {item.endTime}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", marginTop: 10, gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <User size={13} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{item.instructor}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <MapPin size={13} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{item.room}</Text>
                </View>
              </View>
            </GlassCard>
          )}
        />
      )}
    </GradientBackground>
  );
}
