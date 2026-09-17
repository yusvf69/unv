import type { IncomingMessage, ServerResponse } from "node:http";
import { sql } from "./lib/db.js";
import { handle, jsonResponse, jsonError, corsResponse } from "./lib/handler.js";
import { getUserId, getCurrentUser, requireAuth, requireRole, ensureSuper, generateToken } from "./lib/auth.js";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import webPushPkg from "web-push";
const webPush = (webPushPkg as any).default ?? webPushPkg;

export const config = { runtime: "nodejs", maxDuration: 60 };

async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const rows = await sql`SELECT v.k, v.v FROM unnest(ARRAY['vapid_public','vapid_private']::text[]) k LEFT JOIN app_settings v ON v.key = k.k`;
  const map: Record<string, string> = {};
  for (const r of rows) if (r.v) map[r.k] = r.v;
  if (map.vapid_public && map.vapid_private) {
    webPush.setVapidDetails(
      process.env.PUSH_SUBJECT || "mailto:admin@unv.vercel.app",
      map.vapid_public,
      map.vapid_private
    );
    return { publicKey: map.vapid_public, privateKey: map.vapid_private };
  }
  const keys = webPush.generateVAPIDKeys();
  await sql`INSERT INTO app_settings (key, value) VALUES ('vapid_public', ${keys.publicKey}), ('vapid_private', ${keys.privateKey}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  webPush.setVapidDetails(
    process.env.PUSH_SUBJECT || "mailto:admin@unv.vercel.app",
    keys.publicKey,
    keys.privateKey
  );
  return keys;
}

async function sendPushToUser(userId: number, title: string, body: string, url: string): Promise<void> {
  try {
    const keys = await getVapidKeys();
    const subs = await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}`;
    if (!subs.length) return;
    const payload = JSON.stringify({ title, body, url });
    const results = await Promise.allSettled(
      subs.map((s) =>
        webPush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        )
      )
    );
    results.forEach((r, i) => {
      if (r.status === "fulfilled") return;
      const err: any = r.reason;
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        sql`DELETE FROM push_subscriptions WHERE user_id = ${userId} AND endpoint = ${subs[i].endpoint}`.catch(() => {});
      }
    });
  } catch {
    // pushes are best-effort; never break the main flow
  }
}

async function ensurePushTables(): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS app_settings (key text PRIMARY KEY, value text NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, endpoint)
  )`;
}

async function ensureVisitsTable(): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS visits (
    id serial PRIMARY KEY,
    ip text NOT NULL,
    user_agent text,
    path text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
}

function getMailer() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}

// --- Helpers ---
function generateUniqueCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "UV-";
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

const ADMIN_PERMISSION_DEFS = [
  { key: "manage_courses", ar: "إدارة المقررات", en: "Manage Courses" },
  { key: "manage_materials", ar: "ملفات المواد", en: "Manage Materials" },
  { key: "manage_students", ar: "الطلاب", en: "Manage Students" },
  { key: "manage_staff", ar: "هيئة التدريس", en: "Manage Staff" },
  { key: "manage_schedule", ar: "الجدول", en: "Manage Schedule" },
  { key: "manage_exams", ar: "الامتحانات", en: "Manage Exams" },
  { key: "manage_news", ar: "الأخبار", en: "Manage News" },
  { key: "manage_talents", ar: "المواهب", en: "Manage Talents" },
  { key: "manage_forum", ar: "المنتدى", en: "Manage Forum" },
  { key: "manage_events", ar: "الفعاليات", en: "Manage Events" },
  { key: "manage_complaints", ar: "إدارة الشكاوى", en: "Manage Complaints" },
  { key: "manage_admins", ar: "المشرفين", en: "Manage Admins" },
  { key: "manage_dm", ar: "الرسائل", en: "Manage DM" },
  { key: "manage_achievements", ar: "الإنجازات", en: "Manage Achievements" },
  { key: "manage_grades", ar: "الدرجات", en: "Manage Grades" },
  { key: "manage_skills", ar: "المهارات", en: "Manage Skills" },
];

function ensureAdminPermission(user: any, permission: string) {
  if (!user) throw Object.assign(new Error("غير مصرح"), { status: 403 });
  if (user.role === "super_admin") return;
  const perms: string[] = user.admin_permissions ? JSON.parse(user.admin_permissions) : [];
  if (!perms.includes(permission)) throw Object.assign(new Error("ليس لديك صلاحية لهذا الإجراء"), { status: 403 });
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

// --- Daily Missions Helpers ---

const DEFAULT_MISSIONS = [
  { title: "ادرس درس مهارات", description: "أكمل درساً في أي مسار مهارات", points: 10, kind: "skill" },
  { title: "العب لعبة تعليمية", description: "العب أي لعبة وحقق 3 نجوم", points: 15, kind: "game" },
  { title: "حل 10 أسئلة", description: "أجب عن 10 أسئلة من بنك الأسئلة", points: 15, kind: "quiz" },
  { title: "أكمل Quick Check", description: "أجب على أسئلة المراجعة بعد الدرس", points: 8, kind: "skill" },
  { title: "اكسب 30 XP", description: "اجمع 30 نقطة خبرة من أي نشاط", points: 20, kind: "focus" },
  { title: "شارك في المنتدى", description: "اكتب منشوراً أو رداً في المنتدى", points: 8, kind: "forum" },
  { title: "أكمل اختباراً بنجاح", description: "اختبر نفسك بنسبة 70%+", points: 20, kind: "quiz" },
  { title: "العب تحدي اليوم", description: "افتح لعبة اليوم الموصى بها", points: 12, kind: "challenge" },
  { title: "راجع مساراً", description: "أكمل 3 دروس في مسار مهارات", points: 25, kind: "skill" },
  { title: "ادرس مع AI", description: "استخدم المساعد الذكي لشرح درس", points: 10, kind: "focus" },
  { title: "حافظ على التتابع", description: "ادرس أو العب ليومين متتاليين", points: 20, kind: "streak" },
  { title: "تحدي مزدوج", description: "العب لعبتين مختلفتين", points: 18, kind: "game" },
  { title: "متفوق Quick Check", description: "أجب على 3 Quick Checks بنتيجة 80%+", points: 22, kind: "skill" },
  { title: "3 نجوم", description: "احصل على 3 نجوم في أي لعبة", points: 20, kind: "game" },
  { title: "درس + لعبة", description: "ادرس درساً ثم العب اللعبة المرتبطة", points: 25, kind: "focus" },
  { title: "Streak 3 أيام", description: "حافظ على تتابع 3 أيام متتالية", points: 30, kind: "streak" },
  { title: "بطولة سريعة", description: "العب 3 جولات من نفس اللعبة", points: 20, kind: "game" },
  { title: "نسبة نقاء", description: "أنهِ اختباراً بنسبة 90%+", points: 25, kind: "quiz" },
  { title: "مستكشف مسار", description: "ابدأ مسار مهارات جديد", points: 12, kind: "skill" },
  { title: "تحدي الفعالية", description: "شارك في الفعالية الأسبوعية", points: 20, kind: "challenge" },
];

async function ensureDailyMissionsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS daily_missions (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      points INT NOT NULL DEFAULT 10,
      kind TEXT NOT NULL DEFAULT 'study',
      completed BOOLEAN NOT NULL DEFAULT false,
      mission_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_daily_missions_user_date ON daily_missions (user_id, mission_date)`;
  } catch {}
}

async function autoCompleteMissions(userId: number, kind: string) {
  try {
    await sql`UPDATE daily_missions SET completed = true WHERE user_id = ${userId} AND mission_date = CURRENT_DATE AND kind = ${kind} AND completed = false`;
  } catch (e) { console.error("[autoCompleteMissions]", e); }
}

async function ensureDailyStreaksTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS user_daily_streaks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id),
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_active_date DATE DEFAULT CURRENT_DATE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

async function updateDailyStreak(userId: number) {
  try {
    await ensureDailyStreaksTable();
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const [row] = await sql`SELECT * FROM user_daily_streaks WHERE user_id = ${userId}`;
    if (!row) {
      await sql`INSERT INTO user_daily_streaks (user_id, current_streak, longest_streak, last_active_date) VALUES (${userId}, 1, 1, ${today})`;
    } else if (row.last_active_date?.toISOString().split("T")[0] === today) {
      // already active today, no change
    } else if (row.last_active_date?.toISOString().split("T")[0] === yesterday) {
      const next = row.current_streak + 1;
      const longest = Math.max(next, row.longest_streak);
      await sql`UPDATE user_daily_streaks SET current_streak = ${next}, longest_streak = ${longest}, last_active_date = ${today}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ${userId}`;
    } else {
      await sql`UPDATE user_daily_streaks SET current_streak = 1, last_active_date = ${today}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ${userId}`;
    }
    // award XP for streak milestones
    const [updated] = await sql`SELECT * FROM user_daily_streaks WHERE user_id = ${userId}`;
    if (updated && updated.current_streak > 0 && [3, 7, 14, 21, 30, 60, 90, 365].includes(updated.current_streak)) {
      await sql`UPDATE users SET points = points + ${updated.current_streak * 2} WHERE id = ${userId}`;
    }
    // Auto-complete streak missions
    try { await autoCompleteMissions(userId, "streak"); } catch {}
  } catch (e) { console.error("[updateDailyStreak]", e); }
}

async function generateDailyMissions(userId: number): Promise<any[]> {
  await ensureDailyMissionsTable();
  const today = new Date().toISOString().split("T")[0];

  const [user] = await sql`SELECT name, year_in_college, specialization, group_name FROM users WHERE id = ${userId}`;

  let aiMissions: any[] | null = null;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (apiKey && user) {
    try {
      const prompt = `أنت مساعد UniVerse. أنشئ 5 مهام يومية لطالب كلية زراعية.
بيانات الطالب:
- الاسم: ${user.name || ""}
- السنة: ${user.year_in_college || ""}
- التخصص: ${user.specialization || ""}

المهام يجب أن تدمج بين المهارات والألعاب والاختبارات. أعد JSON array فقط:
[{"title":"عنوان","description":"وصف","points":10,"kind":"skill"}]
الأنواع: skill (مهام المهارات), game (مهام الألعاب), quiz (مهام الاختبارات), forum (المنتدى), focus (تركيز عام)
النقاط: بين 5 و 25`;
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://unv-api.vercel.app",
          "X-Title": "UniVerse",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-lite-001",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.8,
          max_tokens: 1024,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || "";
        const jsonMatch = text.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          aiMissions = JSON.parse(jsonMatch[0]);
          if (!Array.isArray(aiMissions) || aiMissions.length === 0) aiMissions = null;
        }
      }
    } catch (e) { console.error("[generateDailyMissions] AI error:", e); }
  }

  const missionData = (aiMissions || DEFAULT_MISSIONS).slice(0, 5);
  const inserted: any[] = [];
  for (const m of missionData) {
    const [row] = await sql`
      INSERT INTO daily_missions (user_id, title, description, points, kind, mission_date)
      VALUES (${userId}, ${m.title}, ${m.description || ""}, ${m.points || 10}, ${m.kind || "study"}, ${today})
      RETURNING *`;
    inserted.push(row);
  }
  return inserted;
}

async function getDailyMissions(userId: number) {
  await ensureDailyMissionsTable();
  const today = new Date().toISOString().split("T")[0];
  const existing = await sql`SELECT * FROM daily_missions WHERE user_id = ${userId} AND mission_date = ${today} ORDER BY id`;
  if (existing.length > 0) return existing;
  return await generateDailyMissions(userId);
}

async function recalculateLevel(userId: number): Promise<void> {
  const [user] = await sql`SELECT points, level FROM users WHERE id = ${userId}`;
  if (!user) return;
  const computedLevel = Math.floor(user.points / 100) + 1;
  if (computedLevel !== user.level) {
    await sql`UPDATE users SET level = ${computedLevel} WHERE id = ${userId}`;
  }
}

