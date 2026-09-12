import * as Haptics from "expo-haptics";
import { useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { useEvents } from "@/hooks/useApi";
import { Calendar, MapPin } from "lucide-react-native";

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { data: events, isLoading, refetch } = useEvents();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <GradientBackground>
      <GlassCard style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12, marginHorizontal: 16, marginTop: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: colors.primary + "15",
            alignItems: "center", justifyContent: "center",
          }}>
            <Calendar size={18} color={colors.primary} />
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700", letterSpacing: -0.5 }}>Events</Text>
        </View>
      </GlassCard>

      {isLoading && !events ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !events || events.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: colors.primary + "10",
            alignItems: "center", justifyContent: "center", marginBottom: 16,
          }}>
            <Calendar size={28} color={colors.textSecondary} />
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: "center" }}>No events</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item }) => {
            const date = item.dueAt ? new Date(item.dueAt) : null;
            return (
              <GlassCard style={{ padding: 16, marginBottom: 12, flexDirection: "row" }}>
                {date && (
                  <View style={{
                    width: 56, height: 56, borderRadius: 14,
                    backgroundColor: colors.primary + "12",
                    alignItems: "center", justifyContent: "center", marginRight: 14,
                  }}>
                    <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "700", lineHeight: 20 }}>
                      {date.getDate()}
                    </Text>
                    <Text style={{ color: colors.primary, fontSize: 10, fontWeight: "600", textTransform: "uppercase" }}>
                      {date.toLocaleDateString("en-US", { month: "short" })}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginBottom: 4 }}>
                    {item.title}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 8 }} numberOfLines={2}>
                    {item.description}
                  </Text>
                  {item.location && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <MapPin size={13} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.location}</Text>
                    </View>
                  )}
                </View>
              </GlassCard>
            );
          }}
        />
      )}
    </GradientBackground>
  );
}
