import type { IncomingMessage, ServerResponse } from "node:http";
import { sql } from "./lib/db.js";
import { handle, jsonResponse, jsonError, corsResponse } from "./lib/handler.js";
import { getUserId, getCurrentUser, requireAuth, requireRole, ensureSuper, generateToken } from "./lib/auth.js";
import bcrypt from "bcryptjs";

export const config = { runtime: "nodejs", maxDuration: 60 };

// --- Helpers ---
function generateUniqueCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "UV-";
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

const AR_DAY_TO_NUM: Record<string, number> = {
  "الأحد": 0, "الاثنين": 1, "الإثنين": 1, "الثلاثاء": 2, "الأربعاء": 3, "الخميس": 4, "الجمعة": 5, "السبت": 6,
  "sun": 0, "mon": 1, "tue": 2, "wed": 3, "thu": 4, "fri": 5, "sat": 6,
};

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([^&?\s]+)/);
  return m ? m[1] : null;
}

async function ensureThread(a: number, b: number): Promise<number> {
  if (isNaN(a) || isNaN(b) || a <= 0 || b <= 0) throw Object.assign(new Error("معرفات المستخدمين غير صالحة"), { status: 400 });
  const [low, high] = a < b ? [a, b] : [b, a];
  try {
    const rows = await sql`SELECT * FROM dm_threads WHERE user_a_id = ${low} AND user_b_id = ${high} LIMIT 1`;
    if (rows[0]) return rows[0].id;
    const [t] = await sql`INSERT INTO dm_threads (user_a_id, user_b_id) VALUES (${low}, ${high}) RETURNING *`;
    return t.id;
  } catch (e) {
    console.error("[ensureThread error]", e, { userIdA: low, userIdB: high });
    throw e;
  }
}

async function getAttemptDetail(attemptId: number) {
  const [attempt] = await sql`SELECT * FROM quiz_attempts WHERE id = ${attemptId}`;
  if (!attempt) throw Object.assign(new Error("المحاولة غير موجودة"), { status: 404 });
  const [user] = await sql`SELECT * FROM users WHERE id = ${attempt.user_id}`;
  const questions = await sql`SELECT * FROM quiz_questions WHERE quiz_id = ${attempt.quiz_id}`;
  const details = questions.map((qq: any) => {
    const userAns = (attempt.answers as any[]).find((a: any) => a.questionId === qq.id);
    return {
      questionId: qq.id, text: qq.text, options: qq.options, correctIndex: qq.correct_index,
      explanation: qq.explanation, points: qq.points, userChosen: userAns?.chosen ?? -1,
      correct: userAns?.correct ?? false,
    };
  });
  return {
    attemptId: attempt.id, userName: user?.name, userAvatar: user?.avatar_url,
    userGroup: user?.group_name, score: attempt.score, total: attempt.total,
    durationSec: attempt.duration_sec, passed: attempt.passed,
    completedAt: attempt.completed_at?.toISOString(), questions: details,
  };
}

async function applyProposal(p: any) {
  const payload = p.payload as Record<string, unknown>;
  const jsonPayload = JSON.stringify(payload);
  switch (p.resource_kind) {
    case "news":
      if (p.action === "create") await sql`INSERT INTO news (title, body, image_url, status, published_at, created_by) VALUES (${payload.title || ""}, ${payload.body || ""}, ${payload.imageUrl || ""}, ${payload.status || "pending"}, ${new Date()}, ${payload.createdBy || null})`;
      else if (p.action === "update" && p.resource_id) await sql`UPDATE news SET title = COALESCE(${payload.title}, title), body = COALESCE(${payload.body}, body), status = COALESCE(${payload.status}, status) WHERE id = ${p.resource_id}`;
      else if (p.action === "delete" && p.resource_id) await sql`DELETE FROM news WHERE id = ${p.resource_id}`;
      break;
    case "user":
      if (p.action === "create") await sql`INSERT INTO users (name, email, role) VALUES (${payload.name || ""}, ${payload.email || ""}, ${payload.role || "student"})`;
      else if (p.action === "update" && p.resource_id) await sql`UPDATE users SET name = COALESCE(${payload.name}, name), role = COALESCE(${payload.role}, role) WHERE id = ${p.resource_id}`;
      else if (p.action === "delete" && p.resource_id) await sql`UPDATE users SET status = 'inactive' WHERE id = ${p.resource_id}`;
      break;
    case "talent":
      if (p.action === "remove_talent" && p.resource_id) {
        const [t] = await sql`SELECT * FROM talents WHERE id = ${p.resource_id}`;
        if (t) {
          await sql`UPDATE talents SET status = 'removed' WHERE id = ${p.resource_id}`;
          const warning = (payload.warning as string) ?? "تم حذف موهبتك من قبل الإدارة.";
          await sql`INSERT INTO notifications (user_id, title, body, type) VALUES (${t.owner_id}, 'تحذير من الإدارة بشأن موهبة', ${warning}, 'alert')`;
        }
      }
      break;
    case "course":
      if (p.action === "create") await sql`INSERT INTO courses (title, code, description) VALUES (${payload.title || ""}, ${payload.code || ""}, ${payload.description || ""})`;
      else if (p.action === "update" && p.resource_id) await sql`UPDATE courses SET title = COALESCE(${payload.title}, title), description = COALESCE(${payload.description}, description) WHERE id = ${p.resource_id}`;
      else if (p.action === "delete" && p.resource_id) await sql`DELETE FROM courses WHERE id = ${p.resource_id}`;
      break;
    case "material":
      if (p.action === "create") await sql`INSERT INTO materials (course_id, title, kind, url) VALUES (${payload.courseId}, ${payload.title || ""}, ${payload.kind || ""}, ${payload.url || ""})`;
      else if (p.action === "update" && p.resource_id) await sql`UPDATE materials SET title = COALESCE(${payload.title}, title), kind = COALESCE(${payload.kind}, kind) WHERE id = ${p.resource_id}`;
      else if (p.action === "delete" && p.resource_id) await sql`DELETE FROM materials WHERE id = ${p.resource_id}`;
      break;
    case "quiz":
      if (p.action === "create") await sql`INSERT INTO quizzes (title, description, course_id, is_open) VALUES (${payload.title || ""}, ${payload.description || ""}, ${payload.courseId}, ${payload.isOpen ?? false})`;
      else if (p.action === "update" && p.resource_id) await sql`UPDATE quizzes SET title = COALESCE(${payload.title}, title), is_open = COALESCE(${payload.isOpen}, is_open) WHERE id = ${p.resource_id}`;
      else if (p.action === "delete" && p.resource_id) await sql`DELETE FROM quizzes WHERE id = ${p.resource_id}`;
      break;
    case "question":
      if (p.action === "create") await sql`INSERT INTO quiz_questions (quiz_id, text, options, correct_index) VALUES (${payload.quizId}, ${payload.text || ""}, ${JSON.stringify(payload.options || [])}, ${payload.correctIndex ?? 0})`;
      else if (p.action === "update" && p.resource_id) await sql`UPDATE quiz_questions SET text = COALESCE(${payload.text}, text), options = COALESCE(${JSON.stringify(payload.options)}, options) WHERE id = ${p.resource_id}`;
      else if (p.action === "delete" && p.resource_id) await sql`DELETE FROM quiz_questions WHERE id = ${p.resource_id}`;
      break;
  }
}

// --- Route Handlers by Domain ---

async function handleDashboard(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const me = await getCurrentUser(userId);
    if (!me) throw Object.assign(new Error("المستخدم غير موجود"), { status: 404 });

    const nextLevelPoints = me.level * 100;
    const allStudents = await sql`SELECT id, points FROM users WHERE role = 'student' ORDER BY points DESC`;
    const rank = allStudents.findIndex((s: any) => s.id === userId) + 1;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);
    const [{ weeklyMinutes = 0 }] = await sql`SELECT sum(minutes_studied)::int AS weeklyMinutes FROM activity WHERE user_id = ${userId} AND date >= ${weekAgoStr}`;
    const focusGoalMinutes = 600;

    const schedule = await sql`SELECT * FROM group_schedule WHERE group_name = ${me.group_name} AND year_in_college = ${me.year_in_college} ORDER BY CASE day WHEN 'الأحد' THEN 0 WHEN 'الاثنين' THEN 1 WHEN 'الإثنين' THEN 1 WHEN 'الثلاثاء' THEN 2 WHEN 'الأربعاء' THEN 3 WHEN 'الخميس' THEN 4 WHEN 'الجمعة' THEN 5 WHEN 'السبت' THEN 6 END`;
    const scheduleItems = schedule.map((s: any) => ({ ...s, dayNumber: AR_DAY_TO_NUM[s.day] ?? 0 }));

    const attempts = await sql`SELECT qa.*, q.course_title FROM quiz_attempts qa LEFT JOIN quizzes q ON qa.quiz_id = q.id WHERE qa.user_id = ${userId} ORDER BY qa.completed_at DESC LIMIT 10`;
    const grades = attempts.map((a: any) => ({
      id: a.id, courseTitle: a.course_title || "اختبار",
      score: a.score, total: a.total, percent: a.total > 0 ? Math.round((a.score / a.total) * 100) : 0,
      passed: a.passed, completedAt: a.completed_at?.toISOString(),
    }));

    const attendance = await sql`SELECT date, minutes_studied FROM activity WHERE user_id = ${userId} ORDER BY date DESC LIMIT 7`;
    const attendanceItems = attendance.map((a: any) => ({ date: a.date, minutes: a.minutes_studied, present: a.minutes_studied > 0 }));

    const openQuizzes = await sql`SELECT * FROM quizzes WHERE is_open = true ORDER BY created_at DESC LIMIT 5`;
    const missions = openQuizzes.map((q: any) => ({
      id: q.id, title: q.title, description: q.description || "", points: q.total_points || 100,
      deadline: null, completed: false,
    }));

    const notifs = await sql`SELECT * FROM notifications WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 5`;
    const notifications = notifs.map((n: any) => ({
      id: n.id, title: n.title, body: n.body, type: n.type, read: n.read,
      createdAt: n.created_at?.toISOString(),
    }));

    const activityRows = await sql`SELECT date, minutes_studied, points_earned FROM activity WHERE user_id = ${userId} ORDER BY date DESC LIMIT 30`;
    const activity = activityRows.map((a: any) => ({
      date: a.date, minutes: a.minutes_studied, points: a.points_earned,
    }));

    const examSchedule = await sql`SELECT * FROM exam_schedule WHERE group_name = ${me.group_name} AND year_in_college = ${me.year_in_college} ORDER BY date LIMIT 5`;
    const examPrediction = {
      exams: examSchedule.map((e: any) => ({
        id: e.id, courseTitle: e.course_title, date: e.date, time: e.time, room: e.room, type: e.type,
      })),
      risk: "medium" as const,
      recommendations: ["راجع المحاضرات الأخيرة", "جرب اختبارات تجريبية"],
    };

    return {
      user: me, nextLevelPoints, rank, weeklyMinutes, focusGoalMinutes,
      schedule: scheduleItems, grades, attendance: attendanceItems, missions,
      notifications, activity, examPrediction,
    };
  });
}

async function handleHealth(): Promise<Response> {
  return jsonResponse({ status: "ok" });
}

async function handleAuth(req: Request, parts: string[]): Promise<Response> {
  const [, , action] = parts; // auth/login, auth/signup, etc.

  if (action === "login") {
    return handle(async () => {
      const body = await req.json();
      const { identifier, password } = body;
      if (!identifier || !password) throw Object.assign(new Error("البريد/الهاتف وكلمة المرور مطلوبة"), { status: 400 });
      const [user] = await sql`SELECT * FROM users WHERE email = ${identifier} OR phone = ${identifier} LIMIT 1`;
      if (!user) throw Object.assign(new Error("الحساب غير موجود"), { status: 404 });
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) throw Object.assign(new Error("كلمة المرور غير صحيحة"), { status: 401 });
      const token = generateToken(user.id, user.role);
      return { userId: user.id, role: user.role, token };
    });
  }

  if (action === "signup") {
    return handle(async () => {
      const body = await req.json();
      const { name, username, email, phone, password, yearInCollege, specialization, groupName, avatarUrl } = body;
      if (!name || !username || !email || !phone || !password) throw Object.assign(new Error("كل الحقول مطلوبة"), { status: 400 });
      if (username.length < 4) throw Object.assign(new Error("اليوزر لازم يكون 4 حروف على الأقل"), { status: 400 });
      if (password.length < 6) throw Object.assign(new Error("كلمة المرور لازم تكون 6 حروف على الأقل"), { status: 400 });

      const [usernameTaken] = await sql`SELECT id FROM users WHERE username = ${username} LIMIT 1`;
      if (usernameTaken) throw Object.assign(new Error("اليوزر ده مأخوذ"), { status: 409 });

      const [emailExists] = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
      if (emailExists) throw Object.assign(new Error("الإيميل ده مسجل قبل كده"), { status: 409 });

      const hashedPassword = await bcrypt.hash(password, 10);
      let uniqueCode = generateUniqueCode();
      let codeExists = true;
      while (codeExists) {
        const [existing] = await sql`SELECT id FROM users WHERE unique_code = ${uniqueCode} LIMIT 1`;
        if (!existing) codeExists = false;
        else uniqueCode = generateUniqueCode();
      }

      const [created] = await sql`
        INSERT INTO users (name, username, email, phone, password, role, department, specialization, year_in_college, group_name, avatar_url, unique_code, email_verified, phone_verified)
        VALUES (${name}, ${username}, ${email}, ${phone}, ${hashedPassword}, 'student', ${specialization || "غير محدد"}, ${specialization || null}, ${yearInCollege || null}, ${groupName || null}, ${avatarUrl || null}, ${uniqueCode}, true, true)
        RETURNING *`;

      await sql`INSERT INTO notifications (user_id, title, body, type) VALUES (${created.id}, ${`أهلاً ${name} في UniVerse`}, ${`كودك الخاص: ${uniqueCode}. احفظه لأنه مهم.`}, 'success')`;
      const token = generateToken(created.id, created.role);
      return { userId: created.id, isNew: true, uniqueCode, token };
    });
  }

  if (action === "logout") {
    return handle(async () => ({ ok: true }));
  }

  if (action === "username-available") {
    return handle(async () => {
      const url = new URL(req.url, "http://localhost");
      const username = url.searchParams.get("username");
      if (!username || username.length < 4) return { available: false, reason: username ? "اليوزر لازم يكون 4 حروف على الأقل" : "أدخل يوزر" };
      const [existing] = await sql`SELECT id FROM users WHERE username = ${username} LIMIT 1`;
      if (existing) {
        const suggestions: string[] = [];
        for (const s of [Math.floor(Math.random() * 900 + 100).toString(), Math.floor(Math.random() * 9000 + 1000).toString()]) {
          const suggestion = `${username}${s}`;
          const [taken] = await sql`SELECT id FROM users WHERE username = ${suggestion} LIMIT 1`;
          if (!taken) suggestions.push(suggestion);
          if (suggestions.length >= 2) break;
        }
        return { available: false, reason: "اليوزر ده مأخوذ", suggestions };
      }
      return { available: true };
    });
  }

  if (action === "demo-login") {
    return handle(async () => {
      const body = await req.json();
      const { email, password } = body;
      const [u] = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
      if (!u) throw Object.assign(new Error("الحساب غير موجود"), { status: 404 });
      if (password) {
        const valid = await bcrypt.compare(password, u.password);
        if (!valid) throw Object.assign(new Error("كلمة المرور غير صحيحة"), { status: 401 });
      }
      const token = generateToken(u.id, u.role);
      return { userId: u.id, role: u.role, token };
    });
  }

  return jsonError("Not Found", 404);
}

async function handleMe(req: Request): Promise<Response> {
  console.log("🔵 [handleMe] Starting...");
  return handle(async () => {
    const authHeader = req.headers.get("authorization");
    console.log("🟡 [handleMe] auth header:", authHeader ? "present" : "missing");
    const { userId } = requireAuth(req.headers);
    console.log("🟡 [handleMe] userId:", userId);
    console.log("🔵 [handleMe] Querying user...");
    const [user] = await sql`SELECT * FROM users WHERE id = ${userId}`;
    console.log("🟢 [handleMe] User found:", !!user);
    if (!user) throw Object.assign(new Error("لا يوجد مستخدم"), { status: 404 });
    const [{ c: unreadCount }] = await sql`SELECT count(*)::int AS c FROM notifications WHERE user_id = ${userId} AND read = false`;
    const [{ c: unreadDmCount }] = await sql`SELECT count(*)::int AS c FROM dm_messages m JOIN dm_threads t ON m.thread_id = t.id WHERE t.user_a_id = ${userId} OR t.user_b_id = ${userId} AND m.read = false AND m.from_id != ${userId}`;
    return {
      id: user.id, name: user.name, username: user.username, email: user.email, phone: user.phone,
      role: user.role, groupName: user.group_name, avatarUrl: user.avatar_url, department: user.department,
      year: user.year, yearInCollege: user.year_in_college, specialization: user.specialization,
      points: user.points, level: user.level, streak: user.streak, title: user.title,
      uniqueCode: user.unique_code, emailVerified: user.email_verified, phoneVerified: user.phone_verified,
      unreadCount, unreadDmCount,
    };
  });
}

async function handleMeProfile(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const body = await req.json();
    const { name, phone, avatarUrl, bio, specialization, yearInCollege, groupName } = body;
    const update: Record<string, unknown> = {};
    if (typeof name === "string" && name.trim()) update.name = name.trim();
    if (typeof phone === "string") update.phone = phone;
    if (typeof avatarUrl === "string") update.avatar_url = avatarUrl;
    if (typeof bio === "string") update.bio = bio;
    if (typeof specialization === "string") update.specialization = specialization;
    if (typeof yearInCollege === "number") update.year_in_college = yearInCollege;
    if (typeof groupName === "string" && ["A", "B", "C", "D", "E"].includes(groupName)) update.group_name = groupName;
    if (!Object.keys(update).length) return { ok: true };
    if (update.name !== undefined) await sql`UPDATE users SET name = ${update.name} WHERE id = ${userId}`;
    if (update.phone !== undefined) await sql`UPDATE users SET phone = ${update.phone} WHERE id = ${userId}`;
    if (update.avatar_url !== undefined) await sql`UPDATE users SET avatar_url = ${update.avatar_url} WHERE id = ${userId}`;
    if (update.bio !== undefined) await sql`UPDATE users SET bio = ${update.bio} WHERE id = ${userId}`;
    if (update.specialization !== undefined) await sql`UPDATE users SET specialization = ${update.specialization} WHERE id = ${userId}`;
    if (update.year_in_college !== undefined) await sql`UPDATE users SET year_in_college = ${update.year_in_college} WHERE id = ${userId}`;
    if (update.group_name !== undefined) await sql`UPDATE users SET group_name = ${update.group_name} WHERE id = ${userId}`;
    return { ok: true };
  });
}

async function handleMeGroup(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const body = await req.json();
    const { groupName } = body;
    if (!["A", "B", "C", "D", "E"].includes(groupName)) throw Object.assign(new Error("اختر مجموعة صحيحة"), { status: 400 });
    await sql`UPDATE users SET group_name = ${groupName} WHERE id = ${userId}`;
    return { ok: true };
  });
}

async function handleSwitchRole(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const body = await req.json();
    const { role } = body;
    if (!["student", "doctor", "ta", "admin", "super_admin"].includes(role)) throw Object.assign(new Error("Role غير صالح"), { status: 400 });
    await sql`UPDATE users SET role = ${role} WHERE id = ${userId}`;
    const token = generateToken(userId, role);
    return { token, role };
  });
}

