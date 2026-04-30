import { Router, type IRouter } from "express";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { ListTalentsResponse, VoteTalentResponse } from "@workspace/api-zod";
import { db, schema } from "../lib/db";
import { handle } from "../lib/util";

const router: IRouter = Router();

router.get("/talents", (_req, res) => {
  void handle(res, async () => {
    const rows = await db.select().from(schema.talentsTable).orderBy(desc(schema.talentsTable.votes));
    const owners =
      rows.length > 0
        ? await db.select().from(schema.usersTable).where(inArray(schema.usersTable.id, rows.map((r) => r.ownerId)))
        : [];
    const oMap = new Map(owners.map((o) => [o.id, o]));
    return ListTalentsResponse.parse(
      rows.map((t) => {
        const o = oMap.get(t.ownerId);
        return {
          id: t.id,
          title: t.title,
          category: t.category,
          description: t.description,
          mediaUrl: t.mediaUrl,
          votes: t.votes,
          owner: o
            ? { id: o.id, name: o.name, avatarUrl: o.avatarUrl, role: o.role }
            : { id: 0, name: "Unknown", avatarUrl: null, role: "student" },
        };
      }),
    );
  });
});

router.post("/talents/:id/vote", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(schema.talentsTable)
      .set({ votes: sql`${schema.talentsTable.votes} + 1` })
      .where(eq(schema.talentsTable.id, id))
      .returning();
    if (!updated) throw Object.assign(new Error("Talent not found"), { status: 404 });
    return VoteTalentResponse.parse({ votes: updated.votes });
  });
});

export default router;
