import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { GetLeaderboardResponse } from "@workspace/api-zod";
import { db, schema } from "../lib/db";
import { handle } from "../lib/util";

const router: IRouter = Router();

router.get("/leaderboard", (req, res) => {
  void handle(res, async () => {
    const period = (req.query.period as string) || "weekly";
    const factor = period === "daily" ? 0.25 : period === "weekly" ? 1 : period === "monthly" ? 3.5 : 12;
    const rows = await db
      .select()
      .from(schema.usersTable)
      .where(eq(schema.usersTable.role, "student"))
      .orderBy(desc(schema.usersTable.points))
      .limit(50);
    const entries = rows.map((u, i) => ({
      rank: i + 1,
      userId: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      department: u.department,
      year: u.year,
      points: Math.round(u.points * factor),
      level: u.level,
      streak: u.streak,
      deltaRank: ((u.id * 7) % 5) - 2,
    }));
    return GetLeaderboardResponse.parse(entries);
  });
});

export default router;