async function updateStreak(userId: number): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  try { await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_user_date ON activity (user_id, date)`; } catch {}

  try {
    await sql`
      INSERT INTO activity (user_id, date, minutes_studied, points_earned)
      VALUES (${userId}, ${today}, 0, 0)
      ON CONFLICT (user_id, date) DO NOTHING
    `;
  } catch (e) { console.error("[updateStreak] insert activity:", e); }

  const dates = await sql`
    SELECT DISTINCT date FROM activity
    WHERE user_id = ${userId}
    ORDER BY date DESC LIMIT 365
  `;

  let streak = 0;
  const checkDate = new Date();
  for (const row of dates) {
    const expected = checkDate.toISOString().split("T")[0];
    const rowDate = typeof row.date === "string" ? row.date : new Date(row.date).toISOString().split("T")[0];
    if (rowDate === expected) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else break;
  }

  await sql`UPDATE users SET streak = ${streak} WHERE id = ${userId}`;
  // also update the new daily streaks table
  try { await updateDailyStreak(userId); } catch (e) { console.error("[updateStreak] updateDailyStreak:", e); }
}

// --- Route Handlers by Domain ---

async function handlePush(req: Request, parts: string[]): Promise<Response> {
  return handle(async () => {
    if (req.method === "GET" && parts[1] === "vapid") {
      const { publicKey } = await getVapidKeys();
      return { publicKey };
    }

    if (parts[1] !== "subscribe" && parts[1] !== "unsubscribe") {
      throw Object.assign(new Error("Not Found"), { status: 404 });
    }

    const { userId } = requireAuth(req.headers);
    const body = await req.json();
    if (req.method === "POST" && parts[1] === "subscribe") {
      const { endpoint, p256dh, auth } = body;
      if (!endpoint || !p256dh || !auth) {
        throw Object.assign(new Error("بيانات الاشتراك غير مكتملة"), { status: 400 });
      }
      await sql`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
        VALUES (${userId}, ${endpoint}, ${p256dh}, ${auth})
        ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`;
      return { ok: true };
    }

    if (req.method === "DELETE" && parts[1] === "unsubscribe") {
      await sql`DELETE FROM push_subscriptions WHERE user_id = ${userId}`;
      return { ok: true };
    }

    throw Object.assign(new Error("Method Not Allowed"), { status: 405 });
  });
}

async function handleDashboard(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const me = await getCurrentUser(userId);
    if (!me) throw Object.assign(new Error("المستخدم غير موجود"), { status: 404 });

    const currentLevelMin = (me.level - 1) * 100;
    const nextLevelPoints = me.level * 100;
    const allStudents = await sql`SELECT id, points FROM users WHERE role = 'student' ORDER BY points DESC`;
    const rank = allStudents.findIndex((s: any) => s.id === userId) + 1;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);
    const [{ weeklyMinutes = 0 }] = await sql`SELECT sum(minutes_studied)::int AS weeklyMinutes FROM activity WHERE user_id = ${userId} AND date >= ${weekAgoStr}`;
    const focusGoalMinutes = 600;

    const schedule = await sql`SELECT * FROM group_schedule WHERE group_name = ${me.group_name} AND year_in_college = ${me.year_in_college} ORDER BY CASE day WHEN 'الأحد' THEN 0 WHEN 'الاثنين' THEN 1 WHEN 'الإثنين' THEN 1 WHEN 'الثلاثاء' THEN 2 WHEN 'الأربعاء' THEN 3 WHEN 'الخميس' THEN 4 WHEN 'الجمعة' THEN 5 WHEN 'السبت' THEN 6 END`;
    const scheduleItems = schedule.map((s: any) => ({
      id: s.id, groupName: s.group_name, yearInCollege: s.year_in_college,
      day: s.day, dayNumber: AR_DAY_TO_NUM[s.day] ?? 0,
      startTime: s.start_time, endTime: s.end_time,
      courseTitle: s.course_title, courseCode: s.course_code,
      instructor: s.instructor, room: s.room, type: s.type,
    }));

    const attempts = await sql`SELECT qa.*, q.course_title FROM quiz_attempts qa LEFT JOIN quizzes q ON qa.quiz_id = q.id WHERE qa.user_id = ${userId} ORDER BY qa.completed_at DESC LIMIT 10`;
    const grades = attempts.map((a: any) => ({
      id: a.id, courseTitle: a.course_title || "اختبار",
      score: a.score, total: a.total, percent: a.total > 0 ? Math.round((a.score / a.total) * 100) : 0,
      passed: a.passed, completedAt: a.completed_at?.toISOString(),
    }));

    const attendance = await sql`SELECT date, minutes_studied FROM activity WHERE user_id = ${userId} ORDER BY date DESC LIMIT 7`;
    const attendanceItems = attendance.map((a: any) => ({ date: a.date, minutes: a.minutes_studied, present: a.minutes_studied > 0 }));

    const missionRows = await getDailyMissions(userId);
    const missions = missionRows.map((m: any) => ({
      id: m.id, title: m.title, description: m.description || "", points: m.points,
      kind: m.kind, completed: m.completed,
    }));

    const notifs = await sql`SELECT * FROM notifications WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 5`;
    const notifications = notifs.map((n: any) => ({
      id: n.id, title: n.title, body: n.body, type: n.type, read: n.read,
      createdAt: n.created_at?.toISOString(),
    }));

    const activityRows = await sql`SELECT date, minutes_studied, points_earned FROM activity WHERE user_id = ${userId} ORDER BY date DESC LIMIT 30`;
    const activity = activityRows.map((a: any) => ({
      date: a.date, minutesStudied: a.minutes_studied, pointsEarned: a.points_earned,
    }));

    const quizPct = grades.length ? grades.reduce((s: number, g: any) => s + g.percent, 0) / grades.length : null;
    const attendPct = attendanceItems.length ? (attendanceItems.filter((a: any) => a.present).length / attendanceItems.length) * 100 : null;
    const minutes7 = activityRows.reduce((s: number, a: any) => s + a.minutes_studied, 0);
    const studyPct = minutes7 > 0 ? (minutes7 / 600) * 100 : null;
    const weakest = grades.length ? grades.reduce((w: any, g: any) => (g.percent < w.percent ? g : w), grades[0]) : null;
    const haveAtt = [quizPct, attendPct, studyPct].filter((v) => v != null).length;
    const predicted =
      haveAtt > 0
        ? (quizPct ?? 50) * 0.4 + (attendPct ?? 50) * 0.35 + (studyPct ?? 30) * 0.25
        : null;

    const examPrediction = predicted == null
      ? {
          courseId: 0,
          courseTitle: "—",
          predictedScore: 0,
          confidence: 0.5,
          risk: "low" as const,
          recommendations: ["لم يتم رصد درجات بعد. تابع مع الإدارة عند توفرها."],
        }
      : {
          courseId: 0,
          courseTitle: weakest?.courseTitle ?? "—",
          predictedScore: Math.max(0, Math.min(100, Math.round(predicted))),
          confidence: Math.round((0.5 + haveAtt * 0.1) * 100),
          risk: (predicted < 60 ? "high" : predicted < 75 ? "medium" : "low") as "high" | "medium" | "low",
          recommendations: buildExamRecommendations(quizPct, attendPct, studyPct, minutes7, weakest?.courseTitle ?? null),
        };

    return {
      user: me, currentLevelMin, nextLevelPoints, rank, weeklyMinutes, focusGoalMinutes,
      schedule: scheduleItems, grades, attendance: attendanceItems, missions,
      notifications, activity, examPrediction,
    };
  });
}

function buildExamRecommendations(
  quizPct: number | null,
  attendPct: number | null,
  studyPct: number | null,
  minutes7: number,
  weakestTitle: string | null,
): string[] {
  const recs: string[] = [];
  if (quizPct != null && quizPct < 60) {
    recs.push(`متوسط اختباراتك (${Math.round(quizPct)}%) منخفض — أعد حل الاختبارات التجريبية وراجع أخطاءك`);
  }
  if (attendPct != null && attendPct < 75) {
    recs.push(`نسبة التزامك اليومي ${Math.round(attendPct)}% — المواظبة ترفع توقعاتك`);
  }
  if (studyPct != null && studyPct < 55) {
    recs.push(`مذاكرتك الأسبوعية ${Math.round(minutes7 / 60)} ساعات فقط — استهدف 6 ساعات على الأقل`);
  }
  if (weakestTitle) {
    recs.push(`ركّز على مقرر "${weakestTitle}" — الأضعف نسبياً`);
  }
  if (!recs.length) {
    recs.push("استمر على المذاكرة المنتظمة", "حل اختباراً وهمياً قبل كل امتحان");
  }
  return recs;
}

async function handleHealth(): Promise<Response> {
  return jsonResponse({ status: "ok" });
}

// ---------- LOGIN LOCKOUT (wrong-password protection) ----------
const LOGIN_ATTEMPTS = new Map<string, { fails: number; lockUntil: number; lockCount: number }>();
const LOCK_AFTER_ATTEMPTS = 5;

function lockDurationMinutes(lockCount: number): number {
  if (lockCount <= 1) return 1;
  if (lockCount === 2) return 5;
  if (lockCount === 3) return 15;
  return 30;
}

function normalizeLoginKey(id: string): string {
  const key = id.trim().toLowerCase();
  if (key.includes("@")) return key;
  return key.replace(/[^0-9]/g, "").replace(/^0/, "+2");
}

function checkLoginLock(key: string): number {
  const entry = LOGIN_ATTEMPTS.get(key);
  if (!entry) return 0;
  const now = Date.now();
  if (entry.lockUntil === 0) return 0;
  if (entry.lockUntil <= now) {
    entry.lockUntil = 0;
    entry.fails = 0;
    return 0;
  }
  return entry.lockUntil - now;
}

function recordFailedLogin(key: string): { lockedMins: number; remaining: number } {
  const now = Date.now();
  let entry = LOGIN_ATTEMPTS.get(key);
  if (!entry) {
    entry = { fails: 0, lockUntil: 0, lockCount: 0 };
    LOGIN_ATTEMPTS.set(key, entry);
  }
  entry.fails += 1;
  if (entry.fails >= LOCK_AFTER_ATTEMPTS) {
    entry.lockCount += 1;
    const mins = lockDurationMinutes(entry.lockCount);
    entry.lockUntil = now + mins * 60_000;
    entry.fails = 0;
    LOGIN_ATTEMPTS.set(key, entry);
    return { lockedMins: mins, remaining: 0 };
  }
  LOGIN_ATTEMPTS.set(key, entry);
  return { lockedMins: 0, remaining: LOCK_AFTER_ATTEMPTS - entry.fails };
}

function clearLoginLock(key: string): void {
  LOGIN_ATTEMPTS.delete(key);
}

async function handleAuth(req: Request, parts: string[]): Promise<Response> {
  const [, , action] = parts; // auth/login, auth/signup, etc.

  if (action === "login") {
    return handle(async () => {
      const body = await req.json();
      const { identifier, password } = body;
      if (!identifier || !password) throw Object.assign(new Error("البريد/الهاتف وكلمة المرور مطلوبة"), { status: 400 });
      const lockKey = normalizeLoginKey(identifier);
      const lockedMs = checkLoginLock(lockKey);
      if (lockedMs > 0) {
        const mins = Math.max(1, Math.ceil(lockedMs / 60_000));
        throw Object.assign(new Error(`محاولات كثيرة جداً. انتظر ${mins} دقيقة قبل المحاولة التالية`), { status: 429 });
      }
      const [user] = await sql`SELECT * FROM users WHERE email = ${identifier} OR phone = ${identifier} LIMIT 1`;
      if (!user) throw Object.assign(new Error("الحساب غير موجود"), { status: 404 });
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        const out = recordFailedLogin(lockKey);
        if (out.lockedMins > 0) {
          throw Object.assign(new Error(`كلمة المرور غير صحيحة. تم إيقاف المحاولات لمدة ${out.lockedMins} دقيقة`), { status: 401 });
        }
        throw Object.assign(new Error(`كلمة المرور غير صحيحة. متبقي ${out.remaining} محاولات`), { status: 401 });
      }
      clearLoginLock(lockKey);
      const token = generateToken(user.id, user.role);
      return { userId: user.id, role: user.role, token };
    });
  }

  if (action === "signup") {
    return handle(async () => {
      const body = await req.json();
      const { name, username, email, phone, password, yearInCollege, specialization, groupName, avatarUrl, termsAccepted } = body;
      if (!name || !username || !email || !phone || !password) throw Object.assign(new Error("كل الحقول مطلوبة"), { status: 400 });
      if (username.length < 4) throw Object.assign(new Error("اليوزر لازم يكون 4 حروف على الأقل"), { status: 400 });
      if (password.length < 6) throw Object.assign(new Error("كلمة المرور لازم تكون 6 حروف على الأقل"), { status: 400 });
      if (termsAccepted !== true) throw Object.assign(new Error("لازم توافق على الشروط والأحكام قبل ما تسجل"), { status: 400 });

      const [usernameTaken] = await sql`SELECT id FROM users WHERE username = ${username} LIMIT 1`;
      if (usernameTaken) throw Object.assign(new Error("اليوزر ده مأخوذ"), { status: 409 });

      const [emailExists] = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
      if (emailExists) throw Object.assign(new Error("الإيميل ده مسجل قبل كده"), { status: 409 });

      const normalizedPhone = phone.replace(/[^0-9]/g, "").replace(/^0/, "+2");
      const [phoneExists] = await sql`SELECT id FROM users WHERE phone = ${normalizedPhone} LIMIT 1`;
      if (phoneExists) throw Object.assign(new Error("الرقم ده مسجل قبل كده"), { status: 409 });

      const hashedPassword = await bcrypt.hash(password, 10);
      let uniqueCode = generateUniqueCode();
      let codeExists = true;
      while (codeExists) {
        const [existing] = await sql`SELECT id FROM users WHERE unique_code = ${uniqueCode} LIMIT 1`;
        if (!existing) codeExists = false;
        else uniqueCode = generateUniqueCode();
      }

      const [created] = await sql`
        INSERT INTO users (name, username, email, phone, password, role, department, specialization, year_in_college, group_name, avatar_url, unique_code, email_verified, phone_verified, terms_accepted_at)
        VALUES (${name}, ${username}, ${email}, ${phone}, ${hashedPassword}, 'student', ${specialization || "غير محدد"}, ${specialization || null}, ${yearInCollege || null}, ${groupName || null}, ${avatarUrl || null}, ${uniqueCode}, true, true, now())
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

  if (action === "send-verification") {
    return handle(async () => {
      let { email, phone } = await req.json();
      if (!email && !phone) throw Object.assign(new Error("الإيميل أو الرقم مطلوب"), { status: 400 });

      if (phone) {
        phone = phone.replace(/[^0-9]/g, "");
        if (phone.startsWith("0")) phone = "+2" + phone;
        else if (!phone.startsWith("+")) phone = "+" + phone;
      }

      const ultraMsgToken = process.env.ULTRAMSG_TOKEN;
      const ultraMsgId = process.env.ULTRAMSG_INSTANCE_ID;

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const results: string[] = [];

      if (email) {
        const m = getMailer();
        if (m) {
          try {
            await m.sendMail({
              from: `"UniVerse" <${process.env.GMAIL_USER}>`,
              to: email,
              subject: "كود تأكيد التسجيل في UniVerse",
              html: `<div style="font-family:sans-serif;padding:24px;max-width:480px;margin:auto"><h2 style="color:#16a34a">مرحباً بك في UniVerse</h2><p>كود التأكيد الخاص بك:</p><div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#f0fdf4;border-radius:12px;direction:ltr">${code}</div><p style="color:#666;font-size:14px">الكود صالح لمدة 10 دقائق</p></div>`,
            });
            results.push("email");
          } catch (e) { console.error("[send-verification] email error:", e); }
        }
      }

      if (phone && ultraMsgToken && ultraMsgId) {
        try {
          await fetch(`https://api.ultramsg.com/${ultraMsgId}/messages/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: ultraMsgToken,
              to: phone,
              body: `كود تأكيد UniVerse: ${code}\nصالح لمدة 10 دقائق`,
            }),
          });
          results.push("whatsapp");
        } catch (e) { console.error("[send-verification] whatsapp error:", e); }
      }

      await sql`DELETE FROM verification_codes WHERE (email = ${email} OR phone = ${phone}) AND verified = false`;
      await sql`INSERT INTO verification_codes (email, phone, code, type, expires_at) VALUES (${email || null}, ${phone || null}, ${code}, 'email', ${expiresAt})`;

      if (results.length === 0) throw Object.assign(new Error("فشل إرسال الكود، حاول مرة أخرى"), { status: 500 });
      return { sentTo: results };
    });
  }

  if (action === "verify-code") {
    return handle(async () => {
      const { email, phone, code } = await req.json();
      if (!code) throw Object.assign(new Error("الكود مطلوب"), { status: 400 });

      const [row] = await sql`
        SELECT * FROM verification_codes 
        WHERE (email = ${email || ""} OR phone = ${phone || ""}) 
        AND code = ${code} AND verified = false 
        AND expires_at > NOW() 
        ORDER BY created_at DESC LIMIT 1`;
      if (!row) throw Object.assign(new Error("الكود غير صحيح أو منتهي الصلاحية"), { status: 400 });

      await sql`UPDATE verification_codes SET verified = true WHERE id = ${row.id}`;
      return { verified: true };
    });
  }

  if (action === "check-user") {
    return handle(async () => {
      let { email, phone } = await req.json();
      if (!email && !phone) throw Object.assign(new Error("الإيميل أو الرقم مطلوب"), { status: 400 });
      if (email) {
        const [existing] = await sql`SELECT id, email FROM users WHERE email = ${email} LIMIT 1`;
        if (existing) return { exists: true, field: "email" };
      }
      if (phone) {
        phone = phone.replace(/[^0-9]/g, "");
        if (phone.startsWith("0")) phone = "+2" + phone;
        else if (!phone.startsWith("+")) phone = "+" + phone;
        const [existing] = await sql`SELECT id, phone FROM users WHERE phone = ${phone} LIMIT 1`;
        if (existing) return { exists: true, field: "phone" };
      }
      return { exists: false };
    });
  }

  if (action === "forgot-password") {
    return handle(async () => {
      let { email, phone } = await req.json();
      if (!email && !phone) throw Object.assign(new Error("الإيميل أو الرقم مطلوب"), { status: 400 });

      let user;
      if (phone) {
        phone = phone.replace(/[^0-9]/g, "");
        if (phone.startsWith("0")) phone = "+2" + phone;
        else if (!phone.startsWith("+")) phone = "+" + phone;
        [user] = await sql`SELECT * FROM users WHERE phone = ${phone} LIMIT 1`;
      }
      if (email && !user) {
        [user] = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
      }
      if (!user) throw Object.assign(new Error("لا يوجد حساب بهذا البريد/الرقم"), { status: 404 });

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const results: string[] = [];

      if (user.email) {
        const m = getMailer();
        if (m) {
          try {
            await m.sendMail({
              from: `"UniVerse" <${process.env.GMAIL_USER}>`,
              to: user.email,
              subject: "كود استعاده كلمة المرور - UniVerse",
              html: `<div style="font-family:sans-serif;padding:24px;max-width:480px;margin:auto"><h2 style="color:#16a34a">استعاده كلمة المرور</h2><p>كود استعاده كلمة المرور الخاص بك:</p><div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#f0fdf4;border-radius:12px;direction:ltr">${code}</div><p style="color:#666;font-size:14px">الكود صالح لمدة 10 دقائق</p></div>`,
            });
            results.push("email");
          } catch (e) { console.error("[forgot-password] email error:", e); }
        }
      }

      if (user.phone) {
        const ultraMsgToken = process.env.ULTRAMSG_TOKEN;
        const ultraMsgId = process.env.ULTRAMSG_INSTANCE_ID;
        if (ultraMsgToken && ultraMsgId) {
          try {
            await fetch(`https://api.ultramsg.com/${ultraMsgId}/messages/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: ultraMsgToken,
                to: user.phone,
                body: `كود استعاده كلمه المرور UniVerse: ${code}\nصالح لمدة 10 دقائق`,
              }),
            });
            results.push("whatsapp");
          } catch (e) { console.error("[forgot-password] whatsapp error:", e); }
        }
      }

      if (results.length === 0) throw Object.assign(new Error("فشل إرسال الكود، حاول مرة أخرى"), { status: 500 });

      await sql`DELETE FROM verification_codes WHERE (email = ${user.email || ""} OR phone = ${user.phone || ""}) AND verified = false`;
      await sql`INSERT INTO verification_codes (email, phone, code, type, expires_at) VALUES (${user.email || null}, ${user.phone || null}, ${code}, 'password_reset', ${expiresAt})`;
      return { sentTo: results, identifier: user.email || user.phone };
    });
  }

  if (action === "verify-reset-code") {
    return handle(async () => {
      let { email, phone, code } = await req.json();
      if (!code) throw Object.assign(new Error("الكود مطلوب"), { status: 400 });

      if (phone) {
        phone = phone.replace(/[^0-9]/g, "");
        if (phone.startsWith("0")) phone = "+2" + phone;
        else if (!phone.startsWith("+")) phone = "+" + phone;
      }

      const [row] = await sql`
        SELECT * FROM verification_codes 
        WHERE (email = ${email || ""} OR phone = ${phone || ""}) 
        AND code = ${code} AND verified = false AND type = 'password_reset'
        AND expires_at > NOW() 
        ORDER BY created_at DESC LIMIT 1`;
      if (!row) throw Object.assign(new Error("الكود غير صحيح أو منتهي الصلاحية"), { status: 400 });

      await sql`UPDATE verification_codes SET verified = true WHERE id = ${row.id}`;
      return { verified: true };
    });
  }

  if (action === "reset-password") {
    return handle(async () => {
      let { email, phone, code, newPassword } = await req.json();
      if (!newPassword || newPassword.length < 6) throw Object.assign(new Error("كلمة المرور الجديدة لازم تكون 6 حروف على الأقل"), { status: 400 });

      if (phone) {
        phone = phone.replace(/[^0-9]/g, "");
        if (phone.startsWith("0")) phone = "+2" + phone;
        else if (!phone.startsWith("+")) phone = "+" + phone;
      }

      const [row] = await sql`
        SELECT * FROM verification_codes 
        WHERE (email = ${email || ""} OR phone = ${phone || ""}) 
        AND code = ${code} AND verified = true AND type = 'password_reset'
        AND expires_at > NOW() 
        ORDER BY created_at DESC LIMIT 1`;
      if (!row) throw Object.assign(new Error("الكود غير صحيح أو منتهي الصلاحية"), { status: 400 });

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      if (email) await sql`UPDATE users SET password = ${hashedPassword} WHERE email = ${email}`;
      else if (phone) await sql`UPDATE users SET password = ${hashedPassword} WHERE phone = ${phone}`;

      await sql`DELETE FROM verification_codes WHERE id = ${row.id}`;

      let user;
      if (email) [user] = await sql`SELECT id, role FROM users WHERE email = ${email} LIMIT 1`;
      else [user] = await sql`SELECT id, role FROM users WHERE phone = ${phone} LIMIT 1`;

      const token = generateToken(user.id, user.role);
      return { userId: user.id, role: user.role, token, message: "تم تغيير كلمة المرور بنجاح" };
    });
  }

  if (action === "resend-code") {
    return handle(async () => {
      let { email, phone } = await req.json();
      if (!email && !phone) throw Object.assign(new Error("الإيميل أو الرقم مطلوب"), { status: 400 });

      if (phone) {
        phone = phone.replace(/[^0-9]/g, "");
        if (phone.startsWith("0")) phone = "+2" + phone;
        else if (!phone.startsWith("+")) phone = "+" + phone;
      }

      const [last] = await sql`
        SELECT * FROM verification_codes 
        WHERE (email = ${email || ""} OR phone = ${phone || ""}) 
        AND verified = false 
        ORDER BY created_at DESC LIMIT 1`;

      const delays = [60, 300, 600, 1800, 3600];
      const attempt = last?.resend_attempts || 0;
      const delay = delays[Math.min(attempt, delays.length - 1)];

      if (last) {
        const elapsed = (Date.now() - new Date(last.last_sent_at).getTime()) / 1000;
        if (elapsed < delay) throw Object.assign(
          new Error(`انتظر ${Math.ceil(delay - elapsed)} ثانية قبل إعادة الإرسال`),
          { status: 429, retryAfter: Math.ceil(delay - elapsed) }
        );
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const ultraMsgToken = process.env.ULTRAMSG_TOKEN;
      const ultraMsgId = process.env.ULTRAMSG_INSTANCE_ID;

      if (email) {
        const m = getMailer();
        if (m) {
          try {
            await m.sendMail({
              from: `"UniVerse" <${process.env.GMAIL_USER}>`,
              to: email,
              subject: "كود تأكيد جديد - UniVerse",
              html: `<div style="font-family:sans-serif;padding:24px;max-width:480px;margin:auto"><h2 style="color:#16a34a">إعادة إرسال الكود</h2><p>كود التأكيد الجديد:</p><div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#f0fdf4;border-radius:12px;direction:ltr">${code}</div><p style="color:#666;font-size:14px">الكود صالح لمدة 10 دقائق</p></div>`,
            });
          } catch (e) { console.error("[resend-code] email error:", e); }
        }
      }

      if (phone && ultraMsgToken && ultraMsgId) {
        try {
          await fetch(`https://api.ultramsg.com/${ultraMsgId}/messages/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: ultraMsgToken,
              to: phone,
              body: `كود تأكيد جديد UniVerse: ${code}\nصالح لمدة 10 دقائق`,
            }),
          });
        } catch (e) { console.error("[resend-code] whatsapp error:", e); }
      }

      await sql`DELETE FROM verification_codes WHERE (email = ${email || ""} OR phone = ${phone || ""}) AND verified = false`;
      await sql`INSERT INTO verification_codes (email, phone, code, type, expires_at, resend_attempts) VALUES (${email || null}, ${phone || null}, ${code}, 'email', ${expiresAt}, ${attempt + 1})`;

      return { sent: true };
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
      points: user.points, coins: user.coins ?? 0, level: user.level, streak: user.streak, title: user.title,
      uniqueCode: user.unique_code, adminPermissions: user.admin_permissions,
      emailVerified: user.email_verified, phoneVerified: user.phone_verified,
      unreadCount, unreadDmCount,
      onboarded: !!user.onboarded_at,
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

async function handleOnboardingSeen(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    await sql`UPDATE users SET onboarded_at = now() WHERE id = ${userId}`;
    return { ok: true };
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

async function handleAdminOverview(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const user = await getCurrentUser(userId);
    requireRole(user, ["admin", "super_admin"]);
    const [{ totalStudents }] = await sql`SELECT count(*)::int AS "totalStudents" FROM users WHERE role = 'student'`;
    const [{ totalStaff }] = await sql`SELECT count(*)::int AS "totalStaff" FROM users WHERE role IN ('doctor', 'ta', 'admin', 'super_admin')`;
    const [{ activeExams }] = await sql`SELECT count(*)::int AS "activeExams" FROM quizzes`;
    const [{ totalVisits }] = await sql`SELECT count(*)::int AS "totalVisits" FROM visits WHERE created_at > now() - interval '24 hours'`;
    const [{ totalLikes }] = await sql`SELECT (SELECT count(*) FROM talent_likes) + (SELECT count(*) FROM forum_post_likes) AS "totalLikes"`;

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
      totalStudents, totalStaff, activeExams, totalVisits, totalLikes, todayActivity: weeklyEngagement[6].activeUsers,
      aiUsageToday, weeklyEngagement, departmentBreakdown: deptRows, pointsDistribution, alerts,
    };
  });
}

async function handleAdminUsers(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const user = await getCurrentUser(userId);
    requireRole(user, ["admin", "super_admin"]);
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

async function handleAdminVisits(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const user = await getCurrentUser(userId);
    requireRole(user, ["admin", "super_admin"]);
    const url = new URL(req.url, "http://localhost");
    const since = url.searchParams.get("since") || (() => { const d = new Date(); d.setHours(d.getHours() - 24); return d.toISOString(); })();
    const rows = await sql`SELECT * FROM visits WHERE created_at > ${since} ORDER BY created_at DESC LIMIT 200`;
    return rows.map((v: any) => ({
      id: v.id, ip: v.ip, userAgent: v.user_agent, path: v.path,
      createdAt: v.created_at?.toISOString(),
    }));
  });
}

async function handleAdminLikes(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const user = await getCurrentUser(userId);
    requireRole(user, ["admin", "super_admin"]);

    const talentLikes = await sql`
      SELECT tl.id, tl.created_at, u.name AS user_name, u.username, t.title AS post_title, t.category
      FROM talent_likes tl
      JOIN users u ON u.id = tl.user_id
      JOIN talents t ON t.id = tl.talent_id
      ORDER BY tl.created_at DESC LIMIT 50
    `;

    const forumLikes = await sql`
      SELECT fpl.id, fpl.created_at, u.name AS user_name, u.username, fp.title AS post_title, fp.category
      FROM forum_post_likes fpl
      JOIN users u ON u.id = fpl.user_id
      JOIN forum_posts fp ON fp.id = fpl.post_id
      ORDER BY fpl.created_at DESC LIMIT 50
    `;

    return {
      talentLikes: talentLikes.map((l: any) => ({
        id: l.id, user_name: l.user_name, username: l.username,
        post_title: l.post_title, category: l.category,
        createdAt: l.created_at?.toISOString(),
      })),
      forumLikes: forumLikes.map((l: any) => ({
        id: l.id, user_name: l.user_name, username: l.username,
        post_title: l.post_title, category: l.category,
        createdAt: l.created_at?.toISOString(),
      })),
    };
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
          ...t, mediaUrl: t.media_url, createdAt: t.created_at?.toISOString(),
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
      const shuffled = [...questions].sort(() => Math.random() - 0.5);
      const out = shuffled.map((qq: any) => {
        const opts = qq.options.map((o: string, i: number) => ({ text: o, originalIndex: i }));
        const shuffledOpts = [...opts].sort(() => Math.random() - 0.5);
        return {
          id: qq.id,
          text: qq.text,
          type: qq.type,
          options: qq.type === "complete" ? [] : shuffledOpts.map((o: any) => o.text),
          optionMap: qq.type === "complete" ? [0] : shuffledOpts.map((o: any) => o.originalIndex),
          points: qq.points,
        };
      });
      return {
        quiz: {
          id: q.id, title: q.title, description: q.description, courseId: q.course_id,
          courseTitle: q.course_title, durationMinutes: q.duration_minutes,
          totalPoints: q.total_points, difficulty: q.difficulty,
          groupOnly: q.group_only, yearOnly: q.year_only, isOpen: q.is_open,
          randomize: q.randomize, passPercent: q.pass_percent,
          createdAt: q.created_at?.toISOString(),
        },
        questions: out,
      };
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
      for (const qq of questions) total += qq.points;
      const ans: any[] = [];
      for (const a of answers) {
        const qq = questions.find((x: any) => x.id === a.questionId);
        if (!qq) continue;
        let correct: boolean;
        if (qq.type === "complete") {
          const userText = (a as any).textAnswer || "";
          const expectedAnswer = qq.options[qq.correct_index] || "";
          correct = userText.trim().toLowerCase() === expectedAnswer.trim().toLowerCase();
        } else {
          correct = qq.correct_index === a.chosenOriginalIndex;
        }
        if (correct) score += qq.points;
        ans.push({
          questionId: qq.id,
          chosen: a.chosenOriginalIndex,
          correct,
          ...(qq.type === "complete" ? { textAnswer: (a as any).textAnswer || "" } : {}),
        });
      }
      const pct = total > 0 ? Math.round((score / total) * 100) : 0;
      const passed = pct >= (q.pass_percent || 50);
      const [attempt] = await sql`INSERT INTO quiz_attempts (quiz_id, user_id, score, total, duration_sec, answers, passed) VALUES (${id}, ${userId}, ${score}, ${total}, ${durationSec || 0}, ${JSON.stringify(ans)}, ${passed}) RETURNING *`;
      const pointsAwarded = Math.floor(score / 5) + (passed ? 10 : 0);
      await sql`UPDATE users SET points = points + ${pointsAwarded} WHERE id = ${userId}`;
      try { await recalculateLevel(userId); } catch (e) { console.error("[recalculateLevel]", e); }
      const questionDetails = questions.map((qq: any) => {
        const userAns = ans.find((a: any) => a.questionId === qq.id);
        const wasAnswered = !!userAns;
        return {
          questionId: qq.id, text: qq.text, type: qq.type,
          options: wasAnswered ? qq.options : [],
          correctIndex: wasAnswered ? qq.correct_index : -1,
          explanation: wasAnswered ? qq.explanation : "",
          points: qq.points,
          userChosen: userAns?.chosen ?? -1,
          correct: wasAnswered ? userAns.correct : false,
          ...(qq.type === "complete" ? { textAnswer: (userAns as any)?.textAnswer || "" } : {}),
        };
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
      const [q] = await sql`INSERT INTO quizzes (title, description, course_id, course_title, duration_minutes, total_points, difficulty, group_only, year_only, randomize, pass_percent, is_open) VALUES (${title}, ${description || ""}, ${courseId}, ${courseTitle || ""}, ${durationMinutes ?? 15}, ${totalPoints ?? 100}, ${difficulty || "medium"}, ${groupOnly || null}, ${yearOnly || null}, ${randomize ?? true}, ${passPercent ?? 50}, true) RETURNING *`;
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
    if (req.method === "GET" && !parts[4]) {
      return handle(async () => sql`SELECT * FROM quiz_questions WHERE quiz_id = ${Number(parts[2])} ORDER BY ord`);
    }
    if (req.method === "POST" && parts[4] === "bulk") {
      return handle(async () => {
        const quizId = Number(parts[2]);
        const body = await req.json();
        const questionsArr = body.questions;
        if (!Array.isArray(questionsArr) || !questionsArr.length) throw Object.assign(new Error("لم يتم إرسال أي أسئلة"), { status: 400 });
        let created = 0;
        for (const q of questionsArr) {
          const { text, type, options, correctIndex, points, explanation } = q;
          if (!text || !options || typeof correctIndex !== "number") throw Object.assign(new Error(`بيانات السؤال ناقصة: "${(text || "").slice(0, 50)}"`), { status: 400 });
          const [maxOrd] = await sql`SELECT MAX(ord) AS max FROM quiz_questions WHERE quiz_id = ${quizId}`;
          await sql`INSERT INTO quiz_questions (quiz_id, text, type, options, correct_index, points, explanation, ord) VALUES (${quizId}, ${text}, ${type || "mc"}, ${JSON.stringify(options)}, ${correctIndex}, ${points ?? 10}, ${explanation || ""}, ${(maxOrd?.max ?? 0) + 1})`;
          created++;
        }
        return { created };
      });
    }
    if (req.method === "POST" && !parts[4]) {
      return handle(async () => {
        const body = await req.json();
        const { text, type, options, correctIndex, points, explanation } = body;
        if (!text || !options || typeof correctIndex !== "number") throw Object.assign(new Error("بيانات السؤال ناقصة"), { status: 400 });
        const [maxOrd] = await sql`SELECT MAX(ord) AS max FROM quiz_questions WHERE quiz_id = ${Number(parts[2])}`;
        const [qq] = await sql`INSERT INTO quiz_questions (quiz_id, text, type, options, correct_index, points, explanation, ord) VALUES (${Number(parts[2])}, ${text}, ${type || "mc"}, ${JSON.stringify(options)}, ${correctIndex}, ${points ?? 10}, ${explanation || ""}, ${(maxOrd?.max ?? 0) + 1}) RETURNING *`;
        return qq;
      });
    }
    if (req.method === "DELETE") {
      return handle(async () => {
        const quizId = Number(parts[2]);
        await sql`DELETE FROM quiz_questions WHERE quiz_id = ${quizId}`;
        return { ok: true };
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
        const unread = msgs.filter((m: any) => m.from_id !== userId && !(m.read || m.is_read || m.read_at)).length;
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
          await sql`UPDATE dm_messages SET read = true WHERE thread_id = ${threadId} AND from_id != ${userId} AND read = false`;
        } catch {
          try {
            await sql`UPDATE dm_messages SET is_read = true WHERE thread_id = ${threadId} AND from_id != ${userId} AND (is_read IS NULL OR is_read = false)`;
          } catch {
            try {
              await sql`UPDATE dm_messages SET read_at = now() WHERE thread_id = ${threadId} AND from_id != ${userId} AND read_at IS NULL`;
            } catch {
              // column may not exist, silently ignore
            }
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
      let callerRole: string | null = null;
      if (currentUserId) {
        const [caller] = await sql`SELECT role FROM users WHERE id = ${currentUserId} LIMIT 1`;
        callerRole = caller?.role || null;
      }
      const canSeePII = currentUserId === user.id || callerRole === "admin" || callerRole === "super_admin";
      const safe: any = {
        id: user.id, name: user.name, username: user.username, role: user.role,
        title: user.title || null, bio: user.bio || null, department: user.department || "غير محدد",
        specialization: user.specialization || null, groupName: user.group_name || null,
        avatarUrl: user.avatar_url || null, points: user.points || 0, level: user.level || 1,
        streak: user.streak || 0, coins: user.coins || 0,
        year: user.year_in_college || null, yearInCollege: user.year_in_college || null,
        lastSeen: user.last_seen?.toISOString?.() ?? user.last_seen ?? null,
        createdAt: user.created_at?.toISOString?.() ?? user.created_at ?? null,
        followerCount, followingCount, totalLikesReceived: totalTalentLikes + totalForumLikes,
        forumPosts: forumPosts.map((p: any) => ({ ...p, createdAt: p.created_at?.toISOString?.() })),
        talents: talents.map((t: any) => ({ ...t, createdAt: t.created_at?.toISOString?.() })),
        summaries: summaries.map((s: any) => ({ ...s, createdAt: s.created_at?.toISOString?.() })),
        following,
      };
      if (canSeePII) {
        safe.email = user.email;
        safe.phone = user.phone;
        safe.uniqueCode = user.unique_code;
      }
      return safe;
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
      latestNews: news.map((n: any) => ({ ...n, imageUrl: n.image_url, publishedAt: n.published_at?.toISOString?.() ?? n.published_at, createdAt: n.created_at?.toISOString() })),
    });
  } catch (err: any) {
    console.error("🔴 [handleHomeFeed] Error:", err?.message);
    return jsonError(err?.message || "Internal Server Error", 500);
  }
}

async function handleNews(): Promise<Response> {
  return handle(async () => {
    const rows = await sql`SELECT * FROM news WHERE status = 'approved' ORDER BY published_at DESC`;
    return rows.map((r: any) => ({
      id: r.id, title: r.title, excerpt: r.excerpt, body: r.body, category: r.category,
      imageUrl: r.image_url, author: r.author,
      publishedAt: r.published_at?.toISOString?.() ?? r.published_at,
    }));
  });
}

async function handleNewsById(id: string): Promise<Response> {
  return handle(async () => {
    const [row] = await sql`SELECT * FROM news WHERE id = ${Number(id)} LIMIT 1`;
    if (!row) throw Object.assign(new Error("News not found"), { status: 404 });
    return {
      id: row.id, title: row.title, excerpt: row.excerpt, body: row.body, category: row.category,
      imageUrl: row.image_url, author: row.author,
      publishedAt: row.published_at?.toISOString?.() ?? row.published_at,
    };
  });
}

async function ensureSkillTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS user_skill_progress (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      lesson_id INT NOT NULL REFERENCES skill_lessons(id) ON DELETE CASCADE,
      track_id INT NOT NULL REFERENCES skill_tracks(id) ON DELETE CASCADE,
      completed BOOLEAN NOT NULL DEFAULT true,
      quick_check_score INT NOT NULL DEFAULT 0,
      level TEXT NOT NULL DEFAULT 'beginner',
      completed_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, lesson_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS skill_quick_checks (
      id SERIAL PRIMARY KEY,
      lesson_id INT NOT NULL REFERENCES skill_lessons(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      options JSONB NOT NULL,
      correct_index INT NOT NULL,
      explanation TEXT NOT NULL DEFAULT '',
      ord INT NOT NULL DEFAULT 0
    )
  `;
  try { await sql`ALTER TABLE skill_tracks ADD COLUMN IF NOT EXISTS year_in_college INT DEFAULT 0`; } catch {}
  try { await sql`ALTER TABLE skill_tracks ADD COLUMN IF NOT EXISTS prerequisites INT[] DEFAULT '{}'`; } catch {}
  try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS coins INT DEFAULT 0`; } catch {}
  try { await sql`CREATE INDEX IF NOT EXISTS idx_usp_user ON user_skill_progress (user_id)`; } catch {}
  try { await sql`CREATE INDEX IF NOT EXISTS idx_usp_track ON user_skill_progress (track_id)`; } catch {}
  try { await sql`CREATE INDEX IF NOT EXISTS idx_sqc_lesson ON skill_quick_checks (lesson_id)`; } catch {}
  await sql`
    CREATE TABLE IF NOT EXISTS lab_steps (
      id SERIAL PRIMARY KEY,
      lesson_id INT NOT NULL REFERENCES skill_lessons(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'info',
      config JSONB NOT NULL DEFAULT '{}',
      ord INT NOT NULL DEFAULT 0
    )
  `;
  try { await sql`CREATE INDEX IF NOT EXISTS idx_ls_lesson ON lab_steps (lesson_id)`; } catch {}
  await sql`
    CREATE TABLE IF NOT EXISTS lesson_notes (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      lesson_id INT NOT NULL REFERENCES skill_lessons(id) ON DELETE CASCADE,
      content TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, lesson_id)
    )
  `;
  try { await sql`CREATE INDEX IF NOT EXISTS idx_ln_user_lesson ON lesson_notes (user_id, lesson_id)`; } catch {}
}

function computeSkillLevel(totalLessons: number, completed: number, avgQuickCheckScore: number): string {
  if (totalLessons === 0) return "beginner";
  const pct = completed / totalLessons;
  if (pct >= 1 && avgQuickCheckScore >= 90) return "mastered";
  if (pct >= 1 && avgQuickCheckScore >= 70) return "practitioner";
  if (pct >= 0.5) return "learner";
  return "beginner";
}

const LAB_TEMPLATES: Record<string, { title: string; description: string; kind: string; config: any }[]> = {
  default: [
    { title: "نظرة عامة", description: "اقرأ التعليمات التالية بعناية قبل بدء التجربة.\n\nتأكد من توفر جميع الأدوات والمواد المطلوبة.", kind: "info", config: {} },
    { title: "المواد والأدوات", description: "المواد المطلوبة:\n• عينة التربة\n• ماء مقطر\n• ورق ترشيح\n• أنابيب اختبار", kind: "info", config: {} },
    { title: "خطوات العمل", description: "اتبع الخطوات التالية بالترتيب:\n1. ضع العينة في الأنبوب\n2. أضف الماء المقطر\n3. رجّ الأنبوب جيداً\n4. سجّل الملاحظات", kind: "info", config: {} },
    { title: "التسجيل", description: "سجّل نتائج ملاحظاتك في الحقل أدناه.", kind: "input", config: { placeholder: "أدخل ملاحظاتك هنا..." } },
    { title: "الاستنتاج", description: "بناءً على ما لاحظته، استنتج:\n• هل النتيجة متوقعة؟\n• ما التطبيق العملي لهذه التجربة؟", kind: "input", config: { placeholder: "اكتب استنتاجك..." } },
  ],
  soil: [
    { title: "الهدف من التجربة", description: "قياس درجة حموضة التربة (pH) لتحديد مدى ملاءمتها للمحاصيل المختلفة.", kind: "info", config: {} },
    { title: "الأدوات والمواد", description: "• عينة تربة (50 جم)\n• ماء مقطر (100 مل)\n• جهاز قياس pH\n• ورق ترشيح\n• دورق زجاجي\n• ملعقة خلط", kind: "info", config: {} },
    { title: "تحضير العينة", description: "1. ضع 50 جم من عينة التربة في الدورق الزجاجي.\n2. أضف 100 مل من الماء المقطر.\n3. حرّك المخلوط لمدة دقيقتين.\n4. اتركه لمدة 5 دقائق حتى تستقر العوالق.", kind: "info", config: {} },
    { title: "القياس", description: "1. اغمس جهاز قياس pH في المحلول.\n2. انتظر حتى يستقر الرقم.\n3. سجّل قراءة pH.", kind: "input", config: { placeholder: "أدخل قراءة pH...", unit: "pH" } },
    { title: "تحليل النتيجة", description: "• pH 6-7.5: مناسب لمعظم المحاصيل\n• pH < 6: تربة حمضية — تحتاج إضافة جير\n• pH > 7.5: تربة قلوية — تحتاج إضافة كبريت", kind: "info", config: {} },
    { title: "التوصيات", description: "بناءً على قراءتك:\n1. هل التربة مناسبة للزراعة؟\n2. أي المحاصيل تناسب هذه التربة؟\n3. ما التعديلات المطلوبة؟", kind: "input", config: { placeholder: "اكتب توصياتك..." } },
  ],
  plant: [
    { title: "الهدف من التجربة", description: "التعرف على أجزاء النبات المختلفة ووظائفها من خلال التشريح.", kind: "info", config: {} },
    { title: "الأدوات والمواد", description: "• نبتة طازجة (يفضل نبات بقولي)\n• مشرط حاد\n• عدسة مكبرة\n• ورق أبيض\n• ملقط", kind: "info", config: {} },
    { title: "الفحص الخارجي", description: "1. افحص النبات بالعين المجردة.\n2. حدّد الأجزاء الرئيسية: الجذر، الساق، الأوراق، الأزهار.\n3. سجّل ملاحظاتك عن شكل كل جزء.", kind: "input", config: { placeholder: "صف الأجزاء الخارجية..." } },
    { title: "تشريح الساق", description: "1. اقطع الساق عرضياً بالمشرط.\n2. ضع المقطع على الورق الأبيض.\n3. افحص بالعدسة المكبرة.\n4. لاحظ الحزم الوعائية.", kind: "info", config: {} },
    { title: "تشريح الورقة", description: "1. اقطع جزءاً صغيراً من الورقة.\n2. افحص سطح الورقة العلوي والسفلي.\n3. سجّل الفروق بين السطحين.", kind: "input", config: { placeholder: "سجّل ملاحظات تشريح الورقة..." } },
    { title: "الاستنتاج", description: "اكتب تقريراً موجزاً عن:\n• الأجزاء الرئيسية للنبات\n• وظيفة كل جزء\n• كيف تتكيف هذه النبتة مع بيئتها", kind: "input", config: { placeholder: "اكتب التقرير الختامي..." } },
  ],
};

async function seedLabSteps(lessonId: number, lessonTitle: string) {
  const title = lessonTitle.toLowerCase();
  let template = LAB_TEMPLATES.default;
  if (title.includes("تربة") || title.includes("ph") || title.includes("حمض") || title.includes("قلو")) {
    template = LAB_TEMPLATES.soil;
  } else if (title.includes("نبات") || title.includes("زرع") || title.includes("تشريح") || title.includes("محصول") || title.includes("بذ") || title.includes("جذر")) {
    template = LAB_TEMPLATES.plant;
  }
  for (let i = 0; i < template.length; i++) {
    const s = template[i];
    await sql`INSERT INTO lab_steps (lesson_id, title, description, kind, config, ord) VALUES (${lessonId}, ${s.title}, ${s.description}, ${s.kind}, ${JSON.stringify(s.config)}, ${i})`;
  }
}

async function ensureVisualCardsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS visual_cards (
      id SERIAL PRIMARY KEY,
      lesson_id INTEGER REFERENCES skill_lessons(id),
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT DEFAULT '',
      ord INTEGER DEFAULT 0
    )
  `;
}

const VISUAL_TEMPLATES: Record<string, { title: string; description: string; imageHint: string }[]> = {
  soil: [
    { title: "مقياس pH التربة", description: "pH يقاس من 0 إلى 14. التربة الحامضية أقل من 7، القلوية أكثر من 7، المتعادلة 7. معظم المحاصيل تنمو في pH 6-7.5", imageHint: "soil-ph-scale" },
    { title: "أنسجة التربة", description: "التربة الرملية: تصريف سريع - فقيرة بالماء. التربة الطينية: تصريف بطيء - غنية بالماء. التربة الطميية: مثالية للزراعة", imageHint: "soil-texture-triangle" },
    { title: "العناصر الغذائية الكبرى", description: "N نيتروجين: نمو خضري\nP فوسفور: جذور وأزهار\nK بوتاسيوم: جودة الثمار", imageHint: "npk-chart" },
  ],
  plant: [
    { title: "أجزاء النبات", description: "الجذر: امتصاص الماء والعناصر\nالساق: دعم ونقل\nالأوراق: بناء ضوئي\nالأزهار: تكاثر", imageHint: "plant-parts" },
    { title: "عملية البناء الضوئي", description: "CO₂ + H₂O → C₆H₁₂O₆ + O₂\nضوء الشمس + كلوروفيل + ماء + ثاني أكسيد كربون → سكر + أكسجين", imageHint: "photosynthesis" },
    { title: "أعراض نقص العناصر", description: "نقص N: اصفرار الأوراق السفلية\nنقص P: تلون بنفسجي\nنقص K: احتراق حواف الأوراق\nنقص Fe: اصفرار العروق", imageHint: "deficiency-symptoms" },
  ],
  default: [
    { title: "ملخص الدرس", description: "راجع النقاط الرئيسية من هذا الدرس لفهم أفضل للمحتوى", imageHint: "summary" },
    { title: "المصطلحات الأساسية", description: "تعرف على أهم المصطلحات والمفاهيم التي تم شرحها في الدرس", imageHint: "key-terms" },
  ],
};

async function seedVisualCards(lessonId: number, lessonTitle: string) {
  const title = lessonTitle.toLowerCase();
  let template = VISUAL_TEMPLATES.default;
  if (title.includes("تربة") || title.includes("ph") || title.includes("soil") || title.includes("حمض") || title.includes("قلو") || title.includes("عناصر")) {
    template = VISUAL_TEMPLATES.soil;
  } else if (title.includes("نبات") || title.includes("زرع") || title.includes("محصول") || title.includes("بذ") || title.includes("جذر") || title.includes("ورق") || title.includes("زهر")) {
    template = VISUAL_TEMPLATES.plant;
  }
  for (let i = 0; i < template.length; i++) {
    const c = template[i];
    await sql`INSERT INTO visual_cards (lesson_id, title, description, image_url, ord) VALUES (${lessonId}, ${c.title}, ${c.description}, ${`/images/${c.imageHint}.svg`}, ${i})`;
  }
}

async function handleSkills(req: Request, parts: string[]): Promise<Response> {
  await ensureSkillTables();

  // GET /skills/tracks or GET /v2/skills/tracks — list all tracks with lessons + per-user progress
  if (parts[1] === "tracks") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const tracks = await sql`SELECT * FROM skill_tracks`;
      if (!tracks.length) return [];
      const lessons = await sql`SELECT * FROM skill_lessons WHERE track_id = ANY(${tracks.map((t: any) => t.id)}) ORDER BY ord, id`;
      const userProgress = await sql`SELECT * FROM user_skill_progress WHERE user_id = ${userId}`;
      const quickChecks = await sql`SELECT * FROM skill_quick_checks ORDER BY ord`;

      return tracks.map((t: any) => {
        const trackLessons = lessons.filter((l: any) => l.track_id === t.id);
        const enrichedLessons = trackLessons.map((l: any) => {
          const prog = userProgress.find((p: any) => p.lesson_id === l.id);
          const lessonQCs = quickChecks.filter((qc: any) => qc.lesson_id === l.id);
          return {
            id: l.id, trackId: l.track_id, title: l.title,
            durationMinutes: l.duration_minutes, kind: l.kind,
            completed: prog ? prog.completed : false,
            quickCheckScore: prog ? prog.quick_check_score : 0,
            ord: l.ord,
            quickCheckCount: lessonQCs.length,
          };
        });
        const doneCount = enrichedLessons.filter((l: any) => l.completed).length;
        const totalCount = enrichedLessons.length;
        const trackQs = userProgress.filter((p: any) => p.track_id === t.id);
        const avgScore = trackQs.length ? trackQs.reduce((s: number, p: any) => s + p.quick_check_score, 0) / trackQs.length : 0;
        const level = computeSkillLevel(totalCount, doneCount, avgScore);
        const trackProgress = totalCount > 0 ? doneCount / totalCount : 0;
        return {
          id: t.id, title: t.title, category: t.category, description: t.description,
          difficulty: t.difficulty, coverUrl: t.cover_url, progress: trackProgress,
          level, lessons: enrichedLessons,
          yearInCollege: t.year_in_college ?? 0,
          prerequisites: t.prerequisites ?? [],
        };
      });
    });
  }

  // GET /skills/me — user's overall skill dashboard
  if (parts[1] === "me") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const tracks = await sql`SELECT * FROM skill_tracks`;
      if (!tracks.length) return { totalTracks: 0, totalLessons: 0, completedLessons: 0, progress: 0, level: "beginner", tracks: [] };
      const lessons = await sql`SELECT * FROM skill_lessons ORDER BY ord, id`;
      const userProgress = await sql`SELECT * FROM user_skill_progress WHERE user_id = ${userId}`;
      const user = await sql`SELECT * FROM users WHERE id = ${userId}`;
      const me = user[0];

      const trackSummaries = tracks.map((t: any) => {
        const trackLessons = lessons.filter((l: any) => l.track_id === t.id);
        const done = trackLessons.filter((l: any) => userProgress.find((p: any) => p.lesson_id === l.id && p.completed));
        const trackQPs = userProgress.filter((p: any) => p.track_id === t.id);
        const avgScore = trackQPs.length ? trackQPs.reduce((s: number, p: any) => s + p.quick_check_score, 0) / trackQPs.length : 0;
        return {
          id: t.id, title: t.title, category: t.category, difficulty: t.difficulty,
          totalLessons: trackLessons.length, completedLessons: done.length,
          progress: trackLessons.length ? done.length / trackLessons.length : 0,
          level: computeSkillLevel(trackLessons.length, done.length, avgScore),
        };
      });

      const totalLessons = lessons.length;
      const completedLessons = userProgress.filter((p: any) => p.completed).length;
      const overallProgress = totalLessons > 0 ? completedLessons / totalLessons : 0;
      const allAvgScore = userProgress.length ? userProgress.reduce((s: number, p: any) => s + p.quick_check_score, 0) / userProgress.length : 0;
      const overallLevel = computeSkillLevel(totalLessons, completedLessons, allAvgScore);

      return {
        totalTracks: tracks.length,
        totalLessons,
        completedLessons,
        progress: overallProgress,
        level: overallLevel,
        points: me?.points ?? 0,
        xpFromSkills: completedLessons * 5,
        tracks: trackSummaries,
      };
    });
  }

  // GET/POST /skills/notes/:lessonId — lesson notes
  if (parts[1] === "notes" && parts[2]) {
    const lessonId = Number(parts[2]);
    if (req.method === "GET") {
      return handle(async () => {
        const { userId } = requireAuth(req.headers);
        const [note] = await sql`SELECT * FROM lesson_notes WHERE user_id = ${userId} AND lesson_id = ${lessonId}`;
        return { lessonId, content: note?.content ?? "" };
      });
    }
    if (req.method === "POST") {
      return handle(async () => {
        const { userId } = requireAuth(req.headers);
        const body = await req.json();
        const { content } = body;
        await sql`
          INSERT INTO lesson_notes (user_id, lesson_id, content, updated_at)
          VALUES (${userId}, ${lessonId}, ${content || ""}, NOW())
          ON CONFLICT (user_id, lesson_id) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
        `;
        return { ok: true };
      });
    }
  }

  // GET /skills/recommendations — smart recommendations based on user profile + performance
  if (parts[1] === "recommendations") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const [u] = await sql`SELECT * FROM users WHERE id = ${userId}`;
      if (!u) return [];
      const tracks = await sql`SELECT * FROM skill_tracks ORDER BY id`;
      if (!tracks.length) return [];
      const lessons = await sql`SELECT * FROM skill_lessons ORDER BY ord, id`;
      const userProgress = await sql`SELECT * FROM user_skill_progress WHERE user_id = ${userId}`;
      const quizAttempts = await sql`SELECT qa.*, q.title AS quiz_title FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id WHERE qa.user_id = ${userId} ORDER BY qa.created_at DESC LIMIT 50`;

      const spec = (u.specialization || "").toLowerCase();
      const year = u.year_in_college || 1;
      const completedTrackIds = new Set(
        tracks.filter((t: any) => {
          const trackLessons = lessons.filter((l: any) => l.track_id === t.id);
          return trackLessons.length > 0 && trackLessons.every((l: any) => userProgress.find((p: any) => p.lesson_id === l.id && p.completed));
        }).map((t: any) => t.id)
      );

      // Find weak areas from quiz attempts
      const weakQuizTopics: string[] = [];
      for (const a of quizAttempts) {
        if (a.total > 0 && (a.score / a.total) < 0.6) {
          weakQuizTopics.push((a.quiz_title || "").toLowerCase());
        }
      }

      // Find weak categories from quick check scores
      const catScores: Record<string, { total: number; sum: number }> = {};
      for (const t of tracks) {
        const trackLessons = lessons.filter((l: any) => l.track_id === t.id);
        const qps = userProgress.filter((p: any) => trackLessons.some((l: any) => l.id === p.lesson_id));
        if (qps.length > 0) {
          catScores[t.category] = catScores[t.category] || { total: 0, sum: 0 };
          catScores[t.category].total += qps.length;
          catScores[t.category].sum += qps.reduce((s: number, p: any) => s + p.quick_check_score, 0);
        }
      }

      // Recommend tracks
      const recommendations: { trackId: number; reason: string; priority: number; xpEstimate: number; durationMinutes: number }[] = [];

      for (const t of tracks) {
        if (completedTrackIds.has(t.id)) continue;
        const trackLessons = lessons.filter((l: any) => l.track_id === t.id);
        const doneCount = trackLessons.filter((l: any) => userProgress.find((p: any) => p.lesson_id === l.id && p.completed)).length;
        const totalCount = trackLessons.length;
        const remainingXP = (totalCount - doneCount) * 5;
        const remainingMin = trackLessons.slice(doneCount).reduce((s: number, l: any) => s + l.duration_minutes, 0);

        let priority = 0;
        let reasons: string[] = [];

        // Track specialization match
        const title = t.title.toLowerCase();
        if (spec && (title.includes(spec) || spec.includes(t.category) || t.category === "practical" && spec.includes("زراع"))) {
          priority += 3;
          reasons.push(`يناسب تخصصك (${u.specialization})`);
        }

        // Year match
        if (t.difficulty === "beginner" && year <= 2) { priority += 2; reasons.push("مناسب لسنتك الدراسية"); }
        else if (t.difficulty === "intermediate" && year >= 2 && year <= 3) { priority += 2; reasons.push("مناسب لمستوى سنتك"); }
        else if (t.difficulty === "advanced" && year >= 3) { priority += 2; reasons.push("تحدٍ مناسب لسنتك"); }

        // In progress — high priority
        if (doneCount > 0 && doneCount < totalCount) { priority += 5; reasons.push("أكمل ما بدأته"); }

        // Near completion
        if (doneCount / totalCount >= 0.7) { priority += 3; reasons.push("على وشك الإنهاء"); }

        // Weak area match
        if (weakQuizTopics.some((topic) => title.includes(topic))) { priority += 4; reasons.push("يعالج نقاط ضعفك في الاختبارات"); }

        // Weak category
        const catAvg = catScores[t.category];
        if (catAvg && catAvg.total > 0 && catAvg.sum / catAvg.total < 70) { priority += 3; reasons.push(`حسّن مستواك في ${t.category}`); }

        if (reasons.length > 0) {
          recommendations.push({ trackId: t.id, reason: reasons.join(" · "), priority, xpEstimate: remainingXP, durationMinutes: remainingMin });
        }
      }

      // Not started tracks (low priority but useful)
      for (const t of tracks) {
        if (completedTrackIds.has(t.id)) continue;
        if (recommendations.some((r) => r.trackId === t.id)) continue;
        const trackLessons = lessons.filter((l: any) => l.track_id === t.id);
        const totalMin = trackLessons.reduce((s: number, l: any) => s + l.duration_minutes, 0);
        recommendations.push({ trackId: t.id, reason: `اكتشف مسار ${t.title}`, priority: 0, xpEstimate: trackLessons.length * 5, durationMinutes: totalMin });
      }

      recommendations.sort((a, b) => b.priority - a.priority);
      const topRecs = recommendations.slice(0, 5);

      // Personal summary
      const weakCats = Object.entries(catScores)
        .filter(([, v]: any) => v.total > 0 && v.sum / v.total < 70)
        .map(([k]) => k);
      const weakTopics = [...new Set(weakQuizTopics.map((t) => t.replace("اختبار ", "").trim()))];
      const summary = `مرحباً ${u.name || "طالب"}! أنت في السنة ${year} ${u.specialization ? `تخصص ${u.specialization}` : ""}. ${completedTrackIds.size > 0 ? `أكملت ${completedTrackIds.size} مسار${completedTrackIds.size > 1 ? "ات" : ""} حتى الآن.` : "لم تكمل أي مسار بعد."} ${weakCats.length > 0 ? `تحتاج تحسين في مجالات: ${weakCats.join("، ")}.` : ""}`;
      const weakAreas = [
        ...weakCats.map((c) => `ضعف في ${c}`),
        ...weakTopics.slice(0, 3).map((t) => `ضعف في ${t}`),
      ];

      return { summary, weakAreas: weakAreas.slice(0, 4), tracks: topRecs };
    });
  }

  // GET /skills/labs/:id — lab steps for a lesson
  if (parts[1] === "labs" && parts[2] && !parts[3]) {
    return handle(async () => {
      const lessonId = Number(parts[2]);
      if (isNaN(lessonId)) throw Object.assign(new Error("معرف الدرس غير صالح"), { status: 400 });
      const [lesson] = await sql`SELECT * FROM skill_lessons WHERE id = ${lessonId}`;
      if (!lesson) throw Object.assign(new Error("الدرس غير موجود"), { status: 404 });
      let steps = await sql`SELECT * FROM lab_steps WHERE lesson_id = ${lessonId} ORDER BY ord, id`;
      if (!steps.length) {
        await seedLabSteps(lessonId, lesson.title);
        steps = await sql`SELECT * FROM lab_steps WHERE lesson_id = ${lessonId} ORDER BY ord, id`;
      }
      return { lesson: { id: lesson.id, title: lesson.title, kind: lesson.kind }, steps: steps.map((s: any) => ({ id: s.id, title: s.title, description: s.description, kind: s.kind, config: s.config, ord: s.ord })) };
    });
  }

  // GET /skills/visual/:id — visual card / infographic for a lesson
  if (parts[1] === "visual" && parts[2] && !parts[3]) {
    return handle(async () => {
      const lessonId = Number(parts[2]);
      if (isNaN(lessonId)) throw Object.assign(new Error("معرف الدرس غير صالح"), { status: 400 });
      const [lesson] = await sql`SELECT * FROM skill_lessons WHERE id = ${lessonId}`;
      if (!lesson) throw Object.assign(new Error("الدرس غير موجود"), { status: 404 });
      await ensureVisualCardsTable();
      let cards = await sql`SELECT * FROM visual_cards WHERE lesson_id = ${lessonId} ORDER BY ord, id`;
      if (!cards.length) {
        await seedVisualCards(lessonId, lesson.title);
        cards = await sql`SELECT * FROM visual_cards WHERE lesson_id = ${lessonId} ORDER BY ord, id`;
      }
      return { lesson: { id: lesson.id, title: lesson.title, kind: lesson.kind }, cards: cards.map((c: any) => ({ id: c.id, title: c.title, description: c.description, imageUrl: c.image_url, ord: c.ord })) };
    });
  }

  // GET /skills/capstone/:id — generate capstone challenge for a track
  if (parts[1] === "capstone" && parts[2]) {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const trackId = Number(parts[2]);
      const [track] = await sql`SELECT * FROM skill_tracks WHERE id = ${trackId}`;
      if (!track) throw Object.assign(new Error("المسار غير موجود"), { status: 404 });
      const lessons = await sql`SELECT * FROM skill_lessons WHERE track_id = ${trackId} ORDER BY ord, id`;
      const qcs = await sql`SELECT * FROM skill_quick_checks WHERE lesson_id = ANY(${lessons.map((l: any) => l.id)}) ORDER BY ord`;
      const userProgress = await sql`SELECT * FROM user_skill_progress WHERE user_id = ${userId} AND track_id = ${trackId}`;

      // Build challenge from quick checks + generate scenario questions
      const challenges = qcs.map((qc: any) => ({
        id: qc.id, question: qc.question, options: qc.options,
      }));

      const doneCount = userProgress.filter((p: any) => p.completed).length;
      const totalCount = lessons.length;

      return {
        trackTitle: track.title,
        totalLessons: totalCount,
        completedLessons: doneCount,
        ready: doneCount === totalCount,
        challenge: challenges.slice(0, 10),
        timeEstimate: "10-15 دقيقة",
        xpReward: 50,
      };
    });
  }

  // GET /skills/flashcards/:id — generate flashcards for a track
  if (parts[1] === "flashcards" && parts[2]) {
    return handle(async () => {
      const trackId = Number(parts[2]);
      const [track] = await sql`SELECT * FROM skill_tracks WHERE id = ${trackId}`;
      if (!track) throw Object.assign(new Error("المسار غير موجود"), { status: 404 });
      const lessons = await sql`SELECT * FROM skill_lessons WHERE track_id = ${trackId} ORDER BY ord, id`;
      const qcs = await sql`SELECT * FROM skill_quick_checks WHERE lesson_id = ANY(${lessons.map((l: any) => l.id)}) ORDER BY ord`;
      const cards = qcs.map((qc: any, i: number) => ({
        id: i + 1,
        front: qc.question,
        back: qc.explanation || (qc.options[qc.correct_index] || ""),
        topic: lessons.find((l: any) => l.id === qc.lesson_id)?.title || "",
      }));
      // Add lesson title cards
      for (const lesson of lessons) {
        cards.push({ id: cards.length + 1, front: `ماذا تعرف عن: ${lesson.title}?`, back: `درس في مسار ${track.title} — مدته ${lesson.duration_minutes} دقائق`, topic: lesson.title });
      }
      return { trackTitle: track.title, cards: cards.slice(0, 20) };
    });
  }

  // GET /skills/:id — single track detail with per-user data + quick checks
  if (parts[1] && !isNaN(Number(parts[1])) && !parts[2]) {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const id = Number(parts[1]);
      const [track] = await sql`SELECT * FROM skill_tracks WHERE id = ${id}`;
      if (!track) throw Object.assign(new Error("المسار غير موجود"), { status: 404 });
      const lessons = await sql`SELECT * FROM skill_lessons WHERE track_id = ${id} ORDER BY ord, id`;
      const userProgress = await sql`SELECT * FROM user_skill_progress WHERE user_id = ${userId} AND track_id = ${id}`;
      const quickChecks = await sql`SELECT * FROM skill_quick_checks WHERE lesson_id = ANY(${lessons.map((l: any) => l.id)}) ORDER BY ord`;

      const enrichedLessons = lessons.map((l: any) => {
        const prog = userProgress.find((p: any) => p.lesson_id === l.id);
        const lessonQCs = quickChecks.filter((qc: any) => qc.lesson_id === l.id);
        return {
          id: l.id, trackId: l.track_id, title: l.title,
          durationMinutes: l.duration_minutes, kind: l.kind,
          completed: prog ? prog.completed : false,
          quickCheckScore: prog ? prog.quick_check_score : 0,
          ord: l.ord,
          quickChecks: lessonQCs.map((qc: any) => ({
            id: qc.id, question: qc.question, options: qc.options,
          })),
        };
      });
      const doneCount = enrichedLessons.filter((l: any) => l.completed).length;
      const totalCount = enrichedLessons.length;
      const avgScore = userProgress.length ? userProgress.reduce((s: number, p: any) => s + p.quick_check_score, 0) / userProgress.length : 0;
      const level = computeSkillLevel(totalCount, doneCount, avgScore);
      const trackProgress = totalCount > 0 ? doneCount / totalCount : 0;
      return {
        id: track.id, title: track.title, category: track.category, description: track.description,
        difficulty: track.difficulty, coverUrl: track.cover_url, progress: trackProgress,
        level, lessons: enrichedLessons,
        yearInCollege: track.year_in_college ?? 0,
        prerequisites: track.prerequisites ?? [],
      };
    });
  }

  // POST /skills/lessons/:id/complete
  if (parts[3] === "complete") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const id = Number(parts[2]);
      const [lesson] = await sql`SELECT * FROM skill_lessons WHERE id = ${id}`;
      if (!lesson) throw Object.assign(new Error("الدرس غير موجود"), { status: 404 });

      // Upsert per-user progress
      await sql`
        INSERT INTO user_skill_progress (user_id, lesson_id, track_id, completed, completed_at)
        VALUES (${userId}, ${id}, ${lesson.track_id}, true, NOW())
        ON CONFLICT (user_id, lesson_id) DO UPDATE SET completed = true, completed_at = NOW()
      `;

      // Recompute track progress from per-user data
      const all = await sql`SELECT * FROM skill_lessons WHERE track_id = ${lesson.track_id}`;
      const userDone = await sql`SELECT * FROM user_skill_progress WHERE user_id = ${userId} AND track_id = ${lesson.track_id} AND completed = true`;
      const progress = all.length ? userDone.length / all.length : 0;
      await sql`UPDATE skill_tracks SET progress = ${progress} WHERE id = ${lesson.track_id}`;

      // Compute level
      const userProgress = await sql`SELECT * FROM user_skill_progress WHERE user_id = ${userId} AND track_id = ${lesson.track_id}`;
      const avgScore = userProgress.length ? userProgress.reduce((s: number, p: any) => s + p.quick_check_score, 0) / userProgress.length : 0;
      const level = computeSkillLevel(all.length, userDone.length, avgScore);
      await sql`UPDATE user_skill_progress SET level = ${level} WHERE user_id = ${userId} AND track_id = ${lesson.track_id}`;

      // Award points
      await sql`UPDATE users SET points = points + 5 WHERE id = ${userId}`;
      try { await recalculateLevel(userId); } catch (e) { console.error("[recalculateLevel]", e); }
      try { await autoCompleteMissions(userId, "skill"); } catch (e) { console.error("[autoCompleteMissions skill]", e); }
      try { await updateDailyStreak(userId); } catch (e) { console.error("[updateDailyStreak skill]", e); }

      return { ok: true, level, progress, xpEarned: 5 };
    });
  }

  // POST /skills/quick-checks/:id/submit — submit a quick check answer
  if (parts[1] === "quick-checks" && parts[3] === "submit") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const qcId = Number(parts[2]);
      const body = await req.json();
      const { answer, lessonId } = body;
      const [qc] = await sql`SELECT * FROM skill_quick_checks WHERE id = ${qcId}`;
      if (!qc) throw Object.assign(new Error("السؤال غير موجود"), { status: 404 });
      const correct = answer === qc.correct_index;
      const score = correct ? 100 : 0;

      // Update user's quick check score for this lesson
      const [existing] = await sql`SELECT * FROM user_skill_progress WHERE user_id = ${userId} AND lesson_id = ${lessonId}`;
      if (existing) {
        const newScore = Math.max(existing.quick_check_score, score);
        await sql`UPDATE user_skill_progress SET quick_check_score = ${newScore} WHERE id = ${existing.id}`;
      }

      if (correct) {
        await sql`UPDATE users SET points = points + 3 WHERE id = ${userId}`;
        try { await recalculateLevel(userId); } catch {}
      }

      return { correct, correctIndex: qc.correct_index, explanation: qc.explanation, xpEarned: correct ? 3 : 0 };
    });
  }

  return jsonError("Not Found", 404);
}