async function handleNotifications(req: Request, parts: string[]): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    if (parts[2] === "mark-all-read") {
      await sql`UPDATE notifications SET read = true WHERE user_id = ${userId}`;
      return { ok: true };
    }
    if (parts[3] === "read") {
      const id = Number(parts[2]);
      await sql`UPDATE notifications SET read = true WHERE id = ${id} AND user_id = ${userId}`;
      return { ok: true };
    }
    const rows = await sql`SELECT * FROM notifications WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 50`;
    return rows.map((n: any) => ({ ...n, createdAt: n.created_at?.toISOString() }));
  });
}

async function handleAdminNotifications(req: Request): Promise<Response> {
  const { userId } = requireAuth(req.headers);
  const user = await getCurrentUser(userId);
  requireRole(user, ["admin", "super_admin"]);

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  return handle(async () => {
    const body = await req.json();
    const { title, body: msgBody } = body;
    if (!title || !msgBody) throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });

    const targetRole = body.targetRole || null;
    const targetGroup = body.targetGroup || null;

    let users;
    if (targetRole && targetGroup) {
      users = await sql`SELECT id FROM users WHERE role = ${targetRole} AND group_name = ${targetGroup}`;
    } else if (targetRole) {
      users = await sql`SELECT id FROM users WHERE role = ${targetRole}`;
    } else if (targetGroup) {
      users = await sql`SELECT id FROM users WHERE group_name = ${targetGroup}`;
    } else {
      users = await sql`SELECT id FROM users WHERE 1=1`;
    }

    if (users.length > 0) {
      for (const u of users) {
        await sql`INSERT INTO notifications (user_id, title, body) VALUES (${u.id}, ${title}, ${msgBody})`;
      }
    }
    return { ok: true, sentTo: users.length };
  });
}

async function handleAdminOverview(): Promise<Response> {
  return handle(async () => {
    const [{ totalStudents }] = await sql`SELECT count(*)::int AS "totalStudents" FROM users WHERE role = 'student'`;
    const [{ totalStaff }] = await sql`SELECT count(*)::int AS "totalStaff" FROM users WHERE role IN ('doctor', 'ta')`;
    const [{ activeExams }] = await sql`SELECT count(*)::int AS "activeExams" FROM quizzes`;

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);

    const activityRows = await sql`
      SELECT date, sum(minutes_studied)::int AS minutes, count(distinct user_id)::int AS "userCount"
      FROM activity WHERE date >= ${weekAgoStr} GROUP BY date`;
    const activityMap = new Map(activityRows.map((r: any) => [r.date, { minutes: r.minutes, users: r.userCount }]));
    const weeklyEngagement = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekAgo); d.setDate(weekAgo.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const data = activityMap.get(dateStr);
      return { date: dateStr, activeUsers: data?.users ?? 0, studyMinutes: data?.minutes ?? 0 };
    });

    const deptRows = await sql`SELECT department, count(*)::int AS count FROM users WHERE role = 'student' GROUP BY department`;

    const allStudents = await sql`SELECT points FROM users WHERE role = 'student'`;
    const buckets = [
      { bucket: "0-99", min: 0, max: 99 }, { bucket: "100-499", min: 100, max: 499 },
      { bucket: "500-999", min: 500, max: 999 }, { bucket: "1000-1999", min: 1000, max: 1999 },
      { bucket: "2000+", min: 2000, max: 999999 },
    ];
    const pointsDistribution = buckets.map((b) => ({
      bucket: b.bucket, count: allStudents.filter((s: any) => s.points >= b.min && s.points <= b.max).length,
    }));

    const todayStr = today.toISOString().slice(0, 10);
    const [{ aiUsageToday = 0 }] = await sql`SELECT count(*)::int AS "aiUsageToday" FROM quiz_attempts WHERE completed_at::date = ${todayStr}::date`;

    const alerts: any[] = [];
    const [{ unreadNotifs = 0 }] = await sql`SELECT count(*)::int AS "unreadNotifs" FROM notifications WHERE read = false`;
    const [recentComplaints] = await sql`SELECT count(*)::int AS count FROM complaints WHERE created_at > now() - interval '24 hours'`;
    if (recentComplaints?.count > 0) alerts.push({ id: 2, title: `${recentComplaints.count} شكوى جديدة`, body: "تم استلام شكاوى جديدة تحتاج مراجعة.", severity: "warning", kind: "complaint", createdAt: new Date().toISOString() });
    const [pendingTalents] = await sql`SELECT count(*)::int AS count FROM talents WHERE status = 'pending'`;
    if (pendingTalents?.count > 0) alerts.push({ id: 3, title: `${pendingTalents.count} موهبة بانتظار المراجعة`, body: "مواهب جديدة تحتاج اعتماد من الإدارة.", severity: "info", kind: "content_review", createdAt: new Date().toISOString() });
    alerts.push({ id: 5, title: "النظام يعمل بشكل طبيعي", body: `إجمالي ${totalStudents} طالب و ${totalStaff} عضو هيئة تدريس. ${unreadNotifs} إشعار غير مقروء.`, severity: "info", kind: "system", createdAt: new Date().toISOString() });

    return {
      totalStudents, totalStaff, activeExams, todayActivity: weeklyEngagement[6].activeUsers,
      aiUsageToday, weeklyEngagement, departmentBreakdown: deptRows, pointsDistribution, alerts,
    };
  });
}

async function handleAdminUsers(req: Request): Promise<Response> {
  return handle(async () => {
    const url = new URL(req.url, "http://localhost");
    const role = url.searchParams.get("role") || undefined;
    const rows = role ? await sql`SELECT * FROM users WHERE role = ${role} LIMIT 100` : await sql`SELECT * FROM users LIMIT 100`;
    return rows.map((u: any) => ({
      id: u.id, name: u.name, username: u.username, email: u.email, phone: u.phone,
      role: u.role, department: u.department, yearInCollege: u.year_in_college,
      specialization: u.specialization, avatarUrl: u.avatar_url, status: u.status,
      points: u.points, title: u.title, uniqueCode: u.unique_code,
      lastSeen: u.last_seen?.toISOString(),
    }));
  });
}

async function handleAdminProposals(req: Request, parts: string[]): Promise<Response> {
  const { userId } = requireAuth(req.headers);
  const user = await getCurrentUser(userId);
  requireRole(user, ["admin", "super_admin"]);

  if (req.method === "GET") {
    return handle(async () => {
      try {
        const url = new URL(req.url, "http://localhost");
        const status = url.searchParams.get("status") || "pending";
        const where = user.role === "super_admin"
          ? sql`status = ${status}`
          : sql`proposer_id = ${userId} AND status = ${status}`;
        const rows = await sql`SELECT * FROM admin_proposals WHERE ${where} ORDER BY created_at DESC`;
        const proposerIds = rows.map((r: any) => r.proposer_id);
        const proposers = proposerIds.length ? await sql`SELECT * FROM users WHERE id = ANY(${proposerIds})` : [];
        const byId = new Map(proposers.map((p: any) => [p.id, p]));
        return rows.map((r: any) => ({
          ...r, createdAt: r.created_at?.toISOString(), decidedAt: r.decided_at?.toISOString() ?? null,
          proposerName: byId.get(r.proposer_id)?.name, proposerRole: byId.get(r.proposer_id)?.role,
        }));
      } catch (err) {
        console.error("handleAdminProposals GET error:", err);
        return [];
      }
    });
  }

  if (req.method === "POST" && !parts[3]) {
    return handle(async () => {
      const body = await req.json();
      const { action, resourceKind, resourceId, payload, reason } = body;
      if (!action || !resourceKind) throw Object.assign(new Error("action و resourceKind مطلوب"), { status: 400 });

      if (user.role === "super_admin") {
        const [p] = await sql`
          INSERT INTO admin_proposals (proposer_id, action, resource_kind, resource_id, payload, reason, status, decided_by_id, decided_at, decision_note)
          VALUES (${userId}, ${action}, ${resourceKind}, ${resourceId || null}, ${payload ?? {}}, ${reason || null}, 'approved', ${userId}, ${new Date()}, 'تنفيذ مباشر من السوبر أدمن')
          RETURNING *`;
        await applyProposal(p);
        return { proposal: p, applied: true };
      }

      const [p] = await sql`
        INSERT INTO admin_proposals (proposer_id, action, resource_kind, resource_id, payload, reason, status)
        VALUES (${userId}, ${action}, ${resourceKind}, ${resourceId || null}, ${payload ?? {}}, ${reason || null}, 'pending')
        RETURNING *`;
      const supers = await sql`SELECT * FROM users WHERE role = 'super_admin'`;
      for (const su of supers) {
        await sql`INSERT INTO notifications (user_id, title, body, type) VALUES (${su.id}, 'اقتراح جديد بانتظار موافقتك', ${`${user.name} يقترح ${action} على ${resourceKind}${reason ? ` — ${reason}` : ""}`}, 'warning')`;
      }
      return { proposal: p, applied: false };
    });
  }

  if (req.method === "POST" && parts[3] === "decide") {
    return handle(async () => {
      requireRole(user, ["super_admin"]);
      const id = Number(parts[2]);
      const body = await req.json();
      const { decision, note } = body;
      const [p] = await sql`SELECT * FROM admin_proposals WHERE id = ${id}`;
      if (!p) throw Object.assign(new Error("الاقتراح غير موجود"), { status: 404 });
      if (p.status !== "pending") throw Object.assign(new Error("تم البت في الاقتراح بالفعل"), { status: 400 });

      if (decision === "approve") {
        await applyProposal(p);
        await sql`UPDATE admin_proposals SET status = 'approved', decided_by_id = ${userId}, decided_at = ${new Date()}, decision_note = ${note || null} WHERE id = ${id}`;
        await sql`INSERT INTO notifications (user_id, title, body, type) VALUES (${p.proposer_id}, 'تمت الموافقة على اقتراحك', ${`وافق السوبر أدمن على ${p.action} - ${p.resource_kind}${note ? ` — ${note}` : ""}`}, 'success')`;
      } else {
        await sql`UPDATE admin_proposals SET status = 'rejected', decided_by_id = ${userId}, decided_at = ${new Date()}, decision_note = ${note || null} WHERE id = ${id}`;
        await sql`INSERT INTO notifications (user_id, title, body, type) VALUES (${p.proposer_id}, 'تم رفض اقتراحك', ${`رفض السوبر أدمن ${p.action} - ${p.resource_kind}${note ? ` — ${note}` : ""}`}, 'alert')`;
      }
      return { ok: true };
    });
  }

  return jsonError("Not Found", 404);
}

async function handleTalentsFeed(req: Request, parts: string[]): Promise<Response> {
  console.log("🟡 [handleTalentsFeed] method:", req.method, "parts:", JSON.stringify(parts), "parts[1]:", parts[1], "!parts[1]:", !parts[1]);
  if (req.method === "GET" && !parts[1]) {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const rows = await sql`SELECT * FROM talents WHERE status = 'active' ORDER BY created_at DESC`;
      const ownerIds = Array.from(new Set(rows.map((t: any) => t.owner_id)));
      const owners = ownerIds.length ? await sql`SELECT * FROM users WHERE id = ANY(${ownerIds})` : [];
      const ownerById = new Map(owners.map((u: any) => [u.id, u]));
      const talentIds = rows.map((t: any) => t.id);
      const likes = talentIds.length ? await sql`SELECT * FROM talent_likes WHERE talent_id = ANY(${talentIds})` : [];
      const comments = talentIds.length ? await sql`SELECT * FROM talent_comments WHERE talent_id = ANY(${talentIds})` : [];
      return rows.map((t: any) => {
        const tLikes = likes.filter((l: any) => l.talent_id === t.id);
        const tComments = comments.filter((c: any) => c.talent_id === t.id);
        const owner = ownerById.get(t.owner_id);
        return {
          ...t, createdAt: t.created_at?.toISOString(),
          owner: owner ? { id: owner.id, name: owner.name, avatarUrl: owner.avatar_url, groupName: owner.group_name, department: owner.department } : null,
          likesCount: tLikes.length, likedByMe: tLikes.some((l: any) => l.user_id === userId),
          commentsCount: tComments.length,
        };
      });
    });
  }

  if (req.method === "POST" && !parts[1]) {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const body = await req.json();
      const { title, description, category, mediaUrl, groupOnly } = body;
      if (!title || !description || !category) throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
      const [t] = await sql`INSERT INTO talents (title, description, category, media_url, owner_id, group_only) VALUES (${title}, ${description}, ${category}, ${mediaUrl || null}, ${userId}, ${groupOnly || null}) RETURNING *`;
      return t;
    });
  }

  if (parts[2] && parts[3] === "like") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const id = Number(parts[2]);
      const existing = await sql`SELECT * FROM talent_likes WHERE talent_id = ${id} AND user_id = ${userId}`;
      if (existing.length) {
        await sql`DELETE FROM talent_likes WHERE talent_id = ${id} AND user_id = ${userId}`;
        return { liked: false };
      }
      await sql`INSERT INTO talent_likes (talent_id, user_id) VALUES (${id}, ${userId})`;
      return { liked: true };
    });
  }

  if (parts[2] && parts[3] === "comments") {
    if (req.method === "GET") {
      return handle(async () => {
        const id = Number(parts[2]);
        const rows = await sql`SELECT * FROM talent_comments WHERE talent_id = ${id} ORDER BY created_at DESC`;
        const authorIds = Array.from(new Set(rows.map((r: any) => r.author_id)));
        const authors = authorIds.length ? await sql`SELECT * FROM users WHERE id = ANY(${authorIds})` : [];
        const byId = new Map(authors.map((u: any) => [u.id, u]));
        return rows.map((c: any) => ({ ...c, createdAt: c.created_at?.toISOString(), authorName: byId.get(c.author_id)?.name, authorAvatar: byId.get(c.author_id)?.avatar_url }));
      });
    }
    if (req.method === "POST") {
      return handle(async () => {
        const { userId } = requireAuth(req.headers);
        const id = Number(parts[2]);
        const body = await req.json();
        if (!body.body) throw Object.assign(new Error("نص التعليق مطلوب"), { status: 400 });
        const [c] = await sql`INSERT INTO talent_comments (talent_id, author_id, body) VALUES (${id}, ${userId}, ${body.body}) RETURNING *`;
        return c;
      });
    }
  }

  return jsonError("Not Found", 404);
}

async function handleForum(req: Request, parts: string[]): Promise<Response> {
  if (req.method === "GET" && !parts[2]) {
    return handle(async () => {
      const posts = await sql`SELECT * FROM forum_posts ORDER BY created_at DESC`;
      const authorIds = Array.from(new Set(posts.map((p: any) => p.author_id)));
      const users = authorIds.length ? await sql`SELECT * FROM users WHERE id = ANY(${authorIds})` : [];
      const byId = new Map(users.map((u: any) => [u.id, u]));
      const replyCounts = posts.length ? await sql`SELECT post_id, count(*)::int AS c FROM forum_replies WHERE post_id = ANY(${posts.map((p: any) => p.id)}) GROUP BY post_id` : [];
      const countMap = new Map(replyCounts.map((r: any) => [r.post_id, r.c]));
      return posts.map((p: any) => ({
        ...p, createdAt: p.created_at?.toISOString(), authorName: byId.get(p.author_id)?.name,
        authorAvatar: byId.get(p.author_id)?.avatar_url, authorGroup: byId.get(p.author_id)?.group_name,
        repliesCount: countMap.get(p.id) ?? 0,
      }));
    });
  }

  if (req.method === "POST" && !parts[2]) {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const body = await req.json();
      const { title, body: postBody, category, groupOnly } = body;
      if (!title || !postBody) throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
      const [post] = await sql`INSERT INTO forum_posts (title, body, category, author_id, group_only) VALUES (${title}, ${postBody}, ${category || "عام"}, ${userId}, ${groupOnly || null}) RETURNING *`;
      return post;
    });
  }

  if (parts[3] === "upvote") {
    return handle(async () => {
      requireAuth(req.headers);
      const id = Number(parts[2]);
      await sql`UPDATE forum_posts SET upvotes = upvotes + 1 WHERE id = ${id}`;
      return { ok: true };
    });
  }

  if (parts[3] === "replies") {
    if (req.method === "GET") {
      return handle(async () => {
        const id = Number(parts[2]);
        const replies = await sql`SELECT * FROM forum_replies WHERE post_id = ${id} ORDER BY created_at`;
        const ids = Array.from(new Set(replies.map((r: any) => r.author_id)));
        const users = ids.length ? await sql`SELECT * FROM users WHERE id = ANY(${ids})` : [];
        const byId = new Map(users.map((u: any) => [u.id, u]));
        return replies.map((r: any) => ({ ...r, createdAt: r.created_at?.toISOString(), authorName: byId.get(r.author_id)?.name, authorAvatar: byId.get(r.author_id)?.avatar_url, authorRole: byId.get(r.author_id)?.role }));
      });
    }
    if (req.method === "POST") {
      return handle(async () => {
        const { userId } = requireAuth(req.headers);
        const id = Number(parts[2]);
        const body = await req.json();
        if (!body.body) throw Object.assign(new Error("نص الرد مطلوب"), { status: 400 });
        const [r] = await sql`INSERT INTO forum_replies (post_id, body, author_id) VALUES (${id}, ${body.body}, ${userId}) RETURNING *`;
        return r;
      });
    }
  }

  return jsonError("Not Found", 404);
}

async function handleQuizzesList(): Promise<Response> {
  return handle(async () => {
    const rows = await sql`SELECT * FROM quizzes WHERE is_open = true ORDER BY created_at DESC LIMIT 50`;
    return rows.map((q: any) => ({ ...q, createdAt: q.created_at?.toISOString() }));
  });
}

async function handleQuizzes(req: Request, parts: string[]): Promise<Response> {
  if (parts[1] === "open") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const me = await getCurrentUser(userId);
      const all = await sql`SELECT * FROM quizzes WHERE is_open = true ORDER BY created_at DESC`;
      const filtered = me ? all.filter((q: any) => (!q.group_only || q.group_only === me.group_name) && (!q.year_only || q.year_only === me.year_in_college)) : all;
      const attempts = me ? await sql`SELECT * FROM quiz_attempts WHERE user_id = ${me.id}` : [];
      return filtered.map((q: any) => {
        const myAttempts = attempts.filter((a: any) => a.quiz_id === q.id);
        const best = myAttempts.reduce((m: number, a: any) => Math.max(m, a.score), 0);
        return { ...q, createdAt: q.created_at?.toISOString(), myAttemptsCount: myAttempts.length, myBestScore: best };
      });
    });
  }

  if (parts[2] === "start") {
    return handle(async () => {
      requireAuth(req.headers);
      const id = Number(parts[1]);
      const [q] = await sql`SELECT * FROM quizzes WHERE id = ${id}`;
      if (!q) throw Object.assign(new Error("الاختبار غير موجود"), { status: 404 });
      if (!q.is_open) throw Object.assign(new Error("هذا الاختبار مغلق حالياً"), { status: 403 });
      const questions = await sql`SELECT * FROM quiz_questions WHERE quiz_id = ${id}`;
      const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, Math.min(10, questions.length));
      const out = shuffled.map((qq: any) => {
        const opts = qq.options.map((o: string, i: number) => ({ text: o, originalIndex: i }));
        const shuffledOpts = [...opts].sort(() => Math.random() - 0.5);
        return { id: qq.id, text: qq.text, options: shuffledOpts.map((o: any) => o.text), optionMap: shuffledOpts.map((o: any) => o.originalIndex), points: qq.points };
      });
      return { quiz: { ...q, createdAt: q.created_at?.toISOString() }, questions: out };
    });
  }

  if (parts[2] === "submit") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const id = Number(parts[1]);
      const body = await req.json();
      const { answers, durationSec } = body;
      const [q] = await sql`SELECT * FROM quizzes WHERE id = ${id}`;
      if (!q) throw Object.assign(new Error("الاختبار غير موجود"), { status: 404 });
      if (!q.is_open) throw Object.assign(new Error("هذا الاختبار مغلق حالياً"), { status: 403 });
      const questions = await sql`SELECT * FROM quiz_questions WHERE quiz_id = ${id}`;
      let score = 0, total = 0;
      const ans: any[] = [];
      for (const a of answers) {
        const qq = questions.find((x: any) => x.id === a.questionId);
        if (!qq) continue;
        total += qq.points;
        const correct = qq.correct_index === a.chosenOriginalIndex;
        if (correct) score += qq.points;
        ans.push({ questionId: qq.id, chosen: a.chosenOriginalIndex, correct });
      }
      const pct = total > 0 ? Math.round((score / total) * 100) : 0;
      const passed = pct >= (q.pass_percent || 50);
      const [attempt] = await sql`INSERT INTO quiz_attempts (quiz_id, user_id, score, total, duration_sec, answers, passed) VALUES (${id}, ${userId}, ${score}, ${total}, ${durationSec || 0}, ${JSON.stringify(ans)}, ${passed}) RETURNING *`;
      const pointsAwarded = Math.floor(score / 5) + (passed ? 10 : 0);
      await sql`UPDATE users SET points = points + ${pointsAwarded} WHERE id = ${userId}`;
      const questionDetails = questions.map((qq: any) => {
        const userAns = ans.find((a: any) => a.questionId === qq.id);
        return { questionId: qq.id, text: qq.text, options: qq.options, correctIndex: qq.correct_index, explanation: qq.explanation, points: qq.points, userChosen: userAns?.chosen ?? -1, correct: userAns?.correct ?? false };
      });
      return { ...attempt, completedAt: attempt.completed_at?.toISOString(), passed, pointsAwarded, questionDetails };
    });
  }

  return jsonError("Not Found", 404);
}

