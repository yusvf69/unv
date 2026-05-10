import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, User, Award, Key, Copy, Lock, Calendar, Clock, Target, BookOpen, Trophy, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMeV2, useUpdateProfile, useAchievements, useMyGroupSchedule, useMyExamSchedule } from "@/lib/api";
import { useGetDashboard } from "@workspace/api-client-react";
import FileUpload from "@/components/file-upload";
import { Link } from "wouter";
import { useTranslation, globalI18n } from "@/lib/i18n";

const SPECIALIZATIONS = [
  "شعبه عامه",
  "علوم التربة والمياه",
  "الإنتاج النباتي",
  "الإنتاج الحيواني",
  "الهندسة الزراعية",
  "التكنولوجيا الحيوية",
  "علوم الأغذية",
  "الاقتصاد الزراعي",
  "وقاية النبات",
];

const SPECIALIZATION_KEYS: Record<string, string> = {
  "شعبه عامه": "specGeneral",
  "علوم التربة والمياه": "specSoilWater",
  "الإنتاج النباتي": "specPlantProduction",
  "الإنتاج الحيواني": "specAnimalProduction",
  "الهندسة الزراعية": "specAgriEngineering",
  "التكنولوجيا الحيوية": "specBiotech",
  "علوم الأغذية": "specFoodScience",
  "الاقتصاد الزراعي": "specAgriEconomics",
  "وقاية النبات": "specPlantProtection",
};

type ProfileTab = "account" | "schedule" | "tasks" | "progress" | "goals";

