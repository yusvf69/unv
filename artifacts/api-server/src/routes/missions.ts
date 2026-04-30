import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { ListMissionsResponse, CompleteMissionResponse } from "@workspace/api-zod";
import { db, schema } from "../lib/db";
import { handle } from "../lib/util";

const router: IRouter = Router();

const DEFAULT_MISSIONS = [
  { title: "ذاكر ساعة واحدة", description: "اقضِ 60 دقيقة في المذاكرة المركزة", points: 10, kind: "study", ord: 0, completed: false },
  { title: "راجع ملخصاً", description: "اقرأ ملخصاً لمادة من المواد", points: 5, kind: "study", ord: 1, completed: false },
  { title: "حل 10 أسئلة", description: "أجب على 10 أسئلة من بنك الأسئلة", points: 15, kind: "quiz", ord: 2, completed: false },
  { title: "شارك في المنتدى", description: "اكتب منشوراً أو ردّاً في المنتدى", points: 8, kind: "forum", ord: 3, completed: false },
  { title: "أكمل اختباراً", description: "أنهِ اختباراً كاملًا بنتيجة 70% على الأقل", points: 20, kind: "quiz", ord: 4, completed: false },
];

router.get("/missions", (_req, res) => {
  void handle(res, async () => {
    let rows = await db.select().from(schema.missionsTable).orderBy(schema.missionsTable.ord);
    if (!rows.length || rows[0]?.kind === "daily") {
      await db.delete(schema.missionsTable);
      await db.insert(schema.missionsTable).values(DEFAULT_MISSIONS);
      rows = await db.select().from(schema.missionsTable).orderBy(schema.missionsTable.ord);
    }
    return ListMissionsResponse.parse(
      rows.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        points: m.points,
        kind: m.kind,
        completed: m.completed,
      })),
    );
  });
});

router.post("/missions/:id/complete", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const [m] = await db.select().from(schema.missionsTable).where(eq(schema.missionsTable.id, id)).limit(1);
    if (!m) throw Object.assign(new Error("Mission not found"), { status: 404 });
    if (!m.completed) {
      const userId = req.demo.currentUserId;
      if (!userId) throw Object.assign(new Error("غير مسجل"), { status: 401 });
      await db.update(schema.missionsTable).set({ completed: true }).where(eq(schema.missionsTable.id, id));
      const [updatedUser] = await db
        .update(schema.usersTable)
        .set({ points: sql`${schema.usersTable.points} + ${m.points}` })
        .where(eq(schema.usersTable.id, userId))
        .returning();
      // Notification for mission completion
      await db.insert(schema.notificationsTable).values({
        userId,
        title: "✅ مهمة مكتملة",
        body: `أكملت "${m.title}" وحصلت على ${m.points} نقطة`,
        type: "success",
      });
      return CompleteMissionResponse.parse({
        id: m.id, title: m.title, description: m.description, points: m.points, kind: m.kind, completed: true,
      });
    }
    const userId = req.demo.currentUserId;
    if (!userId) throw Object.assign(new Error("غير مسجل"), { status: 401 });
    const [user] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, userId));
    return CompleteMissionResponse.parse({
      id: m.id, title: m.title, description: m.description, points: m.points, kind: m.kind, completed: true,
    });
  });
});

export default router;