async function handleAdminQuizzes(req: Request, parts: string[]): Promise<Response> {
  const { userId } = requireAuth(req.headers);
  const user = await getCurrentUser(userId);
  requireRole(user, ["admin", "super_admin"]);

  if (parts[1] === "all-quizzes") {
    return handle(async () => {
      const all = await sql`SELECT * FROM quizzes ORDER BY created_at DESC`;
      const counts = await sql`SELECT quiz_id, COUNT(*)::int AS c FROM quiz_attempts GROUP BY quiz_id`;
      const map = new Map<number, number>(counts.map((r: any) => [Number(r.quiz_id), Number(r.c)]));
      return all.map((q: any) => ({ ...q, createdAt: q.created_at?.toISOString(), attemptsCount: map.get(q.id) ?? 0 }));
    });
  }

  if (parts[1] === "quizzes" && parts[3] === "attempts" && !parts[4]) {
    return handle(async () => {
      const id = Number(parts[2]);
      const attempts = await sql`SELECT * FROM quiz_attempts WHERE quiz_id = ${id} ORDER BY completed_at DESC`;
      const ids = Array.from(new Set(attempts.map((a: any) => a.user_id)));
      const users = ids.length ? await sql`SELECT * FROM users WHERE id = ANY(${ids})` : [];
      const byId = new Map(users.map((u: any) => [u.id, u]));
      return attempts.map((a: any) => ({ ...a, completedAt: a.completed_at?.toISOString(), userName: byId.get(a.user_id)?.name, userAvatar: byId.get(a.user_id)?.avatar_url, userGroup: byId.get(a.user_id)?.group_name }));
    });
  }

  if (parts[1] === "quizzes" && parts[3] === "attempts" && parts[4]) {
    return handle(async () => getAttemptDetail(Number(parts[4])));
  }

  if (req.method === "POST" && parts[1] === "quizzes" && !parts[2]) {
    return handle(async () => {
      const body = await req.json();
      const { title, description, courseId, courseTitle, durationMinutes, totalPoints, difficulty, groupOnly, yearOnly, randomize, passPercent } = body;
      if (!title || !courseId) throw Object.assign(new Error("العنوان والمادة مطلوبان"), { status: 400 });
      const [q] = await sql`INSERT INTO quizzes (title, description, course_id, course_title, duration_minutes, total_points, difficulty, group_only, year_only, randomize, pass_percent) VALUES (${title}, ${description || ""}, ${courseId}, ${courseTitle || ""}, ${durationMinutes ?? 15}, ${totalPoints ?? 100}, ${difficulty || "medium"}, ${groupOnly || null}, ${yearOnly || null}, ${randomize ?? true}, ${passPercent ?? 50}) RETURNING *`;
      return { ...q, createdAt: q.created_at?.toISOString() };
    });
  }

  if (req.method === "PUT" && parts[1] === "quiz-questions" && parts[2]) {
    return handle(async () => {
      const id = Number(parts[2]);
      const body = await req.json();
      const { text, options, correctIndex, points, explanation } = body;
      const [existing] = await sql`SELECT * FROM quiz_questions WHERE id = ${id}`;
      if (!existing) throw Object.assign(new Error("السؤال غير موجود"), { status: 404 });
      await sql`UPDATE quiz_questions SET text = COALESCE(${text}, text), options = COALESCE(${JSON.stringify(options)}, options), correct_index = COALESCE(${correctIndex}, correct_index), points = COALESCE(${points}, points), explanation = COALESCE(${explanation}, explanation) WHERE id = ${id}`;
      return { ok: true };
    });
  }

  if (req.method === "DELETE" && parts[1] === "quiz-questions" && parts[2]) {
    return handle(async () => {
      await sql`DELETE FROM quiz_questions WHERE id = ${Number(parts[2])}`;
      return { ok: true };
    });
  }

  if (req.method === "PUT" && parts[1] === "quizzes" && parts[2]) {
    return handle(async () => {
      const id = Number(parts[2]);
      const body = await req.json();
      const { title, description, durationMinutes, totalPoints, difficulty, groupOnly, yearOnly, randomize, passPercent } = body;
      await sql`UPDATE quizzes SET title = COALESCE(${title}, title), description = COALESCE(${description}, description), duration_minutes = COALESCE(${durationMinutes}, duration_minutes), total_points = COALESCE(${totalPoints}, total_points), difficulty = COALESCE(${difficulty}, difficulty), group_only = COALESCE(${groupOnly}, group_only), year_only = COALESCE(${yearOnly}, year_only), randomize = COALESCE(${randomize}, randomize), pass_percent = COALESCE(${passPercent}, pass_percent) WHERE id = ${id}`;
      return { ok: true };
    });
  }

  if (req.method === "DELETE" && parts[1] === "quizzes" && parts[2]) {
    return handle(async () => {
      await sql`DELETE FROM quizzes WHERE id = ${Number(parts[2])}`;
      return { ok: true };
    });
  }

  if (parts[1] === "quizzes" && parts[3] === "questions") {
    if (req.method === "GET") {
      return handle(async () => sql`SELECT * FROM quiz_questions WHERE quiz_id = ${Number(parts[2])} ORDER BY ord`);
    }
    if (req.method === "POST") {
      return handle(async () => {
        const body = await req.json();
        const { text, type, options, correctIndex, points, explanation } = body;
        if (!text || !options || typeof correctIndex !== "number") throw Object.assign(new Error("بيانات السؤال ناقصة"), { status: 400 });
        const [maxOrd] = await sql`SELECT MAX(ord) AS max FROM quiz_questions WHERE quiz_id = ${Number(parts[2])}`;
        const [qq] = await sql`INSERT INTO quiz_questions (quiz_id, text, type, options, correct_index, points, explanation, ord) VALUES (${Number(parts[2])}, ${text}, ${type || "mc"}, ${JSON.stringify(options)}, ${correctIndex}, ${points ?? 10}, ${explanation || ""}, ${(maxOrd?.max ?? 0) + 1}) RETURNING *`;
        return qq;
      });
    }
  }

  if (parts[2] === "toggle") {
    return handle(async () => {
      ensureSuper(user);
      const id = Number(parts[3]);
      const [q] = await sql`SELECT * FROM quizzes WHERE id = ${id}`;
      if (!q) throw Object.assign(new Error("الاختبار غير موجود"), { status: 404 });
      await sql`UPDATE quizzes SET is_open = NOT is_open WHERE id = ${id}`;
      return { ok: true, isOpen: !q.is_open };
    });
  }

  return jsonError("Not Found", 404);
}

async function handleDM(req: Request, parts: string[]): Promise<Response> {
  const { userId } = requireAuth(req.headers);
  console.log("[handleDM] userId:", userId, "parts:", JSON.stringify(parts));

  if (parts[1] === "threads") {
    return handle(async () => {
      const threads = await sql`SELECT * FROM dm_threads WHERE user_a_id = ${userId} OR user_b_id = ${userId} ORDER BY last_message_at DESC`;
      if (!threads.length) return [];
      const otherIds = threads.map((t: any) => t.user_a_id === userId ? t.user_b_id : t.user_a_id);
      const users = await sql`SELECT * FROM users WHERE id = ANY(${otherIds})`;
      const byId = new Map(users.map((u: any) => [u.id, u]));
      const allMsgs = await sql`SELECT * FROM dm_messages WHERE thread_id = ANY(${threads.map((t: any) => t.id)})`;
      return threads.map((t: any) => {
        const otherId = t.user_a_id === userId ? t.user_b_id : t.user_a_id;
        const other = byId.get(otherId);
        const msgs = allMsgs.filter((m: any) => m.thread_id === t.id).sort((a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at));
        const last = msgs[0];
        const unread = msgs.filter((m: any) => m.from_id !== userId && !(m.is_read || m.read_at)).length;
        return {
          threadId: t.id, other: other ? { id: other.id, name: other.name, avatarUrl: other.avatar_url, groupName: other.group_name } : null,
          lastMessage: last ? { body: last.body, createdAt: last.created_at?.toISOString(), fromMe: last.from_id === userId } : null,
          unread, lastMessageAt: t.last_message_at?.toISOString(),
        };
      });
    });
  }

  if (parts[1] === "with") {
    const otherId = Number(parts[2]);
    if (req.method === "GET") {
      return handle(async () => {
        const [otherUser] = await sql`SELECT id, name, avatar_url, group_name, specialization FROM users WHERE id = ${otherId}`;
        if (!otherUser) throw Object.assign(new Error("المستخدم غير موجود"), { status: 404 });
        const threadId = await ensureThread(userId, otherId);
        const msgs = await sql`SELECT id, thread_id, from_id, body, created_at FROM dm_messages WHERE thread_id = ${threadId} ORDER BY created_at`;
        try {
          await sql`UPDATE dm_messages SET is_read = true WHERE thread_id = ${threadId} AND from_id != ${userId} AND (is_read IS NULL OR is_read = false)`;
        } catch {
          try {
            await sql`UPDATE dm_messages SET read_at = now() WHERE thread_id = ${threadId} AND from_id != ${userId} AND read_at IS NULL`;
          } catch {
            // column may not exist, silently ignore
          }
        }
        return {
          threadId, other: { id: otherUser.id, name: otherUser.name, avatarUrl: otherUser.avatar_url, groupName: otherUser.group_name, specialization: otherUser.specialization },
          messages: msgs.map((m: any) => ({ ...m, createdAt: m.created_at?.toISOString(), fromMe: m.from_id === userId })),
        };
      });
    }
    if (req.method === "POST") {
      return handle(async () => {
        const body = await req.json();
        if (!body.body || !body.body.trim()) throw Object.assign(new Error("اكتب رسالة"), { status: 400 });
        const [otherUser] = await sql`SELECT id FROM users WHERE id = ${otherId}`;
        if (!otherUser) throw Object.assign(new Error("المستخدم غير موجود"), { status: 404 });
        const threadId = await ensureThread(userId, otherId);
        const [msg] = await sql`INSERT INTO dm_messages (thread_id, from_id, body) VALUES (${threadId}, ${userId}, ${body.body.trim()}) RETURNING *`;
        await sql`UPDATE dm_threads SET last_message_at = now() WHERE id = ${threadId}`;
        const [meUser] = await sql`SELECT name FROM users WHERE id = ${userId}`;
        try {
          await sql`INSERT INTO notifications (user_id, title, body, type) VALUES (${otherId}, ${`رسالة من ${meUser?.name || "أحدهم"}`}, ${body.body.trim().slice(0, 100)}, 'info')`;
        } catch {
          // notifications table may not exist
        }
        return { ...msg, createdAt: msg.created_at?.toISOString() };
      });
    }
  }

  return jsonError("Not Found", 404);
}

async function handleFollow(req: Request, parts: string[]): Promise<Response> {
  const { userId } = requireAuth(req.headers);

  if (req.method === "POST" && parts[1] === "follow") {
    return handle(async () => {
      const targetId = Number(parts[2]);
      if (targetId === userId) throw Object.assign(new Error("لا يمكنك متابعة نفسك"), { status: 400 });
      const existing = await sql`SELECT * FROM user_follows WHERE follower_id = ${userId} AND following_id = ${targetId}`;
      if (existing.length) {
        await sql`DELETE FROM user_follows WHERE follower_id = ${userId} AND following_id = ${targetId}`;
        return { following: false };
      }
      await sql`INSERT INTO user_follows (follower_id, following_id) VALUES (${userId}, ${targetId})`;
      try {
        const [meUser] = await sql`SELECT name FROM users WHERE id = ${userId}`;
        await sql`INSERT INTO notifications (user_id, title, body, type) VALUES (${targetId}, 'متابعة جديدة', ${`${meUser?.name || "أحدهم"} بدأ متابعتك`}, 'info')`;
      } catch {
        // notifications table may not exist
      }
      return { following: true };
    });
  }

  if (parts[1] === "follows") {
    if (parts[2] === "me") {
      return handle(async () => {
        const followers = await sql`SELECT * FROM user_follows WHERE following_id = ${userId}`;
        const following = await sql`SELECT * FROM user_follows WHERE follower_id = ${userId}`;
        const ids = Array.from(new Set([...followers.map((f: any) => f.follower_id), ...following.map((f: any) => f.following_id)]));
        const users = ids.length ? await sql`SELECT * FROM users WHERE id = ANY(${ids})` : [];
        const byId = new Map(users.map((u: any) => [u.id, u]));
        const map = (id: number) => { const u = byId.get(id); return u ? { id: u.id, name: u.name, avatarUrl: u.avatar_url, groupName: u.group_name, specialization: u.specialization } : null; };
        return { followers: followers.map((f: any) => map(f.follower_id)).filter(Boolean), following: following.map((f: any) => map(f.following_id)).filter(Boolean) };
      });
    }
    if (parts[3] === "status") {
      return handle(async () => {
        const target = Number(parts[2]);
        const r = await sql`SELECT * FROM user_follows WHERE follower_id = ${userId} AND following_id = ${target}`;
        return { following: r.length > 0 };
      });
    }
  }

  return jsonError("Not Found", 404);
}

async function handleUsers(req: Request, parts: string[]): Promise<Response> {
  if (parts[1] === "students") {
    return handle(async () => {
      const rows = await sql`SELECT * FROM users WHERE role = 'student' ORDER BY points DESC LIMIT 100`;
      return rows.map((u: any) => ({ id: u.id, name: u.name, username: u.username, avatarUrl: u.avatar_url, groupName: u.group_name, specialization: u.specialization, yearInCollege: u.year_in_college, points: u.points, uniqueCode: u.unique_code }));
    });
  }

  if (parts[1]) {
    return handle(async () => {
      const id = Number(parts[1]);
      const [user] = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
      if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
      const [{ followerCount }] = await sql`SELECT count(*)::int AS "followerCount" FROM user_follows WHERE following_id = ${id}`;
      const [{ followingCount }] = await sql`SELECT count(*)::int AS "followingCount" FROM user_follows WHERE follower_id = ${id}`;
      const [{ totalTalentLikes }] = await sql`SELECT count(*)::int AS "totalTalentLikes" FROM talent_likes WHERE user_id = ${user.id}`;
      const userPostIds = await sql`SELECT id FROM forum_posts WHERE author_id = ${id}`;
      let totalForumLikes = 0;
      if (userPostIds.length > 0) {
        const [{ c }] = await sql`SELECT count(*)::int AS c FROM forum_post_likes WHERE post_id = ANY(${userPostIds.map((p: any) => p.id)})`;
        totalForumLikes = c;
      }
      const forumPosts = await sql`SELECT * FROM forum_posts WHERE author_id = ${id} ORDER BY created_at DESC LIMIT 50`;
      const talents = await sql`SELECT * FROM talents WHERE owner_id = ${id} AND status = 'active' ORDER BY created_at DESC LIMIT 50`;
      const summaries = await sql`SELECT * FROM material_files WHERE uploaded_by_id = ${id} AND category = 'student-summary' ORDER BY created_at DESC LIMIT 50`;
      const currentUserId = (await getUserId(req.headers.get("authorization")?.slice(7))) || null;
      let following = false;
      if (currentUserId) {
        const [f] = await sql`SELECT * FROM user_follows WHERE follower_id = ${currentUserId} AND following_id = ${id}`;
        following = !!f;
      }
      return {
        ...user, lastSeen: user.last_seen?.toISOString(), createdAt: user.created_at?.toISOString(),
        followerCount, followingCount, totalLikesReceived: totalTalentLikes + totalForumLikes,
        forumPosts: forumPosts.map((p: any) => ({ ...p, createdAt: p.created_at?.toISOString() })),
        talents: talents.map((t: any) => ({ ...t, createdAt: t.created_at?.toISOString() })),
        summaries: summaries.map((s: any) => ({ ...s, createdAt: s.created_at?.toISOString() })),
        following,
      };
    });
  }

  return jsonError("Not Found", 404);
}

async function handleHomeFeed(): Promise<Response> {
  console.log("🔵 [handleHomeFeed] Starting...");
  try {
    const [{ students }] = await sql`SELECT count(*)::int AS students FROM users WHERE role = 'student'`;
    const [{ staff }] = await sql`SELECT count(*)::int AS staff FROM users WHERE role IN ('doctor', 'ta')`;
    const [{ courses }] = await sql`SELECT count(*)::int AS courses FROM courses`;
    const [{ researchProjects }] = await sql`SELECT count(*)::int AS "researchProjects" FROM talents WHERE category = 'research'`;
    const [deanRow] = await sql`SELECT * FROM users WHERE role = 'doctor' AND title LIKE '%عميد%' LIMIT 1`;
    const news = await sql`SELECT * FROM news WHERE status = 'approved' ORDER BY published_at DESC LIMIT 3`;
    return jsonResponse({
      stats: { students: students || 0, staff: staff || 0, courses: courses || 0, researchProjects: researchProjects || 0 },
      dean: deanRow ? { name: deanRow.name, bio: deanRow.bio || "مرحباً بكم في كلية الزراعة" } : null,
      latestNews: news.map((n: any) => ({ ...n, createdAt: n.created_at?.toISOString() })),
    });
  } catch (err: any) {
    console.error("🔴 [handleHomeFeed] Error:", err?.message);
    return jsonError(err?.message || "Internal Server Error", 500);
  }
}

async function handleNews(): Promise<Response> {
  return handle(async () => {
    const rows = await sql`SELECT * FROM news WHERE status = 'approved' ORDER BY published_at DESC`;
    return rows;
  });
}

async function handleNewsById(id: string): Promise<Response> {
  return handle(async () => {
    const [row] = await sql`SELECT * FROM news WHERE id = ${Number(id)} LIMIT 1`;
    if (!row) throw Object.assign(new Error("News not found"), { status: 404 });
    return row;
  });
}

async function handleSkills(req: Request, parts: string[]): Promise<Response> {
  if (parts[2] === "tracks") {
    return handle(async () => {
      const tracks = await sql`SELECT * FROM skill_tracks`;
      if (!tracks.length) return [];
      const lessons = await sql`SELECT * FROM skill_lessons WHERE track_id = ANY(${tracks.map((t: any) => t.id)}) ORDER BY ord`;
      return tracks.map((t: any) => ({ ...t, lessons: lessons.filter((l: any) => l.track_id === t.id) }));
    });
  }

  if (parts[4] === "complete") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const id = Number(parts[3]);
      await sql`UPDATE skill_lessons SET completed = true WHERE id = ${id}`;
      const [lesson] = await sql`SELECT * FROM skill_lessons WHERE id = ${id}`;
      if (lesson) {
        const all = await sql`SELECT * FROM skill_lessons WHERE track_id = ${lesson.track_id}`;
        const done = all.filter((l: any) => l.completed).length;
        const progress = all.length ? done / all.length : 0;
        await sql`UPDATE skill_tracks SET progress = ${progress} WHERE id = ${lesson.track_id}`;
        await sql`UPDATE users SET points = points + 5 WHERE id = ${userId}`;
      }
      return { ok: true };
    });
  }

  return jsonError("Not Found", 404);
}