const GAME_MAX_SCORES: Record<string, number> = {
  soil_match: 850, plant_quiz: 1000, harvest_run: 1500, plant_id: 960, soil_ph: 1500,
  crop_match: 1200, disease_detect: 1400, case_battle: 2000,
};

async function handleGames(req: Request, parts: string[]): Promise<Response> {
  if (parts[1] === "score" && req.method === "POST") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const body = await req.json();
      const { gameKey, score, durationMs } = body;
      if (!gameKey || typeof score !== "number") throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
      const maxScore = GAME_MAX_SCORES[gameKey] ?? 1000;
      const clampedScore = Math.min(Math.max(0, Math.floor(score)), maxScore);
      const [bestRow] = await sql`SELECT MAX(score) AS best FROM game_scores WHERE user_id = ${userId} AND game_key = ${gameKey}`;
      const isNewBest = clampedScore > (bestRow?.best ?? -1);
      const [row] = await sql`INSERT INTO game_scores (user_id, game_key, score, duration_ms) VALUES (${userId}, ${gameKey}, ${clampedScore}, ${durationMs ?? 0}) RETURNING *`;
      if (isNewBest) {
        const earnedXP = Math.floor(clampedScore / 10);
        const earnedCoins = Math.floor(clampedScore / 100);
        await sql`UPDATE users SET points = points + ${earnedXP}, coins = coins + ${earnedCoins} WHERE id = ${userId}`;
        try { await recalculateLevel(userId); } catch (e) { console.error("[recalculateLevel]", e); }
      }
      try { await autoCompleteMissions(userId, "game"); } catch (e) { console.error("[autoCompleteMissions game]", e); }
      try { await updateDailyStreak(userId); } catch (e) { console.error("[updateDailyStreak game]", e); }
      // Update challenge progress
      try {
        await ensureChallengesTable();
        const today = new Date().toISOString().split("T")[0];
        await sql`UPDATE game_challenges SET progress = LEAST(progress + ${clampedScore}, target_score) WHERE user_id = ${userId} AND created_date = ${today} AND game_key = ${gameKey} AND completed = false`;
        // Auto-complete challenges that meet target
        await sql`UPDATE game_challenges SET completed = true, progress = target_score WHERE user_id = ${userId} AND created_date = ${today} AND game_key = ${gameKey} AND progress >= target_score AND completed = false`;
        // Award XP for completed challenges
        const [completed] = await sql`SELECT * FROM game_challenges WHERE user_id = ${userId} AND created_date = ${today} AND game_key = ${gameKey} AND completed = true AND progress >= target_score`;
        if (completed) {
          await sql`UPDATE users SET points = points + ${completed.xp_reward} WHERE id = ${userId}`;
        }
      } catch (e) { console.error("[challenge progress]", e); }
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

  if (parts[1] === "my-scores" && req.method === "GET") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const limit = Math.min(Number(new URL(req.url, "http://localhost").searchParams.get("limit")) || 50, 200);
      const rows = await sql`SELECT * FROM game_scores WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit}`;
      return rows.map((r: any) => ({
        id: r.id, gameKey: r.game_key, score: r.score, durationMs: r.duration_ms,
        createdAt: r.created_at?.toISOString?.() ?? r.created_at,
      }));
    });
  }

  if (parts[1] === "stats" && req.method === "GET") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const rows = await sql`SELECT * FROM game_scores WHERE user_id = ${userId}`;
      const byGame = new Map<string, { count: number; best: number; total: number; stars3: number; stars2: number; stars1: number }>();
      for (const r of rows) {
        const gk = r.game_key as string;
        if (!byGame.has(gk)) byGame.set(gk, { count: 0, best: 0, total: 0, stars3: 0, stars2: 0, stars1: 0 });
        const s = byGame.get(gk)!;
        s.count++;
        s.total += r.score;
        if (r.score > s.best) s.best = r.score;
        const maxScore = GAME_MAX_SCORES[gk] ?? 1000;
        const pct = maxScore > 0 ? r.score / maxScore : 0;
        if (pct >= 0.8) s.stars3++;
        else if (pct >= 0.5) s.stars2++;
        else if (r.score > 0) s.stars1++;
      }
      const totals = { gamesPlayed: rows.length, totalScore: rows.reduce((a: number, r: any) => a + r.score, 0), totalXP: Math.floor(rows.reduce((a: number, r: any) => a + r.score, 0) / 10) };
      return { byGame: Object.fromEntries(byGame), totals };
    });
  }

  // GET /v2/games/replay/:id
  if (parts[1] === "replay" && parts[2]) {
    return handle(async () => {
      const scoreId = Number(parts[2]);
      const [score] = await sql`SELECT * FROM game_scores WHERE id = ${scoreId}`;
      if (!score) throw Object.assign(new Error("النتيجة غير موجودة"), { status: 404 });
      const [u] = await sql`SELECT name, avatar_url FROM users WHERE id = ${score.user_id}`;
      return {
        id: score.id,
        gameKey: score.game_key,
        score: score.score,
        durationMs: score.duration_ms,
        user: u || { name: "طالب" },
        createdAt: score.created_at,
      };
    });
  }

  return jsonError("Not Found", 404);
}

