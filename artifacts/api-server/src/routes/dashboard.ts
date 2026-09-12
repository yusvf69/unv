import { Router, type IRouter } from "express";
import { eq, desc, sql, and, gt } from "drizzle-orm";
import { GetDashboardResponse } from "@workspace/api-zod";
import { db, schema } from "../lib/db";
import { handle } from "../lib/util";

const router: IRouter = Router();

router.get("/dashboard", (req, res) => {
  void handle(res, async () => {
    const userId = req.demo.currentUserId;
    if (!userId) throw Object.assign(new Error("غير مسجل"), { status: 401 });
    const [user] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, userId)).limit(1);
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

    let schedule = await db
      .select()
      .from(schema.scheduleItemsTable)
      .where(eq(schema.scheduleItemsTable.userId, userId));

    if (!schedule.length && user.groupName && user.yearInCollege) {
      const groupRows = await db
        .select()
        .from(schema.groupScheduleTable)
        .where(
          and(
            eq(schema.groupScheduleTable.groupName, user.groupName),
            eq(schema.groupScheduleTable.yearInCollege, user.yearInCollege),
          ),
        );
      schedule = groupRows.map((g) => ({
        id: g.id,
        userId: userId,
        courseId: 0,
        courseTitle: g.courseTitle,
        courseCode: g.courseCode ?? "",
        instructor: g.instructor,
        room: g.room,
        day: g.day,
        startTime: g.startTime,
        endTime: g.endTime,
        type: g.type,
      }));
    }

    const grades = await db.select().from(schema.gradesTable).where(eq(schema.gradesTable.userId, userId));
    const attendance = await db.select().from(schema.attendanceTable).where(eq(schema.attendanceTable.userId, userId));
    const missions = await db.select().from(schema.missionsTable).orderBy(schema.missionsTable.ord);
    const notifications = await db
      .select()
      .from(schema.notificationsTable)
      .where(eq(schema.notificationsTable.userId, userId))
      .orderBy(desc(schema.notificationsTable.createdAt))
      .limit(8);

    // Get last 7 days of activity
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];
    const rawActivity = await db
      .select()
      .from(schema.activityTable)
      .where(and(eq(schema.activityTable.userId, userId), sql`${schema.activityTable.date} >= ${weekAgoStr}`))
      .orderBy(schema.activityTable.date);

    // Fill in missing days with zero
    const activityByDate = new Map<string, { minutesStudied: number; pointsEarned: number }>();
    for (const a of rawActivity) {
      activityByDate.set(a.date, { minutesStudied: a.minutesStudied, pointsEarned: a.pointsEarned });
    }
    const activity: { date: string; minutesStudied: number; pointsEarned: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekAgo);
      d.setDate(weekAgo.getDate() + i);
      const key = d.toISOString().split("T")[0];
      const existing = activityByDate.get(key);
      activity.push({
        date: key,
        minutesStudied: existing?.minutesStudied ?? 0,
        pointsEarned: existing?.pointsEarned ?? 0,
      });
    }

    let rank = 1;
    if (user.role === "student") {
      const [{ rank: r }] = await db
        .select({ rank: sql<number>`(count(*) + 1)::int` })
        .from(schema.usersTable)
        .where(and(eq(schema.usersTable.role, "student"), gt(schema.usersTable.points, user.points)));
      rank = r;
    }

    const nextLevelPoints = (user.level + 1) * 500;
    const weeklyMinutes = activity.reduce((sum, a) => sum + a.minutesStudied, 0);

    const attempts = await db
      .select()
      .from(schema.quizAttemptsTable)
      .where(eq(schema.quizAttemptsTable.userId, userId))
      .orderBy(desc(schema.quizAttemptsTable.completedAt))
      .limit(10);

    const trim = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    const gradePct = grades.length
      ? grades.reduce((s, g) => s + (g.outOf > 0 ? (g.score / g.outOf) * 100 : 0), 0) / grades.length
      : null;
    const quizPct = attempts.length
      ? attempts.reduce((s, a) => s + (a.total > 0 ? (a.score / a.total) * 100 : 0), 0) / attempts.length
      : null;
    const attTot = attendance.reduce((s, a) => s + a.total, 0);
    const attDone = attendance.reduce((s, a) => s + a.attended, 0);
    const attendPct = attTot > 0 ? (attDone / attTot) * 100 : null;
    const minutes7 = activity.reduce((s, a) => s + a.minutesStudied, 0);
    const studyPct = minutes7 > 0 ? (minutes7 / 600) * 100 : null;

    const weakest = (() => {
      let best: { title: string; pct: number } | null = null;
      if (gradePct != null && grades.length) {
        for (const g of grades) {
          const p = g.outOf > 0 ? (g.score / g.outOf) * 100 : 0;
          if (!best || p < best.pct) best = { title: g.courseTitle, pct: p };
        }
      }
      return best;
    })();

    const worstAttempt = attempts.length
      ? attempts.reduce((w, a) => {
          const wp = w.total > 0 ? w.score / w.total : 1;
          const ap = a.total > 0 ? a.score / a.total : 1;
          return ap < wp ? a : w;
        }, attempts[0])
      : null;
    let weakestQuizTitle: string | null = null;
    if (!weakest && worstAttempt) {
      const [qz] = await db
        .select({ courseTitle: schema.quizzesTable.courseTitle, title: schema.quizzesTable.title })
        .from(schema.quizzesTable)
        .where(eq(schema.quizzesTable.id, worstAttempt.quizId))
        .limit(1);
      weakestQuizTitle = qz?.courseTitle || qz?.title || null;
    }

    const have = [gradePct, quizPct, attendPct, studyPct].filter((v): v is number => v != null).length;
    const predicted =
      gradePct != null
        ? gradePct * 0.5 + (quizPct ?? 50) * 0.25 + (attendPct ?? 50) * 0.15 + (studyPct ?? 30) * 0.1
        : have > 0
        ? (quizPct ?? 50) * 0.4 + (attendPct ?? 50) * 0.35 + (studyPct ?? 30) * 0.25
        : null;

    const examPrediction =
      predicted == null
        ? {
            courseId: 0,
            courseTitle: "—",
            predictedScore: 0,
            confidence: 0.5,
            risk: "low" as const,
            recommendations: ["لم يتم رصد درجات بعد. تابع مع الإدارة عند توفرها."],
          }
        : {
            courseId: weakest ? (grades.find((g) => g.courseTitle === weakest!.title)?.courseId ?? 0) : 0,
            courseTitle: weakest?.title ?? weakestQuizTitle ?? "—",
            predictedScore: trim(predicted),
            confidence: Math.round((0.5 + have * 0.1) * 100),
            risk: (predicted < 60 ? "high" : predicted < 75 ? "medium" : "low") as "high" | "medium" | "low",
            recommendations: buildExamRecommendations(gradePct, quizPct, attendPct, studyPct, minutes7, weakest),
          };

