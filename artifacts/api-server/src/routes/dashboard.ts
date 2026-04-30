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

    const lowestGrade = grades.reduce<typeof grades[number] | null>(
      (min, g) => (!min || g.score / g.outOf < min.score / min.outOf ? g : min),
      null,
    );
    const examPrediction = lowestGrade
      ? {
          courseId: lowestGrade.courseId,
          courseTitle: lowestGrade.courseTitle,
          predictedScore: Math.round((lowestGrade.score / lowestGrade.outOf) * 100 * 0.95),
          confidence: 0.78,
          risk:
            lowestGrade.score / lowestGrade.outOf < 0.6
              ? "high"
              : lowestGrade.score / lowestGrade.outOf < 0.75
              ? "medium"
              : "low",
          recommendations: [
            "راجع الفصول 4 و 5 من المقرر",
            "حل اختبار تجريبي قبل الامتحان",
            "احضر ساعتي مذاكرة جماعية في القاعة 12",
          ],
        }
      : {
          courseId: 0,
          courseTitle: "—",
          predictedScore: 0,
          confidence: 0.5,
          risk: "low" as const,
          recommendations: ["لم يتم رصد درجات بعد. تابع مع الإدارة عند توفرها."],
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

export default router;