// ── Challenges System ──
async function ensureChallengesTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS game_challenges (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id),
      challenge_type TEXT NOT NULL DEFAULT 'daily',
      game_key TEXT,
      target_score INT NOT NULL DEFAULT 1000,
      xp_reward INT NOT NULL DEFAULT 50,
      progress INT NOT NULL DEFAULT 0,
      completed BOOLEAN DEFAULT false,
      week_start DATE,
      created_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  try { await sql`CREATE INDEX IF NOT EXISTS idx_challenges_user_date ON game_challenges (user_id, created_date)`; } catch {}
}

async function ensureSeasonalEventsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS seasonal_events (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      game_key TEXT,
      xp_reward INT NOT NULL DEFAULT 50,
      badge_title TEXT,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

async function ensureDailyRewardsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS daily_rewards (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id),
      claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
      reward_type TEXT NOT NULL DEFAULT 'xp',
      reward_value INT NOT NULL DEFAULT 10,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  try { await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_rewards_user_date ON daily_rewards (user_id, claim_date)`; } catch {}
}

async function handleChallenges(req: Request, parts: string[]): Promise<Response> {
  const { userId } = requireAuth(req.headers);

  // GET /v2/challenges — today's challenges + progress
  if (!parts[1]) {
    return handle(async () => {
      await ensureChallengesTable();
      const today = new Date().toISOString().split("T")[0];
      let challenges = await sql`SELECT * FROM game_challenges WHERE user_id = ${userId} AND created_date = ${today} ORDER BY id`;
      if (!challenges.length) {
        // Generate a daily challenge based on a random game
        const gameKeys = Object.keys(GAME_MAX_SCORES);
        const gameKey = gameKeys[Math.floor(Math.random() * gameKeys.length)];
        const maxScore = GAME_MAX_SCORES[gameKey];
        const target = Math.round(maxScore * 0.7);
        await sql`INSERT INTO game_challenges (user_id, challenge_type, game_key, target_score, xp_reward, progress, created_date) VALUES (${userId}, 'daily', ${gameKey}, ${target}, 50, 0, ${today})`;
        challenges = await sql`SELECT * FROM game_challenges WHERE user_id = ${userId} AND created_date = ${today} ORDER BY id`;
      }
      return challenges.map((c: any) => ({
        id: c.id,
        type: c.challenge_type,
        gameKey: c.game_key,
        targetScore: c.target_score,
        xpReward: c.xp_reward,
        progress: c.progress,
        completed: c.completed,
      }));
    });
  }

  // POST /v2/challenges/claim — claim daily reward chest
  if (parts[1] === "claim") {
    return handle(async () => {
      await ensureDailyRewardsTable();
      const today = new Date().toISOString().split("T")[0];
      const [existing] = await sql`SELECT * FROM daily_rewards WHERE user_id = ${userId} AND claim_date = ${today}`;
      if (existing) throw Object.assign(new Error("لقد حصلت على المكافأة اليومية بالفعل"), { status: 400 });
      // Random reward: 10-50 XP, sometimes a bonus
      const xpValues = [10, 15, 20, 25, 30, 50];
      const xp = xpValues[Math.floor(Math.random() * xpValues.length)];
      await sql`INSERT INTO daily_rewards (user_id, claim_date, reward_type, reward_value) VALUES (${userId}, ${today}, 'xp', ${xp})`;
      await sql`UPDATE users SET points = points + ${xp} WHERE id = ${userId}`;
      try { await recalculateLevel(userId); } catch {}
      return { xp, type: "xp", message: `+${xp} XP مكافأة يومية! 🎁` };
    });
  }

  return jsonError("Not Found", 404);
}

async function handleSeasonalEventsRoute(req: Request): Promise<Response> {
  return handle(async () => {
    await ensureSeasonalEventsTable();
    // Seed default events if none exist
    const count = await sql`SELECT COUNT(*) as cnt FROM seasonal_events WHERE active = true`;
    if (!count.length || count[0].cnt === 0) {
      const today = new Date();
      const end = new Date(today); end.setDate(end.getDate() + 7);
      await sql`INSERT INTO seasonal_events (title, description, game_key, xp_reward, badge_title, start_date, end_date) VALUES
        ('تحدي التربة', 'تنافس مع زملائك في لعبة توازن التربة — أفضل 3 لاعبين يفوزون بشارة خاصة', 'soil_ph', 80, 'Soil Master', ${today.toISOString().split("T")[0]}, ${end.toISOString().split("T")[0]}),
        ('موسم الزراعة', 'العب ذاكرة المحاصيل واجمع أكبر عدد من النقاط', 'soil_match', 50, NULL, ${today.toISOString().split("T")[0]}, ${end.toISOString().split("T")[0]})
      `;
    }
    const todayStr = new Date().toISOString().split("T")[0];
    const events = await sql`SELECT * FROM seasonal_events WHERE active = true AND start_date <= ${todayStr} AND end_date >= ${todayStr} ORDER BY id`;
    return events.map((e: any) => ({
      id: e.id, title: e.title, description: e.description, gameKey: e.game_key,
      xpReward: e.xp_reward, badgeTitle: e.badge_title,
      startDate: e.start_date?.toISOString?.()?.split("T")[0] || e.start_date,
      endDate: e.end_date?.toISOString?.()?.split("T")[0] || e.end_date,
    }));
  });
}

// ── Study Rooms ──
async function ensureStudyRoomsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS study_rooms (
      id SERIAL PRIMARY KEY,
      track_id INT,
      title TEXT NOT NULL,
      description TEXT,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS study_room_members (
      id SERIAL PRIMARY KEY,
      room_id INT NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
      user_id INT NOT NULL,
      joined_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(room_id, user_id)
    )
  `;
}

async function handleStudyRooms(req: Request, parts: string[]): Promise<Response> {
  const { userId } = requireAuth(req.headers);

  if (!parts[0] || parts[0] === "create") {
    return handle(async () => {
      await ensureStudyRoomsTable();
      const rows = await sql`
        SELECT r.*, (SELECT COUNT(*) FROM study_room_members m WHERE m.room_id = r.id) as member_count
        FROM study_rooms r ORDER BY r.created_at DESC
      `;
      const trackIds = rows.map((r: any) => r.track_id).filter(Boolean);
      const tracks = trackIds.length ? await sql`SELECT id, title FROM skill_tracks WHERE id = ANY(${trackIds})` : [];
      const trackMap = new Map(tracks.map((t: any) => [t.id, t.title]));
      const userIds = rows.map((r: any) => r.created_by);
      const users = userIds.length ? await sql`SELECT id, name FROM users WHERE id = ANY(${userIds})` : [];
      const userMap = new Map(users.map((u: any) => [u.id, u.name]));
      const memberRows = await sql`SELECT room_id FROM study_room_members WHERE user_id = ${userId}`;
      const myRoomIds = new Set(memberRows.map((r: any) => r.room_id));
      return rows.map((r: any) => ({
        id: r.id, trackId: r.track_id, trackTitle: trackMap.get(r.track_id) || null,
        title: r.title, description: r.description,
        createdBy: r.created_by, createdByName: userMap.get(r.created_by) || "طالب",
        memberCount: Number(r.member_count), isMember: myRoomIds.has(r.id),
      }));
    });
  }

  if (parts[0] === "create") {
    return handle(async () => {
      await ensureStudyRoomsTable();
      const body = await req.json();
      const { title, description, trackId } = body;
      if (!title) throw Object.assign(new Error("عنوان الغرفة مطلوب"), { status: 400 });
      const [row] = await sql`INSERT INTO study_rooms (title, description, track_id, created_by) VALUES (${title}, ${description || ""}, ${trackId || null}, ${userId}) RETURNING *`;
      await sql`INSERT INTO study_room_members (room_id, user_id) VALUES (${row.id}, ${userId})`;
      return row;
    });
  }

  if (parts[0] === "join" && parts[1]) {
    return handle(async () => {
      await ensureStudyRoomsTable();
      const roomId = Number(parts[1]);
      const [room] = await sql`SELECT * FROM study_rooms WHERE id = ${roomId}`;
      if (!room) throw Object.assign(new Error("الغرفة غير موجودة"), { status: 404 });
      try { await sql`INSERT INTO study_room_members (room_id, user_id) VALUES (${roomId}, ${userId})`; }
      catch { throw Object.assign(new Error("أنت بالفعل عضو في هذه الغرفة"), { status: 400 }); }
      return { ok: true };
    });
  }

  if (parts[0] === "leave" && parts[1]) {
    return handle(async () => {
      await ensureStudyRoomsTable();
      const roomId = Number(parts[1]);
      await sql`DELETE FROM study_room_members WHERE room_id = ${roomId} AND user_id = ${userId}`;
      return { ok: true };
    });
  }

  return jsonError("Not Found", 404);
}

// ── Co-op Challenges ──
async function ensureCoopTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS team_challenges (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      game_key TEXT NOT NULL,
      target_score INT NOT NULL DEFAULT 1000,
      xp_reward INT NOT NULL DEFAULT 75,
      start_date DATE NOT NULL DEFAULT CURRENT_DATE,
      end_date DATE NOT NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS team_challenge_participants (
      id SERIAL PRIMARY KEY,
      challenge_id INT NOT NULL REFERENCES team_challenges(id) ON DELETE CASCADE,
      user_id INT NOT NULL,
      team_name TEXT NOT NULL DEFAULT '',
      score INT NOT NULL DEFAULT 0,
      completed BOOLEAN DEFAULT false,
      joined_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(challenge_id, user_id)
    )
  `;
}

async function handleCoopChallenges(req: Request, parts: string[]): Promise<Response> {
  const { userId } = requireAuth(req.headers);

  if (!parts[0]) {
    return handle(async () => {
      await ensureCoopTables();
      const today = new Date().toISOString().split("T")[0];
      const rows = await sql`SELECT * FROM team_challenges WHERE end_date >= ${today} ORDER BY start_date ASC`;
      const myEntries = await sql`SELECT challenge_id, score, team_name FROM team_challenge_participants WHERE user_id = ${userId}`;
      const entryMap = new Map(myEntries.map((e: any) => [e.challenge_id, e]));
      return rows.map((c: any) => {
        const my = entryMap.get(c.id);
        return {
          id: c.id, title: c.title, gameKey: c.game_key, targetScore: c.target_score,
          xpReward: c.xp_reward, startDate: c.start_date, endDate: c.end_date,
          myScore: my?.score || 0, myTeamName: my?.team_name || "", joined: !!my,
        };
      });
    });
  }

  if (parts[0] === "join" && parts[1]) {
    return handle(async () => {
      await ensureCoopTables();
      const challengeId = Number(parts[1]);
      const body = await req.json();
      const teamName = body.teamName || "";
      const [challenge] = await sql`SELECT * FROM team_challenges WHERE id = ${challengeId}`;
      if (!challenge) throw Object.assign(new Error("التحدي غير موجود"), { status: 404 });
      try { await sql`INSERT INTO team_challenge_participants (challenge_id, user_id, team_name) VALUES (${challengeId}, ${userId}, ${teamName})`; }
      catch { throw Object.assign(new Error("أنت مشترك بالفعل"), { status: 400 }); }
      return { ok: true };
    });
  }

  if (parts[0] === "score" && parts[1]) {
    return handle(async () => {
      await ensureCoopTables();
      const challengeId = Number(parts[1]);
      const body = await req.json();
      const { score } = body;
      const [existing] = await sql`SELECT * FROM team_challenge_participants WHERE challenge_id = ${challengeId} AND user_id = ${userId}`;
      if (!existing) throw Object.assign(new Error("أنت غير مشترك في هذا التحدي"), { status: 400 });
      if (existing.completed) throw Object.assign(new Error("لقد سجلت نتيجتك بالفعل"), { status: 400 });
      await sql`UPDATE team_challenge_participants SET score = ${score}, completed = true WHERE challenge_id = ${challengeId} AND user_id = ${userId}`;
      await sql`UPDATE users SET points = points + ${Math.floor(score / 10)} WHERE id = ${userId}`;
      return { ok: true, xpEarned: Math.floor(score / 10) };
    });
  }

  return jsonError("Not Found", 404);
}

// ── Game Analytics ──
async function handleGameAnalytics(req: Request): Promise<Response> {
  const { userId } = requireAuth(req.headers);
  const user = await getCurrentUser(userId);
  requireRole(user, ["admin", "super_admin"]);

  return handle(async () => {
    const allScores = await sql`SELECT * FROM game_scores ORDER BY created_at DESC`;
    const totalPlayers = new Set(allScores.map((s: any) => s.user_id)).size;
    const byGame: Record<string, { plays: number; totalScore: number; avgScore: number; bestScore: number; players: Set<number> }> = {};
    for (const s of allScores) {
      const gk = s.game_key;
      if (!byGame[gk]) byGame[gk] = { plays: 0, totalScore: 0, avgScore: 0, bestScore: 0, players: new Set() };
      byGame[gk].plays++;
      byGame[gk].totalScore += s.score;
      if (s.score > byGame[gk].bestScore) byGame[gk].bestScore = s.score;
      byGame[gk].players.add(s.user_id);
    }
    const gameAnalytics = Object.entries(byGame).map(([gameKey, data]) => ({
      gameKey, plays: data.plays,
      avgScore: Math.round(data.totalScore / data.plays),
      bestScore: data.bestScore,
      totalScore: data.totalScore,
      uniquePlayers: data.players.size,
    }));
    return {
      totalGamesPlayed: allScores.length,
      totalUniquePlayers: totalPlayers,
      byGame: gameAnalytics.sort((a, b) => b.plays - a.plays),
    };
  });
}

// ── Weekly Tournament ──
async function handleTournament(req: Request, parts: string[]): Promise<Response> {
  return handle(async () => {
    const url = new URL(req.url, "http://localhost");
    const gameKey = url.searchParams.get("gameKey");
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    let rows;
    if (gameKey) {
      rows = await sql`SELECT s.user_id, MAX(s.score) AS best_score, COUNT(*) AS plays, SUM(score) AS total_score FROM game_scores s WHERE s.game_key = ${gameKey} AND s.created_at >= ${weekAgo} GROUP BY s.user_id ORDER BY best_score DESC LIMIT 20`;
    } else {
      rows = await sql`SELECT s.user_id, MAX(s.score) AS best_score, COUNT(*) AS plays, SUM(s.score) AS total_score FROM game_scores s WHERE s.created_at >= ${weekAgo} GROUP BY s.user_id ORDER BY total_score DESC LIMIT 20`;
    }
    const userIds = rows.map((r: any) => r.user_id);
    const users = userIds.length ? await sql`SELECT * FROM users WHERE id = ANY(${userIds})` : [];
    const byId = new Map(users.map((u: any) => [u.id, u]));
    return rows.map((r: any, i: number) => {
      const u = byId.get(Number(r.user_id));
      return {
        rank: i + 1,
        userId: r.user_id,
        userName: u?.name || "طالب",
        userAvatar: u?.avatar_url || null,
        bestScore: Number(r.best_score),
        totalScore: Number(r.total_score),
        plays: Number(r.plays),
      };
    });
  });
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

async function handleStreak(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    await ensureDailyStreaksTable();
    const [row] = await sql`SELECT * FROM user_daily_streaks WHERE user_id = ${userId}`;
    const today = new Date().toISOString().split("T")[0];
    const lastActive = row?.last_active_date?.toISOString().split("T")[0];
    const activeToday = lastActive === today;
    return {
      currentStreak: row?.current_streak ?? 0,
      longestStreak: row?.longest_streak ?? 0,
      lastActiveDate: lastActive ?? null,
      activeToday,
    };
  });
}

async function handleBadges(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const me = await getCurrentUser(userId);
    if (!me) return [];
    const userProgress = await sql`SELECT * FROM user_skill_progress WHERE user_id = ${me.id}`;
    const games = await sql`SELECT * FROM game_scores WHERE user_id = ${me.id}`;
    const tracks = await sql`SELECT * FROM skill_tracks`;
    const completedTracks = tracks.filter((t: any) => {
      const trackLessons = userProgress.filter((p: any) => p.track_id === t.id);
      const completed = trackLessons.filter((p: any) => p.completed);
      const total = trackLessons.length;
      return total > 0 && completed.length >= total;
    });
    const completedTrackNames = completedTracks.map((t: any) => t.title.toLowerCase());
    const threeStarGames = games.filter((g: any) => {
      const maxScore = GAME_MAX_SCORES[g.game_key] ?? 1000;
      return maxScore > 0 && g.score / maxScore >= 0.8;
    }).length;

    const badges = [
      {
        id: "soil-starter", title: "Soil Starter", desc: "أكمل مسار أساسيات التربة",
        unlocked: completedTrackNames.some((t: string) => t.includes("تربة") || t.includes("soil")),
        icon: "🪴", category: "مهارات",
      },
      {
        id: "plant-doctor", title: "Plant Doctor", desc: "أكمل مسار أمراض النبات",
        unlocked: completedTrackNames.some((t: string) => t.includes("أمراض") || t.includes("مرض") || t.includes("تشخيص")),
        icon: "🔬", category: "مهارات",
      },
      {
        id: "pest-hunter", title: "Pest Hunter", desc: "أكمل مسار مكافحة الآفات",
        unlocked: completedTrackNames.some((t: string) => t.includes("آفات") || t.includes("حشرات") || t.includes("مكافحة")),
        icon: "🐛", category: "مهارات",
      },
      {
        id: "lab-explorer", title: "Lab Explorer", desc: "أكمل 3 دروس مختبرية",
        unlocked: userProgress.filter((p: any) => p.completed && p.track_id > 0).length >= 3,
        icon: "🧪", category: "مهارات",
      },
      {
        id: "top-agronomist", title: "Top Agronomist", desc: "أكمل 5 مسارات مهارات",
        unlocked: completedTracks.length >= 5,
        icon: "🏅", category: "مهارات",
      },
      {
        id: "game-collector", title: "Game Collector", desc: "العب كل أنواع الألعاب",
        unlocked: new Set(games.map((g: any) => g.game_key)).size >= 8,
        icon: "🎮", category: "ألعاب",
      },
      {
        id: "memory-ace", title: "ذاكرة ممتازة", desc: "احصل على 3 نجوم في ذاكرة المحاصيل",
        unlocked: games.some((g: any) => g.game_key === "soil_match" && (GAME_MAX_SCORES.soil_match > 0 && g.score / GAME_MAX_SCORES.soil_match >= 0.8)),
        icon: "🧠", category: "ألعاب",
      },
      {
        id: "ph-master", title: "pH Master", desc: "احصل على 3 نجوم في توازن التربة",
        unlocked: games.some((g: any) => g.game_key === "soil_ph" && (GAME_MAX_SCORES.soil_ph > 0 && g.score / GAME_MAX_SCORES.soil_ph >= 0.8)),
        icon: "⚗️", category: "ألعاب",
      },
      {
        id: "crop-master", title: "Crop Master", desc: "احصل على 3 نجوم في مطابقة المحاصيل",
        unlocked: games.some((g: any) => g.game_key === "crop_match" && (GAME_MAX_SCORES.crop_match > 0 && g.score / GAME_MAX_SCORES.crop_match >= 0.8)),
        icon: "📅", category: "ألعاب",
      },
      {
        id: "detective", title: "Disease Detective", desc: "احصل على 3 نجوم في كشف الأمراض",
        unlocked: games.some((g: any) => g.game_key === "disease_detect" && (GAME_MAX_SCORES.disease_detect > 0 && g.score / GAME_MAX_SCORES.disease_detect >= 0.8)),
        icon: "🔬", category: "ألعاب",
      },
      {
        id: "strategist", title: "Agronomy Strategist", desc: "احصل على 3 نجوم في معركة القرار",
        unlocked: games.some((g: any) => g.game_key === "case_battle" && (GAME_MAX_SCORES.case_battle > 0 && g.score / GAME_MAX_SCORES.case_battle >= 0.8)),
        icon: "⚔️", category: "ألعاب",
      },
    ];
    return badges.map((b) => ({
      ...b,
      completed: b.unlocked,
      percent: b.unlocked ? 100 : 0,
    }));
  });
}

async function handleActivityHeatmap(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const activity = await sql`
      SELECT date, minutes_studied, points_earned FROM activity
      WHERE user_id = ${userId} AND date >= ${yearAgo.toISOString().split("T")[0]}
      ORDER BY date ASC
    `;
    const heatmap: Record<string, { minutes: number; points: number }> = {};
    for (const a of activity) {
      const d = typeof a.date === "string" ? a.date : new Date(a.date).toISOString().split("T")[0];
      heatmap[d] = { minutes: Number(a.minutes_studied), points: Number(a.points_earned) };
    }
    // Generate all dates for the past year
    const data: { date: string; minutes: number; points: number; level: number }[] = [];
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1);
    for (let i = 0; i < 365; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split("T")[0];
      const entry = heatmap[key];
      const minutes = entry?.minutes ?? 0;
      data.push({
        date: key,
        minutes,
        points: entry?.points ?? 0,
        level: minutes > 120 ? 4 : minutes > 60 ? 3 : minutes > 30 ? 2 : minutes > 0 ? 1 : 0,
      });
    }
    // Stats
    const totalMinutes = data.reduce((s, d) => s + d.minutes, 0);
    const activeDays = data.filter((d) => d.minutes > 0).length;
    const longestStreak = data.reduce((acc, d) => {
      if (d.minutes > 0) acc.current++;
      else acc.current = 0;
      acc.longest = Math.max(acc.longest, acc.current);
      return acc;
    }, { current: 0, longest: 0 }).longest;
    return { data, totalMinutes, activeDays, longestStreak, totalDays: 365 };
  });
}

const UNLOCKABLES = [
  { id: "title-soil-starter", type: "title", label: "Soil Starter", icon: "🪴", requirement: "أكمل مسار أساسيات التربة",
    check: async (uid: number) => {
      const up = await sql`SELECT * FROM user_skill_progress WHERE user_id = ${uid}`;
      const tr = await sql`SELECT * FROM skill_tracks`;
      const done = tr.filter((t: any) => {
        const l = up.filter((p: any) => p.track_id === t.id && p.completed);
        const q = up.filter((p: any) => p.track_id === t.id);
        return q.length > 0 && l.length >= q.length;
      });
      return done.some((t: any) => t.title.toLowerCase().includes("تربة") || t.title.toLowerCase().includes("soil"));
    }
  },
  { id: "title-plant-doctor", type: "title", label: "Plant Doctor", icon: "🔬", requirement: "أكمل مسار أمراض النبات",
    check: async (uid: number) => {
      const up = await sql`SELECT * FROM user_skill_progress WHERE user_id = ${uid}`;
      const tr = await sql`SELECT * FROM skill_tracks`;
      const done = tr.filter((t: any) => {
        const l = up.filter((p: any) => p.track_id === t.id && p.completed);
        const q = up.filter((p: any) => p.track_id === t.id);
        return q.length > 0 && l.length >= q.length;
      });
      return done.some((t: any) => t.title.toLowerCase().includes("أمراض") || t.title.toLowerCase().includes("تشخيص"));
    }
  },
  { id: "title-lab-explorer", type: "title", label: "Lab Explorer", icon: "🧪", requirement: "أكمل 3 مختبرات",
    check: async (uid: number) => {
      const up = await sql`SELECT * FROM user_skill_progress WHERE user_id = ${uid}`;
      return up.filter((p: any) => p.completed).length >= 3;
    }
  },
  { id: "title-game-master", type: "title", label: "Game Master", icon: "🎮", requirement: "العب 50 لعبة",
    check: async (uid: number) => {
      const games = await sql`SELECT * FROM game_scores WHERE user_id = ${uid}`;
      return games.length >= 50;
    }
  },
  { id: "frame-level-5", type: "frame", label: "إطار برونزي", icon: "🥉", requirement: "المستوى 5",
    check: async (uid: number) => {
      const [u] = await sql`SELECT * FROM users WHERE id = ${uid}`;
      return u?.level >= 5;
    }
  },
  { id: "frame-level-10", type: "frame", label: "إطار فضي", icon: "🥈", requirement: "المستوى 10",
    check: async (uid: number) => {
      const [u] = await sql`SELECT * FROM users WHERE id = ${uid}`;
      return u?.level >= 10;
    }
  },
  { id: "frame-level-20", type: "frame", label: "إطار ذهبي", icon: "🥇", requirement: "المستوى 20",
    check: async (uid: number) => {
      const [u] = await sql`SELECT * FROM users WHERE id = ${uid}`;
      return u?.level >= 20;
    }
  },
  { id: "frame-streak-7", type: "frame", label: "إطار متابع", icon: "🔥", requirement: "7 أيام متتالية",
    check: async (uid: number) => {
      const [s] = await sql`SELECT * FROM user_daily_streaks WHERE user_id = ${uid}`;
      return (s?.current_streak ?? 0) >= 7;
    }
  },
  { id: "frame-streak-30", type: "frame", label: "إطار ملتزم", icon: "💪", requirement: "30 يوم متتالي",
    check: async (uid: number) => {
      const [s] = await sql`SELECT * FROM user_daily_streaks WHERE user_id = ${uid}`;
      return (s?.current_streak ?? 0) >= 30;
    }
  },
  { id: "theme-nature", type: "theme", label: "الطبيعة", icon: "🌿", requirement: "10 دروس مهارات",
    check: async (uid: number) => {
      const up = await sql`SELECT * FROM user_skill_progress WHERE user_id = ${uid}`;
      return up.filter((p: any) => p.completed).length >= 10;
    }
  },
  { id: "theme-desert", type: "theme", label: "الصحراء", icon: "🏜️", requirement: "المستوى 15",
    check: async (uid: number) => {
      const [u] = await sql`SELECT * FROM users WHERE id = ${uid}`;
      return u?.level >= 15;
    }
  },
  { id: "theme-ocean", type: "theme", label: "المحيط", icon: "🌊", requirement: "أكمل 10 مسارات",
    check: async (uid: number) => {
      const up = await sql`SELECT * FROM user_skill_progress WHERE user_id = ${uid}`;
      const tr = await sql`SELECT * FROM skill_tracks`;
      return tr.filter((t: any) => {
        const l = up.filter((p: any) => p.track_id === t.id && p.completed);
        const q = up.filter((p: any) => p.track_id === t.id);
        return q.length > 0 && l.length >= q.length;
      }).length >= 10;
    }
  },
];

async function handleUnlockables(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const results = await Promise.all(UNLOCKABLES.map(async (u) => ({
      id: u.id, type: u.type, label: u.label, icon: u.icon, requirement: u.requirement,
      unlocked: await u.check(userId),
    })));
    const [me] = await sql`SELECT * FROM users WHERE id = ${userId}`;
    return {
      items: results,
      equipped: { title: me?.title ?? "", frame: me?.avatar_frame ?? "none", theme: me?.theme ?? "default" },
    };
  });
}

async function handleEquipUnlockable(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const body = await req.json();
    const { itemId } = body;
    if (!itemId) throw Object.assign(new Error("معرف القطعة مطلوب"), { status: 400 });
    const item = UNLOCKABLES.find((u) => u.id === itemId);
    if (!item) throw Object.assign(new Error("القطعة غير موجودة"), { status: 404 });
    const unlocked = await item.check(userId);
    if (!unlocked) throw Object.assign(new Error("لم يتم فتح هذه القطعة بعد"), { status: 403 });
    if (item.type === "title") await sql`UPDATE users SET title = ${item.label} WHERE id = ${userId}`;
    else if (item.type === "frame") await sql`UPDATE users SET avatar_frame = ${item.id} WHERE id = ${userId}`;
    else if (item.type === "theme") await sql`UPDATE users SET theme = ${item.id.replace("theme-", "")} WHERE id = ${userId}`;
    return { ok: true, type: item.type, value: item.label };
  });
}

async function handleActivity(req: Request): Promise<Response> {
  if (req.method === "POST") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const body = await req.json();
      const { minutes } = body;
      if (!minutes || minutes <= 0) throw Object.assign(new Error("Invalid minutes"), { status: 400 });
      // cap abuse: max 240 min per request, and cap daily total at 720 min
      const DAY_CAP = 720, REQ_CAP = 240;
      const today = new Date().toISOString().split("T")[0];
      const [cur] = await sql`SELECT * FROM activity WHERE user_id = ${userId} AND date = ${today}`;
      const already = Number(cur?.minutes_studied ?? 0);
      const allowed = Math.max(0, Math.min(Math.floor(minutes), REQ_CAP, DAY_CAP - already));
      if (allowed <= 0) return { loggedMinutes: 0, earnedPoints: 0, totalMinutes: already };
      const earnedPoints = Math.floor(allowed / 10);

      try { await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_user_date ON activity (user_id, date)`; } catch {}

      await sql`
        INSERT INTO activity (user_id, date, minutes_studied, points_earned)
        VALUES (${userId}, ${today}, ${allowed}, ${earnedPoints})
        ON CONFLICT (user_id, date) DO UPDATE
        SET minutes_studied = activity.minutes_studied + EXCLUDED.minutes_studied,
            points_earned = activity.points_earned + EXCLUDED.points_earned
      `;

      await sql`UPDATE users SET points = points + ${earnedPoints} WHERE id = ${userId}`;
      try { await recalculateLevel(userId); } catch (e) { console.error("[recalculateLevel]", e); }

      if (allowed >= 30) {
        await sql`INSERT INTO notifications (user_id, title, body, type) VALUES (${userId}, '📚 مذاكرة مسجلة', ${`تم تسجيل ${allowed} دقيقة مذاكرة. حصلت على ${earnedPoints} نقطة.`}, 'info')`;
      }

      const [record] = await sql`SELECT * FROM activity WHERE user_id = ${userId} AND date = ${today}`;
      if (record) {
        if (record.minutes_studied >= 60 && record.minutes_studied - minutes < 60) {
          await sql`INSERT INTO notifications (user_id, title, body, type) VALUES (${userId}, '⏰ ساعة مذاكرة!', 'وصلت لساعة مذاكرة اليوم. استمر!', 'success')`;
        }
        if (record.minutes_studied >= 120 && record.minutes_studied - minutes < 120) {
          await sql`INSERT INTO notifications (user_id, title, body, type) VALUES (${userId}, '🔥 ساعتين مذاكرة!', 'يوم مميز! واصل التقدم.', 'success')`;
        }
      }

      try { await updateStreak(userId); } catch (e) { console.error("[streak update]", e); }

      return record;
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
    const userProgress = await sql`SELECT * FROM user_skill_progress WHERE user_id = ${me.id}`;
    const labsDone = userProgress.filter((p: any) => p.completed).length;
    const gameStreaks = await sql`SELECT DISTINCT game_key FROM game_scores WHERE user_id = ${me.id}`;
    const distinctGames = gameStreaks.length;
    const threeStarGames = games.filter((g: any) => {
      const maxScore = GAME_MAX_SCORES[g.game_key] ?? 1000;
      return maxScore > 0 && g.score / maxScore >= 0.8;
    }).length;
    const missions = await sql`SELECT * FROM daily_missions WHERE user_id = ${me.id} AND completed = true`;
    const list = [
      { id: "quiz-passer-5", title: "ناجح متمكن", desc: "اجتز 5 اختبارات بنسبة 80%+", target: 5, value: passes, icon: "🎯" },
      { id: "quiz-passer-25", title: "خبير الاختبارات", desc: "اجتز 25 اختباراً بنسبة 80%+", target: 25, value: passes, icon: "🏆" },
      { id: "game-master-10", title: "لاعب متفان", desc: "العب 10 ألعاب", target: 10, value: games.length, icon: "🎮" },
      { id: "game-master-50", title: "بطل الألعاب", desc: "العب 50 لعبة", target: 50, value: games.length, icon: "🎮" },
      { id: "star-collector-30", title: "جامع النجوم", desc: "احصل على 30 لعبة بثلاث نجوم", target: 30, value: threeStarGames, icon: "⭐" },
      { id: "game-explorer-3", title: "مستكشف الألعاب", desc: "العب 3 أنواع مختلفة من الألعاب", target: 3, value: distinctGames, icon: "🎯" },
      { id: "skill-builder-15", title: "صانع المهارات", desc: "أكمل 15 درس مهارة", target: 15, value: labsDone, icon: "📚" },
      { id: "skill-builder-50", title: "خبير المهارات", desc: "أكمل 50 درس مهارة", target: 50, value: labsDone, icon: "📚" },
      { id: "follower-10", title: "مؤثر صاعد", desc: "احصل على 10 متابعين", target: 10, value: followers.length, icon: "⭐" },
      { id: "points-500", title: "جامع النقاط", desc: "اجمع 500 نقطة", target: 500, value: me.points, icon: "💎" },
      { id: "points-2000", title: "مليونير النقاط", desc: "اجمع 2000 نقطة", target: 2000, value: me.points, icon: "💎" },
      { id: "level-5", title: "مستوى متقدم", desc: "وصول للمستوى 5", target: 5, value: me.level, icon: "🚀" },
      { id: "level-10", title: "أسطورة", desc: "وصول للمستوى 10", target: 10, value: me.level, icon: "🚀" },
      { id: "mission-complete-10", title: "منجز المهام", desc: "أكمل 10 مهام يومية", target: 10, value: missions.length, icon: "📋" },
    ];
    return list.map((a) => ({ ...a, completed: a.value >= a.target, percent: Math.min(100, Math.round((a.value / a.target) * 100)) }));
  });
}

