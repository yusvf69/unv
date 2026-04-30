import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { ListSkillTracksResponse, GetSkillTrackResponse } from "@workspace/api-zod";
import { db, schema } from "../lib/db";
import { handle } from "../lib/util";

const router: IRouter = Router();

router.get("/skills/tracks", (_req, res) => {
  void handle(res, async () => {
    const tracks = await db.select().from(schema.skillTracksTable);
    const lessons = await db.select().from(schema.skillLessonsTable);
    const counts = new Map<number, number>();
    for (const l of lessons) counts.set(l.trackId, (counts.get(l.trackId) ?? 0) + 1);
    return ListSkillTracksResponse.parse(
      tracks.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        description: t.description,
        lessonsCount: counts.get(t.id) ?? 0,
        progress: t.progress,
        coverUrl: t.coverUrl,
        difficulty: t.difficulty,
      })),
    );
  });
});

router.get("/skills/tracks/:id", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const [t] = await db.select().from(schema.skillTracksTable).where(eq(schema.skillTracksTable.id, id)).limit(1);
    if (!t) throw Object.assign(new Error("Skill track not found"), { status: 404 });
    const lessons = await db
      .select()
      .from(schema.skillLessonsTable)
      .where(eq(schema.skillLessonsTable.trackId, id))
      .orderBy(schema.skillLessonsTable.ord);
    return GetSkillTrackResponse.parse({
      id: t.id,
      title: t.title,
      category: t.category,
      description: t.description,
      lessonsCount: lessons.length,
      progress: t.progress,
      coverUrl: t.coverUrl,
      difficulty: t.difficulty,
      lessons: lessons.map((l) => ({
        id: l.id,
        title: l.title,
        durationMinutes: l.durationMinutes,
        kind: l.kind,
        completed: l.completed,
      })),
    });
  });
});

export default router;
