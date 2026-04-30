import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { AiChatBody, AiChatResponse } from "@workspace/api-zod";
import { getAiClient } from "../lib/ai";
import { handle } from "../lib/util";
import { db, schema } from "../lib/db";

const router: IRouter = Router();

const FALLBACK_SUGGESTIONS = [
  "ما مواعيد محاضرتي القادمة؟",
  "اعرض درجاتي الحالية",
  "خطة مذاكرة لأسبوع",
  "ما هي اقتراحاتي الإدارية المعلقة؟",
];

async function buildContext(userId: number): Promise<string> {
  const [user] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, userId)).limit(1);
  if (!user) return "المستخدم غير معروف. ردّ بصيغة عامة.";

  const lines: string[] = [];
  lines.push(`### معلومات المستخدم الحالي`);
  lines.push(`- الاسم: ${user.name}`);
  lines.push(`- الدور: ${user.role}`);
  lines.push(`- القسم: ${user.department}`);
  if (user.specialization) lines.push(`- التخصص: ${user.specialization}`);
  if (user.yearInCollege) lines.push(`- السنة الدراسية: ${user.yearInCollege}`);
  if (user.groupName) lines.push(`- المجموعة: ${user.groupName}`);
  lines.push(`- النقاط: ${user.points} | المستوى: ${user.level}`);
  lines.push("");

  if (user.role === "student") {
    // schedule
    const sched = await db
      .select()
      .from(schema.scheduleItemsTable)
      .where(eq(schema.scheduleItemsTable.userId, userId))
      .limit(20);
    if (sched.length) {
      lines.push("### جدوله الأسبوعي");
      for (const s of sched) lines.push(`- ${s.day} ${s.startTime}-${s.endTime}: ${s.courseTitle} (${s.room}, ${s.instructor})`);
      lines.push("");
    }

    // grades
    const grades = await db.select().from(schema.gradesTable).where(eq(schema.gradesTable.userId, userId)).limit(20);
    if (grades.length) {
      lines.push("### درجاته الحالية");
      for (const g of grades) lines.push(`- ${g.courseTitle}: ${g.score}/${g.outOf} (${g.letter})`);
      lines.push("");
    }

    // attendance
    const att = await db.select().from(schema.attendanceTable).where(eq(schema.attendanceTable.userId, userId)).limit(10);
    if (att.length) {
      lines.push("### حضوره");
      for (const a of att) lines.push(`- ${a.courseTitle}: ${a.attended}/${a.total} محاضرة`);
      lines.push("");
    }

    // recent quiz attempts
    const attempts = await db
      .select()
      .from(schema.quizAttemptsTable)
      .where(eq(schema.quizAttemptsTable.userId, userId))
      .orderBy(desc(schema.quizAttemptsTable.completedAt))
      .limit(5);
    if (attempts.length) {
      lines.push("### آخر اختباراته");
      for (const a of attempts) lines.push(`- اختبار #${a.quizId}: ${a.score}/${a.total}`);
      lines.push("");
    }
  }

  if (user.role === "admin" || user.role === "super_admin") {
    const pending = await db
      .select()
      .from(schema.adminProposalsTable)
      .where(
        user.role === "super_admin"
          ? eq(schema.adminProposalsTable.status, "pending")
          : and(eq(schema.adminProposalsTable.proposerId, userId), eq(schema.adminProposalsTable.status, "pending")),
      );
    lines.push(`### حالة الاقتراحات`);
    lines.push(`- ${user.role === "super_admin" ? "اقتراحات بانتظار موافقتك" : "اقتراحاتك المعلقة"}: ${pending.length}`);
    if (pending.length) {
      for (const p of pending.slice(0, 8)) {
        lines.push(`  · ${p.action} على ${p.resourceKind}${p.resourceId ? ` #${p.resourceId}` : ""} — السبب: ${p.reason || "غير محدد"}`);
      }
    }
    lines.push("");

    const [{ count: studentCount }] = (await db.execute(
      `SELECT COUNT(*)::int AS count FROM users WHERE role='student'` as any,
    )) as any;
    lines.push(`### إحصائيات سريعة`);
    lines.push(`- عدد الطلاب المسجلين: ${studentCount}`);
    lines.push("");
  }

  // notifications
  const notes = await db
    .select()
    .from(schema.notificationsTable)
    .where(eq(schema.notificationsTable.userId, userId))
    .orderBy(desc(schema.notificationsTable.createdAt))
    .limit(5);
  if (notes.length) {
    lines.push("### آخر إشعاراته");
    for (const n of notes) lines.push(`- [${n.read ? "مقروء" : "جديد"}] ${n.title}: ${n.body}`);
    lines.push("");
  }

  return lines.join("\n");
}

router.post("/ai/chat", (req, res) => {
  void handle(res, async () => {
    const body = AiChatBody.parse(req.body);
    const userId = req.demo.currentUserId;
    if (!userId) throw Object.assign(new Error("غير مسجل"), { status: 401 });
    const context = await buildContext(userId);

    const systemPrompt = `أنت "مرشد UniVerse" — مساعد ذكي لطلاب وإدارة كلية الزراعة.
تعرف بيانات المستخدم الحالي ودوره وتجيب بناءً على بياناته الفعلية.

${context}

تعليمات الرد:
- استخدم اللغة التي يكتب بها المستخدم (العربية أو الإنجليزية).
- إذا سأل عن جدوله/درجاته/حضوره/اقتراحاته/إشعاراته، أجب من البيانات أعلاه مباشرة بدقة.
- إذا كان المستخدم سوبر أدمن أو أدمن، اقترح قرارات إدارية مناسبة.
- إذا كان طالباً، قدّم خطط مذاكرة عملية ونصائح أكاديمية.
- لا تخترع بيانات. إذا كانت البيانات فارغة قل ذلك بصراحة.
- ردود قصيرة منظمة، بدون رموز تعبيرية.`;

    const client = getAiClient();
    if (!client) {
      const last = body.messages[body.messages.length - 1]?.content ?? "";
      return AiChatResponse.parse({
        reply: `استلمت سؤالك: "${last}". المساعد الذكي غير متصل حالياً.`,
        suggestions: FALLBACK_SUGGESTIONS,
      });
    }

    const contents = body.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    try {
      const result = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 4096,
          temperature: 0.6,
        },
      });
      const reply = result.text ?? "لم أتمكن من توليد رد.";

      let suggestions: string[] = FALLBACK_SUGGESTIONS;
      try {
        const sugResult = await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: `بناءً على هذا الرد:\n${reply}\n\nاقترح ٣ أسئلة قصيرة (أقل من 10 كلمات) قد يطرحها المستخدم بعدها. سطر لكل سؤال بدون ترقيم.` }] }],
          config: { maxOutputTokens: 256, temperature: 0.8 },
        });
        const lines = (sugResult.text ?? "")
          .split("\n")
          .map((s) => s.replace(/^[-*\d.\s]+/, "").trim())
          .filter((s) => s.length > 0 && s.length < 100)
          .slice(0, 3);
        if (lines.length > 0) suggestions = lines;
      } catch {}

      return AiChatResponse.parse({ reply, suggestions });
    } catch (err) {
      req.log.error({ err }, "AI chat failed");
      return AiChatResponse.parse({
        reply: "حدث خطأ أثناء الاتصال بالمساعد الذكي. حاول مرة أخرى.",
        suggestions: FALLBACK_SUGGESTIONS,
      });
    }
  });
});

export default router;