async function handleCertificate(req: Request, parts: string[]): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const trackId = Number(parts[1]);
    if (isNaN(trackId)) throw Object.assign(new Error("معرف المسار غير صالح"), { status: 400 });
    const [track] = await sql`SELECT * FROM skill_tracks WHERE id = ${trackId}`;
    if (!track) throw Object.assign(new Error("المسار غير موجود"), { status: 404 });
    const lessons = await sql`SELECT * FROM skill_lessons WHERE track_id = ${trackId}`;
    const userProgress = await sql`SELECT * FROM user_skill_progress WHERE user_id = ${userId} AND track_id = ${trackId}`;
    const doneCount = userProgress.filter((p: any) => p.completed).length;
    if (doneCount < lessons.length) throw Object.assign(new Error("لم تكمل كل الدروس"), { status: 400 });
    const [me] = await sql`SELECT * FROM users WHERE id = ${userId}`;
    // Calculate mastery level
    const avgScore = userProgress.length ? Math.round(userProgress.reduce((s: number, p: any) => s + p.quick_check_score, 0) / userProgress.length) : 0;
    const mastery = avgScore >= 90 ? "متقن" : avgScore >= 70 ? "ممارس" : avgScore >= 50 ? "متعلم" : "مبتدئ";
    const totalXP = lessons.length * 5 + userProgress.filter((p: any) => p.quick_check_score > 0).length * 3;
    // Generate certificate ID
    const certId = `UV-CERT-${trackId}-${userId}-${Date.now().toString(36).toUpperCase()}`;
    return {
      id: certId,
      userName: me?.name || "طالب",
      trackTitle: track.title,
      trackCategory: track.category,
      difficulty: track.difficulty,
      lessonsCompleted: doneCount,
      totalLessons: lessons.length,
      averageScore: avgScore,
      mastery,
      totalXP,
      issuedAt: new Date().toISOString(),
    };
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
        return rows.map((r: any) => ({
          id: r.id, groupName: r.group_name, yearInCollege: r.year_in_college,
          day: r.day, dayNumber: AR_DAY_TO_NUM[r.day] ?? 0,
          startTime: r.start_time, endTime: r.end_time,
          courseTitle: r.course_title, courseCode: r.course_code,
          instructor: r.instructor, room: r.room, type: r.type,
        }));
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
        const rows = await sql`SELECT * FROM group_schedule ORDER BY year_in_college, group_name, day`;
        return rows.map((r: any) => ({
          id: r.id, groupName: r.group_name, yearInCollege: r.year_in_college,
          day: r.day, dayNumber: AR_DAY_TO_NUM[r.day] ?? 0,
          startTime: r.start_time, endTime: r.end_time,
          courseTitle: r.course_title, courseCode: r.course_code,
          instructor: r.instructor, room: r.room, type: r.type,
        }));
      } catch (err) {
        console.error("handleGroupSchedule admin GET error:", err);
        return [];
      }
    });
  }
  if (req.method === "POST" && parts[2] === "import") {
    return handle(async () => {
      const { rows } = await req.json();
      if (!Array.isArray(rows) || !rows.length) throw Object.assign(new Error("لا توجد صفوف لاستيرادها"), { status: 400 });
      let inserted = 0;
      for (const r of rows) {
        const { groupName, yearInCollege, day, startTime, endTime, courseTitle, courseCode, instructor, room, type } = r;
        if (!groupName || !yearInCollege || !day || !startTime || !endTime || !courseTitle || !instructor || !room) {
          throw Object.assign(new Error("بيانات غير مكتملة في أحد الصفوف"), { status: 400 });
        }
        await sql`INSERT INTO group_schedule (group_name, year_in_college, day, start_time, end_time, course_title, course_code, instructor, room, type) VALUES (${groupName}, ${yearInCollege}, ${day}, ${startTime}, ${endTime}, ${courseTitle}, ${courseCode || null}, ${instructor}, ${room}, ${type || "lecture"})`;
        inserted++;
      }
      return { ok: true, inserted };
    });
  }
  if (req.method === "POST") {
    return handle(async () => {
      const body = await req.json();
      const { groupName, yearInCollege, day, startTime, endTime, courseTitle, courseCode, instructor, room, type, allGroups, allYears } = body;
      const groups = allGroups ? ["A", "B", "C", "D", "E"] : [groupName];
      const years = allYears ? [1, 2, 3, 4] : [Number(yearInCollege)];
      if (groups.some((g) => !g) || years.some((y) => !y) || !day || !startTime || !endTime || !courseTitle || !instructor || !room) throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
      const created: unknown[] = [];
      for (const g of groups) {
        for (const y of years) {
          const [r] = await sql`INSERT INTO group_schedule (group_name, year_in_college, day, start_time, end_time, course_title, course_code, instructor, room, type) VALUES (${g}, ${y}, ${day}, ${startTime}, ${endTime}, ${courseTitle}, ${courseCode || null}, ${instructor}, ${room}, ${type || "lecture"}) RETURNING *`;
          created.push(r);
        }
      }
      return groups.length * years.length > 1 ? { ok: true, created: created.length } : created[0];
    });
  }
  if (req.method === "PUT") {
    return handle(async () => {
      const body = await req.json();
      const id = Number(parts[2]);
      if (!id) throw Object.assign(new Error("id غير صالح"), { status: 400 });
      const { groupName, yearInCollege, day, startTime, endTime, courseTitle, courseCode, instructor, room, type } = body;
      const hasAny = [groupName, yearInCollege, day, startTime, endTime, courseTitle, courseCode, instructor, room, type].some((v) => v !== undefined);
      if (!hasAny) throw Object.assign(new Error("لا توجد بيانات للتعديل"), { status: 400 });
      if (groupName !== undefined) await sql`UPDATE group_schedule SET group_name = ${String(groupName)} WHERE id = ${id}`;
      if (yearInCollege !== undefined) await sql`UPDATE group_schedule SET year_in_college = ${Number(yearInCollege)} WHERE id = ${id}`;
      if (day !== undefined) await sql`UPDATE group_schedule SET day = ${String(day)} WHERE id = ${id}`;
      if (startTime !== undefined) await sql`UPDATE group_schedule SET start_time = ${String(startTime)} WHERE id = ${id}`;
      if (endTime !== undefined) await sql`UPDATE group_schedule SET end_time = ${String(endTime)} WHERE id = ${id}`;
      if (courseTitle !== undefined) await sql`UPDATE group_schedule SET course_title = ${String(courseTitle)} WHERE id = ${id}`;
      if (courseCode !== undefined) await sql`UPDATE group_schedule SET course_code = ${(courseCode as string) || null} WHERE id = ${id}`;
      if (instructor !== undefined) await sql`UPDATE group_schedule SET instructor = ${String(instructor)} WHERE id = ${id}`;
      if (room !== undefined) await sql`UPDATE group_schedule SET room = ${String(room)} WHERE id = ${id}`;
      if (type !== undefined) await sql`UPDATE group_schedule SET type = ${String(type)} WHERE id = ${id}`;
      const [r] = await sql`SELECT * FROM group_schedule WHERE id = ${id}`;
      if (!r) throw Object.assign(new Error("الصف غير موجود"), { status: 404 });
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
        const rows = await sql`SELECT * FROM exam_schedule WHERE group_name = ${group} AND year_in_college = ${year} ORDER BY date, time`;
        return rows.map((r: any) => ({
          id: r.id, groupName: r.group_name, yearInCollege: r.year_in_college,
          day: r.day, date: r.date, time: r.time, courseTitle: r.course_title,
          courseCode: r.course_code, room: r.room, type: r.type,
        }));
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
        const rows = await sql`SELECT * FROM exam_schedule ORDER BY year_in_college, group_name, date`;
        return rows.map((r: any) => ({
          id: r.id, groupName: r.group_name, yearInCollege: r.year_in_college,
          day: r.day, date: r.date, time: r.time, courseTitle: r.course_title,
          courseCode: r.course_code, room: r.room, type: r.type,
        }));
      } catch (err) {
        console.error("handleExamSchedule admin GET error:", err);
        return [];
      }
    });
  }
  if (req.method === "POST" && parts[2] === "import") {
    return handle(async () => {
      const { rows } = await req.json();
      if (!Array.isArray(rows) || !rows.length) throw Object.assign(new Error("لا توجد صفوف لاستيرادها"), { status: 400 });
      let inserted = 0;
      for (const r of rows) {
        const { groupName, yearInCollege, day, date, time, courseTitle, courseCode, room, type } = r;
        if (!groupName || !yearInCollege || !day || !date || !time || !courseTitle || !room) {
          throw Object.assign(new Error("بيانات غير مكتملة في أحد الصفوف"), { status: 400 });
        }
        await sql`INSERT INTO exam_schedule (group_name, year_in_college, day, date, time, course_title, course_code, room, type) VALUES (${groupName}, ${yearInCollege}, ${day}, ${date}, ${time}, ${courseTitle}, ${courseCode || null}, ${room}, ${type || "midterm"})`;
        inserted++;
      }
      return { ok: true, inserted };
    });
  }
  if (req.method === "POST") {
    return handle(async () => {
      const body = await req.json();
      const { groupName, yearInCollege, day, date, time, courseTitle, courseCode, room, type, allGroups, allYears } = body;
      const groups = allGroups ? ["A", "B", "C", "D", "E"] : [groupName];
      const years = allYears ? [1, 2, 3, 4] : [Number(yearInCollege)];
      if (groups.some((g) => !g) || years.some((y) => !y) || !day || !date || !time || !courseTitle || !room) throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
      const created: unknown[] = [];
      for (const g of groups) {
        for (const y of years) {
          const [r] = await sql`INSERT INTO exam_schedule (group_name, year_in_college, day, date, time, course_title, course_code, room, type) VALUES (${g}, ${y}, ${day}, ${date}, ${time}, ${courseTitle}, ${courseCode || null}, ${room}, ${type || "midterm"}) RETURNING *`;
          created.push(r);
        }
      }
      return groups.length * years.length > 1 ? { ok: true, created: created.length } : created[0];
    });
  }
  if (req.method === "PUT") {
    return handle(async () => {
      const body = await req.json();
      const id = Number(parts[2]);
      if (!id) throw Object.assign(new Error("id غير صالح"), { status: 400 });
      const { groupName, yearInCollege, day, date, time, courseTitle, courseCode, room, type } = body;
      const hasAny = [groupName, yearInCollege, day, date, time, courseTitle, courseCode, room, type].some((v) => v !== undefined);
      if (!hasAny) throw Object.assign(new Error("لا توجد بيانات للتعديل"), { status: 400 });
      if (groupName !== undefined) await sql`UPDATE exam_schedule SET group_name = ${String(groupName)} WHERE id = ${id}`;
      if (yearInCollege !== undefined) await sql`UPDATE exam_schedule SET year_in_college = ${Number(yearInCollege)} WHERE id = ${id}`;
      if (day !== undefined) await sql`UPDATE exam_schedule SET day = ${String(day)} WHERE id = ${id}`;
      if (date !== undefined) await sql`UPDATE exam_schedule SET date = ${String(date)} WHERE id = ${id}`;
      if (time !== undefined) await sql`UPDATE exam_schedule SET time = ${String(time)} WHERE id = ${id}`;
      if (courseTitle !== undefined) await sql`UPDATE exam_schedule SET course_title = ${String(courseTitle)} WHERE id = ${id}`;
      if (courseCode !== undefined) await sql`UPDATE exam_schedule SET course_code = ${(courseCode as string) || null} WHERE id = ${id}`;
      if (room !== undefined) await sql`UPDATE exam_schedule SET room = ${String(room)} WHERE id = ${id}`;
      if (type !== undefined) await sql`UPDATE exam_schedule SET type = ${String(type)} WHERE id = ${id}`;
      const [r] = await sql`SELECT * FROM exam_schedule WHERE id = ${id}`;
      if (!r) throw Object.assign(new Error("الصف غير موجود"), { status: 404 });
      return r;
    });
  }
  if (req.method === "DELETE") return handle(async () => { await sql`DELETE FROM exam_schedule WHERE id = ${Number(parts[2])}`; return { ok: true }; });
  return jsonError("Not Found", 404);
}