async function handleGames(req: Request, parts: string[]): Promise<Response> {
  if (parts[1] === "score" && req.method === "POST") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const body = await req.json();
      const { gameKey, score, durationMs } = body;
      if (!gameKey || typeof score !== "number") throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
      const [row] = await sql`INSERT INTO game_scores (user_id, game_key, score, duration_ms) VALUES (${userId}, ${gameKey}, ${score}, ${durationMs ?? 0}) RETURNING *`;
      await sql`UPDATE users SET points = points + ${Math.floor(score / 10)} WHERE id = ${userId}`;
      return row;
    });
  }

  if (parts[1] === "leaderboard") {
    return handle(async () => {
      const url = new URL(req.url, "http://localhost");
      const gameKey = url.searchParams.get("gameKey");
      const rows = gameKey ? await sql`SELECT * FROM game_scores WHERE game_key = ${gameKey} ORDER BY score DESC LIMIT 20` : await sql`SELECT * FROM game_scores ORDER BY score DESC LIMIT 20`;
      const userIds = Array.from(new Set(rows.map((r: any) => r.user_id)));
      const users = userIds.length ? await sql`SELECT * FROM users WHERE id = ANY(${userIds})` : [];
      const byId = new Map(users.map((u: any) => [u.id, u]));
      return rows.map((r: any) => ({ ...r, createdAt: r.created_at?.toISOString(), userName: byId.get(r.user_id)?.name, userAvatar: byId.get(r.user_id)?.avatar_url, groupName: byId.get(r.user_id)?.group_name }));
    });
  }

  return jsonError("Not Found", 404);
}

async function handleLeaderboard(req: Request): Promise<Response> {
  return handle(async () => {
    const url = new URL(req.url, "http://localhost");
    const period = url.searchParams.get("period") || "weekly";
    try {
      let whereClause: ReturnType<typeof sql>;
      const now = new Date();
      if (period === "daily") {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        whereClause = sql`created_at >= ${start}`;
      } else if (period === "weekly") {
        const start = new Date(now);
        start.setDate(start.getDate() - 7);
        whereClause = sql`created_at >= ${start}`;
      } else if (period === "monthly") {
        const start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        whereClause = sql`created_at >= ${start}`;
      } else {
        whereClause = sql`1=1`;
      }
      const rows = await sql`SELECT user_id, SUM(points) AS points FROM user_activity_log WHERE ${whereClause} GROUP BY user_id ORDER BY points DESC LIMIT 50`;
      const userIds = rows.map((r: any) => r.user_id);
      const users = userIds.length ? await sql`SELECT * FROM users WHERE id = ANY(${userIds}) AND role = 'student'` : [];
      const byId = new Map(users.map((u: any) => [u.id, u]));
      const allRows = await sql`SELECT user_id, SUM(points) AS points FROM user_activity_log GROUP BY user_id ORDER BY points DESC`;
      const allTimeRanks = new Map<number, number>();
      let rank = 0;
      for (const r of allRows) { rank++; allTimeRanks.set(Number(r.user_id), rank); }
      const prevWeek = new Date(now);
      prevWeek.setDate(prevWeek.getDate() - 14);
      const prevEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const prevRows = await sql`SELECT user_id, SUM(points) AS points FROM user_activity_log WHERE created_at >= ${prevWeek} AND created_at < ${prevEnd} GROUP BY user_id`;
      const prevRanks = new Map<number, number>();
      let prevRank = 0;
      for (const r of [...prevRows].sort((a: any, b: any) => Number(b.points) - Number(a.points))) { prevRank++; prevRanks.set(Number(r.user_id), prevRank); }
      const studentOnly = rows.filter((r: any) => byId.has(Number(r.user_id)));
      return studentOnly.map((r: any, i: number) => {
        const uid = Number(r.user_id);
        const u = byId.get(uid);
        const currentRank = i + 1;
        const p = prevRanks.get(uid);
        const delta = p ? p - currentRank : 0;
        return { rank: currentRank, userId: uid, name: u?.name || "", avatarUrl: u?.avatar_url || null, department: u?.department || "", year: u?.year || null, points: Number(r.points), level: u ? Math.floor(Number(u.points) / 100) + 1 : 1, streak: u?.streak || 0, deltaRank: delta };
      });
    } catch (e: any) {
      if (e.message?.includes("relation") || e.message?.includes("does not exist")) {
        const users = await sql`SELECT * FROM users WHERE role = 'student' ORDER BY points DESC LIMIT 50`;
        return users.map((u: any, i: number) => ({ rank: i + 1, userId: u.id, name: u.name, avatarUrl: u.avatar_url || null, department: u.department || "", year: u.year || null, points: u.points, level: Math.floor(u.points / 100) + 1, streak: u.streak || 0, deltaRank: 0 }));
      }
      throw e;
    }
  });
}

async function handleActivity(req: Request): Promise<Response> {
  if (req.method === "POST") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const body = await req.json();
      const { minutes } = body;
      if (!minutes || minutes <= 0) throw Object.assign(new Error("Invalid minutes"), { status: 400 });
      const today = new Date().toISOString().split("T")[0];
      const [existing] = await sql`SELECT * FROM activity WHERE user_id = ${userId} AND date = ${today} LIMIT 1`;
      const earnedPoints = Math.floor(minutes / 10);
      if (existing) {
        const prevMinutes = existing.minutes_studied;
        await sql`UPDATE activity SET minutes_studied = minutes_studied + ${minutes}, points_earned = points_earned + ${earnedPoints} WHERE id = ${existing.id}`;
        await sql`UPDATE users SET points = points + ${earnedPoints} WHERE id = ${userId}`;
        if (existing.minutes_studied + minutes >= 60 && prevMinutes < 60) {
          await sql`INSERT INTO notifications (user_id, title, body, type) VALUES (${userId}, '⏰ ساعة مذاكرة!', 'وصلت لساعة مذاكرة اليوم. استمر!', 'success')`;
        }
        if (existing.minutes_studied + minutes >= 120 && prevMinutes < 120) {
          await sql`INSERT INTO notifications (user_id, title, body, type) VALUES (${userId}, '🔥 ساعتين مذاكرة!', 'يوم مميز! واصل التقدم.', 'success')`;
        }
        const [updated] = await sql`SELECT * FROM activity WHERE id = ${existing.id}`;
        return updated;
      }
      const [row] = await sql`INSERT INTO activity (user_id, date, minutes_studied, points_earned) VALUES (${userId}, ${today}, ${minutes}, ${earnedPoints}) RETURNING *`;
      await sql`UPDATE users SET points = points + ${earnedPoints} WHERE id = ${userId}`;
      if (minutes >= 30) {
        await sql`INSERT INTO notifications (user_id, title, body, type) VALUES (${userId}, '📚 مذاكرة مسجلة', ${`تم تسجيل ${minutes} دقيقة مذاكرة. حصلت على ${earnedPoints} نقطة.`}, 'info')`;
      }
      return row;
    });
  }
  return jsonError("Not Found", 404);
}

async function handleAchievements(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const me = await getCurrentUser(userId);
    if (!me) return [];
    const attempts = await sql`SELECT * FROM quiz_attempts WHERE user_id = ${me.id}`;
    const passes = attempts.filter((a: any) => a.total > 0 && a.score / a.total >= 0.8).length;
    const games = await sql`SELECT * FROM game_scores WHERE user_id = ${me.id}`;
    const followers = await sql`SELECT * FROM user_follows WHERE following_id = ${me.id}`;
    const lessons = await sql`SELECT * FROM skill_lessons WHERE completed = true`;
    const list = [
      { id: "quiz-passer-5", title: "ناجح متمكن", desc: "اجتز 5 اختبارات بنسبة 80%+", target: 5, value: passes, icon: "🎯" },
      { id: "quiz-passer-25", title: "خبير الاختبارات", desc: "اجتز 25 اختباراً بنسبة 80%+", target: 25, value: passes, icon: "🏆" },
      { id: "game-master-10", title: "لاعب متفان", desc: "العب 10 ألعاب", target: 10, value: games.length, icon: "🎮" },
      { id: "skill-builder-15", title: "صانع المهارات", desc: "أنجز 15 درس مهارة", target: 15, value: lessons.length, icon: "📚" },
      { id: "follower-10", title: "مؤثر صاعد", desc: "احصل على 10 متابعين", target: 10, value: followers.length, icon: "⭐" },
      { id: "points-500", title: "جامع النقاط", desc: "اجمع 500 نقطة", target: 500, value: me.points, icon: "💎" },
      { id: "level-5", title: "مستوى متقدم", desc: "وصول للمستوى 5", target: 5, value: me.level, icon: "🚀" },
    ];
    return list.map((a) => ({ ...a, completed: a.value >= a.target, percent: Math.min(100, Math.round((a.value / a.target) * 100)) }));
  });
}

async function handleGroupSchedule(req: Request, parts: string[]): Promise<Response> {
  const { userId } = requireAuth(req.headers);
  const user = await getCurrentUser(userId);
  const url = new URL(req.url, "http://localhost");

  if (req.method === "GET" && !parts[1]?.startsWith("admin")) {
    return handle(async () => {
      try {
        const group = url.searchParams.get("group") || user?.group_name;
        const year = Number(url.searchParams.get("year") || user?.year_in_college || 0);
        if (!group || !year) return [];
        const rows = await sql`SELECT * FROM group_schedule WHERE group_name = ${group} AND year_in_college = ${year}`;
        return rows.map((r: any) => ({ ...r, dayNumber: AR_DAY_TO_NUM[r.day] ?? 0 }));
      } catch (err) {
        console.error("handleGroupSchedule GET error:", err);
        return [];
      }
    });
  }

  // Admin routes
  requireRole(user, ["admin", "super_admin"]);
  if (req.method === "GET") {
    return handle(async () => {
      try {
        return await sql`SELECT * FROM group_schedule ORDER BY year_in_college, group_name, day`;
      } catch (err) {
        console.error("handleGroupSchedule admin GET error:", err);
        return [];
      }
    });
  }
  if (req.method === "POST") {
    return handle(async () => {
      const body = await req.json();
      const { groupName, yearInCollege, day, startTime, endTime, courseTitle, courseCode, instructor, room, type } = body;
      if (!groupName || !yearInCollege || !day || !startTime || !endTime || !courseTitle || !instructor || !room) throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
      const [r] = await sql`INSERT INTO group_schedule (group_name, year_in_college, day, start_time, end_time, course_title, course_code, instructor, room, type) VALUES (${groupName}, ${yearInCollege}, ${day}, ${startTime}, ${endTime}, ${courseTitle}, ${courseCode || null}, ${instructor}, ${room}, ${type || "lecture"}) RETURNING *`;
      return r;
    });
  }
  if (req.method === "DELETE") {
    return handle(async () => { await sql`DELETE FROM group_schedule WHERE id = ${Number(parts[2])}`; return { ok: true }; });
  }

  return jsonError("Not Found", 404);
}

async function handleExamSchedule(req: Request, parts: string[]): Promise<Response> {
  const { userId } = requireAuth(req.headers);
  const user = await getCurrentUser(userId);
  const url = new URL(req.url, "http://localhost");

  if (req.method === "GET" && !parts[1]?.startsWith("admin")) {
    return handle(async () => {
      try {
        const group = url.searchParams.get("group") || user?.group_name;
        const year = Number(url.searchParams.get("year") || user?.year_in_college || 0);
        if (!group || !year) return [];
        return await sql`SELECT * FROM exam_schedule WHERE group_name = ${group} AND year_in_college = ${year} ORDER BY date, time`;
      } catch (err) {
        console.error("handleExamSchedule GET error:", err);
        return [];
      }
    });
  }

  requireRole(user, ["admin", "super_admin"]);
  if (req.method === "GET") {
    return handle(async () => {
      try {
        return await sql`SELECT * FROM exam_schedule ORDER BY year_in_college, group_name, date`;
      } catch (err) {
        console.error("handleExamSchedule admin GET error:", err);
        return [];
      }
    });
  }
  if (req.method === "POST") {
    return handle(async () => {
      const body = await req.json();
      const { groupName, yearInCollege, day, date, time, courseTitle, courseCode, room, type } = body;
      if (!groupName || !yearInCollege || !day || !date || !time || !courseTitle || !room) throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
      const [r] = await sql`INSERT INTO exam_schedule (group_name, year_in_college, day, date, time, course_title, course_code, room, type) VALUES (${groupName}, ${yearInCollege}, ${day}, ${date}, ${time}, ${courseTitle}, ${courseCode || null}, ${room}, ${type || "midterm"}) RETURNING *`;
      return r;
    });
  }
  if (req.method === "DELETE") return handle(async () => { await sql`DELETE FROM exam_schedule WHERE id = ${Number(parts[2])}`; return { ok: true }; });
  return jsonError("Not Found", 404);
}

async function handleCourses(req: Request, parts: string[]): Promise<Response> {
  if (parts[2] && parts[3] === "materials") {
    return handle(async () => sql`SELECT * FROM materials WHERE course_id = ${Number(parts[2])} ORDER BY ord`);
  }
  if (parts[2] && parts[3] === "all-files") {
    return handle(async () => sql`SELECT * FROM material_files WHERE course_id = ${Number(parts[2])} ORDER BY created_at DESC`);
  }
  if (parts[2] && parts[3] === "lectures") {
    return handle(async () => {
      const courseId = Number(parts[2]);
      const lectures = await sql`SELECT * FROM lectures WHERE course_id = ${courseId} ORDER BY ord`;
      if (!lectures.length) return [];
      const lecIds = lectures.map((l: any) => l.id);
      const vids = await sql`SELECT * FROM lecture_videos WHERE lecture_id = ANY(${lecIds}) ORDER BY ord`;
      const quizzes = await sql`SELECT * FROM lecture_quizzes WHERE lecture_id = ANY(${lecIds})`;
      const quizQs = quizzes.length ? await sql`SELECT * FROM lecture_quiz_questions WHERE quiz_id = ANY(${quizzes.map((q: any) => q.id)}) ORDER BY ord` : [];
      const pdfs = await sql`SELECT * FROM lecture_pdfs WHERE lecture_id = ANY(${lecIds})`;
      return lectures.map((l: any) => ({
        id: l.id, courseId: l.course_id, title: l.title, type: l.type, ord: l.ord,
        videos: vids.filter((v: any) => v.lecture_id === l.id).map((v: any) => ({ id: v.id, lectureId: v.lecture_id, title: v.title, youtubeUrl: v.youtube_url, youtubeId: v.youtube_id, ord: v.ord })),
        quizzes: quizzes.filter((q: any) => q.lecture_id === l.id).map((q: any) => ({ id: q.id, lectureId: q.lecture_id, title: q.title, questions: quizQs.filter((qq: any) => qq.quiz_id === q.id).map((qq: any) => ({ id: qq.id, quizId: qq.quiz_id, text: qq.text, options: Array.isArray(qq.options) ? qq.options : (typeof qq.options === "string" ? JSON.parse(qq.options) : []), correctIndex: qq.correct_index, points: qq.points, ord: qq.ord })) })),
        pdfs: pdfs.filter((p: any) => p.lecture_id === l.id).map((p: any) => ({ id: p.id, lectureId: p.lecture_id, name: p.name, url: p.url, sizeBytes: p.size_bytes, materialFileId: p.material_file_id })),
      }));
    });
  }
  if (parts[2] && parts[3] === "video-progress") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const courseId = Number(parts[2]);
      const lectures = await sql`SELECT * FROM lectures WHERE course_id = ${courseId}`;
      if (!lectures.length) return [];
      const vids = await sql`SELECT * FROM lecture_videos WHERE lecture_id = ANY(${lectures.map((l: any) => l.id)})`;
      const prog = vids.length ? await sql`SELECT * FROM video_progress WHERE user_id = ${userId} AND video_id = ANY(${vids.map((v: any) => v.id)})` : [];
      const progMap = new Map(prog.map((p: any) => [p.video_id, p.completed]));
      return vids.map((v: any) => ({ videoId: v.id, completed: progMap.get(v.id) || false }));
    });
  }
  if (parts[2] && parts[3] === "progress") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const courseId = Number(parts[2]);
      const lectures = await sql`SELECT * FROM lectures WHERE course_id = ${courseId}`;
      if (!lectures.length) return { totalItems: 0, completedItems: 0, percent: 0, videos: [], quizzes: [] };
      const vids = await sql`SELECT * FROM lecture_videos WHERE lecture_id = ANY(${lectures.map((l: any) => l.id)})`;
      const quizzes = await sql`SELECT * FROM lecture_quizzes WHERE lecture_id = ANY(${lectures.map((l: any) => l.id)})`;
      const videoProg = vids.length ? await sql`SELECT * FROM video_progress WHERE user_id = ${userId} AND video_id = ANY(${vids.map((v: any) => v.id)})` : [];
      const quizAttemptsList = quizzes.length ? await sql`SELECT * FROM lecture_quiz_attempts WHERE user_id = ${userId} AND quiz_id = ANY(${quizzes.map((q: any) => q.id)})` : [];
      const videoMap = new Map(videoProg.map((p: any) => [p.video_id, p.completed]));
      const quizMap = new Map(quizAttemptsList.map((a: any) => [a.quiz_id, a.score / a.total >= 0.5]));
      const totalItems = vids.length + quizzes.length;
      const completedItems = vids.filter((v: any) => videoMap.get(v.id)).length + quizzes.filter((q: any) => quizMap.get(q.id)).length;
      return { totalItems, completedItems, percent: totalItems ? Math.round((completedItems / totalItems) * 100) : 0, videos: vids.map((v: any) => ({ id: v.id, completed: videoMap.get(v.id) || false })), quizzes: quizzes.map((q: any) => ({ id: q.id, completed: quizMap.get(q.id) || false })) };
    });
  }
  return jsonError("Not Found", 404);
}

