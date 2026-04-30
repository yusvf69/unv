import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { ListCoursesResponse, GetCourseResponse } from "@workspace/api-zod";
import { db, schema } from "../lib/db";
import { handle } from "../lib/util";

const router: IRouter = Router();

router.get("/courses", (_req, res) => {
  void handle(res, async () => {
    const rows = await db.select().from(schema.coursesTable);
    return ListCoursesResponse.parse(
      rows.map((c) => ({
        id: c.id,
        title: c.title,
        code: c.code,
        description: c.description,
        credits: c.credits,
        department: c.department,
        instructor: c.instructor,
        coverUrl: c.coverUrl,
        progress: c.progress,
        enrolled: c.enrolled,
      })),
    );
  });
});

router.get("/courses/:id", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const [c] = await db.select().from(schema.coursesTable).where(eq(schema.coursesTable.id, id)).limit(1);
    if (!c) throw Object.assign(new Error("Course not found"), { status: 404 });
    const materials = await db
      .select()
      .from(schema.materialsTable)
      .where(eq(schema.materialsTable.courseId, id))
      .orderBy(schema.materialsTable.ord);
    return GetCourseResponse.parse({
      id: c.id,
      title: c.title,
      code: c.code,
      description: c.description,
      credits: c.credits,
      department: c.department,
      instructor: c.instructor,
      coverUrl: c.coverUrl,
      progress: c.progress,
      enrolled: c.enrolled,
      instructorBio: c.instructorBio,
      syllabus: c.syllabus ?? [],
      materials: materials.map((m) => ({
        id: m.id,
        title: m.title,
        kind: m.kind,
        url: m.url,
        durationMinutes: m.durationMinutes,
      })),
    });
  });
});

export default router;