const mapRetakeRow = (r: any) => ({
  id: r.id, courseTitle: r.course_title, sourceYear: r.source_year,
  day: r.day, dayNumber: r.day_number ?? AR_DAY_TO_NUM[r.day] ?? 0,
  startTime: r.start_time, endTime: r.end_time,
  room: r.room, instructor: r.instructor, type: r.type,
});

const normalizeSubject = (t: any) => String(t || "").replace(/\s*\([^)]*\)\s*$/g, "").trim();

const groupRowToBlock = (r: any) => ({
  id: r.id, courseTitle: r.course_title, sourceYear: r.year_in_college,
  day: r.day, dayNumber: AR_DAY_TO_NUM[r.day] ?? 0,
  startTime: r.start_time, endTime: r.end_time,
  room: r.room, instructor: r.instructor, type: r.type,
});

async function handleRetakes(req: Request, parts: string[]): Promise<Response> {
  const { userId } = requireAuth(req.headers);
  const user = await getCurrentUser(userId);

  if (parts[0] === "retake-courses") {
    requireRole(user, ["admin", "super_admin"]);
    if (req.method === "GET") {
      return handle(async () => {
        const rows = await sql`SELECT * FROM retake_courses ORDER BY source_year, course_title, day_number, start_time`;
        return rows.map(mapRetakeRow);
      });
    }
    if (req.method === "POST") {
      return handle(async () => {
        const body = await req.json();
        const list = Array.isArray(body?.rows) ? body.rows : [body];
        if (!list.length) throw Object.assign(new Error("لا توجد بيانات لإضافتها"), { status: 400 });
        const created: unknown[] = [];
        for (const r of list) {
          const { courseTitle, sourceYear, day, dayNumber, startTime, endTime, room, instructor, type } = r;
          if (!courseTitle || !sourceYear || !day || !startTime || !endTime) throw Object.assign(new Error("بيانات ناقصة (اسم المادة، السنة، اليوم، والوقت مطلوبون)"), { status: 400 });
          const dn = dayNumber != null ? Number(dayNumber) : AR_DAY_TO_NUM[day] ?? 0;
          const [ins] = await sql`INSERT INTO retake_courses (course_title, source_year, day, day_number, start_time, end_time, room, instructor, type) VALUES (${courseTitle}, ${Number(sourceYear)}, ${day}, ${dn}, ${startTime}, ${endTime}, ${room || null}, ${instructor || null}, ${type || "lecture"}) RETURNING *`;
          created.push(ins);
        }
        return Array.isArray(body?.rows) ? { ok: true, created: created.length } : mapRetakeRow(created[0]);
      });
    }
    if (req.method === "PUT") {
      return handle(async () => {
        const id = Number(parts[2]);
        if (!id) throw Object.assign(new Error("id غير صالح"), { status: 400 });
        const body = await req.json();
        const { courseTitle, sourceYear, day, dayNumber, startTime, endTime, room, instructor, type } = body;
        const hasAny = [courseTitle, sourceYear, day, dayNumber, startTime, endTime, room, instructor, type].some((v) => v !== undefined);
        if (!hasAny) throw Object.assign(new Error("لا توجد بيانات للتعديل"), { status: 400 });
        if (courseTitle !== undefined) await sql`UPDATE retake_courses SET course_title = ${String(courseTitle)} WHERE id = ${id}`;
        if (sourceYear !== undefined) await sql`UPDATE retake_courses SET source_year = ${Number(sourceYear)} WHERE id = ${id}`;
        if (day !== undefined) await sql`UPDATE retake_courses SET day = ${String(day)}, day_number = ${AR_DAY_TO_NUM[day] ?? 0} WHERE id = ${id}`;
        if (dayNumber !== undefined) await sql`UPDATE retake_courses SET day_number = ${Number(dayNumber)} WHERE id = ${id}`;
        if (startTime !== undefined) await sql`UPDATE retake_courses SET start_time = ${String(startTime)} WHERE id = ${id}`;
        if (endTime !== undefined) await sql`UPDATE retake_courses SET end_time = ${String(endTime)} WHERE id = ${id}`;
        if (room !== undefined) await sql`UPDATE retake_courses SET room = ${(room as string) || null} WHERE id = ${id}`;
        if (instructor !== undefined) await sql`UPDATE retake_courses SET instructor = ${(instructor as string) || null} WHERE id = ${id}`;
        if (type !== undefined) await sql`UPDATE retake_courses SET type = ${String(type)} WHERE id = ${id}`;
        const [r] = await sql`SELECT * FROM retake_courses WHERE id = ${id}`;
        if (!r) throw Object.assign(new Error("الصف غير موجود"), { status: 404 });
        return mapRetakeRow(r);
      });
    }
    if (req.method === "DELETE") return handle(async () => { await sql`DELETE FROM retake_courses WHERE id = ${Number(parts[2])}`; return { ok: true }; });
  }

  if (parts[0] === "retake-options") {
    return handle(async () => {
      const rcRows = await sql`SELECT * FROM retake_courses`;
      const myGroup = user?.group_name || null;
      const allGs = await sql`SELECT * FROM group_schedule ORDER BY year_in_college, day, start_time`;
      const myGs = myGroup ? allGs.filter((r: any) => r.group_name === myGroup) : allGs;
      const my = await sql`SELECT id, course_title, source_year FROM student_retakes WHERE user_id = ${userId}`;
      const carriedIdByKey = new Map(my.map((s: any) => [`${normalizeSubject(s.course_title)}||${s.source_year}`, s.id]));

      const subjects = new Map<string, { courseTitle: string; sourceYear: number; blocks: any[] }>();
      const ensureKey = (base: string, year: number) => {
        const key = `${base}||${year}`;
        if (!subjects.has(key)) subjects.set(key, { courseTitle: base, sourceYear: year, blocks: [] });
        return key;
      };
      const hisSetup = new Set<string>();
      for (const r of myGs) {
        const key = ensureKey(normalizeSubject(r.course_title), Number(r.year_in_college));
        hisSetup.add(key);
        subjects.get(key)!.blocks.push(groupRowToBlock(r));
      }
      for (const r of allGs) {
        const key = ensureKey(normalizeSubject(r.course_title), Number(r.year_in_college));
        if (!hisSetup.has(key) && subjects.get(key)!.blocks.length === 0) subjects.get(key)!.blocks.push(groupRowToBlock(r));
      }
      for (const r of rcRows) {
        const key = ensureKey(normalizeSubject(r.course_title), Number(r.source_year));
        subjects.get(key)!.blocks = [];
        subjects.get(key)!.blocks.push(mapRetakeRow(r));
      }
      const myYear = user?.year_in_college != null ? Number(user.year_in_college) : null;
      return Array.from(subjects.values())
        .filter((o) => myYear == null || o.sourceYear < myYear)
        .map((o) => ({
          ...o,
          carriedId: carriedIdByKey.get(`${o.courseTitle}||${o.sourceYear}`) ?? null,
          carried: carriedIdByKey.has(`${o.courseTitle}||${o.sourceYear}`),
        }));
    });
  }

  if (parts[0] === "my-retakes") {
    if (req.method === "GET") {
      return handle(async () => {
        const carried = await sql`SELECT * FROM student_retakes WHERE user_id = ${userId} ORDER BY source_year, course_title`;
        const userGroup = user?.group_name || null;
        const rcAll = await sql`SELECT * FROM retake_courses`;
        const gsByYear: Record<number, any[]> = {};
        const blocks: any[] = [];
        for (const c of carried) {
          const base = normalizeSubject(c.course_title);
          const rcMatches = rcAll.filter((r: any) => Number(r.source_year) === c.source_year && normalizeSubject(r.course_title) === base);
          if (rcMatches.length > 0) {
            for (const r of rcMatches) blocks.push({ ...mapRetakeRow(r), retakeId: c.id });
          } else {
            if (!gsByYear[c.source_year]) {
              const allGy = await sql`SELECT * FROM group_schedule WHERE year_in_college = ${c.source_year}`;
              const inMy = userGroup ? allGy.filter((r: any) => r.group_name === userGroup) : allGy;
              gsByYear[c.source_year] = inMy.length > 0 ? inMy : allGy;
            }
            let matched = gsByYear[c.source_year].filter((x: any) => normalizeSubject(x.course_title) === base);
            if (!matched.length) {
              const allGy = await sql`SELECT * FROM group_schedule WHERE year_in_college = ${c.source_year}`;
              matched = allGy.filter((x: any) => normalizeSubject(x.course_title) === base);
            }
            for (const r of matched) blocks.push({ ...groupRowToBlock(r), retakeId: c.id });
          }
        }
        return { carried: carried.map((c: any) => ({ id: c.id, courseTitle: c.course_title, sourceYear: c.source_year })), blocks };
      });
    }
    if (req.method === "POST") {
      return handle(async () => {
        const body = await req.json();
        const { courseTitle, sourceYear } = body;
        if (!courseTitle || !sourceYear) throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
        const base = normalizeSubject(courseTitle);
        const yearN = Number(sourceYear);
        if (user?.year_in_college != null && yearN >= Number(user.year_in_college)) throw Object.assign(new Error("مش ممكن تشيل مادة من سنتك أو سنة أصغر"), { status: 400 });
        const rcTitles = await sql`SELECT course_title FROM retake_courses WHERE source_year = ${yearN}`;
        const gsTitles = await sql`SELECT DISTINCT course_title FROM group_schedule WHERE year_in_college = ${yearN}`;
        const found = [...rcTitles, ...gsTitles].some((x: any) => normalizeSubject(x.course_title) === base);
        if (!found) throw Object.assign(new Error("المادة دي مش موجوده في السنة دي"), { status: 400 });
        const [r] = await sql`INSERT INTO student_retakes (user_id, course_title, source_year) VALUES (${userId}, ${base}, ${yearN}) ON CONFLICT (user_id, course_title, source_year) DO NOTHING RETURNING *`;
        return r ? { ok: true, id: r.id } : { ok: true, already: true };
      });
    }
    if (req.method === "DELETE") {
      return handle(async () => { await sql`DELETE FROM student_retakes WHERE id = ${Number(parts[1])} AND user_id = ${userId}`; return { ok: true }; });
    }
  }

  return jsonError("Not Found", 404);
}

const mapEbookRow = (r: any) => ({
  id: r.id,
  title: r.title,
  subject: r.subject,
  yearInCollege: r.year_in_college,
  coverUrl: r.cover_url,
  bookUrl: r.book_url,
  description: r.description,
  createdAt: r.created_at?.toISOString?.() ?? null,
});

async function handleEbooks(req: Request, parts: string[]): Promise<Response> {
  if (parts[1] === "admin") {
    const { userId } = requireAuth(req.headers);
    const user = await getCurrentUser(userId);
    requireRole(user, ["admin", "super_admin"]);

    if (req.method === "GET") {
      return handle(async () => {
        const rows = await sql`SELECT * FROM ebooks ORDER BY year_in_college NULLS LAST, title`;
        return rows.map(mapEbookRow);
      });
    }
    if (req.method === "POST") {
      return handle(async () => {
        const { title, subject, yearInCollege, coverUrl, bookUrl, description } = await req.json();
        if (!title?.trim()) throw Object.assign(new Error("اكتب اسم الكتاب"), { status: 400 });
        if (!bookUrl?.trim()) throw Object.assign(new Error("حط رابط الكتاب"), { status: 400 });
        const [row] = await sql`
          INSERT INTO ebooks (title, subject, year_in_college, cover_url, book_url, description, added_by_id)
          VALUES (${title.trim()}, ${subject?.trim() || ""}, ${yearInCollege ? Number(yearInCollege) : null}, ${coverUrl?.trim() || null}, ${bookUrl.trim()}, ${description?.trim() || ""}, ${userId})
          RETURNING *`;
        return mapEbookRow(row);
      });
    }
    if (req.method === "PUT") {
      return handle(async () => {
        const id = Number(parts[2]);
        const { title, subject, yearInCollege, coverUrl, bookUrl, description } = await req.json();
        const [row] = await sql`
          UPDATE ebooks SET
            title = ${title?.trim() ?? sql`title`},
            subject = ${subject?.trim() ?? sql`subject`},
            year_in_college = ${yearInCollege ? Number(yearInCollege) : null},
            cover_url = ${coverUrl?.trim() || null},
            book_url = ${bookUrl?.trim() ?? sql`book_url`},
            description = ${description?.trim() ?? sql`description`}
          WHERE id = ${id} RETURNING *`;
        if (!row) throw Object.assign(new Error("الكتاب مش موجود"), { status: 404 });
        return mapEbookRow(row);
      });
    }
    if (req.method === "DELETE") {
      return handle(async () => { await sql`DELETE FROM ebooks WHERE id = ${Number(parts[2])}`; return { ok: true }; });
    }
    return jsonError("Not Found", 404);
  }

  return handle(async () => {
    const rows = await sql`SELECT * FROM ebooks ORDER BY year_in_college NULLS LAST, title`;
    return rows.map(mapEbookRow);
  });
}

function argsDayNumber(day: string): number {
  return AR_DAY_TO_NUM[day] ?? 0;
}

