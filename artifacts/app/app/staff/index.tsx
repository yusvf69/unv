import * as Haptics from "expo-haptics";
import { useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { SafeImage } from "@/components/Image";
import { useStaffDoctors } from "@/hooks/useApi";
import { Users, Building2, BadgeCheck } from "lucide-react-native";

export default function StaffScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { data: staff, isLoading, refetch } = useStaffDoctors();
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
            <Users size={18} color={colors.primary} />
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700", letterSpacing: -0.5 }}>Staff</Text>
        </View>
      </GlassCard>

      {isLoading && !staff ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !staff || staff.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: colors.primary + "10",
            alignItems: "center", justifyContent: "center", marginBottom: 16,
          }}>
            <Users size={28} color={colors.textSecondary} />
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: "center" }}>No staff found</Text>
        </View>
      ) : (
        <FlatList
          data={staff}
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
          renderItem={({ item: member }) => (
            <GlassCard style={{ padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center" }}>
              <SafeImage uri={member.avatarUrl} size={52} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>{member.name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                  <BadgeCheck size={13} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "500" }}>
                    {member.title || member.role}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Building2 size={13} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{member.department}</Text>
                </View>
              </View>
            </GlassCard>
          )}
        />
      )}
    </GradientBackground>
  );
}
