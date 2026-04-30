import { Router, type IRouter } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import { ListComplaintsResponse, CreateComplaintBody } from "@workspace/api-zod";
import { db, schema } from "../lib/db";
import { handle } from "../lib/util";

const router: IRouter = Router();

router.get("/complaints", (req, res) => {
  void handle(res, async () => {
    const userId = req.demo.currentUserId;
    if (!userId) throw Object.assign(new Error("غير مسجل"), { status: 401 });
    const rows = await db
      .select()
      .from(schema.complaintsTable)
      .where(eq(schema.complaintsTable.authorId, userId))
      .orderBy(desc(schema.complaintsTable.createdAt));
    const authors =
      rows.length > 0
        ? await db.select().from(schema.usersTable).where(inArray(schema.usersTable.id, rows.map((r) => r.authorId)))
        : [];
    const aMap = new Map(authors.map((a) => [a.id, a]));
    return ListComplaintsResponse.parse(
      rows.map((c) => {
        const a = aMap.get(c.authorId);
        return {
          id: c.id,
          subject: c.subject,
          body: c.body,
          category: c.category,
          status: c.status,
          response: c.response,
          author: a
            ? { id: a.id, name: a.name, avatarUrl: a.avatarUrl, role: a.role }
            : { id: 0, name: "Unknown", avatarUrl: null, role: "student" },
          createdAt: c.createdAt.toISOString(),
        };
      }),
    );
  });
});

router.post("/complaints", (req, res) => {
  void handle(res, async () => {
    const userId = req.demo.currentUserId;
    if (!userId) throw Object.assign(new Error("غير مسجل"), { status: 401 });
    const body = CreateComplaintBody.parse(req.body);
    const [created] = await db
      .insert(schema.complaintsTable)
      .values({
        subject: body.subject,
        body: body.body,
        category: body.category,
        authorId: userId,
      })
      .returning();
    const [author] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, created.authorId));
    return {
      id: created.id,
      subject: created.subject,
      body: created.body,
      category: created.category,
      status: created.status,
      response: created.response,
      author: author
        ? { id: author.id, name: author.name, avatarUrl: author.avatarUrl, role: author.role }
        : { id: 0, name: "Unknown", avatarUrl: null, role: "student" },
      createdAt: created.createdAt.toISOString(),
    };
  });
});

export default router;
