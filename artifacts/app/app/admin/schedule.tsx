import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GlassCard } from "@/components/GlassCard";
import { useSchedule } from "@/hooks/useApi";
import { router } from "expo-router";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react-native";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AdminScheduleScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { data: schedule, isLoading } = useSchedule();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 60 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Pressable onPress={() => router.back()}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <Calendar size={22} color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>Schedule</Text>
        </View>

        {isLoading ? (
          <Text style={{ color: colors.textSecondary, textAlign: "center", marginTop: 40 }}>Loading schedule...</Text>
        ) : schedule ? (
          Object.entries(schedule).map(([day, slots]: [string, any]) =>
            slots?.length > 0 ? (
              <View key={day}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginTop: 16, marginBottom: 8 }}>{dayNames[parseInt(day)] || day}</Text>
                {slots.map((slot: any, idx: number) => (
                  <GlassCard key={idx} style={{ padding: 14, marginBottom: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Clock size={16} color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>{slot.course}</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{slot.time} · {slot.room}</Text>
                      </View>
                      <User size={16} color={colors.textSecondary} />
                    </View>
                  </GlassCard>
                ))}
              </View>
            ) : null
          )
        ) : (
          <Text style={{ color: colors.textSecondary, textAlign: "center", marginTop: 40 }}>No schedule data</Text>
        )}
      </ScrollView>
    </View>
  );
}
