import { View, Text, TextInput, ScrollView, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { router } from "expo-router";
import { useColors, useThemeStore } from "@/hooks/useTheme";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { NeoButton } from "@/components/NeoButton";
import { AIOrb } from "@/components/AIOrb";
import * as Haptics from "expo-haptics";
import {
  apiLogin, apiCheckUser, apiSendVerification, apiVerifyCode,
  apiSignup, apiForgotPassword, apiVerifyResetCode, apiResetPassword,
} from "@/lib/api";

type Phase = "login" | "signup-idle" | "signup-verifying" | "forgot";

export default function LoginScreen() {
  const colors = useColors();
  const isDark = useThemeStore((s) => s.isDark);

  const [phase, setPhase] = useState<Phase>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login fields
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // Signup fields
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [group, setGroup] = useState("");
  const [email, setEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [code, setCode] = useState("");

  // Forgot sub-flow
  const [forgotStep, setForgotStep] = useState<"" | "email" | "code" | "newpass">("");
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");

  const handleLogin = async () => {
    if (!identifier || !password) return;
    setLoading(true);
    setError(null);
    try {
      await apiLogin(identifier, password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setLoading(true);
    setError(null);
    try {
      if (phase === "signup-idle") {
        if (!name || !department || !group || !email || !signupPassword) {
          setError("Please fill in all fields");
          setLoading(false);
          return;
        }
        const check = await apiCheckUser(email, "");
        if (check.exists) {
          setError("Email already registered");
          setLoading(false);
          return;
        }
        await apiSendVerification(email, "");
        setPhase("signup-verifying");
      } else if (phase === "signup-verifying") {
        if (!code) {
          setError("Please enter the verification code");
          setLoading(false);
          return;
        }
        await apiVerifyCode(email, "", code);
        await apiSignup({
          name,
          username: email,
          email,
          phone: "",
          password: signupPassword,
          specialization: department,
          groupName: group,
        });
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    setLoading(true);
    setError(null);
    try {
      if (forgotStep === "" || forgotStep === "email") {
        await apiForgotPassword(forgotIdentifier);
        setForgotStep("code");
      } else if (forgotStep === "code") {
        await apiVerifyResetCode(forgotIdentifier, forgotCode);
        setForgotStep("newpass");
      } else if (forgotStep === "newpass") {
        await apiResetPassword(forgotIdentifier, forgotCode, forgotNewPassword);
        setPhase("login");
        setForgotStep("");
        setIdentifier(forgotIdentifier);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const switchPhase = (p: Phase) => {
    setPhase(p);
    setError(null);
    if (p !== "forgot") setForgotStep("");
  };

  const inputGlass = {
    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.5)",
    borderRadius: 14,
    padding: 15,
    color: colors.text,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(43,92,69,0.1)",
  };

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <LinearGradient
            colors={isDark
              ? ["#0A1A14", "#111F19", "#0D1F1A"]
              : ["#F7F3ED", "#EFE8DE", "#E8DFD3"]
            }
            style={{ flex: 1, position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={{ alignItems: "center", paddingTop: 20, marginBottom: 28 }}>
              <AIOrb size={80} />
              <Text style={{
                color: colors.primary,
                fontSize: 34,
                fontWeight: "800",
                letterSpacing: 1.5,
                marginTop: 16,
                marginBottom: 4,
              }}>
                UniVerse
              </Text>
              <Text style={{
                color: colors.textSecondary,
                fontSize: 14,
                letterSpacing: 0.5,
                opacity: 0.8,
              }}>
                Connect. Learn. Grow.
              </Text>
            </View>

            <GlassCard style={{ padding: 24, paddingBottom: 28 }}>
              {phase === "login" && (
                <>
                  <TextInput
                    placeholder="Email"
                    placeholderTextColor={colors.textSecondary}
                    value={identifier}
                    onChangeText={setIdentifier}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={inputGlass}
                  />
                  <TextInput
                    placeholder="Password"
                    placeholderTextColor={colors.textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    style={inputGlass}
                  />
                  {error && (
                    <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 12, textAlign: "center" }}>
                      {error}
                    </Text>
                  )}
                  <NeoButton label="Login" loading={loading} onPress={handleLogin} />
                  <GlassCard
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); switchPhase("forgot"); }}
                    style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, alignSelf: "center", marginTop: 14 }}
                  >
                    <Text style={{ color: colors.textSecondary, textAlign: "center", fontSize: 13 }}>
                      Forgot password?
                    </Text>
                  </GlassCard>
                  <GlassCard
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); switchPhase("signup-idle"); }}
                    style={{ paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, alignSelf: "center", marginTop: 18 }}
                  >
                    <Text style={{ color: colors.textSecondary, textAlign: "center", fontSize: 14 }}>
                      Don't have an account?{" "}
                      <Text style={{ color: colors.primary, fontWeight: "700" }}>Sign up</Text>
                    </Text>
                  </GlassCard>
                </>
              )}

              {phase === "signup-idle" && (
                <>
                  <TextInput
                    placeholder="Full name"
                    placeholderTextColor={colors.textSecondary}
                    value={name}
                    onChangeText={setName}
                    style={inputGlass}
                  />
                  <TextInput
                    placeholder="Department"
                    placeholderTextColor={colors.textSecondary}
                    value={department}
                    onChangeText={setDepartment}
                    style={inputGlass}
                  />
                  <TextInput
                    placeholder="Group"
                    placeholderTextColor={colors.textSecondary}
                    value={group}
                    onChangeText={setGroup}
                    style={inputGlass}
                  />
                  <TextInput
                    placeholder="Email"
                    placeholderTextColor={colors.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={inputGlass}
                  />
                  <TextInput
                    placeholder="Password"
                    placeholderTextColor={colors.textSecondary}
                    value={signupPassword}
                    onChangeText={setSignupPassword}
                    secureTextEntry
                    style={inputGlass}
                  />
                  {error && (
                    <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 12, textAlign: "center" }}>
                      {error}
                    </Text>
                  )}
                  <NeoButton label="Create Account" loading={loading} onPress={handleSignup} />
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); switchPhase("login"); }}
                    style={{ marginTop: 18 }}
                  >
                    <Text style={{ color: colors.textSecondary, textAlign: "center", fontSize: 14 }}>
                      Already have an account?{" "}
                      <Text style={{ color: colors.primary, fontWeight: "700" }}>Login</Text>
                    </Text>
                  </Pressable>
                </>
              )}

              {phase === "signup-verifying" && (
                <>
                  <Text style={{
                    color: colors.text,
                    fontSize: 18,
                    fontWeight: "700",
                    textAlign: "center",
                    marginBottom: 6,
                  }}>
                    Verify your email
                  </Text>
                  <Text style={{
                    color: colors.textSecondary,
                    fontSize: 13,
                    textAlign: "center",
                    marginBottom: 20,
                    lineHeight: 18,
                  }}>
                    Enter the verification code sent to{"\n"}
                    <Text style={{ color: colors.primary, fontWeight: "600" }}>{email}</Text>
                  </Text>
                  <TextInput
                    placeholder="000000"
                    placeholderTextColor={colors.textSecondary}
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={{
                      ...inputGlass,
                      textAlign: "center",
                      fontSize: 26,
                      letterSpacing: 10,
                      fontWeight: "700",
                    }}
                  />
                  {error && (
                    <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 12, textAlign: "center" }}>
                      {error}
                    </Text>
                  )}
                  <NeoButton label="Verify & Continue" loading={loading} onPress={handleSignup} />
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); switchPhase("signup-idle"); }}
                    style={{ marginTop: 14 }}
                  >
                    <Text style={{ color: colors.textSecondary, textAlign: "center", fontSize: 13 }}>
                      Change email or resend code
                    </Text>
                  </Pressable>
                </>
              )}

              {phase === "forgot" && (
                <>
                  {(forgotStep === "" || forgotStep === "email") && (
                    <>
                      <Text style={{
                        color: colors.text,
                        fontSize: 18,
                        fontWeight: "700",
                        textAlign: "center",
                        marginBottom: 6,
                      }}>
                        Reset password
                      </Text>
                      <Text style={{
                        color: colors.textSecondary,
                        fontSize: 13,
                        textAlign: "center",
                        marginBottom: 20,
                      }}>
                        Enter your email to receive a reset code
                      </Text>
                      <TextInput
                        placeholder="Email"
                        placeholderTextColor={colors.textSecondary}
                        value={forgotIdentifier}
                        onChangeText={setForgotIdentifier}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={inputGlass}
                      />
                      {error && (
                        <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 12, textAlign: "center" }}>
                          {error}
                        </Text>
                      )}
                      <NeoButton
                        label="Send Reset Code"
                        loading={loading}
                        onPress={handleForgot}
                      />
                    </>
                  )}

                  {forgotStep === "code" && (
                    <>
                      <Text style={{
                        color: colors.text,
                        fontSize: 18,
                        fontWeight: "700",
                        textAlign: "center",
                        marginBottom: 6,
                      }}>
                        Enter reset code
                      </Text>
                      <Text style={{
                        color: colors.textSecondary,
                        fontSize: 13,
                        textAlign: "center",
                        marginBottom: 20,
                      }}>
                        Sent to {forgotIdentifier}
                      </Text>
                      <TextInput
                        placeholder="000000"
                        placeholderTextColor={colors.textSecondary}
                        value={forgotCode}
                        onChangeText={setForgotCode}
                        keyboardType="number-pad"
                        maxLength={6}
                        style={{
                          ...inputGlass,
                          textAlign: "center",
                          fontSize: 26,
                          letterSpacing: 10,
                          fontWeight: "700",
                        }}
                      />
                      {error && (
                        <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 12, textAlign: "center" }}>
                          {error}
                        </Text>
                      )}
                      <NeoButton
                        label="Verify Code"
                        loading={loading}
                        onPress={handleForgot}
                      />
                    </>
                  )}

                  {forgotStep === "newpass" && (
                    <>
                      <Text style={{
                        color: colors.text,
                        fontSize: 18,
                        fontWeight: "700",
                        textAlign: "center",
                        marginBottom: 20,
                      }}>
                        New password
                      </Text>
                      <TextInput
                        placeholder="New password"
                        placeholderTextColor={colors.textSecondary}
                        value={forgotNewPassword}
                        onChangeText={setForgotNewPassword}
                        secureTextEntry
                        style={inputGlass}
                      />
                      {error && (
                        <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 12, textAlign: "center" }}>
                          {error}
                        </Text>
                      )}
                      <NeoButton
                        label="Reset Password"
                        loading={loading}
                        onPress={handleForgot}
                      />
                    </>
                  )}

                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); switchPhase("login"); }}
                    style={{ marginTop: 18 }}
                  >
                    <Text style={{ color: colors.textSecondary, textAlign: "center", fontSize: 13 }}>
                      Back to login
                    </Text>
                  </Pressable>
                </>
              )}
            </GlassCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}