export default function Profile() {
  const t = useTranslation(globalI18n);
  const { data: me } = useMeV2();
  const update = useUpdateProfile();
  const { data: achievements } = useAchievements();
  const { data: schedule = [] } = useMyGroupSchedule();
  const { data: exams = [] } = useMyExamSchedule();
  const { data: dashboard } = useGetDashboard();
  const missions = dashboard?.missions ?? [];
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [specialization, setSpecialization] = useState("");
  const [yearInCollege, setYearInCollege] = useState<number>(1);
  const [groupName, setGroupName] = useState("A");
  const [tab, setTab] = useState<ProfileTab>("account");

  useEffect(() => {
    if (!me) return;
    setName(me.name);
    setAvatarUrl(me.avatarUrl);
    setSpecialization(me.specialization || SPECIALIZATIONS[0]);
    setYearInCollege(me.yearInCollege || 1);
    setGroupName(me.groupName || "A");
  }, [me?.id]);

  if (!me) {
    return <div className="container mx-auto px-4 py-12 text-center">{t("loginFirst")}</div>;
  }

  const save = async () => {
    try {
      await update.mutateAsync({
        name,
        avatarUrl: avatarUrl || "",
        specialization,
        yearInCollege,
        groupName,
      });
      toast({ title: t("profileSaved"), description: t("changesApplied") });
    } catch (e) {
      toast({ title: t("error"), description: (e as Error).message, variant: "destructive" });
    }
  };

  const copyCode = () => {
    if (me.uniqueCode) {
      navigator.clipboard.writeText(me.uniqueCode);
      toast({ title: t("codeCopied"), description: me.uniqueCode });
    }
  };

  const completedMissions = missions.filter((m) => m.completed).length;
  const totalMissions = missions.length;

  const tabs = [
    { key: "account" as const, label: t("accountTab"), icon: User },
    { key: "schedule" as const, label: t("scheduleTitle"), icon: Calendar },
    { key: "tasks" as const, label: t("tasksTab"), icon: Target },
    { key: "progress" as const, label: t("progress"), icon: Trophy },
    { key: "goals" as const, label: t("goalsTab"), icon: FileText },
  ];

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl">
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl sm:text-3xl font-serif font-bold mb-4 sm:mb-6">
        {t("profileTitle")}
      </motion.h1>

      {/* Profile Header */}
      <div className="bg-card border rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-primary/30" />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-muted flex items-center justify-center"><User className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground" /></div>
          )}
          <div className="flex-1 text-center sm:text-start">
            <div className="font-bold text-xl sm:text-2xl">{me.name}</div>
            {me.title && <div className="text-sm text-primary font-bold">{me.title}</div>}
            <div className="text-sm text-muted-foreground">{me.email}</div>
            <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
              <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-bold">{me.points} {t("point")}</span>
              <span className="text-xs bg-secondary/10 text-secondary px-3 py-1 rounded-full font-bold">{t("level")} {me.level}</span>
              <span className="text-xs bg-amber-500/10 text-amber-700 px-3 py-1 rounded-full font-bold">🔥 {me.streak} {t("day")}</span>
              {me.groupName && <span className="text-xs bg-blue-500/10 text-blue-700 px-3 py-1 rounded-full font-bold">G{me.groupName}</span>}
            </div>
          </div>
          <FileUpload value={null} onChange={(d) => { if (d) setAvatarUrl(d); }} label={t("changePhoto")} maxSizeKb={400} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 transition shrink-0 ${tab === key ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="whitespace-nowrap">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "account" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="md:col-span-1 bg-card border rounded-2xl p-4 sm:p-6">
            <div className="space-y-4">
              <h3 className="font-bold text-sm flex items-center gap-2"><Key className="w-4 h-4 text-primary" /> {t("accountInfo")}</h3>
              <div>
                <Label className="text-xs">{t("username")}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value={me.username ?? ""} disabled className="h-9 sm:h-10 bg-muted font-mono text-sm" />
                  <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </div>
              <div>
                <Label className="text-xs">{t("yourCode")}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value={me.uniqueCode || ""} disabled className="h-9 sm:h-10 bg-muted font-mono font-bold text-primary text-sm" />
                  <Button variant="ghost" size="sm" onClick={copyCode} className="h-9 sm:h-10"><Copy className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="md:col-span-2 bg-card border rounded-2xl p-4 sm:p-6 space-y-4">
            <h2 className="font-bold text-lg sm:text-xl">{t("editData")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("contactFormName")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("phoneNumber")}</Label>
                <Input value={me.phone || t("notAddedYet")} disabled className="h-10 bg-muted" />
                <p className="text-[10px] text-muted-foreground">{t("phoneNotEditable")}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("academicYear")}</Label>
                <select value={yearInCollege} onChange={(e) => setYearInCollege(Number(e.target.value))} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                  {[1, 2, 3, 4].map((y) => <option key={y} value={y}>{t("yearLabel")} {y}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("groupNameField")}</Label>
                <select value={groupName} onChange={(e) => setGroupName(e.target.value)} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                  {["عام", "A", "B", "C", "D", "E"].map((g) => <option key={g} value={g}>{g === "عام" ? t("catGeneral") : g}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">{t("specializationLabel")}</Label>
                <select value={specialization} onChange={(e) => setSpecialization(e.target.value)} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                  {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{t(SPECIALIZATION_KEYS[s])}</option>)}
                </select>
              </div>
            </div>
            <Button onClick={save} disabled={update.isPending} className="w-full">
              <Save className="me-2 h-4 w-4" /> {t("saveChanges")}
            </Button>
          </motion.div>
        </div>
      )}

      {tab === "schedule" && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-card border rounded-2xl p-4 sm:p-6">
            <h2 className="font-bold text-lg sm:text-xl mb-4 flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> {t("lectureSchedule")}</h2>
            {schedule.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">{t("noSchedule")}</p>
            ) : (
              <div className="space-y-2">
                {schedule.map((s: any) => (
                  <div key={s.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-muted/30 rounded-lg gap-2">
                    <div>
                      <div className="font-bold text-sm">{s.courseTitle}</div>
                      <div className="text-xs text-muted-foreground">{s.instructor}</div>
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      <span className="font-bold">{s.day}</span> · {s.startTime} - {s.endTime} · {s.room}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border rounded-2xl p-4 sm:p-6">
            <h2 className="font-bold text-lg sm:text-xl mb-4 flex items-center gap-2"><Calendar className="h-5 w-5 text-rose-500" /> {t("examSchedule")}</h2>
            {exams.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">{t("noExams")}</p>
            ) : (
              <div className="space-y-2">
                {exams.map((e: any) => (
                  <div key={e.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-amber-500/5 rounded-lg border border-amber-500/20 gap-2">
                    <div>
                      <div className="font-bold text-sm">{e.courseTitle}</div>
                      <div className="text-xs text-muted-foreground">{e.type === "midterm" ? t("midterm") : e.type === "final" ? t("final") : e.type}</div>
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      {e.date} · {e.time} · {e.room}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "tasks" && (
        <div className="bg-card border rounded-2xl p-4 sm:p-6">
          <h2 className="font-bold text-lg sm:text-xl mb-4 flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> {t("missions")}</h2>
          {missions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">{t("noMissions")}</p>
          ) : (
            <div className="space-y-3">
              {missions.map((m: any) => (
                <div key={m.id} className={`p-3 sm:p-4 rounded-xl border ${m.completed ? "bg-emerald-500/5 border-emerald-500/30" : "bg-card"}`}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-bold">{m.title}</div>
                      <div className="text-sm text-muted-foreground">{m.description}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-amber-600">{m.points} {t("point")}</span>
                      {m.completed ? (
                        <span className="text-xs bg-emerald-500/10 text-emerald-700 px-2 py-1 rounded-full font-bold">{t("completed")}</span>
                      ) : (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">{t("inProgress")}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "progress" && (
        <div className="bg-card border rounded-2xl p-4 sm:p-6">
          <h2 className="font-bold text-lg sm:text-xl mb-4 flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> {t("achievements")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {(achievements ?? []).map((a: any) => (
              <div key={a.id} className={`p-4 rounded-2xl border-2 ${a.completed ? "bg-emerald-500/10 border-emerald-500/40" : "bg-card border"}`}>
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{a.icon}</div>
                  <div className="flex-1">
                    <div className="font-bold">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{a.desc}</div>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${a.percent}%` }} />
                    </div>
                    <div className="text-xs mt-1">{a.value} / {a.target}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "goals" && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-card border rounded-2xl p-4 sm:p-6">
            <h2 className="font-bold text-lg sm:text-xl mb-4 flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /> {t("yourGoals")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="p-4 bg-muted/30 rounded-xl">
                <div className="text-sm text-muted-foreground mb-1">{t("currentPoints")}</div>
                <div className="text-3xl font-bold">{me.points}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("remainingForNextLevel").replace("{points}", String(Math.max(0, me.level * 100 - me.points)))}</div>
                <Progress value={((me.points - (me.level - 1) * 100) / 100) * 100} className="h-1.5 mt-2" />
              </div>
              <div className="p-4 bg-muted/30 rounded-xl">
                <div className="text-sm text-muted-foreground mb-1">{t("completedMissions")}</div>
                <div className="text-3xl font-bold">{completedMissions}/{totalMissions}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t("percentComplete").replace("{percent}", String(totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0))}
                </div>
                <Progress value={totalMissions > 0 ? (completedMissions / totalMissions) * 100 : 0} className="h-1.5 mt-2" />
              </div>
              <div className="p-4 bg-muted/30 rounded-xl">
                <div className="text-sm text-muted-foreground mb-1">{t("dailyStreak")}</div>
                <div className="text-3xl font-bold">🔥 {me.streak}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("consecutiveDays")}</div>
              </div>
              <div className="p-4 bg-muted/30 rounded-xl">
                <div className="text-sm text-muted-foreground mb-1">{t("level")}</div>
                <div className="text-3xl font-bold">{me.level}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {me.points} / {me.level * 100} {t("point")}
                </div>
                <Progress value={((me.points - (me.level - 1) * 100) / 100) * 100} className="h-1.5 mt-2" />
              </div>
              <div className="p-4 bg-muted/30 rounded-xl">
                <div className="text-sm text-muted-foreground mb-1">{t("studyTimeThisWeek")}</div>
                <div className="text-3xl font-bold">⏱ {dashboard?.weeklyMinutes ?? 0} {t("minShort")}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("goalMinutes").replace("{minutes}", String(dashboard?.focusGoalMinutes ?? 600))}</div>
                <Progress value={((dashboard?.weeklyMinutes ?? 0) / (dashboard?.focusGoalMinutes ?? 600)) * 100} className="h-1.5 mt-2" />
              </div>
              <div className="p-4 bg-muted/30 rounded-xl">
                <div className="text-sm text-muted-foreground mb-1">{t("rank")}</div>
                <div className="text-3xl font-bold">#{dashboard?.rank ?? "-"}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("amongStudents")}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