async function handleCourses(req: Request, parts: string[]): Promise<Response> {
  if (parts[2] && parts[3] === "materials") {
    return handle(async () => sql`SELECT * FROM materials WHERE course_id = ${Number(parts[2])} ORDER BY ord`);
  }
  if (parts[2] && parts[3] === "all-files") {
    return handle(async () => sql`SELECT * FROM material_files WHERE course_id = ${Number(parts[2])} AND (category IS NULL OR category != 'student-summary') ORDER BY created_at DESC`);
  }
  if (parts[2] && parts[3] === "lectures") {
    return handle(async () => {
      const { userId } = requireAuth(req.headers);
      const viewer = await getCurrentUser(userId);
      const isAdmin = viewer?.role === "admin" || viewer?.role === "super_admin";
      const courseId = Number(parts[2]);
      const lectures = await sql`SELECT * FROM lectures WHERE course_id = ${courseId} ORDER BY ord`;
      if (!lectures.length) return [];
      const lecIds = lectures.map((l: any) => l.id);
      const vids = await sql`SELECT * FROM lecture_videos WHERE lecture_id = ANY(${lecIds}) ORDER BY ord`;
      const quizzes = await sql`SELECT * FROM lecture_quizzes WHERE lecture_id = ANY(${lecIds})`;
      const quizQs = quizzes.length ? await sql`SELECT * FROM lecture_quiz_questions WHERE quiz_id = ANY(${quizzes.map((q: any) => q.id)}) ORDER BY ord` : [];
      const pdfs = await sql`SELECT * FROM lecture_pdfs WHERE lecture_id = ANY(${lecIds})`;
      const quizQToClient = (qq: any) => {
        const clean: any = { id: qq.id, quizId: qq.quiz_id, text: qq.text, options: Array.isArray(qq.options) ? qq.options : (typeof qq.options === "string" ? JSON.parse(qq.options) : []), points: qq.points, ord: qq.ord };
        if (isAdmin) { clean.correctIndex = qq.correct_index; }
        return clean;
      };
      return lectures.map((l: any) => ({
        id: l.id, courseId: l.course_id, title: l.title, type: l.type, ord: l.ord,
        videos: vids.filter((v: any) => v.lecture_id === l.id).map((v: any) => ({ id: v.id, lectureId: v.lecture_id, title: v.title, youtubeUrl: v.youtube_url, youtubeId: v.youtube_id, ord: v.ord })),
        quizzes: quizzes.filter((q: any) => q.lecture_id === l.id).map((q: any) => ({ id: q.id, lectureId: q.lecture_id, title: q.title, questions: quizQs.filter((qq: any) => qq.quiz_id === q.id).map(quizQToClient) })),
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
    ensureAdminPermission(user, "manage_students");
    return handle(async () => {
      const rows = await sql`SELECT * FROM users WHERE role = 'student' ORDER BY points DESC`;
      return rows.map((u: any) => ({ ...u, lastSeen: u.last_seen?.toISOString(), createdAt: u.created_at?.toISOString() }));
    });
  }

  // Staff list
  if (parts[2] === "staff") {
    ensureAdminPermission(user, "manage_staff");
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
    ensureAdminPermission(user, "manage_talents");
    if (req.method === "GET") {
      return handle(async () => {
        const rows = await sql`SELECT * FROM talents ORDER BY created_at DESC`;
        const ownerIds = Array.from(new Set(rows.map((t: any) => t.owner_id)));
        const owners = ownerIds.length ? await sql`SELECT * FROM users WHERE id = ANY(${ownerIds})` : [];
        const byId = new Map(owners.map((u: any) => [u.id, u]));
        return rows.map((t: any) => ({ ...t, mediaUrl: t.media_url, createdAt: t.created_at?.toISOString(), ownerName: byId.get(t.owner_id)?.name, ownerGroup: byId.get(t.owner_id)?.group_name }));
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
    return handle(async () => {
      const rows = await sql`SELECT * FROM courses ORDER BY code`;
      return rows.map((c: any) => ({
        id: c.id, title: c.title, code: c.code, description: c.description,
        credits: c.credits, department: c.department, instructor: c.instructor,
        instructorId: c.instructor_id ?? null, taIds: c.ta_ids ?? [],
        coverUrl: c.cover_url, enrolled: c.enrolled, semester: c.semester,
        yearInCollege: c.year_in_college ?? null,
      }));
    });
  }

  // All materials
  if (parts[2] === "all-materials") {
    return handle(async () => {
      const rows = await sql`SELECT * FROM materials ORDER BY course_id`;
      return rows.map((m: any) => ({
        id: m.id, courseId: m.course_id, title: m.title, kind: m.kind,
        url: m.url, lecturer: m.lecturer, durationMinutes: m.duration_minutes, ord: m.ord,
      }));
    });
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
    ensureAdminPermission(user, "manage_courses");
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
    ensureAdminPermission(user, "manage_courses");
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
    ensureAdminPermission(user, "manage_courses");
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
    ensureAdminPermission(user, "manage_courses");
    return handle(async () => { await sql`DELETE FROM lecture_videos WHERE id = ${Number(parts[3])}`; return { ok: true }; });
  }

  // Admin PDFs
  if (parts[2] === "lectures" && parts[4] === "pdfs" && req.method === "POST") {
    ensureAdminPermission(user, "manage_courses");
    return handle(async () => {
      const lectureId = Number(parts[3]);
      const body = await req.json();
      const { name, url, sizeBytes } = body;
      if (!name || !url) throw Object.assign(new Error("الاسم والرابط مطلوب"), { status: 400 });
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) throw Object.assign(new Error("رابط غير صالح"), { status: 400 });
      const safeSize = Math.max(0, Math.min(Number(sizeBytes) || 0, 50 * 1024 * 1024));
      const [lec] = await sql`SELECT * FROM lectures WHERE id = ${lectureId}`;
      if (!lec) throw Object.assign(new Error("المحاضرة غير موجودة"), { status: 404 });
      const [meUser] = await sql`SELECT * FROM users WHERE id = ${userId}`;
      const [mf] = await sql`INSERT INTO material_files (material_id, course_id, name, kind, url, size_bytes, uploaded_by_id, uploaded_by_name) VALUES (NULL, ${lec.course_id}, ${name}, 'pdf', ${url}, ${safeSize}, ${userId}, ${meUser.name}) RETURNING *`;
      const [p] = await sql`INSERT INTO lecture_pdfs (lecture_id, name, url, size_bytes, material_file_id) VALUES (${lectureId}, ${name}, ${url}, ${safeSize}, ${mf.id}) RETURNING *`;
      return { ...p, materialFileId: mf.id };
    });
  }

  if (parts[2] === "lecture-pdfs" && req.method === "DELETE") {
    ensureAdminPermission(user, "manage_courses");
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
    ensureAdminPermission(user, "manage_courses");
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
    ensureAdminPermission(user, "manage_courses");
    return handle(async () => { await sql`DELETE FROM lecture_quizzes WHERE id = ${Number(parts[3])}`; return { ok: true }; });
  }

  if (parts[2] === "lecture-quizzes" && parts[4] === "questions" && req.method === "POST") {
    ensureAdminPermission(user, "manage_courses");
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
    ensureAdminPermission(user, "manage_courses");
    return handle(async () => sql`SELECT * FROM lecture_quiz_questions WHERE quiz_id = ${Number(parts[3])} ORDER BY ord`);
  }

  if (parts[2] === "lecture-quiz-questions" && req.method === "DELETE") {
    ensureAdminPermission(user, "manage_courses");
    return handle(async () => { await sql`DELETE FROM lecture_quiz_questions WHERE id = ${Number(parts[3])}`; return { ok: true }; });
  }

  // Admin materials CRUD
  if (parts[2] === "materials") {
    ensureAdminPermission(user, "manage_materials");
    if (req.method === "POST" && !parts[3]) {
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
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) throw Object.assign(new Error("رابط غير صالح"), { status: 400 });
        const safeSize = Math.max(0, Math.min(Number(sizeBytes) || 0, 50 * 1024 * 1024));
        const [mat] = await sql`SELECT * FROM materials WHERE id = ${id}`;
        if (!mat) throw Object.assign(new Error("المادة غير موجودة"), { status: 404 });
        const [meUser] = await sql`SELECT * FROM users WHERE id = ${userId}`;
        const [f] = await sql`INSERT INTO material_files (material_id, course_id, name, kind, url, size_bytes, uploaded_by_id, uploaded_by_name) VALUES (${id}, ${mat.course_id}, ${name}, ${kind || "pdf"}, ${url}, ${safeSize}, ${userId}, ${meUser.name}) RETURNING *`;
        return f;
      });
    }
  }

  if (parts[2] === "material-files" && req.method === "DELETE") {
    ensureAdminPermission(user, "manage_materials");
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
  if (parts[1]) {
    return handle(async () => sql`SELECT * FROM material_files WHERE material_id = ${Number(parts[1])} AND (category IS NULL OR category != 'student-summary') ORDER BY created_at DESC`);
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
    const submitted = (answers || []).filter((a: any) => a && a.chosenIndex != null && a.chosenIndex >= 0);
    for (const qq of questions) {
      total += qq.points;
      const a = submitted.find((x: any) => x.questionId === qq.id);
      const chosen = a?.chosenIndex ?? -1;
      const correct = chosen === qq.correct_index;
      if (correct) score += qq.points;
      ansArr.push(`${qq.id}:${chosen}`);
      if (chosen >= 0) {
        details.push({
          questionId: qq.id, text: qq.text, options: qq.options,
          correctIndex: qq.correct_index, points: qq.points,
          userChosen: chosen, correct, explanation: qq.explanation || "",
        });
      }
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
          await sql`INSERT INTO lecture_quiz_attempts (user_id, quiz_id, score, total, answers) VALUES (${userId}, ${quizId}, ${score}, ${total}, 
${ansArr})`;
        } else {
          throw e;
        }
      }
    }
    if (!existing.length) {
      await sql`UPDATE users SET points = points + ${score} WHERE id = ${userId}`;
    }
    return { score, total, passed: score / total >= 0.5, details };
  });
}

async function handleLectureQuizAttempts(req: Request, parts: string[]): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const quizId = Number(parts[2]);
    const attempts = await sql`SELECT id, user_id, quiz_id, score, total, passed, answers, completed_at FROM lecture_quiz_attempts WHERE user_id = ${userId} AND quiz_id = ${quizId} ORDER BY completed_at DESC`;
    return attempts.map((a: any) => ({ ...a, completedAt: a.completed_at?.toISOString() }));
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

async function handleQuizById(req: Request, quizId: number): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const user = await getCurrentUser(userId);
    const isAdmin = user?.role === "admin" || user?.role === "super_admin";
    const [q] = await sql`SELECT * FROM quizzes WHERE id = ${quizId}`;
    if (!q) throw Object.assign(new Error("الاختبار غير موجود"), { status: 404 });
    const questions = await sql`SELECT * FROM quiz_questions WHERE quiz_id = ${quizId} ORDER BY ord`;
    const safeQuestions = questions.map((qq: any) => {
      const clean: any = { id: qq.id, text: qq.text, type: qq.type, options: qq.options, points: qq.points, ord: qq.ord };
      if (isAdmin) {
        clean.correctIndex = qq.correct_index;
        clean.explanation = qq.explanation;
      }
      return clean;
    });
    const cleanQuiz: any = { ...q, createdAt: q.created_at?.toISOString(), questions: safeQuestions };
    return cleanQuiz;
  });
}

async function handleDailyMissionsRoute(req: Request, parts: string[]): Promise<Response> {
  const { userId } = requireAuth(req.headers);

  if (!parts[1]) {
    return handle(async () => {
      const rows = await getDailyMissions(userId);
      return rows.map((m: any) => ({
        id: m.id, title: m.title, description: m.description || "",
        points: m.points, kind: m.kind, completed: m.completed,
      }));
    });
  }

  if (parts[2] === "complete") {
    return handle(async () => {
      const missionId = Number(parts[1]);
      const [mission] = await sql`SELECT * FROM daily_missions WHERE id = ${missionId} AND user_id = ${userId}`;
      if (!mission) throw Object.assign(new Error("المهمة غير موجودة"), { status: 404 });
      if (mission.completed) return { id: mission.id, title: mission.title, description: mission.description, points: mission.points, kind: mission.kind, completed: true };

      await sql`UPDATE daily_missions SET completed = true WHERE id = ${missionId}`;
      await sql`UPDATE users SET points = points + ${mission.points} WHERE id = ${userId}`;

      try { await recalculateLevel(userId); } catch (e) { console.error("[recalculateLevel]", e); }
      try { await updateStreak(userId); } catch (e) { console.error("[streak update]", e); }

      await sql`INSERT INTO notifications (user_id, title, body, type) VALUES (${userId}, '✅ مهمة مكتملة', ${`أكملت "${mission.title}" وحصلت على ${mission.points} نقطة`}, 'success')`;

      return { id: mission.id, title: mission.title, description: mission.description, points: mission.points, kind: mission.kind, completed: true };
    });
  }

  return jsonError("Not Found", 404);
}

async function handleComplaints(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const body = await req.json();
    const { title, body: msgBody, category } = body;
    if (!title || !msgBody) throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
    await sql`INSERT INTO complaints (subject, body, category, author_id) VALUES (${title}, ${msgBody}, ${category || "عام"}, ${userId})`;
    return { ok: true };
  });
}

async function handleGetComplaints(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const rows = await sql`SELECT c.*, u.name AS author_name, u.avatar_url AS author_avatar, u.role AS author_role FROM complaints c LEFT JOIN users u ON u.id = c.author_id WHERE c.author_id = ${userId} ORDER BY c.created_at DESC`;
    if (!rows.length) return [];
    return rows.map((r: any) => ({
      id: r.id,
      subject: r.subject,
      body: r.body,
      category: r.category,
      status: r.status,
      response: r.response,
      author: { id: r.author_id, name: r.author_name, avatarUrl: r.author_avatar, role: r.author_role },
      createdAt: new Date(r.created_at).toISOString(),
    }));
  });
}

const TYPE_LABELS: Record<string, string> = { complaint: "شكوى", suggestion: "اقتراح", inquiry: "استفسار", report: "بلاغ", other: "أخرى" };

