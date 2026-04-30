import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { GetMeResponse } from "@workspace/api-zod";
import { db, schema } from "../lib/db";
import { handle } from "../lib/util";

const router: IRouter = Router();

function toCurrentUser(u: typeof schema.usersTable.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    role: u.role,
    avatarUrl: u.avatarUrl,
    department: u.department,
    year: u.year,
    points: u.points,
    level: u.level,
    streak: u.streak,
    title: u.title,
    uniqueCode: u.uniqueCode,
  };
}

router.get("/me", (req, res) => {
  void handle(res, async () => {
    const id = req.demo.currentUserId;
    if (!id) throw Object.assign(new Error("لا يوجد مستخدم"), { status: 404 });
    const [user] = await db
      .select()
      .from(schema.usersTable)
      .where(eq(schema.usersTable.id, id))
      .limit(1);
    if (!user) throw Object.assign(new Error("لا يوجد مستخدم"), { status: 404 });
    return GetMeResponse.parse(toCurrentUser(user));
  });
});

export default router;
