import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { ListNewsResponse, GetNewsResponse } from "@workspace/api-zod";
import { db, schema } from "../lib/db";
import { handle } from "../lib/util";

const router: IRouter = Router();

router.get("/news", (_req, res) => {
  void handle(res, async () => {
    const rows = await db
      .select()
      .from(schema.newsTable)
      .where(eq(schema.newsTable.status, "approved"))
      .orderBy(desc(schema.newsTable.publishedAt));
    return ListNewsResponse.parse(rows);
  });
});

router.get("/news/:id", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const [row] = await db.select().from(schema.newsTable).where(eq(schema.newsTable.id, id)).limit(1);
    if (!row) throw Object.assign(new Error("News not found"), { status: 404 });
    return GetNewsResponse.parse(row);
  });
});

export default router;