const AR_TO_EN_DAY: Record<string, string> = {
  "الأحد": "sun", "الاثنين": "mon", "الثلاثاء": "tue", "الأربعاء": "wed", "الخميس": "thu", "السبت": "sat",
  "sun": "sun", "mon": "mon", "tue": "tue", "wed": "wed", "thu": "thu", "sat": "sat",
};
const normalizeType = (t: string) => t === "practical" ? "tutorial" : t;

    return GetDashboardResponse.parse({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        department: user.department,
        year: user.year,
        points: user.points,
        level: user.level,
        streak: user.streak,
        title: user.title,
      },
      nextLevelPoints,
      rank,
      weeklyMinutes,
      focusGoalMinutes: 600,
      schedule: schedule.map((s) => ({
        id: s.id,
        courseTitle: s.courseTitle,
        courseCode: s.courseCode,
        instructor: s.instructor,
        room: s.room,
        day: AR_TO_EN_DAY[s.day] || "sun",
        startTime: s.startTime,
        endTime: s.endTime,
        type: normalizeType(s.type) || "lecture",
      })),
      grades,
      attendance: attendance.map((a) => ({
        courseId: a.courseId,
        courseTitle: a.courseTitle,
        attended: a.attended,
        total: a.total,
        percentage: a.total > 0 ? Math.round((a.attended / a.total) * 100) : 0,
      })),
      missions: missions.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        points: m.points,
        kind: m.kind,
        completed: m.completed,
      })),
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type,
        createdAt: n.createdAt.toISOString(),
        read: n.read,
      })),
      activity: activity.map((a) => ({
        date: a.date,
        minutesStudied: a.minutesStudied,
        pointsEarned: a.pointsEarned,
      })),
      examPrediction,
    });
  });
});

function buildExamRecommendations(
  gradePct: number | null,
  quizPct: number | null,
  attendPct: number | null,
  studyPct: number | null,
  minutes7: number,
  weakest: { title: string; pct: number } | null,
): string[] {
  const recs: string[] = [];
  if (gradePct != null && gradePct < 75 && weakest) {
    recs.push(`مستواك في "${weakest.title}" (${Math.round(weakest.pct)}%) يحتاج مراجعة مكثفة قبل الامتحان`);
  }
  if (quizPct != null && quizPct < 60) {
    recs.push(`متوسط اختباراتك (${Math.round(quizPct)}%) منخفض — أعد حل الاختبارات التجريبية وراجع أخطاءك`);
  }
  if (attendPct != null && attendPct < 75) {
    recs.push(`نسبة حضورك ${Math.round(attendPct)}% — الحضور المنتظم يرفع توقعاتك`);
  }
  if (studyPct != null && studyPct < 55) {
    recs.push(`مذاكرتك الأسبوعية ${Math.round(minutes7 / 60)} ساعات فقط — استهدف 6 ساعات على الأقل`);
  }
  if (!recs.length) {
    recs.push("استمر على المذاكرة المنتظمة", "حل اختباراً وهمياً قبل كل امتحان", "راجع المحاضرات الأخيرة للأسبوع القادم");
  }
  return recs;
}

export default router;
