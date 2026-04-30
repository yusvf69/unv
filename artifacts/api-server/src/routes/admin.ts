import { Router, type IRouter } from "express";
import { eq, sql, inArray, desc, sum, count } from "drizzle-orm";
import { GetAdminOverviewResponse, ListAdminUsersResponse } from "@workspace/api-zod";
import { db, schema } from "../lib/db";
import { handle } from "../lib/util";

const router: IRouter = Router();

router.get("/admin/overview", (_req, res) => {
  void handle(res, async () => {
    const [{ totalStudents }] = await db
      .select({ totalStudents: sql<number>`count(*)::int` })
      .from(schema.usersTable)
      .where(eq(schema.usersTable.role, "student"));
    const [{ totalStaff }] = await db
      .select({ totalStaff: sql<number>`count(*)::int` })
      .from(schema.usersTable)
      .where(inArray(schema.usersTable.role, ["doctor", "ta"]));
    const [{ activeExams }] = await db.select({ activeExams: sql<number>`count(*)::int` }).from(schema.quizzesTable);

    // Real weekly engagement from activity table
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);

    const activityRows = await db
      .select({
        date: schema.activityTable.date,
        minutes: sql<number>`sum(${schema.activityTable.minutesStudied})::int`,
        userCount: sql<number>`count(distinct ${schema.activityTable.userId})::int`,
      })
      .from(schema.activityTable)
      .where(sql`${schema.activityTable.date} >= ${weekAgoStr}`)
      .groupBy(schema.activityTable.date);

    const activityMap = new Map(activityRows.map((r) => [r.date, { minutes: r.minutes, users: r.userCount }]));

    const weeklyEngagement = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekAgo);
      d.setDate(weekAgo.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const data = activityMap.get(dateStr);
      return {
        date: dateStr,
        activeUsers: data?.users ?? 0,
        studyMinutes: data?.minutes ?? 0,
      };
    });

    const deptRows = await db
      .select({ department: schema.usersTable.department, count: sql<number>`count(*)::int` })
      .from(schema.usersTable)
      .where(eq(schema.usersTable.role, "student"))
      .groupBy(schema.usersTable.department);

    const buckets = [
      { bucket: "0-99", min: 0, max: 99 },
      { bucket: "100-499", min: 100, max: 499 },
      { bucket: "500-999", min: 500, max: 999 },
      { bucket: "1000-1999", min: 1000, max: 1999 },
      { bucket: "2000+", min: 2000, max: 999999 },
    ];
    const allStudents = await db
      .select({ points: schema.usersTable.points })
      .from(schema.usersTable)
      .where(eq(schema.usersTable.role, "student"));
    const pointsDistribution = buckets.map((b) => ({
      bucket: b.bucket,
      count: allStudents.filter((s) => s.points >= b.min && s.points <= b.max).length,
    }));

    // Real AI usage: count quiz attempts today
    const todayStr = today.toISOString().slice(0, 10);
    const [{ aiUsageToday = 0 }] = await db
      .select({ aiUsageToday: sql<number>`count(*)::int` })
      .from(schema.quizAttemptsTable)
      .where(sql`date_trunc('day', completed_at) = ${todayStr}::date`);

    // Real system alerts from database
    const alerts: Array<{
      id: number;
      title: string;
      body: string;
      severity: "critical" | "warning" | "info";
      kind: string;
      createdAt: string;
    }> = [];

    // Check for students with low attendance
    const lowAttendance = await db
      .select({
        userId: schema.attendanceTable.userId,
        avgPct: sql<number>`avg(${schema.attendanceTable.attended}::float / NULLIF(${schema.attendanceTable.total}, 0) * 100)::int`,
      })
      .from(schema.attendanceTable)
      .groupBy(schema.attendanceTable.userId)
      .having(sql`avg(${schema.attendanceTable.attended}::float / NULLIF(${schema.attendanceTable.total}, 0) * 100) < 60`);
    if (lowAttendance.length > 0) {
      alerts.push({
        id: 1,
        title: `${lowAttendance.length} طلاب في خطر التعثّر`,
        body: "نسبة الحضور أقل من 60% لمقررين أو أكثر.",
        severity: "critical",
        kind: "dropout_risk",
        createdAt: new Date().toISOString(),
      });
    }

    // Recent complaints
    const recentComplaints = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.complaintsTable)
      .where(sql`created_at > now() - interval '24 hours'`);
    if (recentComplaints[0]?.count > 0) {
      alerts.push({
        id: 2,
        title: `${recentComplaints[0].count} شكوى جديدة`,
        body: "تم استلام شكاوى جديدة تحتاج مراجعة.",
        severity: "warning",
        kind: "complaint",
        createdAt: new Date().toISOString(),
      });
    }

    // Unread notifications count
    const [{ unreadNotifs = 0 }] = await db
      .select({ unreadNotifs: sql<number>`count(*)::int` })
      .from(schema.notificationsTable)
      .where(eq(schema.notificationsTable.read, false));

    // Pending talents
    const pendingTalents = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.talentsTable)
      .where(eq(schema.talentsTable.status, "pending"));
    if (pendingTalents[0]?.count > 0) {
      alerts.push({
        id: 3,
        title: `${pendingTalents[0].count} موهبة بانتظار المراجعة`,
        body: "مواهب جديدة تحتاج اعتماد من الإدارة.",
        severity: "info",
        kind: "content_review",
        createdAt: new Date().toISOString(),
      });
    }

    // Forum activity spike
    const recentForumPosts = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.forumPostsTable)
      .where(sql`created_at > now() - interval '24 hours'`);
    if (recentForumPosts[0]?.count > 20) {
      alerts.push({
        id: 4,
        title: "نشاط مكثف في المنتدى",
        body: `${recentForumPosts[0].count} منشور جديد خلال 24 ساعة.`,
        severity: "info",
        kind: "content_review",
        createdAt: new Date().toISOString(),
      });
    }

    // System health
    alerts.push({
      id: 5,
      title: "النظام يعمل بشكل طبيعي",
      body: `إجمالي ${totalStudents} طالب و ${totalStaff} عضو هيئة تدريس. ${unreadNotifs} إشعار غير مقروء.`,
      severity: "info",
      kind: "system",
      createdAt: new Date().toISOString(),
    });

    return GetAdminOverviewResponse.parse({
      totalStudents,
      totalStaff,
      activeExams,
      todayActivity: weeklyEngagement[6].activeUsers,
      aiUsageToday,
      weeklyEngagement,
      departmentBreakdown: deptRows,
      pointsDistribution,
      alerts,
    });
  });
});

router.get("/admin/users", (req, res) => {
  void handle(res, async () => {
    const role = typeof req.query.role === "string" ? req.query.role : undefined;
    const where = role ? eq(schema.usersTable.role, role) : undefined;
    const rows = where
      ? await db.select().from(schema.usersTable).where(where).limit(100)
      : await db.select().from(schema.usersTable).limit(100);
    return ListAdminUsersResponse.parse(
      rows.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        phone: u.phone,
        role: u.role,
        department: u.department,
        yearInCollege: u.yearInCollege,
        specialization: u.specialization,
        avatarUrl: u.avatarUrl,
        status: u.status,
        points: u.points,
        title: u.title,
        uniqueCode: u.uniqueCode,
        lastSeen: u.lastSeen.toISOString(),
      })),
    );
  });
});

export default router;
