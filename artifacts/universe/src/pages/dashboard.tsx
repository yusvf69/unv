import { useGetDashboard, useCompleteMission, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useTranslation, globalI18n } from "@/lib/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { useMyGroupSchedule, useLogStudyActivity } from "@/lib/api";
import { CheckCircle2, Circle, AlertCircle, TrendingUp, Sparkles, BookOpen, Clock, Calendar as CalendarIcon, CheckSquare, Target, MapPin, User as UserIcon, Play, Square, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useState, useEffect } from "react";

const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const AR_WEEKDAYS = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

function getGreeting(name: string) {
  const h = new Date().getHours();
  if (h < 5) return `ليلة هادئة، ${name}`;
  if (h < 12) return `صباح الخير، ${name}`;
  if (h < 17) return `مرحباً ${name}، يومك زرع لمستقبل أخضر`;
  if (h < 21) return `مساء الخير، ${name}`;
  return `بقية ليلتك سعيدة، ${name}`;
}

export default function Dashboard() {
  const { data: dashboard, isLoading } = useGetDashboard();
  const { data: groupSchedule = [] } = useMyGroupSchedule();
  const t = useTranslation(globalI18n);
  const completeMission = useCompleteMission();
  const queryClient = useQueryClient();
  const logActivity = useLogStudyActivity();

  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next % 60 === 0) setElapsedMinutes(Math.floor(next / 60));
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleStop = () => {
    if (elapsedMinutes > 0) {
      logActivity.mutate(elapsedMinutes);
    }
    setIsRunning(false);
    setSeconds(0);
    setElapsedMinutes(0);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!dashboard) return null;

  const today = new Date().getDay();
  const todaysClasses = groupSchedule.filter((s) => s.dayNumber === today).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const aiTip = dashboard.examPrediction.recommendations[0] || "نظّم وقتك وحدّد ٣ أهداف يومية صغيرة.";

  // Prepare weekly activity data with Arabic labels
  const weeklyData = (dashboard.activity ?? []).map((a) => {
    const d = new Date(a.date);
    return {
      ...a,
      dayLabel: AR_WEEKDAYS[d.getDay()],
    };
  });
  const totalWeeklyPoints = weeklyData.reduce((sum, a) => sum + a.pointsEarned, 0);
  const avgDaily = weeklyData.length > 0 ? Math.round(weeklyData.reduce((sum, a) => sum + a.minutesStudied, 0) / 7) : 0;

  const handleCompleteMission = (missionId: number) => {
    const queryKey = getGetDashboardQueryKey();
    const prev = queryClient.getQueryData<typeof dashboard>(queryKey);
    if (prev) {
      queryClient.setQueryData(queryKey, {
        ...prev,
        missions: prev.missions.map((m) => m.id === missionId ? { ...m, completed: true } : m),
      });
    }
    completeMission.mutate(
      { id: missionId },
      {
        onError: () => {
          if (prev) queryClient.setQueryData(queryKey, prev);
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey });
        },
      }
    );
  };

  const progressPercentage = (dashboard.user.points / (dashboard.user.points + dashboard.nextLevelPoints)) * 100;

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
          >
            {getGreeting(dashboard.user.name)}
          </motion.h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-2 text-sm bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/15 rounded-2xl p-3 flex items-start gap-2 max-w-xl"
          >
            <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <span><strong className="text-primary">نصيحة الذكاء الاصطناعي:</strong> {aiTip}</span>
          </motion.div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <p className="text-muted-foreground text-sm">نظرة سريعة على يومك</p>
            {(dashboard.user as any).groupName && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="text-xs bg-primary/15 text-primary px-2.5 py-1 rounded-full font-bold"
              >
                مجموعة {(dashboard.user as any).groupName}
              </motion.span>
            )}
            {(dashboard.user as any).department && (
              <span className="text-xs bg-secondary/15 text-secondary-foreground px-2.5 py-1 rounded-full font-medium">
                {(dashboard.user as any).department}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 bg-card px-3 sm:px-4 py-2 rounded-2xl shadow-sm border border-border w-full sm:w-auto justify-center">
          <div className="text-center px-2 sm:px-4 border-e border-border">
            <div className="text-xl sm:text-2xl font-bold text-secondary">{dashboard.user.level}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Level</div>
          </div>
          <div className="text-center px-2 sm:px-4 border-e border-border">
            <div className="text-xl sm:text-2xl font-bold text-accent">{dashboard.user.points}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Points</div>
          </div>
          <div className="text-center px-2 sm:px-4">
            <div className="text-xl sm:text-2xl font-bold text-orange-500 flex items-center justify-center gap-1">
              🔥 {dashboard.user.streak}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Streak</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI Exam Prediction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
              <div className="w-36 h-36 sm:w-48 sm:h-48 shrink-0 relative">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-muted" />
                  <circle 
                    cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" 
                    strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * dashboard.examPrediction.predictedScore) / 100}
                    className="text-primary transition-all duration-1000 ease-out" 
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl sm:text-4xl font-bold text-primary">{dashboard.examPrediction.predictedScore}%</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">Predicted Score</span>
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="font-bold text-lg">{dashboard.examPrediction.courseTitle}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={dashboard.examPrediction.risk === 'low' ? 'default' : dashboard.examPrediction.risk === 'medium' ? 'secondary' : 'destructive'}>
                      {dashboard.examPrediction.risk} risk
                    </Badge>
                    <span className="text-sm text-muted-foreground">{dashboard.examPrediction.confidence}% confidence</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground/80">Recommendations:</h4>
                  <ul className="space-y-1">
                    {dashboard.examPrediction.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <Target className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />
              Daily Missions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.missions.map(mission => (
              <div key={mission.id} className={`flex items-start gap-3 p-3 rounded-xl border ${mission.completed ? 'bg-muted/50 border-transparent opacity-60' : 'bg-card border-border shadow-sm'}`}>
                <button 
                  onClick={() => !mission.completed && handleCompleteMission(mission.id)}
                  disabled={mission.completed || completeMission.isPending}
                  className="mt-0.5 shrink-0 focus:outline-none"
                >
                  {mission.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <h4 className={`text-sm font-bold ${mission.completed ? 'line-through text-muted-foreground' : ''}`}>{mission.title}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-1">{mission.description}</p>
                </div>
                <div className="text-xs font-bold text-accent shrink-0">+{mission.points}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Study Focus
            </CardTitle>
            <CardDescription>{dashboard.weeklyMinutes} / {dashboard.focusGoalMinutes} دقيقة هذا الأسبوع</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={(dashboard.weeklyMinutes / dashboard.focusGoalMinutes) * 100} className="h-2 mb-4" />

            {/* Weekly Summary */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
              <div className="bg-muted/30 rounded-lg p-2 sm:p-3 text-center">
                <div className="text-base sm:text-lg font-bold text-primary">{dashboard.weeklyMinutes}</div>
                <div className="text-[10px] text-muted-foreground">دقيقة مذاكرة</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-2 sm:p-3 text-center">
                <div className="text-base sm:text-lg font-bold text-accent">+{totalWeeklyPoints}</div>
                <div className="text-[10px] text-muted-foreground">نقاط مكتسبة</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-2 sm:p-3 text-center">
                <div className="text-base sm:text-lg font-bold">{avgDaily} د</div>
                <div className="text-[10px] text-muted-foreground">متوسط يومي</div>
              </div>
            </div>

            {/* Study Timer */}
            <div className="flex items-center justify-between bg-muted/30 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <Timer className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                <div>
                  <div className="text-xl sm:text-2xl font-bold tabular-nums">{formatTime(seconds)}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">
                    {isRunning ? "جاري المذاكرة..." : "اضغط لبدء المذاكرة"}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant={isRunning ? "destructive" : "default"}
                onClick={isRunning ? handleStop : () => setIsRunning(true)}
                disabled={logActivity.isPending}
                className="text-xs sm:text-sm"
              >
                {isRunning ? <><Square className="me-1 h-3 w-3 sm:h-3.5 sm:w-3.5" /> إيقاف</> : <><Play className="me-1 h-3 w-3 sm:h-3.5 sm:w-3.5" /> ابدأ</>}
              </Button>
            </div>

            <div className="h-[150px] sm:h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <XAxis dataKey="dayLabel" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: 'var(--muted)'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                  <Bar dataKey="minutesStudied" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              جدول اليوم — {DAY_NAMES[Number(today)]}
            </CardTitle>
            <CardDescription>{todaysClasses.length > 0 ? `${todaysClasses.length} محاضرة لمجموعتك` : "يوم خفيف بدون محاضرات لمجموعتك"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todaysClasses.length > 0 ? todaysClasses.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex flex-col sm:flex-row gap-2 sm:gap-3 p-3 rounded-xl border-2 border-border bg-gradient-to-r from-card to-primary/5 hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center sm:flex-col sm:items-center justify-center w-full sm:w-16 shrink-0 border-b sm:border-e sm:border-b-0 sm:pe-3 pb-2 sm:pb-0 sm:pe-3">
                    <span className="font-bold text-sm tabular-nums">{item.startTime}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums ms-2 sm:ms-0">{item.endTime}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm">{item.courseTitle}</h4>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-bold">{item.type}</span>
                      {item.room && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {item.room}</span>}
                    </div>
                    {item.instructor && <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-0.5"><UserIcon className="h-2.5 w-2.5" /> {item.instructor}</p>}
                  </div>
                </motion.div>
              )) : groupSchedule.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                  <CalendarIcon className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-sm">لم يُحدَّد جدول لمجموعتك بعد.</p>
                  <p className="text-xs mt-1">اطلب من الإدارة إضافة الجدول.</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                  <CalendarIcon className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-sm">يوم بدون محاضرات لمجموعتك. استثمره بقوة!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