async function handleAdminCrud(req: Request, parts: string[]): Promise<Response> {
  const { userId } = requireAuth(req.headers);
  const user = await getCurrentUser(userId);
  requireRole(user, ["admin", "super_admin"]);

  // Students list
  if (parts[2] === "students") {
    return handle(async () => {
      const rows = await sql`SELECT * FROM users WHERE role = 'student' ORDER BY points DESC`;
      return rows.map((u: any) => ({ ...u, lastSeen: u.last_seen?.toISOString(), createdAt: u.created_at?.toISOString() }));
    });
  }

  // Staff list
  if (parts[2] === "staff") {
    return handle(async () => {
      const rows = await sql`SELECT * FROM users WHERE role IN ('doctor', 'ta', 'admin', 'super_admin') ORDER BY role`;
      return rows.map((u: any) => ({ ...u, lastSeen: u.last_seen?.toISOString(), createdAt: u.created_at?.toISOString() }));
    });
  }

  // Delete user
  if (parts[2] === "users" && parts[4] === undefined && req.method === "DELETE") {
    return handle(async () => {
      ensureSuper(user);
      const id = Number(parts[3]);
      const [u] = await sql`SELECT * FROM users WHERE id = ${id}`;
      if (!u) throw Object.assign(new Error("المستخدم غير موجود"), { status: 404 });
      if (u.role === "super_admin") throw Object.assign(new Error("لا يمكن حذف سوبر أدمن"), { status: 400 });
      await sql`DELETE FROM users WHERE id = ${id}`;
      return { ok: true };
    });
  }

  // Grant points/title
  if (parts[2] === "users" && parts[4] === "grant") {
    return handle(async () => {
      const id = Number(parts[3]);
      const body = await req.json();
      const { points, title } = body;
      const [u] = await sql`SELECT * FROM users WHERE id = ${id}`;
      if (!u) throw Object.assign(new Error("الطالب غير موجود"), { status: 404 });
      const update: Record<string, unknown> = {};
      if (typeof points === "number") update.points = u.points + points;
      if (typeof title === "string" && title.trim()) update.title = title.trim();
      if (!Object.keys(update).length) throw Object.assign(new Error("لا توجد بيانات للتحديث"), { status: 400 });
      if (typeof points === "number") await sql`UPDATE users SET points = ${u.points + points} WHERE id = ${id}`;
      if (typeof title === "string" && title.trim()) await sql`UPDATE users SET title = ${title.trim()} WHERE id = ${id}`;
      const [updated] = await sql`SELECT * FROM users WHERE id = ${id}`;
      return { ...updated, lastSeen: updated.last_seen?.toISOString(), createdAt: updated.created_at?.toISOString() };
    });
  }

  // Student full profile
  if (parts[2] === "student" && parts[4] === "full") {
    return handle(async () => {
      const id = Number(parts[3]);
      const [userRow] = await sql`SELECT * FROM users WHERE id = ${id}`;
      if (!userRow) throw Object.assign(new Error("الطالب غير موجود"), { status: 404 });
      const grades = await sql`SELECT * FROM grades WHERE user_id = ${id}`;
      const attendance = await sql`SELECT * FROM attendance WHERE user_id = ${id}`;
      const schedule = await sql`SELECT * FROM schedule_items WHERE user_id = ${id}`;
      const activity = await sql`SELECT * FROM activity WHERE user_id = ${id}`;
      return { user: { ...userRow, lastSeen: userRow.last_seen?.toISOString(), createdAt: userRow.created_at?.toISOString() }, grades, attendance, schedule, activity };
    });
  }

  // Talents moderation
  if (parts[2] === "talents") {
    if (req.method === "GET") {
      return handle(async () => {
        const rows = await sql`SELECT * FROM talents ORDER BY created_at DESC`;
        const ownerIds = Array.from(new Set(rows.map((t: any) => t.owner_id)));
        const owners = ownerIds.length ? await sql`SELECT * FROM users WHERE id = ANY(${ownerIds})` : [];
        const byId = new Map(owners.map((u: any) => [u.id, u]));
        return rows.map((t: any) => ({ ...t, createdAt: t.created_at?.toISOString(), ownerName: byId.get(t.owner_id)?.name, ownerGroup: byId.get(t.owner_id)?.group_name }));
      });
    }
    if (req.method === "DELETE") {
      return handle(async () => { await sql`DELETE FROM talents WHERE id = ${Number(parts[3])}`; return { ok: true }; });
    }
  }

  // Delete talent comment
  if (parts[2] === "talent-comments") {
    return handle(async () => { await sql`DELETE FROM talent_comments WHERE id = ${Number(parts[3])}`; return { ok: true }; });
  }

  // Delete material comment
  if (parts[2] === "material-comments") {
    return handle(async () => { await sql`DELETE FROM material_file_comments WHERE id = ${Number(parts[3])}`; return { ok: true }; });
  }

  // All quizzes
  if (parts[2] === "all-quizzes") {
    return handle(async () => {
      const all = await sql`SELECT * FROM quizzes ORDER BY created_at DESC`;
      const counts = await sql`SELECT quiz_id, COUNT(*)::int AS c FROM quiz_attempts GROUP BY quiz_id`;
      const map = new Map<number, number>(counts.map((r: any) => [Number(r.quiz_id), Number(r.c)]));
      return all.map((q: any) => ({ ...q, createdAt: q.created_at?.toISOString(), attemptsCount: map.get(q.id) ?? 0 }));
    });
  }

  // All courses
  if (parts[2] === "all-courses") {
    return handle(async () => sql`SELECT * FROM courses ORDER BY code`);
  }

  // All materials
  if (parts[2] === "all-materials") {
    return handle(async () => sql`SELECT * FROM materials ORDER BY course_id`);
  }

  // Admin DM threads
  if (parts[2] === "dm") {
    if (parts[3] === "threads" && !parts[4]) {
      return handle(async () => {
        try {
          const threads = await sql`SELECT * FROM dm_threads ORDER BY last_message_at DESC`;
          if (!threads.length) return [];
          const allUserIds = new Set<number>();
          threads.forEach((t: any) => { allUserIds.add(t.user_a_id); allUserIds.add(t.user_b_id); });
          const users = await sql`SELECT * FROM users WHERE id = ANY(${Array.from(allUserIds)})`;
          const byId = new Map(users.map((u: any) => [u.id, u]));
          const lastMsgs = await sql`SELECT * FROM dm_messages WHERE thread_id = ANY(${threads.map((t: any) => t.id)})`;
          return threads.map((t: any) => {
            const userA = byId.get(t.user_a_id);
            const userB = byId.get(t.user_b_id);
            const msgs = lastMsgs.filter((m: any) => m.thread_id === t.id).sort((a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at));
            const last = msgs[0];
            return {
              threadId: t.id, userA: userA ? { id: userA.id, name: userA.name, avatarUrl: userA.avatar_url, role: userA.role } : null,
              userB: userB ? { id: userB.id, name: userB.name, avatarUrl: userB.avatar_url, role: userB.role } : null,
              lastMessage: last ? { body: last.body, createdAt: last.created_at?.toISOString(), fromId: last.from_id } : null,
              totalMessages: msgs.length, lastMessageAt: t.last_message_at?.toISOString(),
            };
          });
        } catch (err) {
          console.error("handleAdminCrud dm threads error:", err);
          return [];
        }
      });
    }
    if (parts[3] === "threads" && parts[4]) {
      return handle(async () => {
        try {
          const threadId = Number(parts[4]);
          const [thread] = await sql`SELECT * FROM dm_threads WHERE id = ${threadId}`;
          if (!thread) throw Object.assign(new Error("المحادثة غير موجودة"), { status: 404 });
          const msgs = await sql`SELECT * FROM dm_messages WHERE thread_id = ${threadId} ORDER BY created_at`;
          const allUserIds = new Set<number>([thread.user_a_id, thread.user_b_id, ...msgs.map((m: any) => m.from_id)]);
          const users = await sql`SELECT * FROM users WHERE id = ANY(${Array.from(allUserIds)})`;
          const byId = new Map(users.map((u: any) => [u.id, u]));
          return {
            threadId: thread.id, userA: byId.get(thread.user_a_id) ? { id: byId.get(thread.user_a_id).id, name: byId.get(thread.user_a_id).name, avatarUrl: byId.get(thread.user_a_id).avatar_url, role: byId.get(thread.user_a_id).role } : null,
            userB: byId.get(thread.user_b_id) ? { id: byId.get(thread.user_b_id).id, name: byId.get(thread.user_b_id).name, avatarUrl: byId.get(thread.user_b_id).avatar_url, role: byId.get(thread.user_b_id).role } : null,
            messages: msgs.map((m: any) => ({ ...m, createdAt: m.created_at?.toISOString(), fromName: byId.get(m.from_id)?.name || "مستخدم محذوف", fromAvatar: byId.get(m.from_id)?.avatar_url })),
          };
        } catch (err) {
          console.error("handleAdminCrud dm thread detail error:", err);
          return { threadId: Number(parts[4]), messages: [], userA: null, userB: null };
        }
      });
    }
  }

  // Admin lectures
  if (parts[2] === "courses" && parts[4] === "lectures" && req.method === "POST") {
    return handle(async () => {
      const courseId = Number(parts[3]);
      const body = await req.json();
      const { title, type, ord } = body;
      if (!title) throw Object.assign(new Error("العنوان مطلوب"), { status: 400 });
      const [maxOrd] = await sql`SELECT MAX(ord) AS max FROM lectures WHERE course_id = ${courseId}`;
      const [l] = await sql`INSERT INTO lectures (course_id, title, type, ord) VALUES (${courseId}, ${title}, ${type || "lecture"}, ${ord ?? (maxOrd?.max ?? 0) + 1}) RETURNING *`;
      return l;
    });
  }

  if (parts[2] === "lectures" && parts[3] && !parts[4]) {
    if (req.method === "PATCH") {
      return handle(async () => {
        const id = Number(parts[3]);
        const body = await req.json();
        const { title, ord } = body;
        await sql`UPDATE lectures SET title = COALESCE(${title}, title), ord = COALESCE(${ord}, ord) WHERE id = ${id}`;
        return { ok: true };
      });
    }
    if (req.method === "DELETE") {
      return handle(async () => { await sql`DELETE FROM lectures WHERE id = ${Number(parts[3])}`; return { ok: true }; });
    }
  }

  // Admin videos
  if (parts[2] === "lectures" && parts[4] === "videos" && req.method === "POST") {
    return handle(async () => {
      const lectureId = Number(parts[3]);
      const body = await req.json();
      const { title, youtubeUrl, ord } = body;
      if (!title || !youtubeUrl) throw Object.assign(new Error("العنوان ورابط يوتيوب مطلوب"), { status: 400 });
      const ytId = extractYoutubeId(youtubeUrl);
      if (!ytId) throw Object.assign(new Error("رابط يوتيوب غير صالح"), { status: 400 });
      const [maxOrd] = await sql`SELECT MAX(ord) AS max FROM lecture_videos WHERE lecture_id = ${lectureId}`;
      const [v] = await sql`INSERT INTO lecture_videos (lecture_id, title, youtube_url, youtube_id, ord) VALUES (${lectureId}, ${title}, ${youtubeUrl}, ${ytId}, ${ord ?? (maxOrd?.max ?? 0) + 1}) RETURNING *`;
      return v;
    });
  }

  if (parts[2] === "videos" && req.method === "DELETE") {
    return handle(async () => { await sql`DELETE FROM lecture_videos WHERE id = ${Number(parts[3])}`; return { ok: true }; });
  }

  // Admin PDFs
  if (parts[2] === "lectures" && parts[4] === "pdfs" && req.method === "POST") {
    return handle(async () => {
      const lectureId = Number(parts[3]);
      const body = await req.json();
      const { name, url, sizeBytes } = body;
      if (!name || !url) throw Object.assign(new Error("الاسم والرابط مطلوب"), { status: 400 });
      const [lec] = await sql`SELECT * FROM lectures WHERE id = ${lectureId}`;
      if (!lec) throw Object.assign(new Error("المحاضرة غير موجودة"), { status: 404 });
      const [meUser] = await sql`SELECT * FROM users WHERE id = ${userId}`;
      const [mf] = await sql`INSERT INTO material_files (material_id, course_id, name, kind, url, size_bytes, uploaded_by_id, uploaded_by_name) VALUES (NULL, ${lec.course_id}, ${name}, 'pdf', ${url}, ${sizeBytes || 0}, ${userId}, ${meUser.name}) RETURNING *`;
      const [p] = await sql`INSERT INTO lecture_pdfs (lecture_id, name, url, size_bytes, material_file_id) VALUES (${lectureId}, ${name}, ${url}, ${sizeBytes || 0}, ${mf.id}) RETURNING *`;
      return { ...p, materialFileId: mf.id };
    });
  }

  if (parts[2] === "lecture-pdfs" && req.method === "DELETE") {
    return handle(async () => {
      const id = Number(parts[3]);
      const [p] = await sql`SELECT * FROM lecture_pdfs WHERE id = ${id}`;
      if (!p) throw Object.assign(new Error("الملف غير موجود"), { status: 404 });
      if (p.material_file_id) await sql`DELETE FROM material_files WHERE id = ${p.material_file_id}`;
      await sql`DELETE FROM lecture_pdfs WHERE id = ${id}`;
      return { ok: true };
    });
  }

  // Admin lecture quizzes
  if (parts[2] === "lectures" && parts[4] === "quizzes" && req.method === "POST") {
    return handle(async () => {
      const lectureId = Number(parts[3]);
      const body = await req.json();
      const { title, questions } = body;
      if (!title) throw Object.assign(new Error("العنوان مطلوب"), { status: 400 });
      const [q] = await sql`INSERT INTO lecture_quizzes (lecture_id, title) VALUES (${lectureId}, ${title}) RETURNING *`;
      if (questions?.length) {
        for (const qq of questions) {
          await sql`INSERT INTO lecture_quiz_questions (quiz_id, text, options, correct_index, points, ord) VALUES (${q.id}, ${qq.text}, ${qq.options}, ${qq.correctIndex}, ${qq.points ?? 1}, ${qq.ord ?? 0})`;
        }
      }
      return { ...q, questions: questions || [] };
    });
  }

  if (parts[2] === "lecture-quizzes" && req.method === "DELETE") {
    return handle(async () => { await sql`DELETE FROM lecture_quizzes WHERE id = ${Number(parts[3])}`; return { ok: true }; });
  }

  if (parts[2] === "lecture-quizzes" && parts[4] === "questions" && req.method === "POST") {
    return handle(async () => {
      try {
        await sql`CREATE TABLE IF NOT EXISTS lecture_quiz_questions (id SERIAL PRIMARY KEY, quiz_id INT, text TEXT, options TEXT[], correct_index INT, points INT, ord INT)`;
      } catch {}
      const quizId = Number(parts[3]);
      const body = await req.json();
      const { text, options, correctIndex, points } = body;
      if (!text || !options || typeof correctIndex !== "number") throw Object.assign(new Error("بيانات السؤال ناقصة"), { status: 400 });
      let ord = 1;
      try {
        const [r] = await sql`SELECT COALESCE(MAX(ord), 0) AS n FROM lecture_quiz_questions WHERE quiz_id = ${quizId}`;
        ord = (r?.n ?? 0) + 1;
      } catch {}
      try {
        const [qq] = await sql`INSERT INTO lecture_quiz_questions (quiz_id, text, options, correct_index, points, ord) VALUES (${quizId}, ${text}, ${options}, ${correctIndex}, ${points ?? 10}, ${ord}) RETURNING *`;
        return qq;
      } catch (err: any) {
        console.error("🔴 lecture_quiz_questions INSERT error:", err?.message);
        throw Object.assign(new Error(err?.message || "فشل إضافة السؤال"), { status: 500 });
      }
    });
  }

  if (parts[2] === "lecture-quizzes" && parts[4] === "questions" && req.method === "GET") {
    return handle(async () => sql`SELECT * FROM lecture_quiz_questions WHERE quiz_id = ${Number(parts[3])} ORDER BY ord`);
  }

  if (parts[2] === "lecture-quiz-questions" && req.method === "DELETE") {
    return handle(async () => { await sql`DELETE FROM lecture_quiz_questions WHERE id = ${Number(parts[3])}`; return { ok: true }; });
  }

  // Admin materials CRUD
  if (parts[2] === "materials") {
    if (req.method === "POST") {
      return handle(async () => {
        const body = await req.json();
        const { courseId, title, kind, url, lecturer, durationMinutes, ord } = body;
        if (!courseId || !title || !kind) throw Object.assign(new Error("المقرر والعنوان والنوع مطلوبة"), { status: 400 });
        const [f] = await sql`INSERT INTO materials (course_id, title, kind, url, lecturer, duration_minutes, ord) VALUES (${courseId}, ${title}, ${kind}, ${url || ""}, ${lecturer || null}, ${durationMinutes || null}, ${ord || 0}) RETURNING *`;
        return f;
      });
    }
    if (req.method === "PATCH" && parts[3]) {
      return handle(async () => {
        const id = Number(parts[3]);
        const body = await req.json();
        const { title, kind, lecturer, durationMinutes, ord } = body;
        const [existing] = await sql`SELECT * FROM materials WHERE id = ${id}`;
        if (!existing) throw Object.assign(new Error("المادة غير موجودة"), { status: 404 });
        const [updated] = await sql`UPDATE materials SET title = COALESCE(${title}, title), kind = COALESCE(${kind}, kind), lecturer = COALESCE(${lecturer}, lecturer), duration_minutes = COALESCE(${durationMinutes}, duration_minutes), ord = COALESCE(${ord}, ord) WHERE id = ${id} RETURNING *`;
        return updated;
      });
    }
    if (req.method === "DELETE" && parts[3]) {
      return handle(async () => {
        const [existing] = await sql`SELECT * FROM materials WHERE id = ${Number(parts[3])}`;
        if (!existing) throw Object.assign(new Error("المادة غير موجودة"), { status: 404 });
        await sql`DELETE FROM materials WHERE id = ${Number(parts[3])}`;
        return { ok: true };
      });
    }
    // Material files
    if (parts[4] === "files" && req.method === "POST") {
      return handle(async () => {
        const id = Number(parts[3]);
        const body = await req.json();
        const { name, kind, url, sizeBytes } = body;
        if (!name || !url) throw Object.assign(new Error("name و url مطلوبان"), { status: 400 });
        const [mat] = await sql`SELECT * FROM materials WHERE id = ${id}`;
        if (!mat) throw Object.assign(new Error("المادة غير موجودة"), { status: 404 });
        const [meUser] = await sql`SELECT * FROM users WHERE id = ${userId}`;
        const [f] = await sql`INSERT INTO material_files (material_id, course_id, name, kind, url, size_bytes, uploaded_by_id, uploaded_by_name) VALUES (${id}, ${mat.course_id}, ${name}, ${kind || "pdf"}, ${url}, ${sizeBytes || 0}, ${userId}, ${meUser.name}) RETURNING *`;
        return f;
      });
    }
  }

  if (parts[2] === "material-files" && req.method === "DELETE") {
    return handle(async () => { await sql`DELETE FROM material_files WHERE id = ${Number(parts[3])}`; return { ok: true }; });
  }

  // Admin staff delete
  if (parts[2] === "staff" && req.method === "DELETE") {
    return handle(async () => {
      ensureSuper(user);
      const id = Number(parts[3]);
      const [u] = await sql`SELECT * FROM users WHERE id = ${id}`;
      if (!u) throw Object.assign(new Error("غير موجود"), { status: 404 });
      if (u.role === "super_admin") throw Object.assign(new Error("لا يمكن حذف سوبر أدمن"), { status: 400 });
      await sql`DELETE FROM users WHERE id = ${id}`;
      return { ok: true };
    });
  }

  // Admin forum moderation
  if (parts[1] === "forum" && parts[2] === "posts" && req.method === "DELETE") {
    return handle(async () => {
      await sql`DELETE FROM forum_posts WHERE id = ${Number(parts[3])}`;
      return { ok: true };
    });
  }

  if (parts[1] === "forum" && parts[2] === "replies" && req.method === "DELETE") {
    return handle(async () => {
      await sql`DELETE FROM forum_replies WHERE id = ${Number(parts[3])}`;
      return { ok: true };
    });
  }

  return jsonError("Not Found", 404);
}

async function handleMaterialFiles(req: Request, parts: string[]): Promise<Response> {
  if (parts[2]) {
    return handle(async () => sql`SELECT * FROM material_files WHERE material_id = ${Number(parts[2])} ORDER BY created_at DESC`);
  }
  return jsonError("Not Found", 404);
}

