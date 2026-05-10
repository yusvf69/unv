import { motion } from "framer-motion";
import {
  BookOpen, UserPlus, LayoutDashboard, Calendar, BookOpenCheck,
  GraduationCap, Trophy, MessageSquare, Lightbulb, Star, ArrowLeft,
  ChevronLeft, Monitor,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTranslation, globalI18n } from "@/lib/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const SECTIONS = [
  {
    id: "getting-started",
    icon: UserPlus,
    title: "guideGettingStarted",
    desc: "guideGettingStartedDesc",
    steps: [
      { title: "guideCreateAccount", desc: "guideCreateAccountDesc" },
      { title: "guideEmailVerification", desc: "guideEmailVerificationDesc" },
      { title: "guideCompleteProfile", desc: "guideCompleteProfileDesc" },
      { title: "guideExplorePlatform", desc: "guideExplorePlatformDesc" },
    ],
  },
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "guideDashboard",
    desc: "guideDashboardDesc",
    steps: [
      { title: "guideDailyTasks", desc: "guideDailyTasksDesc" },
      { title: "guideTodaySchedule", desc: "guideTodayScheduleDesc" },
      { title: "guideStudyTracking", desc: "guideStudyTrackingDesc" },
      { title: "guideLevelPoints", desc: "guideLevelPointsDesc" },
    ],
  },
  {
    id: "courses",
    icon: BookOpen,
    title: "guideCourses",
    desc: "guideCoursesDesc",
    steps: [
      { title: "guideViewCourses", desc: "guideViewCoursesDesc" },
      { title: "guideLectures", desc: "guideLecturesDesc" },
      { title: "guideWatchVideos", desc: "guideWatchVideosDesc" },
      { title: "guideDownloadFiles", desc: "guideDownloadFilesDesc" },
    ],
  },
  {
    id: "schedule",
    icon: Calendar,
    title: "guideSchedule",
    desc: "guideScheduleDesc",
    steps: [
      { title: "guideLectureSchedule", desc: "guideLectureScheduleDesc" },
      { title: "guideExamSchedule", desc: "guideExamScheduleDesc" },
      { title: "guideReminders", desc: "guideRemindersDesc" },
    ],
  },
  {
    id: "quizzes",
    icon: GraduationCap,
    title: "guideQuizzes",
    desc: "guideQuizzesDesc",
    steps: [
      { title: "guideAvailableQuizzes", desc: "guideAvailableQuizzesDesc" },
      { title: "guideDuringQuiz", desc: "guideDuringQuizDesc" },
      { title: "guideResult", desc: "guideResultDesc" },
      { title: "guideReview", desc: "guideReviewDesc" },
    ],
  },
  {
    id: "community",
    icon: MessageSquare,
    title: "guideCommunity",
    desc: "guideCommunityDesc",
    steps: [
      { title: "guideForum", desc: "guideForumDesc" },
      { title: "guideTalents", desc: "guideTalentsDesc" },
      { title: "guideMessaging", desc: "guideMessagingDesc" },
    ],
  },
  {
    id: "gamification",
    icon: Trophy,
    title: "guideGamification",
    desc: "guideGamificationDesc",
    steps: [
      { title: "guideEarningPoints", desc: "guideEarningPointsDesc" },
      { title: "guideLevels", desc: "guideLevelsDesc" },
      { title: "guideStreak", desc: "guideStreakDesc" },
      { title: "guideLeaderboard", desc: "guideLeaderboardDesc" },
    ],
  },
];

export default function Guide() {
  const t = useTranslation(globalI18n);

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 sm:mb-12"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full text-xs sm:text-sm font-medium text-primary mb-3">
          <BookOpen className="h-3.5 w-3.5" />
          <span>{t("platformGuide")}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold mb-3">
          {t("platformGuide")}
        </h1>
        <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          {t("guideSubtitle")}
        </p>
      </motion.div>

      <Tabs defaultValue="getting-started" dir="rtl" className="w-full">
        <TabsList className="w-full flex-wrap h-auto gap-1 mb-6 sm:mb-8">
          {SECTIONS.map((s) => (
            <TabsTrigger
              key={s.id}
              value={s.id}
              className="text-[10px] sm:text-xs flex-1 min-w-[80px] sm:min-w-[100px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
               <s.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 me-1" />
              {t(s.title)}
            </TabsTrigger>
          ))}
        </TabsList>

        {SECTIONS.map((section) => (
          <TabsContent key={section.id} value={section.id}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="p-2.5 sm:p-3 rounded-xl bg-primary/10">
                  <section.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-2xl font-bold">{t(section.title)}</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">{t(section.desc)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {section.steps.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <Card className="h-full border-border/50 hover:border-primary/20 transition-colors">
                      <CardContent className="p-3 sm:p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-bold shrink-0">
                            {i + 1}
                          </div>
                          <div>
                            <h3 className="font-bold text-xs sm:text-sm mb-1">
                              {t(step.title)}
                            </h3>
                            <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
                              {t(step.desc)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
