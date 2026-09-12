import { View, Text, ScrollView, Pressable, TextInput, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GlassCard } from "@/components/GlassCard";
import { useApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, Search, Users, UserCheck, Shield } from "lucide-react-native";
import { useState } from "react";

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const api = useApi();
  const [search, setSearch] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.get("/v2/admin/users"),
  });

  const filtered = users?.filter((u: any) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 60 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Pressable onPress={() => router.back()}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <Users size={22} color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>Users</Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 14, marginBottom: 16 }}>
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            placeholder="Search users..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, color: colors.text, fontSize: 15 }}
          />
        </View>

        {isLoading ? (
          <Text style={{ color: colors.textSecondary, textAlign: "center", marginTop: 40 }}>Loading users...</Text>
        ) : (
          filtered?.map((user: any) => (
            <GlassCard key={user.id} style={{ padding: 16, marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#FFF", fontSize: 18, fontWeight: "700" }}>{user.name?.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>{user.name}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{user.email}</Text>
                </View>
                {user.role === "admin" && <Shield size={18} color={colors.accentGold} />}
                <UserCheck size={18} color={colors.primary} />
              </View>
            </GlassCard>
          ))
        )}
      </ScrollView>
    </View>
  );
}