async function handleLectureQuizSubmit(req: Request, parts: string[]): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const quizId = Number(parts[2]);
    const body = await req.json();
    const { answers } = body;
    if (!answers) throw Object.assign(new Error("الإجابات مطلوبة"), { status: 400 });
    const questions = await sql`SELECT * FROM lecture_quiz_questions WHERE quiz_id = ${quizId}`;
    let score = 0, total = 0;
    const details: any[] = [];
    const ansArr: string[] = [];
    for (const qq of questions) {
      total += qq.points;
      const a = answers.find((x: any) => x.questionId === qq.id);
      const chosen = a?.chosenIndex ?? -1;
      const correct = chosen === qq.correct_index;
      if (correct) score += qq.points;
      ansArr.push(`${qq.id}:${chosen}`);
      details.push({
        questionId: qq.id, text: qq.text, options: qq.options,
        correctIndex: qq.correct_index, points: qq.points,
        userChosen: chosen, correct, explanation: qq.explanation || "",
      });
    }
    const existing = await sql`SELECT * FROM lecture_quiz_attempts WHERE user_id = ${userId} AND quiz_id = ${quizId}`;
    if (existing.length) {
      await sql`UPDATE lecture_quiz_attempts SET score = ${score}, total = ${total}, answers = ${ansArr}, completed_at = ${new Date()} WHERE id = ${existing[0].id}`;
    } else {
      try {
        await sql`INSERT INTO lecture_quiz_attempts (user_id, quiz_id, score, total, answers) VALUES (${userId}, ${quizId}, ${score}, ${total}, ${ansArr})`;
      } catch (e: any) {
        if (e?.message?.includes("relation") || e?.message?.includes("does not exist")) {
          await sql`CREATE TABLE IF NOT EXISTS lecture_quiz_attempts (id SERIAL PRIMARY KEY, user_id INT, quiz_id INT, score INT, total INT, answers text[], completed_at TIMESTAMP DEFAULT now())`;
          await sql`INSERT INTO lecture_quiz_attempts (user_id, quiz_id, score, total, answers) VALUES (${userId}, ${quizId}, ${score}, ${total}, ${ansArr})`;
        } else {
          throw e;
        }
      }
    }
    await sql`UPDATE users SET points = points + ${score} WHERE id = ${userId}`;
    return { score, total, passed: score / total >= 0.5, details };
  });
}

async function handleLectureQuizAttempts(req: Request, parts: string[]): Promise<Response> {
  return handle(async () => {
    const quizId = Number(parts[2]);
    const attempts = await sql`SELECT * FROM lecture_quiz_attempts WHERE quiz_id = ${quizId} ORDER BY score DESC, completed_at DESC`;
    const userIds = Array.from(new Set(attempts.map((a: any) => a.user_id)));
    const users = userIds.length ? await sql`SELECT * FROM users WHERE id = ANY(${userIds})` : [];
    const byId = new Map(users.map((u: any) => [u.id, u]));
    return attempts.map((a: any) => ({
      ...a, completedAt: a.completed_at?.toISOString(),
      userName: byId.get(a.user_id)?.name, userAvatar: byId.get(a.user_id)?.avatar_url,
      userGroup: byId.get(a.user_id)?.group_name,
    }));
  });
}

async function handleVideoWatch(req: Request, parts: string[]): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const videoId = Number(parts[2]);
    const existing = await sql`SELECT * FROM video_progress WHERE user_id = ${userId} AND video_id = ${videoId}`;
    if (existing.length) {
      await sql`UPDATE video_progress SET completed = true, watched_at = ${new Date()} WHERE id = ${existing[0].id}`;
    } else {
      await sql`INSERT INTO video_progress (user_id, video_id, completed) VALUES (${userId}, ${videoId}, true)`;
    }
    const [vid] = await sql`SELECT * FROM lecture_videos WHERE id = ${videoId}`;
    if (vid) {
      const [lec] = await sql`SELECT * FROM lectures WHERE id = ${vid.lecture_id}`;
      if (lec) {
        const allVids = await sql`SELECT * FROM lecture_videos WHERE lecture_id IN (SELECT id FROM lectures WHERE course_id = ${lec.course_id})`;
        const completedVids = await sql`SELECT * FROM video_progress WHERE user_id = ${userId} AND video_id = ANY(${allVids.map((v: any) => v.id)}) AND completed = true`;
        const progress = allVids.length ? (completedVids.length / allVids.length) * 100 : 0;
        await sql`UPDATE courses SET progress = LEAST(100, ${progress}) WHERE id = ${lec.course_id}`;
      }
    }
    return { ok: true, completed: true };
  });
}

async function handleQuizById(quizId: number): Promise<Response> {
  return handle(async () => {
    const [q] = await sql`SELECT * FROM quizzes WHERE id = ${quizId}`;
    if (!q) throw Object.assign(new Error("الاختبار غير موجود"), { status: 404 });
    const questions = await sql`SELECT * FROM quiz_questions WHERE quiz_id = ${quizId} ORDER BY ord`;
    return { ...q, createdAt: q.created_at?.toISOString(), questions };
  });
}

async function handleMissions(req: Request, parts: string[]): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    if (!parts[1]) {
      const quizzes = await sql`SELECT * FROM quizzes WHERE is_open = true ORDER BY created_at DESC LIMIT 20`;
      return quizzes.map((q: any) => ({
        id: q.id, title: q.title, description: q.description || "",
        points: q.total_points || 100, deadline: null, completed: false,
      }));
    }
    if (parts[2] === "complete") {
      const missionId = Number(parts[1]);
      return { ok: true };
    }
    return jsonError("Not Found", 404);
  });
}

async function handleComplaints(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const body = await req.json();
    const { title, body: msgBody, category } = body;
    if (!title || !msgBody) throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
    await sql`INSERT INTO complaints (user_id, title, body, category) VALUES (${userId}, ${title}, ${msgBody}, ${category || "عام"})`;
    return { ok: true };
  });
}

