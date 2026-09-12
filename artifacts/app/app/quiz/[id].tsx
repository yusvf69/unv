import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useTheme";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { NeoButton } from "@/components/NeoButton";
import { useOpenQuizzes, useStartQuiz, useSubmitQuiz } from "@/hooks/useApi";
import { useLocalSearchParams, router } from "expo-router";
import { Clock, Check, X, Trophy, ArrowLeft, ArrowRight, RotateCcw } from "lucide-react-native";
import * as Haptics from "expo-haptics";

type Phase = "intro" | "taking" | "result";

export default function QuizScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const quizId = Number(id);

  const { data: openQuizzes } = useOpenQuizzes();
  const quizMeta = openQuizzes?.find((q) => q.id === quizId);

  const { data, refetch } = useStartQuiz(quizId);
  const submitQuiz = useSubmitQuiz();

  const [phase, setPhase] = useState<Phase>("intro");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submittedQuiz, setSubmittedQuiz] = useState<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const answersRef = useRef(answers);
  const timeLeftRef = useRef(timeLeft);
  const questionsRef = useRef(data?.questions ?? []);
  answersRef.current = answers;
  timeLeftRef.current = timeLeft;
  questionsRef.current = data?.questions ?? [];

  const quiz = data?.quiz ?? quizMeta;
  const questions = data?.questions ?? [];
  const totalQuestions = questions.length;

  const handleSubmit = useCallback(() => {
    clearInterval(timerRef.current!);
    if (!questionsRef.current.length) return;
    const elapsed = ((quiz?.durationMinutes ?? 10) * 60) - timeLeftRef.current;
    const submitAnswers = Object.entries(answersRef.current).map(([qId, optIdx]) => ({
      questionId: Number(qId),
      chosenOriginalIndex: questionsRef.current.find((q) => q.id === Number(qId))?.optionMap[optIdx] ?? optIdx,
    }));
    submitQuiz.mutateAsync({ quizId, answers: submitAnswers, durationSec: elapsed })
      .then((res) => {
        setSubmittedQuiz(res);
        setPhase("result");
      })
      .catch(() => {});
  }, [quizId, quiz?.durationMinutes, submitQuiz]);

  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  const handleStart = useCallback(async () => {
    const res = await refetch();
    if (!res.data) return;
    setPhase("taking");
    setCurrentQ(0);
    setAnswers({});
    setTimeLeft(res.data.quiz.durationMinutes * 60);
  }, [refetch]);

  useEffect(() => {
    if (phase !== "taking") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleSubmitRef.current();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [phase]);

  useEffect(() => {
    if (phase === "result") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [phase]);

  const selectAnswer = useCallback((questionId: number, optionIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnswers((prev) => {
      if (prev[questionId] === optionIndex) {
        const next = { ...prev };
        delete next[questionId];
        return next;
      }
      return { ...prev, [questionId]: optionIndex };
    });
  }, []);

  const goToQuestion = useCallback((index: number) => {
    slideAnim.setValue(index > currentQ ? 50 : -50);
    setCurrentQ(index);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [currentQ, slideAnim]);

  const answeredCount = Object.keys(answers).length;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (phase === "intro") {
    return (
      <GradientBackground>
        <View style={{ paddingTop: insets.top, paddingHorizontal: 16, paddingBottom: 8 }}>
          <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ArrowLeft size={22} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 16 }}>Back</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, alignItems: "center" }}>
          <GlassCard style={{
            width: 80, height: 80, borderRadius: 40,
            alignItems: "center", justifyContent: "center",
            marginTop: 40, marginBottom: 24,
          }}>
            <Clock size={40} color={colors.primary} />
          </GlassCard>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: "700", textAlign: "center", marginBottom: 8 }}>
            {quiz?.title ?? "Quiz"}
          </Text>
          {quiz && (
            <>
              <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center", marginBottom: 24, lineHeight: 20 }}>
                {quiz.description}
              </Text>
              <GlassCard style={{ padding: 18, width: "100%", marginBottom: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Course</Text>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{"courseTitle" in quiz ? quiz.courseTitle : "-"}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Duration</Text>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{quiz.durationMinutes} min</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Questions</Text>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>
                    {"totalPoints" in quiz ? `${quiz.totalPoints} pts` : `~${quiz.durationMinutes * 2} q`}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Pass</Text>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>
                    {"passPercent" in quiz ? `${quiz.passPercent}%` : "60%"}
                  </Text>
                </View>
              </GlassCard>
              <NeoButton label="Start Quiz" onPress={handleStart} style={{ width: "100%", marginTop: 8 }} />
            </>
          )}
        </ScrollView>
      </GradientBackground>
    );
  }

  if (phase === "result" && submittedQuiz) {
    const pct = Math.round((submittedQuiz.score / submittedQuiz.total) * 100);
    return (
      <GradientBackground>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 16, paddingBottom: 40 }}>
          <Animated.View style={{ alignItems: "center", transform: [{ scale: pulseAnim }] }}>
            <View style={{
              width: 100, height: 100, borderRadius: 50,
              backgroundColor: submittedQuiz.passed ? colors.success : colors.danger,
              alignItems: "center", justifyContent: "center", marginBottom: 16,
            }}>
              <Trophy size={48} stroke="#FFF" />
            </View>
          </Animated.View>

          <GlassCard style={{ padding: 16, alignItems: "center", marginBottom: 8 }}>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: "700", textAlign: "center" }}>
              {submittedQuiz.passed ? "Passed!" : "Try Again"}
            </Text>
          </GlassCard>

          <GlassCard style={{ padding: 12, alignItems: "center", marginBottom: 24 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center" }}>
              You earned {submittedQuiz.pointsAwarded} XP
            </Text>
          </GlassCard>

          <GlassCard style={{ padding: 18, marginBottom: 24, flexDirection: "row", justifyContent: "space-around" }}>
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: colors.text, fontSize: 32, fontWeight: "700" }}>{submittedQuiz.score}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Score</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: colors.text, fontSize: 32, fontWeight: "700" }}>{submittedQuiz.total}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Total</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: colors.text, fontSize: 32, fontWeight: "700" }}>{pct}%</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Percentage</Text>
            </View>
          </GlassCard>

          <GlassCard style={{ padding: 12, alignItems: "center", marginBottom: 12 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>Review Answers</Text>
          </GlassCard>

          {submittedQuiz.questionDetails.map((qd: any, i: number) => (
            <GlassCard key={qd.questionId} style={{ padding: 14, marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View style={{ marginTop: 2 }}>
                  {qd.correct ? <Check size={18} color={colors.success} /> : <X size={18} color={colors.danger} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600", marginBottom: 6 }}>
                    {i + 1}. {qd.text}
                  </Text>
                  {qd.options.map((opt: string, oi: number) => {
                    const isCorrectOption = oi === qd.correctIndex;
                    const isWrongPick = oi === qd.userChosen && !qd.correct;
                    return (
                      <View key={oi} style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 4,
                        paddingHorizontal: 8,
                        borderRadius: 8,
                        backgroundColor: isCorrectOption ? `${colors.success}20` : isWrongPick ? `${colors.danger}20` : "transparent",
                        marginBottom: 3,
                      }}>
                        <Text style={{
                          color: isCorrectOption ? colors.success : isWrongPick ? colors.danger : colors.textSecondary,
                          fontSize: 13,
                          fontWeight: isCorrectOption || isWrongPick ? "600" : "400",
                          flex: 1,
                        }}>
                          {opt}
                        </Text>
                        {isCorrectOption && <Check size={14} color={colors.success} />}
                        {isWrongPick && <X size={14} color={colors.danger} />}
                      </View>
                    );
                  })}
                  {qd.explanation ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 6, fontStyle: "italic" }}>
                      {qd.explanation}
                    </Text>
                  ) : null}
                </View>
              </View>
            </GlassCard>
          ))}

          <NeoButton
            label="Back"
            onPress={() => router.back()}
            icon={<ArrowLeft size={18} color="#FFF" />}
            style={{ marginTop: 16 }}
          />
        </ScrollView>
      </GradientBackground>
    );
  }

  const question = questions[currentQ];

  return (
    <GradientBackground>
      <View style={{ paddingTop: insets.top, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>

          <GlassCard style={{
            width: 64, height: 64, borderRadius: 32,
            borderWidth: 3,
            borderColor: timeLeft < 30 ? colors.danger : timeLeft < 60 ? colors.warning : colors.primary,
            alignItems: "center", justifyContent: "center",
          }}>
            <Clock size={16} color={timeLeft < 30 ? colors.danger : colors.text} />
            <Text style={{
              color: timeLeft < 30 ? colors.danger : colors.text,
              fontSize: 12, fontWeight: "700",
            }}>
              {formatTime(timeLeft)}
            </Text>
          </GlassCard>

          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {currentQ + 1}/{totalQuestions}
          </Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {question && (
          <Animated.View
            style={{
              flex: 1,
              transform: [{ translateX: slideAnim }],
              opacity: slideAnim.interpolate({
                inputRange: [-50, 0, 50],
                outputRange: [0, 1, 0],
              }),
            }}
          >
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}>
              <GlassCard style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, alignSelf: "flex-start", marginBottom: 12 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}>
                  Question {currentQ + 1}/{totalQuestions}
                </Text>
              </GlassCard>

              <GlassCard style={{ padding: 16, marginBottom: 24 }}>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: "600", lineHeight: 28 }}>
                  {question.text}
                </Text>
              </GlassCard>

              {question.options.map((opt, oi) => {
                const isSelected = (answers[question.id] ?? -1) === oi;
                return (
                  <Pressable key={oi} onPress={() => selectAnswer(question.id, oi)}>
                    <GlassCard style={{
                      padding: 16, marginBottom: 10,
                      borderColor: isSelected ? colors.primary : "transparent",
                      borderWidth: isSelected ? 2 : 0,
                    }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View style={{
                          width: 26, height: 26, borderRadius: 13,
                          borderWidth: 2,
                          borderColor: isSelected ? colors.primary : colors.textSecondary,
                          backgroundColor: isSelected ? colors.primary : "transparent",
                          alignItems: "center", justifyContent: "center",
                        }}>
                          {isSelected && <Check size={14} color="#FFF" />}
                        </View>
                        <Text style={{
                          color: colors.text, fontSize: 15, flex: 1,
                          fontWeight: isSelected ? "600" : "400",
                        }}>{opt}</Text>
                      </View>
                    </GlassCard>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}
      </View>

      <View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        paddingBottom: Math.max(insets.bottom, 24),
        paddingTop: 12,
        paddingHorizontal: 16,
      }}>
        <View style={{ height: 3, backgroundColor: colors.border, borderRadius: 1.5, marginBottom: 12 }}>
          <View style={{
            width: `${((currentQ + 1) / totalQuestions) * 100}%`,
            height: "100%",
            backgroundColor: colors.primary,
            borderRadius: 1.5,
          }} />
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          {currentQ > 0 ? (
            <NeoButton
              label="Previous"
              onPress={() => goToQuestion(currentQ - 1)}
              variant="secondary"
              icon={<ArrowLeft size={16} color={colors.text} />}
              style={{ flex: 1 }}
            />
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {currentQ < totalQuestions - 1 ? (
            <NeoButton
              label="Next"
              onPress={() => goToQuestion(currentQ + 1)}
              icon={<ArrowRight size={16} color="#FFF" />}
              style={{ flex: 1 }}
            />
          ) : (
            <NeoButton
              label={`Submit (${answeredCount}/${totalQuestions})`}
              onPress={handleSubmit}
              variant={answeredCount === totalQuestions ? "primary" : "secondary"}
              style={{ flex: 1 }}
              disabled={answeredCount === 0}
            />
          )}
        </View>
      </View>
    </GradientBackground>
  );
}