async function handleContact(req: Request): Promise<Response> {
  return handle(async () => {
    const { userId } = requireAuth(req.headers);
    const { name, email, phone, type: contactType, subject, message } = await req.json();
    if (!subject || !message || !contactType) throw Object.assign(new Error("الموضوع والنوع والرسالة مطلوبون"), { status: 400 });
    const [user] = await sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`;
    if (!user) throw Object.assign(new Error("المستخدم غير موجود"), { status: 404 });
    const [created] = await sql`INSERT INTO complaints (subject, body, category, author_id) VALUES (${`[${contactType}] ${subject}`}, ${message}, ${contactType === "suggestion" ? "academic" : contactType === "inquiry" ? "other" : "technical"}, ${userId}) RETURNING *`;
    const displayName = name || user.name;
    const contactEmail = email || user.email;
    const m = getMailer();
    if (m) {
      const adminEmail = process.env.GMAIL_USER!;
      await m.sendMail({ to: adminEmail, subject: `[UniVerse] رسالة جديدة: ${TYPE_LABELS[contactType] || "أخرى"} من ${displayName}`, html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:linear-gradient(135deg,#2d6a4f,#40916c);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="color:white;margin:0;">🌿 UniVerse</h1>
            <p style="color:rgba(255,255,255,0.85);margin-top:8px;">رسالة جديدة من مستخدم</p>
          </div>
          <div style="background:white;padding:30px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;">
            <p><strong>من:</strong> ${displayName} (${contactEmail})</p>
            <p><strong>النوع:</strong> ${TYPE_LABELS[contactType] || "أخرى"}</p>
            ${phone ? `<p><strong>الهاتف:</strong> ${phone}</p>` : ""}
            <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;">
              <p><strong>الموضوع:</strong> ${subject}</p>
              <p><strong>الرسالة:</strong></p>
              <p style="margin-top:4px;">${message}</p>
            </div>
            <p style="color:#6b7280;font-size:14px;">رقم التذكرة: #${created.id}</p>
          </div>
        </div>` });
      await m.sendMail({ to: contactEmail, subject: `[UniVerse] تم استلام ${TYPE_LABELS[contactType] || "رسالتك"}`, html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:linear-gradient(135deg,#2d6a4f,#40916c);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="color:white;margin:0;">🌿 UniVerse</h1>
            <p style="color:rgba(255,255,255,0.85);margin-top:8px;">منصة كلية الزراعة الذكية</p>
          </div>
          <div style="background:white;padding:30px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;">
            <p>مرحباً <strong>${displayName}</strong>،</p>
            <p>تم استلام <strong>${TYPE_LABELS[contactType] || "رسالتك"}</strong> بنجاح. فريق الدعم سيراجعها في أقرب وقت ممكن.</p>
            <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;">
              <p><strong>الموضوع:</strong> ${subject}</p>
              <p><strong>الرسالة:</strong></p>
              <p style="margin-top:4px;">${message}</p>
            </div>
            <p style="color:#6b7280;font-size:14px;">رقم التذكرة: #${created.id}</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
            <p style="color:#9ca3af;font-size:12px;">هذه رسالة تلقائية، يرجى عدم الرد عليها.</p>
          </div>
        </div>` });
    }
    return { id: created.id, subject: created.subject, body: created.body, category: created.category, status: created.status, createdAt: new Date(created.created_at).toISOString() };
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

function sanitizeStaffRow(u: any, isAdmin: boolean): any {
  const clean: any = {
    id: u.id, name: u.name, role: u.role, department: u.department,
    title: u.title, avatarUrl: u.avatar_url, bio: u.bio ?? null,
    groupName: u.group_name, yearInCollege: u.year_in_college, specialization: u.specialization,
    researchInterests: u.research_interests ?? [], officeHours: u.office_hours ?? null,
  };
  if (isAdmin) {
    clean.email = u.email;
    clean.phone = u.phone;
    clean.username = u.username;
  }
  return clean;
}

async function handleStaff(req: Request, parts: string[]): Promise<Response> {
  const callerId = (() => {
    try { return requireAuth(req.headers).userId; } catch { return null; }
  })();
  const caller = callerId ? await getCurrentUser(callerId) : null;
  const isAdmin = caller?.role === "admin" || caller?.role === "super_admin";

  if (req.method === "GET" && parts[1] && !isNaN(Number(parts[1]))) {
    return handle(async () => {
      const id = Number(parts[1]);
      const [u] = await sql`SELECT * FROM users WHERE id = ${id} AND role IN ('doctor', 'ta', 'admin', 'super_admin')`;
      if (!u) throw Object.assign(new Error("عضو الهيئة غير موجود"), { status: 404 });
      return sanitizeStaffRow(u, isAdmin);
    });
  }

  if (req.method === "GET") {
    return handle(async () => {
      const rows = await sql`SELECT * FROM users WHERE role IN ('doctor', 'ta', 'admin', 'super_admin') ORDER BY role, name`;
      return rows.map((u: any) => sanitizeStaffRow(u, isAdmin));
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

async function handleCoursesList(req: Request | null): Promise<Response> {
  return handle(async () => {
    let myYear: number | null = null;
    const retakeKeys = new Set<string>();
    if (req) {
      try {
        const { userId } = requireAuth(req.headers);
        const [me] = await sql`SELECT year_in_college FROM users WHERE id = ${userId} LIMIT 1`;
        if (me?.year_in_college) myYear = me.year_in_college;
        const retakeRows = await sql`SELECT source_year, course_title FROM student_retakes WHERE user_id = ${userId}`;
        for (const r of retakeRows) {
          if (r.source_year && r.course_title) retakeKeys.add(`${r.source_year}|${r.course_title}`);
        }
      } catch {}
    }
    const rows = await sql`SELECT * FROM courses ORDER BY semester, code`;
    return rows
      .filter((c: any) =>
        c.year_in_college == null ||
        (myYear != null && c.year_in_college === myYear) ||
        retakeKeys.has(`${c.year_in_college}|${c.title}`)
      )
      .map((c: any) => ({
        id: c.id, title: c.title, code: c.code, description: c.description,
        credits: c.credits, department: c.department, instructor: c.instructor,
        coverUrl: c.cover_url, progress: c.progress, enrolled: c.enrolled,
        semester: c.semester ?? 1, yearInCollege: c.year_in_college ?? null,
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
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) throw Object.assign(new Error("رابط غير صالح"), { status: 400 });
      const safeKind = (kind || "pdf").toString().slice(0, 20);
      const safeSize = Math.max(0, Math.min(Number(sizeBytes) || 0, 50 * 1024 * 1024));
      const [me] = await sql`SELECT * FROM users WHERE id = ${userId}`;
      const [f] = await sql`
        INSERT INTO material_files (material_id, course_id, name, kind, url, size_bytes, uploaded_by_id, uploaded_by_name, category)
        VALUES (NULL, ${courseId}, ${name}, ${safeKind}, ${url}, ${safeSize}, ${userId}, ${me?.name || ""}, 'student-summary')
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
    const courseId = Number(parts[1]);
    return await sql`SELECT * FROM material_files WHERE course_id = ${courseId} AND category = 'student-summary' ORDER BY created_at DESC`;
  });
}

async function handleAdminNews(req: Request, parts: string[]): Promise<Response> {
  const { userId } = requireAuth(req.headers);
  const user = await getCurrentUser(userId);
  requireRole(user, ["admin", "super_admin"]);

  if (req.method === "GET") {
    return handle(async () => {
      const rows = await sql`SELECT * FROM news ORDER BY published_at DESC`;
      return rows.map((r: any) => ({
        id: r.id, title: r.title, excerpt: r.excerpt, body: r.body, category: r.category,
        imageUrl: r.image_url, author: r.author, authorId: r.author_id,
        status: r.status, publishedAt: r.published_at?.toISOString?.() ?? r.published_at,
      }));
    });
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
      return {
        id: n.id, title: n.title, excerpt: n.excerpt, body: n.body, category: n.category,
        imageUrl: n.image_url, author: n.author, authorId: n.author_id,
        status: n.status, publishedAt: n.published_at?.toISOString?.() ?? n.published_at,
      };
    });
  }

  if (parts[2] && parts[3] === "approve") {
    return handle(async () => {
      await sql`UPDATE news SET status = 'approved', published_at = ${new Date()} WHERE id = ${Number(parts[2])}`;
      const students = await sql`SELECT id FROM users WHERE role = 'student'`;
      for (const u of students) {
        await sql`INSERT INTO notifications (user_id, title, body, type) VALUES (${u.id}, 'خبر جديد', ${`تم نشر خبر جديد في الأخبار`}, 'news')`;
      }
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

  if (parts[2] === "import") {
    return handle(async () => {
      const body = await req.json();
      const list = Array.isArray(body?.rows) ? body.rows : [];
      if (!list.length) throw Object.assign(new Error("لا توجد بيانات لاستيرادها"), { status: 400 });
      let inserted = 0;
      for (const r of list) {
        const { title, code, description, credits, department, instructorId, yearInCollege, semester, coverUrl } = r;
        if (!title || !code) throw Object.assign(new Error("كل سطر محتاج كود وعنوان"), { status: 400 });
        const [instructor] = instructorId ? await sql`SELECT name FROM users WHERE id = ${Number(instructorId)}` : [null];
        await sql`
          INSERT INTO courses (title, code, description, credits, department, instructor, instructor_id, cover_url, year_in_college, semester)
          VALUES (${title}, ${code}, ${description || ""}, ${credits || 3}, ${department || ""}, ${instructor?.name || ""}, ${instructorId ? Number(instructorId) : null}, ${coverUrl || null}, ${yearInCollege ? Number(yearInCollege) : null}, ${semester || 1})`;
        inserted++;
      }
      return { ok: true, inserted };
    });
  }

  if (req.method === "POST") {
    return handle(async () => {
      const body = await req.json();
      const { title, code, description, credits, department, instructorId, taIds, yearInCollege, semester, coverUrl } = body;
      if (!title || !code) throw Object.assign(new Error("العنوان والكود مطلوب"), { status: 400 });
      const [instructor] = await sql`SELECT name FROM users WHERE id = ${instructorId}`;
      const [c] = await sql`
        INSERT INTO courses (title, code, description, credits, department, instructor, instructor_id, cover_url, year_in_college, semester)
        VALUES (${title}, ${code}, ${description || ""}, ${credits || 3}, ${department || ""}, ${instructor?.name || ""}, ${instructorId || null}, ${coverUrl || null}, ${yearInCollege || null}, ${semester || 1})
        RETURNING *`;
      return c;
    });
  }

  if (req.method === "PUT" && parts[2] && parts[2] !== "import") {
    return handle(async () => {
      const body = await req.json();
      const id = Number(parts[2]);
      const { title, code, description, credits, department, instructorId, taIds, yearInCollege, semester, coverUrl } = body;
      if (!title || !code) throw Object.assign(new Error("العنوان والكود مطلوب"), { status: 400 });
      const [instructor] = instructorId ? await sql`SELECT name FROM users WHERE id = ${Number(instructorId)}` : [null];
      const [c] = await sql`
        UPDATE courses SET
          title = ${title}, code = ${code},
          description = ${description || ""},
          credits = ${credits || 3},
          department = ${department || ""},
          instructor = ${instructor?.name || ""},
          instructor_id = ${instructorId ? Number(instructorId) : null},
          cover_url = ${coverUrl || null},
          year_in_college = ${yearInCollege ? Number(yearInCollege) : null},
          semester = ${semester || 1},
          ta_ids = ${taIds?.length ? taIds.map(Number) : null}
        WHERE id = ${id}
        RETURNING *`;
      if (!c) throw Object.assign(new Error("المقرر غير موجود"), { status: 404 });
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

// ── Admin Skills CRUD ──
async function handleAdminSkills(request: Request, parts: string[]): Promise<Response> {
  const { userId } = requireAuth(request.headers);
  const user = await getCurrentUser(userId);
  requireRole(user, ["admin", "super_admin"]);
  ensureAdminPermission(user, "manage_skills");

  // GET /admin/skills/tracks — list all tracks (admin view, no per-user progress)
  if (request.method === "GET" && parts[3] === "tracks" && !parts[4]) {
    return handle(async () => {
      const tracks = await sql`SELECT * FROM skill_tracks ORDER BY id`;
      const trackIds = tracks.map((t: any) => t.id);
      const lessons = trackIds.length ? await sql`SELECT * FROM skill_lessons WHERE track_id = ANY(${trackIds}) ORDER BY ord, id` : [];
      return tracks.map((t: any) => ({
        id: t.id, title: t.title, category: t.category, description: t.description,
        difficulty: t.difficulty, coverUrl: t.cover_url,
        yearInCollege: t.year_in_college ?? 0,
        prerequisites: t.prerequisites ?? [],
        lessons: lessons.filter((l: any) => l.track_id === t.id).map((l: any) => ({
          id: l.id, trackId: l.track_id, title: l.title,
          durationMinutes: l.duration_minutes, kind: l.kind, ord: l.ord,
        })),
      }));
    });
  }

  // POST /admin/skills/tracks — create a track
  if (request.method === "POST" && parts[3] === "tracks") {
    return handle(async () => {
      const body = await request.json();
      const { title, category, description, difficulty, coverUrl, yearInCollege, prerequisites } = body;
      if (!title || !category) throw Object.assign(new Error("العنوان والتصنيف مطلوبان"), { status: 400 });
      const [r] = await sql`
        INSERT INTO skill_tracks (title, category, description, difficulty, cover_url, year_in_college, prerequisites)
        VALUES (${title}, ${category}, ${description || ""}, ${difficulty || "beginner"}, ${coverUrl || null}, ${yearInCollege ? Number(yearInCollege) : 0}, ${prerequisites ? prerequisites : []})
        RETURNING *`;
      return r;
    });
  }

  // PUT /admin/skills/tracks/:id — update a track
  if (request.method === "PUT" && parts[3] === "tracks" && parts[4]) {
    return handle(async () => {
      const id = Number(parts[4]);
      const body = await request.json();
      if (body.title !== undefined) await sql`UPDATE skill_tracks SET title = ${body.title} WHERE id = ${id}`;
      if (body.category !== undefined) await sql`UPDATE skill_tracks SET category = ${body.category} WHERE id = ${id}`;
      if (body.description !== undefined) await sql`UPDATE skill_tracks SET description = ${body.description} WHERE id = ${id}`;
      if (body.difficulty !== undefined) await sql`UPDATE skill_tracks SET difficulty = ${body.difficulty} WHERE id = ${id}`;
      if (body.coverUrl !== undefined) await sql`UPDATE skill_tracks SET cover_url = ${body.coverUrl} WHERE id = ${id}`;
      if (body.yearInCollege !== undefined) await sql`UPDATE skill_tracks SET year_in_college = ${Number(body.yearInCollege)} WHERE id = ${id}`;
      if (body.prerequisites !== undefined) await sql`UPDATE skill_tracks SET prerequisites = ${body.prerequisites} WHERE id = ${id}`;
      const [updated] = await sql`SELECT * FROM skill_tracks WHERE id = ${id}`;
      return updated;
    });
  }

  // DELETE /admin/skills/tracks/:id — delete a track
  if (request.method === "DELETE" && parts[3] === "tracks" && parts[4]) {
    return handle(async () => {
      await sql`DELETE FROM skill_tracks WHERE id = ${Number(parts[4])}`;
      return { ok: true };
    });
  }

  // POST /admin/skills/lessons — create a lesson
  if (request.method === "POST" && parts[3] === "lessons") {
    return handle(async () => {
      const body = await request.json();
      const { trackId, title, durationMinutes, kind, ord } = body;
      if (!trackId || !title) throw Object.assign(new Error("المسار والعنوان مطلوبان"), { status: 400 });
      const maxOrd = await sql`SELECT COALESCE(MAX(ord), 0) + 1 AS next_ord FROM skill_lessons WHERE track_id = ${trackId}`;
      const nextOrd = ord ?? maxOrd[0].next_ord;
      const [r] = await sql`
        INSERT INTO skill_lessons (track_id, title, duration_minutes, kind, ord)
        VALUES (${trackId}, ${title}, ${durationMinutes ?? 10}, ${kind || "lesson"}, ${nextOrd})
        RETURNING *`;
      return r;
    });
  }

  // PUT /admin/skills/lessons/:id — update a lesson
  if (request.method === "PUT" && parts[3] === "lessons" && parts[4]) {
    return handle(async () => {
      const id = Number(parts[4]);
      const body = await request.json();
      if (body.trackId !== undefined) await sql`UPDATE skill_lessons SET track_id = ${body.trackId} WHERE id = ${id}`;
      if (body.title !== undefined) await sql`UPDATE skill_lessons SET title = ${body.title} WHERE id = ${id}`;
      if (body.durationMinutes !== undefined) await sql`UPDATE skill_lessons SET duration_minutes = ${body.durationMinutes} WHERE id = ${id}`;
      if (body.kind !== undefined) await sql`UPDATE skill_lessons SET kind = ${body.kind} WHERE id = ${id}`;
      if (body.ord !== undefined) await sql`UPDATE skill_lessons SET ord = ${body.ord} WHERE id = ${id}`;
      const [updated] = await sql`SELECT * FROM skill_lessons WHERE id = ${id}`;
      return updated;
    });
  }

  // DELETE /admin/skills/lessons/:id — delete a lesson
  if (request.method === "DELETE" && parts[3] === "lessons" && parts[4]) {
    return handle(async () => {
      await sql`DELETE FROM skill_lessons WHERE id = ${Number(parts[3])}`;
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
  const visitPath = path;
  if (!visitPath.startsWith("api")) {
    const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "unknown";
    const ua = request.headers.get("user-agent") || "";
    ensureVisitsTable().then(() => sql`INSERT INTO visits (ip, user_agent, path) VALUES (${ip}, ${ua}, ${visitPath})`).catch(() => {});
  }
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
    "GET /auth/username-available": () => handleAuth(request, parts),
    "POST /v2/auth/login": () => handleAuth(request, parts),
    "POST /v2/auth/signup": () => handleAuth(request, parts),
    "POST /v2/auth/logout": () => handleAuth(request, parts),
    "GET /v2/auth/username-available": () => handleAuth(request, parts),
    "POST /auth/send-verification": () => handleAuth(request, parts),
    "POST /v2/auth/send-verification": () => handleAuth(request, parts),
    "POST /auth/verify-code": () => handleAuth(request, parts),
    "POST /v2/auth/verify-code": () => handleAuth(request, parts),
    "POST /auth/resend-code": () => handleAuth(request, parts),
    "POST /v2/auth/resend-code": () => handleAuth(request, parts),
    "POST /auth/check-user": () => handleAuth(request, parts),
    "POST /v2/auth/check-user": () => handleAuth(request, parts),
    "POST /auth/forgot-password": () => handleAuth(request, parts),
    "POST /v2/auth/forgot-password": () => handleAuth(request, parts),
    "POST /auth/verify-reset-code": () => handleAuth(request, parts),
    "POST /v2/auth/verify-reset-code": () => handleAuth(request, parts),
    "POST /auth/reset-password": () => handleAuth(request, parts),
    "POST /v2/auth/reset-password": () => handleAuth(request, parts),

    // Me
    "GET /me": () => handleMe(request),
    "PATCH /me": () => handleMeProfile(request),
    "PATCH /me/profile": () => handleMeProfile(request),
    "POST /me/group": () => handleMeGroup(request),
    "GET /v2/me": () => handleMe(request),
    "PATCH /v2/me/profile": () => handleMeProfile(request),
    "POST /v2/onboarding/seen": () => handleOnboardingSeen(request),
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
    "GET /admin/overview": () => handleAdminOverview(request),
    "GET /admin/visits": () => handleAdminVisits(request),
    "GET /admin/likes": () => handleAdminLikes(request),
    "GET /admin/users": () => handleAdminUsers(request),
    "GET /admin/proposals": () => handleAdminProposals(request, ["admin", "proposals"]),
    "POST /admin/proposals": () => handleAdminProposals(request, ["admin", "proposals"]),
    "POST /admin/proposals/:id/decide": () => handleAdminProposals(request, ["admin", "proposals", parts[1], "decide"]),
    "GET /admin/all-quizzes": () => handleAdminQuizzes(request, ["admin", "all-quizzes"]),
    "GET /admin/all-courses": () => handleAdminCrud(request, ["", "admin", "all-courses"]),
    "GET /admin/all-materials": () => handleAdminCrud(request, ["", "admin", "all-materials"]),
    "GET /admin/students": () => handleAdminCrud(request, ["", "admin", "students"]),
    "GET /admin/staff": () => handleAdminCrud(request, ["", "admin", "staff"]),
    "GET /admin/group-schedule": () => handleGroupSchedule(request, ["group-schedule", "admin"]),
    "POST /admin/group-schedule": () => handleGroupSchedule(request, ["group-schedule", "admin"]),
    "POST /admin/group-schedule/import": () => handleGroupSchedule(request, ["admin", "group-schedule", "import"]),
    "GET /admin/exam-schedule": () => handleExamSchedule(request, ["exam-schedule", "admin"]),
    "POST /admin/exam-schedule": () => handleExamSchedule(request, ["exam-schedule", "admin"]),
    "POST /admin/exam-schedule/import": () => handleExamSchedule(request, ["admin", "exam-schedule", "import"]),
    "GET /admin/dm/threads": () => handleAdminCrud(request, ["", "admin", "dm", "threads"]),
    "GET /admin/talents": () => handleAdminCrud(request, ["", "admin", "talents"]),
    "GET /admin/news": () => handleAdminNews(request, ["admin", "news"]),
    "POST /admin/news": () => handleAdminNews(request, ["admin", "news"]),
    "GET /admin/dm/threads/:id": () => handleAdminCrud(request, ["", "admin", "dm", "threads", parts[4]]),
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
    "POST /admin/quizzes/:id/questions/bulk": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[2], "questions", "bulk"]),
    "DELETE /admin/quizzes/:quizId/questions": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[2], "questions"]),
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
    "DELETE /admin/group-schedule/:id": () => handleGroupSchedule(request, ["group-schedule", "admin", parts[2]]),
    "PUT /admin/group-schedule/:id": () => handleGroupSchedule(request, ["group-schedule", "admin", parts[2]]),
    "DELETE /admin/exam-schedule/:id": () => handleExamSchedule(request, ["exam-schedule", "admin", parts[2]]),
    "PUT /admin/exam-schedule/:id": () => handleExamSchedule(request, ["exam-schedule", "admin", parts[2]]),
    "POST /admin/news/:id/approve": () => handleAdminNews(request, ["admin", "news", parts[2], "approve"]),
    "POST /admin/news/:id/reject": () => handleAdminNews(request, ["admin", "news", parts[2], "reject"]),
    "DELETE /admin/news/:id": () => handleAdminNews(request, ["admin", "news", parts[2]]),
    "GET /v2/admin/overview": () => handleAdminOverview(request),
    "GET /v2/admin/users": () => handleAdminUsers(request),
    "GET /v2/admin/proposals": () => handleAdminProposals(request, ["admin", "proposals"]),
    "POST /v2/admin/proposals": () => handleAdminProposals(request, ["admin", "proposals"]),
    "POST /v2/admin/proposals/:id/decide": () => handleAdminProposals(request, ["admin", "proposals", parts[2], "decide"]),
    "GET /v2/admin/all-quizzes": () => handleAdminQuizzes(request, ["admin", "all-quizzes"]),
    "GET /v2/admin/all-courses": () => handleAdminCrud(request, ["", "admin", "all-courses"]),
    "GET /v2/admin/all-materials": () => handleAdminCrud(request, ["", "admin", "all-materials"]),
    "GET /v2/admin/students": () => handleAdminCrud(request, ["", "admin", "students"]),
    "GET /v2/admin/staff": () => handleAdminCrud(request, ["", "admin", "staff"]),
    "GET /v2/admin/group-schedule": () => handleGroupSchedule(request, ["group-schedule", "admin"]),
    "POST /v2/admin/group-schedule": () => handleGroupSchedule(request, ["group-schedule", "admin"]),
    "POST /v2/admin/group-schedule/import": () => handleGroupSchedule(request, ["admin", "group-schedule", "import"]),
    "GET /v2/admin/exam-schedule": () => handleExamSchedule(request, ["exam-schedule", "admin"]),
    "POST /v2/admin/exam-schedule": () => handleExamSchedule(request, ["exam-schedule", "admin"]),
    "POST /v2/admin/exam-schedule/import": () => handleExamSchedule(request, ["admin", "exam-schedule", "import"]),
    "GET /v2/admin/dm/threads": () => handleAdminCrud(request, ["", "admin", "dm", "threads"]),
    "GET /v2/admin/talents": () => handleAdminCrud(request, ["", "admin", "talents"]),
    "GET /v2/admin/news": () => handleAdminNews(request, ["admin", ...parts.slice(2)]),
    "POST /v2/admin/news": () => handleAdminNews(request, ["admin", ...parts.slice(2)]),
    "GET /v2/admin/dm/threads/:id": () => handleAdminCrud(request, ["", "admin", "dm", "threads", parts[4]]),
    "DELETE /v2/admin/staff/:id": () => handleAdminCrud(request, ["", "admin", "staff", parts[3]]),
    "POST /v2/admin/staff": () => handleStaff(request, ["admin", "staff"]),
    "PATCH /v2/admin/staff/:id": () => handleStaff(request, ["admin", "staff", parts[3]]),
    "DELETE /v2/admin/talents/:id": () => handleAdminCrud(request, ["", "admin", "talents", parts[3]]),
    "DELETE /v2/admin/talent-comments/:id": () => handleAdminCrud(request, ["", "admin", "talent-comments", parts[3]]),
    "DELETE /v2/admin/material-comments/:id": () => handleAdminCrud(request, ["", "admin", "material-comments", parts[3]]),
    "POST /v2/admin/courses": () => handleAdminCourses(request, ["admin", "courses"]),
    "PUT /v2/admin/courses/:id": () => handleAdminCourses(request, ["admin", "courses", parts[3]]),
    "POST /v2/admin/courses/import": () => handleAdminCourses(request, ["admin", "courses", "import"]),
    "DELETE /v2/admin/courses/:id": () => handleAdminCourses(request, ["admin", "courses", parts[3]]),
    "POST /v2/admin/quizzes": () => handleAdminQuizzes(request, ["admin", "quizzes"]),
    "PUT /v2/admin/quizzes/:id": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[3]]),
    "DELETE /v2/admin/quizzes/:id": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[3]]),
    "GET /v2/admin/quizzes/:id/questions": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[3], "questions"]),
    "POST /v2/admin/quizzes/:id/questions": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[3], "questions"]),
    "POST /v2/admin/quizzes/:id/questions/bulk": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[3], "questions", "bulk"]),
    "DELETE /v2/admin/quizzes/:quizId/questions": () => handleAdminQuizzes(request, ["admin", "quizzes", parts[3], "questions"]),
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
    "DELETE /v2/admin/group-schedule/:id": () => handleGroupSchedule(request, ["group-schedule", "admin", parts[3]]),
    "PUT /v2/admin/group-schedule/:id": () => handleGroupSchedule(request, ["group-schedule", "admin", parts[3]]),
    "DELETE /v2/admin/exam-schedule/:id": () => handleExamSchedule(request, ["exam-schedule", "admin", parts[3]]),
    "PUT /v2/admin/exam-schedule/:id": () => handleExamSchedule(request, ["exam-schedule", "admin", parts[3]]),
    "GET /v2/admin/retake-courses": () => handleRetakes(request, ["retake-courses", "admin"]),
    "POST /v2/admin/retake-courses": () => handleRetakes(request, ["retake-courses", "admin"]),
    "PUT /v2/admin/retake-courses/:id": () => handleRetakes(request, ["retake-courses", "admin", parts[3]]),
    "DELETE /v2/admin/retake-courses/:id": () => handleRetakes(request, ["retake-courses", "admin", parts[3]]),
    "POST /v2/admin/news/:id/approve": () => handleAdminNews(request, ["admin", "news", parts[3], "approve"]),
    "POST /v2/admin/news/:id/reject": () => handleAdminNews(request, ["admin", "news", parts[3], "reject"]),
    "DELETE /v2/admin/news/:id": () => handleAdminNews(request, ["admin", "news", parts[3]]),

    // Admin permissions
    "GET /v2/admin/permissions": () => handle(async () => ADMIN_PERMISSION_DEFS),
    "GET /v2/admin/admins": () => handle(async () => {
      const { userId } = requireAuth(request.headers);
      const user = await getCurrentUser(userId);
      requireRole(user, ["super_admin"]);
      const rows = await sql`SELECT * FROM users WHERE role IN ('admin', 'super_admin') ORDER BY role`;
      return rows.map((u: any) => ({
        id: u.id, name: u.name, role: u.role,
        permissions: u.role === "super_admin" ? ADMIN_PERMISSION_DEFS.map((p) => p.key) : (() => { try { return JSON.parse(u.admin_permissions); } catch { return []; } })(),
        adminPermissions: u.admin_permissions,
        avatarUrl: u.avatar_url,
      }));
    }),
    "POST /v2/admin/admins": () => handle(async () => {
      const { userId } = requireAuth(request.headers);
      const user = await getCurrentUser(userId);
      requireRole(user, ["super_admin"]);
      const body = await request.json();
      const { userId: targetId, permissions } = body;
      if (!targetId) throw Object.assign(new Error("معرف المستخدم مطلوب"), { status: 400 });
      const [target] = await sql`SELECT * FROM users WHERE id = ${targetId} LIMIT 1`;
      if (!target) throw Object.assign(new Error("المستخدم غير موجود"), { status: 404 });
      if (target.role !== "student") throw Object.assign(new Error("يمكن ترقية الطلاب فقط"), { status: 400 });
      const validKeys = ADMIN_PERMISSION_DEFS.map((p) => p.key);
      const filteredPerms = (permissions || []).filter((p: string) => validKeys.includes(p));
      await sql`UPDATE users SET role = 'admin', admin_permissions = ${JSON.stringify(filteredPerms)} WHERE id = ${targetId}`;
      return { ok: true, role: "admin", permissions: filteredPerms };
    }),
    "PATCH /v2/admin/admins/:id": () => handle(async () => {
      const { userId } = requireAuth(request.headers);
      const user = await getCurrentUser(userId);
      requireRole(user, ["super_admin"]);
      const id = Number(parts[3]);
      const body = await request.json();
      const { permissions } = body;
      const [target] = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
      if (!target) throw Object.assign(new Error("المستخدم غير موجود"), { status: 404 });
      if (target.role !== "admin") throw Object.assign(new Error("المستخدم ليس أدمن"), { status: 400 });
      const validKeys = ADMIN_PERMISSION_DEFS.map((p) => p.key);
      const filteredPerms = (permissions || []).filter((p: string) => validKeys.includes(p));
      await sql`UPDATE users SET admin_permissions = ${JSON.stringify(filteredPerms)} WHERE id = ${id}`;
      return { ok: true, permissions: filteredPerms };
    }),
    "DELETE /v2/admin/admins/:id": () => handle(async () => {
      const { userId } = requireAuth(request.headers);
      const user = await getCurrentUser(userId);
      requireRole(user, ["super_admin"]);
      const id = Number(parts[3]);
      const [target] = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
      if (!target) throw Object.assign(new Error("المستخدم غير موجود"), { status: 404 });
      if (target.role !== "admin") throw Object.assign(new Error("المستخدم ليس أدمن"), { status: 400 });
      await sql`UPDATE users SET role = 'student', admin_permissions = NULL WHERE id = ${id}`;
      return { ok: true, role: "student" };
    }),

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
    "GET /quizzes/:id": () => handleQuizById(request, Number(parts[1])),
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
    "GET /v2/dm/with/:id": () => handleDM(request, ["dm", "with", parts[3]]),
    "POST /v2/dm/with/:id": () => handleDM(request, ["dm", "with", parts[3]]),

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
    "GET /skills/me": () => handleSkills(request, ["skills", "me"]),
    "GET /skills/:id": () => handleSkills(request, ["skills", parts[1]]),
    "POST /skills/lessons/:id/complete": () => handleSkills(request, ["skills", "lessons", parts[2], "complete"]),
    "POST /skills/quick-checks/:id/submit": () => handleSkills(request, ["skills", "quick-checks", parts[2], "submit"]),
    "GET /skills/labs/:id": () => handleSkills(request, ["skills", "labs", parts[2]]),
    "GET /v2/skills/tracks": () => handleSkills(request, ["skills", "tracks"]),
    "GET /v2/skills/me": () => handleSkills(request, ["skills", "me"]),
    "GET /v2/skills/recommendations": () => handleSkills(request, ["skills", "recommendations"]),
    "GET /v2/skills/notes/:id": () => handleSkills(request, ["skills", "notes", parts[3]]),
    "POST /v2/skills/notes/:id": () => handleSkills(request, ["skills", "notes", parts[3]]),
    "GET /skills/notes/:id": () => handleSkills(request, ["skills", "notes", parts[2]]),
    "POST /skills/notes/:id": () => handleSkills(request, ["skills", "notes", parts[2]]),
    "POST /v2/skills/lessons/:id/complete": () => handleSkills(request, ["skills", "lessons", parts[2], "complete"]),
    "POST /v2/skills/quick-checks/:id/submit": () => handleSkills(request, ["skills", "quick-checks", parts[3], "submit"]),
    "GET /v2/skills/labs/:id": () => handleSkills(request, ["skills", "labs", parts[3]]),
    "GET /v2/skills/capstone/:id": () => handleSkills(request, ["skills", "capstone", parts[3]]),
    "GET /v2/skills/flashcards/:id": () => handleSkills(request, ["skills", "flashcards", parts[3]]),
    "GET /skills/capstone/:id": () => handleSkills(request, ["skills", "capstone", parts[2]]),
    "GET /skills/flashcards/:id": () => handleSkills(request, ["skills", "flashcards", parts[2]]),
    "GET /skills/visual/:id": () => handleSkills(request, ["skills", "visual", parts[2]]),
    "GET /v2/skills/visual/:id": () => handleSkills(request, ["skills", "visual", parts[3]]),

    // Games
    "POST /games/score": () => handleGames(request, ["games", "score"]),
    "GET /games/leaderboard": () => handleGames(request, ["games", "leaderboard"]),
    "POST /v2/games/score": () => handleGames(request, ["games", "score"]),
    "GET /v2/games/leaderboard": () => handleGames(request, ["games", "leaderboard"]),
    "GET /v2/games/my-scores": () => handleGames(request, ["games", "my-scores"]),
    "GET /v2/games/stats": () => handleGames(request, ["games", "stats"]),
    "GET /games/my-scores": () => handleGames(request, ["games", "my-scores"]),
    "GET /games/stats": () => handleGames(request, ["games", "stats"]),
    "GET /v2/games/replay/:id": () => handleGames(request, ["games", "replay", parts[3]]),

    // Study Rooms
    "GET /v2/study-rooms": () => handleStudyRooms(request, []),
    "POST /v2/study-rooms": () => handleStudyRooms(request, ["create"]),
    "POST /v2/study-rooms/:id/join": () => handleStudyRooms(request, ["join", parts[3]]),
    "POST /v2/study-rooms/:id/leave": () => handleStudyRooms(request, ["leave", parts[3]]),

    // Co-op Challenges
    "GET /v2/coop-challenges": () => handleCoopChallenges(request, []),
    "POST /v2/coop-challenges/:id/join": () => handleCoopChallenges(request, ["join", parts[3]]),
    "POST /v2/coop-challenges/:id/score": () => handleCoopChallenges(request, ["score", parts[3]]),

    // Game Analytics (admin)
    "GET /v2/admin/game-analytics": () => handleGameAnalytics(request),

    // Admin Skills CRUD
    "GET /admin/skills/tracks": () => handleAdminSkills(request, ["", "admin", "skills", "tracks"]),
    "POST /admin/skills/tracks": () => handleAdminSkills(request, ["", "admin", "skills", "tracks"]),
    "PUT /admin/skills/tracks/:id": () => handleAdminSkills(request, ["", "admin", "skills", "tracks", parts[3]]),
    "DELETE /admin/skills/tracks/:id": () => handleAdminSkills(request, ["", "admin", "skills", "tracks", parts[3]]),
    "POST /admin/skills/lessons": () => handleAdminSkills(request, ["", "admin", "skills", "lessons"]),
    "PUT /admin/skills/lessons/:id": () => handleAdminSkills(request, ["", "admin", "skills", "lessons", parts[3]]),
    "DELETE /admin/skills/lessons/:id": () => handleAdminSkills(request, ["", "admin", "skills", "lessons", parts[3]]),
    "GET /v2/admin/skills/tracks": () => handleAdminSkills(request, ["", "admin", "skills", "tracks"]),
    "POST /v2/admin/skills/tracks": () => handleAdminSkills(request, ["", "admin", "skills", "tracks"]),
    "PUT /v2/admin/skills/tracks/:id": () => handleAdminSkills(request, ["", "admin", "skills", "tracks", parts[4]]),
    "DELETE /v2/admin/skills/tracks/:id": () => handleAdminSkills(request, ["", "admin", "skills", "tracks", parts[4]]),
    "POST /v2/admin/skills/lessons": () => handleAdminSkills(request, ["", "admin", "skills", "lessons"]),
    "PUT /v2/admin/skills/lessons/:id": () => handleAdminSkills(request, ["", "admin", "skills", "lessons", parts[4]]),
    "DELETE /v2/admin/skills/lessons/:id": () => handleAdminSkills(request, ["", "admin", "skills", "lessons", parts[4]]),

     // Streak
    "GET /v2/user/streak": () => handleStreak(request),
    "GET /v2/user/activity-heatmap": () => handleActivityHeatmap(request),

    // Leaderboard (generated API client)
    "GET /leaderboard": () => handleLeaderboard(request),

    // Activity
    "POST /activity/log": () => handleActivity(request),
    "POST /v2/activity/log": () => handleActivity(request),

    // Achievements
    "GET /achievements": () => handleAchievements(request),
    "GET /v2/achievements": () => handleAchievements(request),
    "GET /badges": () => handleBadges(request),
    "GET /v2/badges": () => handleBadges(request),
    "GET /v2/unlockables": () => handleUnlockables(request),
    "POST /v2/unlockables/equip": () => handleEquipUnlockable(request),

    // Certificates
    "GET /v2/certificates/:trackId": () => handleCertificate(request, [parts[2]]),

    // Schedules
    "GET /group-schedule": () => handleGroupSchedule(request, ["group-schedule"]),
    "GET /exam-schedule": () => handleExamSchedule(request, ["exam-schedule"]),
    "GET /v2/group-schedule": () => handleGroupSchedule(request, ["group-schedule"]),
    "GET /v2/exam-schedule": () => handleExamSchedule(request, ["exam-schedule"]),
    "GET /v2/my-retakes": () => handleRetakes(request, ["my-retakes"]),
    "POST /v2/my-retakes": () => handleRetakes(request, ["my-retakes"]),
    "DELETE /v2/my-retakes/:id": () => handleRetakes(request, ["my-retakes", parts[2]]),
    "GET /v2/retake-options": () => handleRetakes(request, ["retake-options"]),

    // E-books
    "GET /v2/ebooks": () => handleEbooks(request, ["ebooks"]),
    "GET /v2/admin/ebooks": () => handleEbooks(request, ["ebooks", "admin"]),
    "POST /v2/admin/ebooks": () => handleEbooks(request, ["ebooks", "admin"]),
    "PUT /v2/admin/ebooks/:id": () => handleEbooks(request, ["ebooks", "admin", parts[3]]),
    "DELETE /v2/admin/ebooks/:id": () => handleEbooks(request, ["ebooks", "admin", parts[3]]),

    // Courses
    "GET /courses": () => handleCoursesList(request),
    "GET /courses/:id": () => handleCourseById(parts[1]),
    "GET /courses/:id/materials": () => handleCourses(request, ["", "courses", parts[1], "materials"]),
    "GET /courses/:id/all-files": () => handleCourses(request, ["", "courses", parts[1], "all-files"]),
    "GET /courses/:id/lectures": () => handleCourses(request, ["", "courses", parts[1], "lectures"]),
    "GET /courses/:id/video-progress": () => handleCourses(request, ["", "courses", parts[1], "video-progress"]),
    "GET /courses/:id/progress": () => handleCourses(request, ["", "courses", parts[1], "progress"]),
    "GET /courses/:id/student-summaries": () => handleCourseSummaries(request, ["courses", parts[1], "student-summaries"]),
    "GET /v2/courses": () => handleCoursesList(request),
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
    "GET /complaints": () => handleGetComplaints(request),
    "GET /v2/complaints": () => handleGetComplaints(request),
    "POST /complaints": () => handleComplaints(request),
    "POST /v2/complaints": () => handleComplaints(request),
    "POST /v2/contact": () => handleContact(request),

    // AI Chat
    "POST /ai/chat": () => handleAiChat(request),

    // Challenges
    "GET /v2/challenges": () => handleChallenges(request, []),
    "POST /v2/challenges/claim": () => handleChallenges(request, ["claim"]),
    "GET /v2/events/seasonal": () => handleSeasonalEventsRoute(request),
    "GET /v2/tournament": () => handleTournament(request, []),

    // Missions
    "GET /missions": () => handleDailyMissionsRoute(request, ["missions"]),
    "POST /missions/:id/complete": () => handleDailyMissionsRoute(request, ["missions", parts[1], "complete"]),
    "GET /v2/missions": () => handleDailyMissionsRoute(request, ["missions"]),
    "POST /v2/missions/:id/complete": () => handleDailyMissionsRoute(request, ["missions", parts[2], "complete"]),

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

    // Web Push (device notifications)
    "GET /v2/push/vapid": () => handlePush(request, ["push", "vapid"]),
    "POST /v2/push/subscribe": () => handlePush(request, ["push", "subscribe"]),
    "POST /v2/push/unsubscribe": () => handlePush(request, ["push", "unsubscribe"]),
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

export { handleRequest };

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