async function handleAiChat(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const body = await req.json();
    const { messages } = body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) throw Object.assign(new Error("الرسائل مطلوبة"), { status: 400 });

    let siteData = "أنت مساعد UniVerse الذكي — منصة طلاب كلية الزراعة. أجب بالعربية.";
    let meData: any = {};
    try {
      const [u] = await sql`SELECT name, year_in_college, specialization, group_name, points FROM users WHERE id = ${userId}`;
      meData = u || {};
      siteData += `\n\nبيانات الطالب:\n- الاسم: ${meData.name || ""}\n- السنة: ${meData.year_in_college || ""}\n- التخصص: ${meData.specialization || ""}`;
    } catch (e) { console.error("[AiChat] user query", e); }

    try {
      const courses = await sql`SELECT id, title, code, description, credits, department, instructor FROM courses ORDER BY code`;
      siteData += `\n\nالمقررات (${courses.length}):\n${courses.map((c: any) => `- ${c.code}: ${c.title} (${c.credits} ساعات) - ${c.department} - د. ${c.instructor}${c.description ? ": " + c.description : ""}`).join("\n")}`;
    } catch (e) { console.error("[AiChat] courses query", e); }

    try {
      const news = await sql`SELECT title, category, body, published_at FROM news WHERE status = 'published' ORDER BY published_at DESC LIMIT 10`;
      siteData += `\n\nأخبار:\n${news.map((n: any) => `- ${n.title} (${n.category})${n.body ? ": " + n.body.slice(0, 100) : ""}`).join("\n") || "لا يوجد"}`;
    } catch (e) { console.error("[AiChat] news query", e); }

    try {
      const events = await sql`SELECT title, description, event_date, location FROM events WHERE event_date >= now() ORDER BY event_date LIMIT 10`;
      siteData += `\n\nأحداث قادمة:\n${events.map((e: any) => `- ${e.title}${e.event_date ? " - " + new Date(e.event_date).toLocaleDateString("ar-EG") : ""}${e.location ? " - " + e.location : ""}`).join("\n") || "لا يوجد"}`;
    } catch (e) { console.error("[AiChat] events query", e); }

    try {
      const quizzes = await sql`SELECT q.id, q.title, q.description, q.course_id, q.is_open, q.due_date, c.title AS course_title FROM quizzes q JOIN courses c ON c.id = q.course_id WHERE q.is_open = true LIMIT 20`;
      siteData += `\n\nالاختبارات المفتوحة:\n${quizzes.map((q: any) => `- ${q.title} (مقرر: ${q.course_title})${q.description ? ": " + q.description.slice(0, 100) : ""}${q.due_date ? " - يسلم: " + new Date(q.due_date).toLocaleDateString("ar-EG") : ""}`).join("\n") || "لا يوجد"}`;
    } catch (e) { console.error("[AiChat] quizzes query", e); }

    try {
      const schedule = await sql`SELECT day_number, start_time, end_time, course_title, instructor, room, type FROM group_schedule WHERE group_name = ${meData.group_name || ""} ORDER BY day_number, start_time`;
      siteData += `\n\nجدول المحاضرات (المجموعة: ${meData.group_name || ""}):\n${schedule.map((s: any) => `- اليوم ${s.day_number}: ${(s.start_time || "").slice(0, 5)}-${(s.end_time || "").slice(0, 5)} ${s.course_title} (${s.type})${s.room ? " - " + s.room : ""}${s.instructor ? " - " + s.instructor : ""}`).join("\n") || "لا يوجد جدول"}`;
    } catch (e) { console.error("[AiChat] schedule query", e); }

    try {
      const materials = await sql`SELECT title, description, course_id, file_type, c.title AS course_title FROM materials m JOIN courses c ON c.id = m.course_id ORDER BY m.created_at DESC LIMIT 10`;
      siteData += `\n\nالملفات الدراسية:\n${materials.map((m: any) => `- ${m.title} (${m.course_title})${m.file_type ? " - " + m.file_type : ""}`).join("\n") || "لا يوجد"}`;
    } catch (e) { console.error("[AiChat] materials query", e); }

    const lastMsg = messages[messages.length - 1]?.content || "";

    try {
      const openRouterKey = process.env.OPENROUTER_API_KEY;
      if (!openRouterKey) throw new Error("OPENROUTER_API_KEY not configured");
      const filtered = messages[0]?.role === "assistant" ? messages.slice(1) : messages;
      const openRouterMessages = filtered.map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content || "",
      }));
      if (openRouterMessages.length === 0) throw new Error("no user message");

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openRouterKey}`,
          "HTTP-Referer": "https://unv-api.vercel.app",
          "X-Title": "UniVerse",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-lite-001",
          messages: [
            { role: "system", content: siteData },
            ...openRouterMessages,
          ],
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      if (res.ok) {
        const data: any = await res.json();
        const reply = data.choices?.[0]?.message?.content || "";
        if (reply) return { reply, suggestions: generateSuggestions(lastMsg) };
      } else {
        console.error("[OpenRouter]", res.status, (await res.text().catch(() => "")).slice(0, 200));
      }
    } catch (e) {
      console.error("[AiChat]", e);
    }

    return { reply: "أهلاً! أنا مساعد UniVerse. اسألني عن المقررات أو الأخبار.", suggestions: generateSuggestions(lastMsg) };
  });
}

function generateSuggestions(lastMsg: string): string[] {
  const lower = lastMsg.toLowerCase();
  if (lower.includes("تمثيل") || lower.includes("ضوئ") || lower.includes("photosynthesis"))
    return ["ازاي التمثيل الضوئي بيحصل في الليل؟", "الفرق بين C3 و C4", "أهم معادلات التمثيل الضوئي"];
  if (lower.includes("تربة") || lower.includes("soil"))
    return ["أنواع التربة", "تحسين خصوبة التربة", "ري التربة"];
  if (lower.includes("امتحان") || lower.includes("مذاكرة") || lower.includes("study") || lower.includes("exam"))
    return ["جدول مذاكرة فعال", "طرق تثبيت المعلومات", "أهم الأسئلة المتوقعة"];
  if (lower.includes("نبات") || lower.includes("زراع") || lower.includes("crop"))
    return ["أمراض النباتات الشائعة", "طرق التسميد", "مواسم الزراعة"];
  if (lower.includes("حيوان") || lower.includes("animal"))
    return ["تغذية الحيوان", "أمراض الماشية", "إنتاج الألبان"];
  return ["اسألني عن أي مادة زراعية", "ازاكر امتحان النباتات ازاي؟", "نصائح للمذاكرة الفعالة", "شرح التمثيل الضوئي"];
}

async function handleStaffDoctors(): Promise<Response> {
  return handle(async () => {
    const rows = await sql`SELECT * FROM users WHERE role IN ('doctor', 'ta') ORDER BY name`;
    return rows.map((u: any) => ({
      id: u.id, name: u.name, role: u.role, department: u.department,
      avatarUrl: u.avatar_url, title: u.title || "عضو هيئة تدريس",
    }));
  });
}

async function handleStaff(req: Request, parts: string[]): Promise<Response> {
  if (req.method === "GET" && parts[1] && !isNaN(Number(parts[1]))) {
    return handle(async () => {
      const id = Number(parts[1]);
      const [u] = await sql`SELECT * FROM users WHERE id = ${id} AND role IN ('doctor', 'ta', 'admin', 'super_admin')`;
      if (!u) throw Object.assign(new Error("عضو الهيئة غير موجود"), { status: 404 });
      return {
        ...u,
        lastSeen: u.last_seen?.toISOString(),
        createdAt: u.created_at?.toISOString(),
        researchInterests: u.research_interests ?? [],
        officeHours: u.office_hours ?? null,
        bio: u.bio ?? null,
      };
    });
  }

  if (req.method === "GET") {
    return handle(async () => {
      try {
        requireAuth(req.headers);
        const rows = await sql`SELECT * FROM users WHERE role IN ('doctor', 'ta', 'admin', 'super_admin') ORDER BY role, name`;
        return rows.map((u: any) => ({
          ...u, lastSeen: u.last_seen?.toISOString(), createdAt: u.created_at?.toISOString(),
        }));
      } catch (err) {
        console.error("handleStaff GET error:", err);
        throw err;
      }
    });
  }

  if (req.method === "POST") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const user = await getCurrentUser(userId);
      requireRole(user, ["admin", "super_admin"]);
      const body = await req.json();
      const { name, email, phone, role, department, title, avatarUrl, bio, username, password } = body;
      if (!name || !email || !role) throw Object.assign(new Error("الاسم والبريد والدور مطلوب"), { status: 400 });
      const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
      const defaultUsername = (username || name).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30) || `user_${Date.now()}`;
      let uniqueCode = generateUniqueCode();
      let codeExists = true;
      while (codeExists) {
        const [existing] = await sql`SELECT id FROM users WHERE unique_code = ${uniqueCode} LIMIT 1`;
        if (!existing) codeExists = false;
        else uniqueCode = generateUniqueCode();
      }
      const [u] = await sql`
        INSERT INTO users (name, email, phone, role, department, title, avatar_url, bio, username, password, unique_code, email_verified, phone_verified)
        VALUES (${name}, ${email}, ${phone || null}, ${role}, ${department || null}, ${title || null}, ${avatarUrl || null}, ${bio || null}, ${defaultUsername}, ${hashedPassword}, ${uniqueCode}, true, true)
        RETURNING *`;
      return { ...u, lastSeen: u.last_seen?.toISOString(), createdAt: u.created_at?.toISOString() };
    });
  }

  if (req.method === "PATCH" && parts[2]) {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const user = await getCurrentUser(userId);
      requireRole(user, ["admin", "super_admin"]);
      const id = Number(parts[2]);
      const body = await req.json();
      const { name, phone, department, title, avatarUrl, bio, username } = body;
      if (name !== undefined) await sql`UPDATE users SET name = ${name} WHERE id = ${id}`;
      if (phone !== undefined) await sql`UPDATE users SET phone = ${phone} WHERE id = ${id}`;
      if (department !== undefined) await sql`UPDATE users SET department = ${department} WHERE id = ${id}`;
      if (title !== undefined) await sql`UPDATE users SET title = ${title} WHERE id = ${id}`;
      if (avatarUrl !== undefined) await sql`UPDATE users SET avatar_url = ${avatarUrl} WHERE id = ${id}`;
      if (bio !== undefined) await sql`UPDATE users SET bio = ${bio} WHERE id = ${id}`;
      if (username !== undefined) await sql`UPDATE users SET username = ${username} WHERE id = ${id}`;
      const [updated] = await sql`SELECT * FROM users WHERE id = ${id}`;
      return { ...updated, lastSeen: updated.last_seen?.toISOString(), createdAt: updated.created_at?.toISOString() };
    });
  }

  return jsonError("Not Found", 404);
}

async function handleCoursesList(): Promise<Response> {
  return handle(async () => {
    const rows = await sql`SELECT * FROM courses ORDER BY code`;
    return rows.map((c: any) => ({
      id: c.id, title: c.title, code: c.code, description: c.description,
      credits: c.credits, department: c.department, instructor: c.instructor,
      coverUrl: c.cover_url, progress: c.progress, enrolled: c.enrolled,
    }));
  });
}

async function handleCourseById(id: string): Promise<Response> {
  return handle(async () => {
    const [c] = await sql`SELECT * FROM courses WHERE id = ${Number(id)} LIMIT 1`;
    if (!c) throw Object.assign(new Error("Course not found"), { status: 404 });
    const materials = await sql`SELECT * FROM materials WHERE course_id = ${c.id} ORDER BY ord`;
    return {
      id: c.id, title: c.title, code: c.code, description: c.description,
      credits: c.credits, department: c.department, instructor: c.instructor,
      coverUrl: c.cover_url, progress: c.progress, enrolled: c.enrolled,
      instructorBio: c.instructor_bio, syllabus: c.syllabus ?? [],
      materials: materials.map((m: any) => ({
        id: m.id, title: m.title, kind: m.kind, url: m.url, durationMinutes: m.duration_minutes,
      })),
    };
  });
}

async function handleMaterialFileRoutes(req: Request, parts: string[]): Promise<Response> {
  if (req.method === "GET" && parts[1] && !parts[2]) {
    return handle(async () => {
      const [f] = await sql`SELECT * FROM material_files WHERE id = ${Number(parts[1])}`;
      if (!f) throw Object.assign(new Error("File not found"), { status: 404 });
      const { userId } = requireAuth(req.headers);
      const [me] = await sql`SELECT * FROM users WHERE id = ${userId}`;
      const [{ liked }] = await sql`SELECT COUNT(*)::int AS liked FROM material_file_likes WHERE file_id = ${f.id} AND user_id = ${userId}`;
      const [{ viewed }] = await sql`SELECT COUNT(*)::int AS viewed FROM material_file_views WHERE file_id = ${f.id} AND user_id = ${userId}`;
      return {
        ...f, category: f.category, views: f.views, likes: f.likes,
        likedByMe: liked > 0, viewedByMe: viewed > 0,
        uploaderTitle: me?.title, uploaderAvatar: me?.avatar_url, uploaderPoints: me?.points,
      };
    });
  }

  if (parts[2] === "view") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const id = Number(parts[1]);
      const existing = await sql`SELECT * FROM material_file_views WHERE file_id = ${id} AND user_id = ${userId}`;
      if (existing.length) return { counted: false };
      await sql`INSERT INTO material_file_views (file_id, user_id) VALUES (${id}, ${userId})`;
      await sql`UPDATE material_files SET views = views + 1 WHERE id = ${id}`;
      return { counted: true };
    });
  }

  if (parts[2] === "like") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const id = Number(parts[1]);
      const existing = await sql`SELECT * FROM material_file_likes WHERE file_id = ${id} AND user_id = ${userId}`;
      if (existing.length) {
        await sql`DELETE FROM material_file_likes WHERE file_id = ${id} AND user_id = ${userId}`;
        await sql`UPDATE material_files SET likes = GREATEST(0, likes - 1) WHERE id = ${id}`;
        return { liked: false };
      }
      await sql`INSERT INTO material_file_likes (file_id, user_id) VALUES (${id}, ${userId})`;
      await sql`UPDATE material_files SET likes = likes + 1 WHERE id = ${id}`;
      return { liked: true };
    });
  }

  if (parts[2] === "comments") {
    if (req.method === "GET") {
      return handle(async () => {
        const id = Number(parts[1]);
        const rows = await sql`SELECT * FROM material_file_comments WHERE file_id = ${id} ORDER BY created_at DESC`;
        const authorIds = Array.from(new Set(rows.map((r: any) => r.author_id)));
        const users = authorIds.length ? await sql`SELECT * FROM users WHERE id = ANY(${authorIds})` : [];
        const byId = new Map(users.map((u: any) => [u.id, u]));
        return rows.map((c: any) => ({
          ...c, createdAt: c.created_at?.toISOString(),
          authorName: byId.get(c.author_id)?.name, authorAvatar: byId.get(c.author_id)?.avatar_url,
          authorRole: byId.get(c.author_id)?.role,
        }));
      });
    }
    if (req.method === "POST") {
      return handle(async () => {
        const { userId } = requireAuth(req.headers);
        const id = Number(parts[1]);
        const body = await req.json();
        if (!body.body) throw Object.assign(new Error("نص التعليق مطلوب"), { status: 400 });
        const [c] = await sql`INSERT INTO material_file_comments (file_id, author_id, body) VALUES (${id}, ${userId}, ${body.body}) RETURNING *`;
        return { ...c, createdAt: c.created_at?.toISOString() };
      });
    }
  }

  return jsonError("Not Found", 404);
}

async function handleStudentSummaries(req: Request, parts: string[]): Promise<Response> {
  const { userId } = requireAuth(req.headers);

  if (req.method === "GET") {
    return handle(async () => {
      const rows = await sql`SELECT * FROM material_files WHERE category = 'student-summary' ORDER BY created_at DESC`;
      const uploaderIds = Array.from(new Set(rows.map((r: any) => r.uploaded_by_id)));
      const users = uploaderIds.length ? await sql`SELECT * FROM users WHERE id = ANY(${uploaderIds})` : [];
      const byId = new Map(users.map((u: any) => [u.id, u]));
      return rows.map((s: any) => {
        const u = byId.get(s.uploaded_by_id);
        return {
          ...s, views: s.views, likes: s.likes,
          uploaderTitle: u?.title, uploaderAvatar: u?.avatar_url, uploaderPoints: u?.points,
        };
      });
    });
  }

  if (req.method === "POST") {
    return handle(async () => {
      const body = await req.json();
      if (typeof body.url === "string" && (body.url.length * 3 / 4) > 4 * 1024 * 1024) {
        throw Object.assign(new Error("حجم الملف كبير جداً. جرب ملف أصغر من 3MB أو اضغطه أكثر"), { status: 400 });
      }
      const { name, kind, url, sizeBytes, courseId } = body;
      if (!name || !url || !courseId) throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
      const [me] = await sql`SELECT * FROM users WHERE id = ${userId}`;
      const [f] = await sql`
        INSERT INTO material_files (material_id, course_id, name, kind, url, size_bytes, uploaded_by_id, uploaded_by_name, category)
        VALUES (NULL, ${courseId}, ${name}, ${kind || "pdf"}, ${url}, ${sizeBytes || 0}, ${userId}, ${me?.name || ""}, 'student-summary')
        RETURNING *`;
      return f;
    });
  }

  if (req.method === "DELETE" && parts[2]) {
    return handle(async () => {
      const id = Number(parts[2]);
      const [f] = await sql`SELECT * FROM material_files WHERE id = ${id}`;
      if (!f) throw Object.assign(new Error("الملف غير موجود"), { status: 404 });
      if (f.uploaded_by_id !== userId) {
        const user = await getCurrentUser(userId);
        requireRole(user, ["admin", "super_admin"]);
      }
      await sql`DELETE FROM material_files WHERE id = ${id}`;
      return { ok: true };
    });
  }

  return jsonError("Not Found", 404);
}

async function handleCourseSummaries(req: Request, parts: string[]): Promise<Response> {
  return handle(async () => {
    const courseId = Number(parts[2]);
    return await sql`SELECT * FROM material_files WHERE course_id = ${courseId} AND category = 'student-summary' ORDER BY created_at DESC`;
  });
}

async function handleAdminNews(req: Request, parts: string[]): Promise<Response> {
  const { userId } = requireAuth(req.headers);
  const user = await getCurrentUser(userId);
  requireRole(user, ["admin", "super_admin"]);

  if (req.method === "GET") {
    return handle(async () => sql`SELECT * FROM news ORDER BY published_at DESC`);
  }

  if (req.method === "POST" && !parts[2]) {
    return handle(async () => {
      const body = await req.json();
      const { title, excerpt, body: newsBody, category, imageUrl } = body;
      if (!title) throw Object.assign(new Error("العنوان مطلوب"), { status: 400 });
      const [n] = await sql`
        INSERT INTO news (title, excerpt, body, category, image_url, status, author, author_id, published_at)
        VALUES (${title}, ${excerpt || ""}, ${newsBody || ""}, ${category || ""}, ${imageUrl || null}, 'pending', ${user.name}, ${userId}, ${new Date()})
        RETURNING *`;
      return n;
    });
  }

  if (parts[2] && parts[3] === "approve") {
    return handle(async () => {
      await sql`UPDATE news SET status = 'approved', published_at = ${new Date()} WHERE id = ${Number(parts[2])}`;
      return { ok: true };
    });
  }

  if (parts[2] && parts[3] === "reject") {
    return handle(async () => {
      await sql`UPDATE news SET status = 'rejected' WHERE id = ${Number(parts[2])}`;
      return { ok: true };
    });
  }

  if (req.method === "DELETE" && parts[2]) {
    return handle(async () => {
      await sql`DELETE FROM news WHERE id = ${Number(parts[2])}`;
      return { ok: true };
    });
  }

  return jsonError("Not Found", 404);
}

async function handleAdminCourses(req: Request, parts: string[]): Promise<Response> {
  const { userId } = requireAuth(req.headers);
  const user = await getCurrentUser(userId);
  requireRole(user, ["admin", "super_admin"]);

  if (req.method === "POST") {
    return handle(async () => {
      const body = await req.json();
      const { title, code, description, credits, department, instructorId, taIds, yearInCollege, coverUrl } = body;
      if (!title || !code) throw Object.assign(new Error("العنوان والكود مطلوب"), { status: 400 });
      const [instructor] = await sql`SELECT name FROM users WHERE id = ${instructorId}`;
      const [c] = await sql`
        INSERT INTO courses (title, code, description, credits, department, instructor, instructor_id, cover_url, year_in_college)
        VALUES (${title}, ${code}, ${description || ""}, ${credits || 3}, ${department || ""}, ${instructor?.name || ""}, ${instructorId || null}, ${coverUrl || null}, ${yearInCollege || null})
        RETURNING *`;
      return c;
    });
  }

  if (req.method === "DELETE" && parts[2]) {
    return handle(async () => {
      await sql`DELETE FROM courses WHERE id = ${Number(parts[2])}`;
      return { ok: true };
    });
  }

  return jsonError("Not Found", 404);
}

async function handleEvents(request: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(request.headers);
    const me = await getCurrentUser(userId);
    const rows = await sql`SELECT * FROM events ORDER BY due_at`;
    const filtered = me && me.role === "student"
      ? rows.filter((e: any) =>
          (!e.year_in_college || e.year_in_college === me.year_in_college) &&
          (!e.group_name || e.group_name === me.group_name))
      : rows;
    return filtered.map((e: any) => ({ ...e, dueAt: e.due_at?.toISOString(), createdAt: e.created_at?.toISOString() }));
  });
}

async function handleAdminEvents(request: Request, parts: string[]): Promise<Response> {
  const { userId } = requireAuth(request.headers);
  const user = await getCurrentUser(userId);
  requireRole(user, ["admin", "super_admin"]);

  if (request.method === "POST") {
    return handle(async () => {
      const body = await request.json();
      const { title, description, kind, yearInCollege, groupName, dueAt, location } = body;
      if (!title || !dueAt) throw Object.assign(new Error("العنوان وموعد الحدث مطلوبان"), { status: 400 });
      const [r] = await sql`
        INSERT INTO events (title, description, kind, year_in_college, group_name, due_at, location, created_by_id)
        VALUES (${title}, ${description || ""}, ${kind || "exam"}, ${yearInCollege ? Number(yearInCollege) : null}, ${groupName || null}, ${new Date(dueAt)}, ${location || null}, ${userId})
        RETURNING *`;
      // Notify matching students
      const students = await sql`SELECT * FROM users WHERE role = 'student'`;
      for (const s of students) {
        if ((!r.year_in_college || r.year_in_college === s.year_in_college) && (!r.group_name || r.group_name === s.group_name)) {
          await sql`INSERT INTO notifications (user_id, title, body, type) VALUES (${s.id}, ${`${r.kind === "exam" ? "امتحان جديد" : "موعد نهائي"}: ${r.title}`}, ${`${r.description || ""} — في ${new Date(r.due_at).toLocaleString("ar-EG")}`}, ${r.kind === "exam" ? "warning" : "info"})`;
        }
      }
      return { ...r, dueAt: r.due_at?.toISOString(), createdAt: r.created_at?.toISOString() };
    });
  }

  if (request.method === "DELETE" && parts[2]) {
    return handle(async () => {
      await sql`DELETE FROM events WHERE id = ${Number(parts[2])}`;
      return { ok: true };
    });
  }

  return jsonError("Not Found", 404);
}

// --- Main Request Handler ---

async function handleRequest(request: Request): Promise<Response> {
  console.log("🔵 [handler] Request:", request.method, request.url);
  
  if (request.method === "OPTIONS") return corsResponse();

  const url = new URL(request.url, "http://localhost");
  const path = url.pathname.replace(/^\/api\/?/, "");
  const parts = path.split("/").filter(Boolean);
  const method = request.method;
  const routeKey = `${method} /${parts.join("/")}`;
  console.log("🟡 [handler] Path:", path, "Route:", routeKey);

  // --- ROUTING TABLE ---
  const routes: Record<string, () => Promise<Response>> = {
    // Health
    "GET /healthz": () => handleHealth(),
    "GET /health": () => handleHealth(),

    // Feed alias
    "GET /feed": () => handleTalentsFeed(request, ["feed"]),
    "GET /home/feed": () => handleHomeFeed(),

    // Auth aliases (legacy routes without /v2/ prefix)
    "POST /login": () => handleAuth(request, ["", "auth", "login"]),
    "POST /signup": () => handleAuth(request, ["", "auth", "signup"]),
    "GET /username-available": () => handleAuth(request, ["", "auth", "username-available"]),

    // Auth
    "POST /auth/login": () => handleAuth(request, parts),
    "POST /auth/signup": () => handleAuth(request, parts),
    "POST /auth/logout": () => handleAuth(request, parts),
    "POST /auth/demo-login": () => handleAuth(request, parts),
    "GET /auth/username-available": () => handleAuth(request, parts),
    "POST /v2/auth/login": () => handleAuth(request, parts),
    "POST /v2/auth/signup": () => handleAuth(request, parts),
    "POST /v2/auth/logout": () => handleAuth(request, parts),
    "POST /v2/auth/demo-login": () => handleAuth(request, parts),
    "GET /v2/auth/username-available": () => handleAuth(request, parts),

    // Me
    "GET /me": () => handleMe(request),
    "PATCH /me": () => handleMeProfile(request),
    "PATCH /me/profile": () => handleMeProfile(request),
    "POST /me/group": () => handleMeGroup(request),
    "POST /me/role": () => handleSwitchRole(request),
    "GET /v2/me": () => handleMe(request),
    "PATCH /v2/me/profile": () => handleMeProfile(request),
    "POST /v2/me/group": () => handleMeGroup(request),

    // Dashboard
    "GET /dashboard": () => handleDashboard(request),

    // Notifications
    "GET /notifications": () => handleNotifications(request, parts),
    "POST /notifications/mark-all-read": () => handleNotifications(request, parts),
    "POST /admin/notifications/system": () => handleAdminNotifications(request),
    "GET /v2/notifications": () => handleNotifications(request, parts),
    "POST /v2/notifications/mark-all-read": () => handleNotifications(request, parts),
    "POST /v2/admin/notifications/system": () => handleAdminNotifications(request),

    // Admin
    "GET /admin/overview": () => handleAdminOverview(),
    "GET /admin/users": () => handleAdminUsers(request),
    "GET /admin/proposals": () => handleAdminProposals(request, ["admin", "proposals"]),
    "POST /admin/proposals": () => handleAdminProposals(request, ["admin", "proposals"]),
    "POST /admin/proposals/:id/decide": () => handleAdminProposals(request, ["admin", "proposals", parts[1], "decide"]),
    "GET /admin/all-quizzes": () => handleAdminQuizzes(request, ["admin", "all-quizzes"]),
    "GET /admin/all-courses": () => handleAdminCrud(request, ["", "admin", "all-courses"]),
    "GET /admin/all-materials": () => handleAdminCrud(request, ["", "admin", "all-materials"]),
    "GET /admin/students": () => handleAdminCrud(request, ["", "admin", "students"]),
    "GET /admin/staff": () => handleAdminCrud(request, ["", "admin", "staff"]),
    "GET /admin/group-schedule": () => handleGroupSchedule(request, ["group-schedule"]),
    "POST /admin/group-schedule": () => handleGroupSchedule(request, ["group-schedule"]),
    "GET /admin/exam-schedule": () => handleExamSchedule(request, ["exam-schedule"]),
    "POST /admin/exam-schedule": () => handleExamSchedule(request, ["exam-schedule"]),
    "GET /admin/dm/threads": () => handleAdminCrud(request, ["", "admin", "dm", "threads"]),
    "GET /admin/talents": () => handleAdminCrud(request, ["", "admin", "talents"]),
    "GET /admin/news": () => handleAdminNews(request, ["admin", "news"]),
    "POST /admin/news": () => handleAdminNews(request, ["admin", "news"]),
    "GET /admin/dm/threads/:id": () => handleAdminCrud(request, ["", "admin", "dm", "threads", parts[3]]),
    "DELETE /admin/staff/:id": () => handleAdminCrud(request, ["", "admin", "staff", parts[2]]),
    "POST /admin/staff": () => handleStaff(request, ["admin", "staff"]),
    "PATCH /admin/staff/:id": () => handleStaff(request, ["admin", "staff", parts[2]]),
    "DELETE /admin/talents/:id": () => handleAdminCrud(request, ["", "admin", "talents", parts[2]]),
    "DELETE /admin/talent-comments/:id": () => handleAdminCrud(request, ["", "admin", "talent-comments", parts[2]]),
    "DELETE /admin/material-comments/:id": () => handleAdminCrud(request, ["", "admin", "material-comments", parts[2]]),
    "POST /admin/courses": () => handleAdminCourses(request, ["admin", "courses"]),
    "DELETE /admin/courses/:id": () => handleAdminCourses(request, ["admin", "courses", parts[2]]),
    "POST /admin/quizzes": () => handleAdminQuizzes(request, ["admin", "quizzes"]),
    "PUT /admin/quizzes/:id": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[2]]),
    "DELETE /admin/quizzes/:id": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[2]]),
    "GET /admin/quizzes/:id/questions": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[2], "questions"]),
    "POST /admin/quizzes/:id/questions": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[2], "questions"]),
    "PUT /admin/quiz-questions/:id": () => handleAdminQuizzes(request, ["admin", "quiz-questions", parts[2]]),
    "DELETE /admin/quiz-questions/:id": () => handleAdminQuizzes(request, ["admin", "quiz-questions", parts[2]]),
    "GET /admin/quizzes/:id/attempts": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[2], "attempts"]),
    "GET /admin/quizzes/:quizId/attempts/:attemptId": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[2], "attempts", parts[4]]),
    "GET /admin/quiz-attempts/:id": () => handle(async () => getAttemptDetail(Number(parts[2]))),
    "POST /admin/quizzes/toggle/:id": () => handleAdminQuizzes(request, ["admin", "quizzes", "toggle", parts[3]]),
    "POST /admin/materials": () => handleAdminCrud(request, ["", "admin", "materials"]),
    "PATCH /admin/materials/:id": () => handleAdminCrud(request, ["", "admin", "materials", parts[2]]),
    "DELETE /admin/materials/:id": () => handleAdminCrud(request, ["", "admin", "materials", parts[2]]),
    "POST /admin/materials/:id/files": () => handleAdminCrud(request, ["", "admin", "materials", parts[2], "files"]),
    "DELETE /admin/material-files/:id": () => handleAdminCrud(request, ["", "admin", "material-files", parts[2]]),
    "POST /admin/courses/:id/lectures": () => handleAdminCrud(request, ["", "admin", "courses", parts[2], "lectures"]),
    "PATCH /admin/lectures/:id": () => handleAdminCrud(request, ["", "admin", "lectures", parts[2]]),
    "DELETE /admin/lectures/:id": () => handleAdminCrud(request, ["", "admin", "lectures", parts[2]]),
    "POST /admin/lectures/:id/videos": () => handleAdminCrud(request, ["", "admin", "lectures", parts[2], "videos"]),
    "DELETE /admin/videos/:id": () => handleAdminCrud(request, ["", "admin", "videos", parts[2]]),
    "POST /admin/lectures/:id/pdfs": () => handleAdminCrud(request, ["", "admin", "lectures", parts[2], "pdfs"]),
    "DELETE /admin/lecture-pdfs/:id": () => handleAdminCrud(request, ["", "admin", "lecture-pdfs", parts[2]]),
    "POST /admin/lectures/:id/quizzes": () => handleAdminCrud(request, ["", "admin", "lectures", parts[2], "quizzes"]),
    "DELETE /admin/lecture-quizzes/:id": () => handleAdminCrud(request, ["", "admin", "lecture-quizzes", parts[2]]),
    "DELETE /admin/users/:id": () => handleAdminCrud(request, ["", "admin", "users", parts[2]]),
    "PATCH /admin/users/:id/grant": () => handleAdminCrud(request, ["", "admin", "users", parts[2], "grant"]),
    "GET /admin/student/:id/full": () => handleAdminCrud(request, ["", "admin", "student", parts[2], "full"]),
    "DELETE /admin/group-schedule/:id": () => handleGroupSchedule(request, ["group-schedule", parts[2]]),
    "DELETE /admin/exam-schedule/:id": () => handleExamSchedule(request, ["exam-schedule", parts[2]]),
    "POST /admin/news/:id/approve": () => handleAdminNews(request, ["admin", "news", parts[2], "approve"]),
    "POST /admin/news/:id/reject": () => handleAdminNews(request, ["admin", "news", parts[2], "reject"]),
    "DELETE /admin/news/:id": () => handleAdminNews(request, ["admin", "news", parts[2]]),
    "GET /v2/admin/overview": () => handleAdminOverview(),
    "GET /v2/admin/users": () => handleAdminUsers(request),
    "GET /v2/admin/proposals": () => handleAdminProposals(request, ["admin", "proposals"]),
    "POST /v2/admin/proposals": () => handleAdminProposals(request, ["admin", "proposals"]),
    "POST /v2/admin/proposals/:id/decide": () => handleAdminProposals(request, ["admin", "proposals", parts[2], "decide"]),
    "GET /v2/admin/all-quizzes": () => handleAdminQuizzes(request, ["admin", "all-quizzes"]),
    "GET /v2/admin/all-courses": () => handleAdminCrud(request, ["", "admin", "all-courses"]),
    "GET /v2/admin/all-materials": () => handleAdminCrud(request, ["", "admin", "all-materials"]),
    "GET /v2/admin/students": () => handleAdminCrud(request, ["", "admin", "students"]),
    "GET /v2/admin/staff": () => handleAdminCrud(request, ["", "admin", "staff"]),
    "GET /v2/admin/group-schedule": () => handleGroupSchedule(request, ["admin", ...parts.slice(2)]),
    "POST /v2/admin/group-schedule": () => handleGroupSchedule(request, ["admin", ...parts.slice(2)]),
    "GET /v2/admin/exam-schedule": () => handleExamSchedule(request, ["admin", ...parts.slice(2)]),
    "POST /v2/admin/exam-schedule": () => handleExamSchedule(request, ["admin", ...parts.slice(2)]),
    "GET /v2/admin/dm/threads": () => handleAdminCrud(request, ["", "admin", "dm", "threads"]),
    "GET /v2/admin/talents": () => handleAdminCrud(request, ["", "admin", "talents"]),
    "GET /v2/admin/news": () => handleAdminNews(request, ["admin", ...parts.slice(2)]),
    "POST /v2/admin/news": () => handleAdminNews(request, ["admin", ...parts.slice(2)]),
    "GET /v2/admin/dm/threads/:id": () => handleAdminCrud(request, ["", "admin", "dm", "threads", parts[3]]),
    "DELETE /v2/admin/staff/:id": () => handleAdminCrud(request, ["", "admin", "staff", parts[3]]),
    "POST /v2/admin/staff": () => handleStaff(request, ["admin", "staff"]),
    "PATCH /v2/admin/staff/:id": () => handleStaff(request, ["admin", "staff", parts[3]]),
    "DELETE /v2/admin/talents/:id": () => handleAdminCrud(request, ["", "admin", "talents", parts[3]]),
    "DELETE /v2/admin/talent-comments/:id": () => handleAdminCrud(request, ["", "admin", "talent-comments", parts[3]]),
    "DELETE /v2/admin/material-comments/:id": () => handleAdminCrud(request, ["", "admin", "material-comments", parts[3]]),
    "POST /v2/admin/courses": () => handleAdminCourses(request, ["admin", "courses"]),
    "DELETE /v2/admin/courses/:id": () => handleAdminCourses(request, ["admin", "courses", parts[3]]),
    "POST /v2/admin/quizzes": () => handleAdminQuizzes(request, ["admin", "quizzes"]),
    "PUT /v2/admin/quizzes/:id": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[3]]),
    "DELETE /v2/admin/quizzes/:id": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[3]]),
    "GET /v2/admin/quizzes/:id/questions": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[3], "questions"]),
    "POST /v2/admin/quizzes/:id/questions": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[3], "questions"]),
    "PUT /v2/admin/quiz-questions/:id": () => handleAdminQuizzes(request, ["admin", "quiz-questions", parts[3]]),
    "DELETE /v2/admin/quiz-questions/:id": () => handleAdminQuizzes(request, ["admin", "quiz-questions", parts[3]]),
    "GET /v2/admin/quizzes/:id/attempts": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[3], "attempts"]),
    "GET /v2/admin/quizzes/:quizId/attempts/:attemptId": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[3], "attempts", parts[4]]),
    "GET /v2/admin/quiz-attempts/:id": () => handle(async () => getAttemptDetail(Number(parts[3]))),
    "POST /v2/admin/quizzes/toggle/:id": () => handleAdminQuizzes(request, ["admin", "quizzes", "toggle", parts[4]]),
    "POST /v2/admin/materials": () => handleAdminCrud(request, ["", "admin", "materials"]),
    "PATCH /v2/admin/materials/:id": () => handleAdminCrud(request, ["", "admin", "materials", parts[3]]),
    "DELETE /v2/admin/materials/:id": () => handleAdminCrud(request, ["", "admin", "materials", parts[3]]),
    "POST /v2/admin/materials/:id/files": () => handleAdminCrud(request, ["", "admin", "materials", parts[3], "files"]),
    "DELETE /v2/admin/material-files/:id": () => handleAdminCrud(request, ["", "admin", "material-files", parts[3]]),
    "POST /v2/admin/courses/:id/lectures": () => handleAdminCrud(request, ["", "admin", "courses", parts[3], "lectures"]),
    "PATCH /v2/admin/lectures/:id": () => handleAdminCrud(request, ["", "admin", "lectures", parts[3]]),
    "DELETE /v2/admin/lectures/:id": () => handleAdminCrud(request, ["", "admin", "lectures", parts[3]]),
    "POST /v2/admin/lectures/:id/videos": () => handleAdminCrud(request, ["", "admin", "lectures", parts[3], "videos"]),
    "DELETE /v2/admin/videos/:id": () => handleAdminCrud(request, ["", "admin", "videos", parts[3]]),
    "POST /v2/admin/lectures/:id/pdfs": () => handleAdminCrud(request, ["", "admin", "lectures", parts[3], "pdfs"]),
    "DELETE /v2/admin/lecture-pdfs/:id": () => handleAdminCrud(request, ["", "admin", "lecture-pdfs", parts[3]]),
    "POST /v2/admin/lectures/:id/quizzes": () => handleAdminCrud(request, ["", "admin", "lectures", parts[3], "quizzes"]),
    "DELETE /v2/admin/lecture-quizzes/:id": () => handleAdminCrud(request, ["", "admin", "lecture-quizzes", parts[3]]),
    "POST /v2/admin/lecture-quizzes/:id/questions": () => handleAdminCrud(request, ["", "admin", "lecture-quizzes", parts[3], "questions"]),
    "GET /v2/admin/lecture-quizzes/:id/questions": () => handleAdminCrud(request, ["", "admin", "lecture-quizzes", parts[3], "questions"]),
    "DELETE /v2/admin/lecture-quiz-questions/:id": () => handleAdminCrud(request, ["", "admin", "lecture-quiz-questions", parts[3]]),
    "DELETE /v2/admin/users/:id": () => handleAdminCrud(request, ["", "admin", "users", parts[3]]),
    "PATCH /v2/admin/users/:id/grant": () => handleAdminCrud(request, ["", "admin", "users", parts[3], "grant"]),
    "GET /v2/admin/student/:id/full": () => handleAdminCrud(request, ["", "admin", "student", parts[3], "full"]),
    "DELETE /v2/admin/group-schedule/:id": () => handleGroupSchedule(request, ["admin", ...parts.slice(2)]),
    "DELETE /v2/admin/exam-schedule/:id": () => handleExamSchedule(request, ["admin", ...parts.slice(2)]),
    "POST /v2/admin/news/:id/approve": () => handleAdminNews(request, ["admin", "news", parts[3], "approve"]),
    "POST /v2/admin/news/:id/reject": () => handleAdminNews(request, ["admin", "news", parts[3], "reject"]),
    "DELETE /v2/admin/news/:id": () => handleAdminNews(request, ["admin", "news", parts[3]]),

    // Talents
    "GET /talents": () => handleTalentsFeed(request, ["talents"]),
    "GET /talents-feed": () => handleTalentsFeed(request, ["talents-feed"]),
    "POST /talents": () => handleTalentsFeed(request, ["talents"]),
    "POST /talents/:id/like": () => handleTalentsFeed(request, ["talents", "id", parts[1], "like"]),
    "POST /talents/:id/vote": () => handleTalentsFeed(request, ["talents", "id", parts[1], "like"]),
    "GET /talents/:id/comments": () => handleTalentsFeed(request, ["talents", "id", parts[1], "comments"]),
    "POST /talents/:id/comments": () => handleTalentsFeed(request, ["talents", "id", parts[1], "comments"]),
    "GET /v2/talents-feed": () => handleTalentsFeed(request, ["talents"]),
    "GET /v2/talents": () => handleTalentsFeed(request, ["", ...parts.slice(2)]),
    "POST /v2/talents": () => handleTalentsFeed(request, ["talents"]),
    "POST /v2/talents/:id/like": () => handleTalentsFeed(request, ["talents", "id", parts[2], "like"]),
    "GET /v2/talents/:id/comments": () => handleTalentsFeed(request, ["talents", "id", parts[2], "comments"]),
    "POST /v2/talents/:id/comments": () => handleTalentsFeed(request, ["talents", "id", parts[2], "comments"]),

    // Forum
    "GET /forum": () => handleForum(request, ["forum"]),
    "GET /forum/posts": () => handleForum(request, ["forum", "posts"]),
    "POST /forum/posts": () => handleForum(request, ["forum", "posts"]),
    "GET /forum/posts/:id": () => handleForum(request, ["forum", "posts", parts[2]]),
    "GET /forum/posts/:id/replies": () => handleForum(request, ["forum", "posts", parts[2], "replies"]),
    "POST /forum/posts/:id/replies": () => handleForum(request, ["forum", "posts", parts[2], "replies"]),
    "POST /forum/posts/:id/upvote": () => handleForum(request, ["forum", "posts", parts[2], "upvote"]),
    "GET /v2/forum/posts": () => handleForum(request, ["forum", "posts"]),
    "POST /v2/forum/posts": () => handleForum(request, ["forum", "posts"]),
    "POST /v2/forum/posts/:id/upvote": () => handleForum(request, ["forum", "posts", parts[3], "upvote"]),
    "GET /v2/forum/posts/:id/replies": () => handleForum(request, ["forum", "posts", parts[3], "replies"]),
    "POST /v2/forum/posts/:id/replies": () => handleForum(request, ["forum", "posts", parts[3], "replies"]),

    // Quizzes
    "GET /quizzes": () => handleQuizzesList(),
    "GET /quizzes/:id": () => handleQuizById(Number(parts[1])),
    "GET /quizzes/open": () => handleQuizzes(request, ["quizzes", "open"]),
    "GET /quizzes/:id/start": () => handleQuizzes(request, ["quizzes", parts[1], "start"]),
    "POST /quizzes/:id/submit": () => handleQuizzes(request, ["quizzes", parts[1], "submit"]),
    "GET /v2/quizzes/open": () => handleQuizzes(request, ["quizzes", "open"]),
    "GET /v2/quizzes/:id/start": () => handleQuizzes(request, ["quizzes", parts[2], "start"]),
    "POST /v2/quizzes/:id/submit": () => handleQuizzes(request, ["quizzes", parts[2], "submit"]),

    // DM
    "GET /dm/threads": () => handleDM(request, ["dm", "threads"]),
    "GET /dm/with/:id": () => handleDM(request, ["dm", "with", parts[2]]),
    "POST /dm/with/:id": () => handleDM(request, ["dm", "with", parts[2]]),
    "GET /v2/dm/threads": () => handleDM(request, ["dm", "threads"]),
    "GET /v2/dm/with/:id": () => handleDM(request, ["dm", "with", parts[2]]),
    "POST /v2/dm/with/:id": () => handleDM(request, ["dm", "with", parts[2]]),

    // Follow
    "POST /follow/:id": () => handleFollow(request, ["x", "follow", parts[1]]),
    "GET /follows/me": () => handleFollow(request, ["x", "follows", "me"]),
    "GET /follows/:id/status": () => handleFollow(request, ["x", "follows", parts[1], "status"]),
    "POST /v2/follow/:id": () => handleFollow(request, ["x", "follow", parts[2]]),
    "GET /v2/follows/me": () => handleFollow(request, ["x", "follows", "me"]),
    "GET /v2/follows/:id/status": () => handleFollow(request, ["x", "follows", parts[2], "status"]),

    // Users
    "GET /users/students": () => handleUsers(request, ["users", "students"]),
    "GET /users/:id": () => handleUsers(request, ["users", parts[1]]),
    "GET /v2/users/students": () => handleUsers(request, ["users", "students"]),
    "GET /v2/users/:id": () => handleUsers(request, ["users", parts[2]]),

    // News
    "GET /news": () => handleNews(),
    "GET /news/:id": () => handleNewsById(parts[1]),

    // Skills
    "GET /skills": () => handleSkills(request, ["skills"]),
    "GET /skills/tracks": () => handleSkills(request, ["skills", "tracks"]),
    "GET /skills/:id": () => handleSkills(request, ["skills", parts[1]]),
    "POST /skills/lessons/:id/complete": () => handleSkills(request, ["skills", "lessons", parts[2], "complete"]),
    "GET /v2/skills/tracks": () => handleSkills(request, ["skills", "tracks"]),
    "POST /v2/skills/lessons/:id/complete": () => handleSkills(request, ["skills", "lessons", parts[2], "complete"]),

    // Games
    "POST /games/score": () => handleGames(request, ["games", "score"]),
    "GET /games/leaderboard": () => handleGames(request, ["games", "leaderboard"]),
    "POST /v2/games/score": () => handleGames(request, ["games", "score"]),
    "GET /v2/games/leaderboard": () => handleGames(request, ["games", "leaderboard"]),

    // Leaderboard (generated API client)
    "GET /leaderboard": () => handleLeaderboard(request),

    // Activity
    "POST /activity/log": () => handleActivity(request),
    "POST /v2/activity/log": () => handleActivity(request),

    // Achievements
    "GET /achievements": () => handleAchievements(request),
    "GET /v2/achievements": () => handleAchievements(request),

    // Schedules
    "GET /group-schedule": () => handleGroupSchedule(request, ["group-schedule"]),
    "GET /exam-schedule": () => handleExamSchedule(request, ["exam-schedule"]),
    "GET /v2/group-schedule": () => handleGroupSchedule(request, ["group-schedule"]),
    "GET /v2/exam-schedule": () => handleExamSchedule(request, ["exam-schedule"]),

    // Courses
    "GET /courses": () => handleCoursesList(),
    "GET /courses/:id": () => handleCourseById(parts[1]),
    "GET /courses/:id/materials": () => handleCourses(request, ["", "courses", parts[1], "materials"]),
    "GET /courses/:id/all-files": () => handleCourses(request, ["", "courses", parts[1], "all-files"]),
    "GET /courses/:id/lectures": () => handleCourses(request, ["", "courses", parts[1], "lectures"]),
    "GET /courses/:id/video-progress": () => handleCourses(request, ["", "courses", parts[1], "video-progress"]),
    "GET /courses/:id/progress": () => handleCourses(request, ["", "courses", parts[1], "progress"]),
    "GET /courses/:id/student-summaries": () => handleCourseSummaries(request, ["courses", parts[1], "student-summaries"]),
    "GET /v2/courses": () => handleCoursesList(),
    "GET /v2/courses/:id": () => handleCourseById(parts[2]),
    "GET /v2/courses/:id/materials": () => handleCourses(request, ["", "courses", parts[2], "materials"]),
    "GET /v2/courses/:id/all-files": () => handleCourses(request, ["", "courses", parts[2], "all-files"]),
    "GET /v2/courses/:id/lectures": () => handleCourses(request, ["", "courses", parts[2], "lectures"]),
    "GET /v2/courses/:id/video-progress": () => handleCourses(request, ["", "courses", parts[2], "video-progress"]),
    "GET /v2/courses/:id/progress": () => handleCourses(request, ["", "courses", parts[2], "progress"]),
    "GET /v2/courses/:id/student-summaries": () => handleCourseSummaries(request, ["courses", parts[2], "student-summaries"]),

    // Materials
    "GET /materials/:id/files": () => handleMaterialFiles(request, ["materials", parts[1], "files"]),
    "GET /v2/materials/:id/files": () => handleMaterialFiles(request, ["materials", parts[2], "files"]),

    // Material files
    "GET /material-files/:id": () => handleMaterialFileRoutes(request, ["material-files", parts[1]]),
    "POST /material-files/:id/view": () => handleMaterialFileRoutes(request, ["material-files", parts[1], "view"]),
    "POST /material-files/:id/like": () => handleMaterialFileRoutes(request, ["material-files", parts[1], "like"]),
    "GET /material-files/:id/comments": () => handleMaterialFileRoutes(request, ["material-files", parts[1], "comments"]),
    "POST /material-files/:id/comments": () => handleMaterialFileRoutes(request, ["material-files", parts[1], "comments"]),
    "GET /v2/material-files/:id": () => handleMaterialFileRoutes(request, ["material-files", parts[2]]),
    "POST /v2/material-files/:id/view": () => handleMaterialFileRoutes(request, ["material-files", parts[2], "view"]),
    "POST /v2/material-files/:id/like": () => handleMaterialFileRoutes(request, ["material-files", parts[2], "like"]),
    "GET /v2/material-files/:id/comments": () => handleMaterialFileRoutes(request, ["material-files", parts[2], "comments"]),
    "POST /v2/material-files/:id/comments": () => handleMaterialFileRoutes(request, ["material-files", parts[2], "comments"]),

    // Student summaries
    "GET /student-summaries": () => handleStudentSummaries(request, ["student-summaries"]),
    "POST /student-summaries": () => handleStudentSummaries(request, ["student-summaries"]),
    "DELETE /student-summaries/:id": () => handleStudentSummaries(request, ["student-summaries", parts[1]]),
    "GET /v2/student-summaries": () => handleStudentSummaries(request, parts),
    "POST /v2/student-summaries": () => handleStudentSummaries(request, parts),
    "DELETE /v2/student-summaries/:id": () => handleStudentSummaries(request, parts),

    // Staff
    "GET /staff/doctors": () => handleStaffDoctors(),
    "GET /staff": () => handleStaff(request, ["staff"]),
    "GET /staff/:id": () => handleStaff(request, ["staff", parts[1]]),
    "POST /staff": () => handleStaff(request, ["staff"]),
    "PATCH /staff/:id": () => handleStaff(request, ["staff", parts[1]]),
    "GET /v2/staff/doctors": () => handleStaffDoctors(),
    "GET /v2/staff": () => handleStaff(request, parts),
    "POST /v2/staff": () => handleStaff(request, parts),
    "PATCH /v2/staff/:id": () => handleStaff(request, parts),

    // Complaints
    "POST /complaints": () => handleComplaints(request),

    // AI Chat
    "POST /ai/chat": () => handleAiChat(request),

    // Missions
    "GET /missions": () => handleMissions(request, ["missions"]),
    "POST /missions/:id/complete": () => handleMissions(request, ["missions", parts[1], "complete"]),

    // Lecture quizzes
    "POST /lecture-quizzes/:id/submit": () => handleLectureQuizSubmit(request, ["lecture-quizzes", parts[1], "submit"]),
    "GET /lecture-quizzes/:id/attempts": () => handleLectureQuizAttempts(request, ["lecture-quizzes", parts[1], "attempts"]),
    "POST /v2/lecture-quizzes/:id/submit": () => handleLectureQuizSubmit(request, parts),
    "GET /v2/lecture-quizzes/:id/attempts": () => handleLectureQuizAttempts(request, parts),

    // Videos
    "POST /videos/:id/watch": () => handleVideoWatch(request, ["videos", parts[1], "watch"]),
    "POST /v2/videos/:id/watch": () => handleVideoWatch(request, parts),

    // Events
    "GET /events": () => handleEvents(request),
    "POST /admin/events": () => handleAdminEvents(request, ["admin", "events"]),
    "DELETE /admin/events/:id": () => handleAdminEvents(request, ["admin", "events", parts[2]]),
    "POST /v2/admin/events": () => handleAdminEvents(request, ["admin", "events"]),
    "DELETE /v2/admin/events/:id": () => handleAdminEvents(request, ["admin", "events", parts[3]]),

    // Admin forum moderation
    "DELETE /admin/forum/posts/:id": () => handleAdminCrud(request, ["", "admin", "forum", "posts", parts[3]]),
    "DELETE /admin/forum/replies/:id": () => handleAdminCrud(request, ["", "admin", "forum", "replies", parts[3]]),
    "DELETE /v2/admin/forum/posts/:id": () => handleAdminCrud(request, ["", "admin", "forum", "posts", parts[4]]),
    "DELETE /v2/admin/forum/replies/:id": () => handleAdminCrud(request, ["", "admin", "forum", "replies", parts[4]]),
  };

  // Try exact match first
  if (routes[routeKey]) {
    console.log("🟢 [handler] Exact route matched:", routeKey);
    const response = await routes[routeKey]();
    console.log("🟢 [handler] Response ready, status:", response.status);
    return response;
  }

  // Try pattern matching for routes with :id/:name params
  for (const [pattern, handlerFn] of Object.entries(routes)) {
    const patternParts = pattern.replace(/^GET |POST |PUT |PATCH |DELETE /, "").split("/").filter(Boolean);
    if (patternParts.length !== parts.length) continue;
    const matches = patternParts.every((p, i) => p.startsWith(":") || p === parts[i]);
    if (!matches) continue;

    // Verify method matches
    const patternMethod = pattern.split(" ")[0];
    if (patternMethod !== method) continue;

    console.log("🟢 [handler] Pattern matched:", pattern);
    const response = await handlerFn();
    console.log("🟢 [handler] Response ready, status:", response.status);
    return response;
  }

  console.log("🔴 [handler] No route found");
  return jsonError(`Route not found: ${method} /${path}`, 404);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await new Promise<string>((resolve) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(data));
    });

    const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
    const host = (req.headers.host as string) || "localhost";
    const url = new URL(`${protocol}://${host}${req.url}`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
      }
    }

    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body: body || undefined,
    });

    const response = await handleRequest(request);

    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err: any) {
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message }));
  }
}
