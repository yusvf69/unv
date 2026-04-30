import { Router, type IRouter } from "express";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { GetHomeFeedResponse } from "@workspace/api-zod";
import { db, schema } from "../lib/db";
import { handle } from "../lib/util";

const router: IRouter = Router();

router.get("/home/feed", (_req, res) => {
  void handle(res, async () => {
    const [dean] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.isDean, 1)).limit(1);
    const topStaff = await db
      .select()
      .from(schema.usersTable)
      .where(inArray(schema.usersTable.role, ["doctor", "ta"]))
      .orderBy(desc(schema.usersTable.points))
      .limit(6);
    const latestNews = await db
      .select()
      .from(schema.newsTable)
      .where(eq(schema.newsTable.status, "approved"))
      .orderBy(desc(schema.newsTable.publishedAt))
      .limit(4);
    const topStudentsRows = await db
      .select()
      .from(schema.usersTable)
      .where(eq(schema.usersTable.role, "student"))
      .orderBy(desc(schema.usersTable.points))
      .limit(5);
    const topStudents = topStudentsRows.map((u, i) => ({
      rank: i + 1,
      userId: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      department: u.department,
      year: u.year,
      points: u.points,
      level: u.level,
      streak: u.streak,
      deltaRank: ((u.id * 5) % 5) - 2,
    }));
    const talents = await db
      .select()
      .from(schema.talentsTable)
      .where(eq(schema.talentsTable.status, "active"))
      .orderBy(desc(schema.talentsTable.votes))
      .limit(6);
    const owners = talents.length
      ? await db
          .select()
          .from(schema.usersTable)
          .where(inArray(schema.usersTable.id, talents.map((t) => t.ownerId)))
      : [];
    const ownerById = new Map(owners.map((o) => [o.id, o]));
    const featuredTalents = talents.map((t) => {
      const o = ownerById.get(t.ownerId);
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
    });
    const [{ students }] = await db
      .select({ students: sql<number>`count(*)::int` })
      .from(schema.usersTable)
      .where(eq(schema.usersTable.role, "student"));
    const [{ staff }] = await db
      .select({ staff: sql<number>`count(*)::int` })
      .from(schema.usersTable)
      .where(inArray(schema.usersTable.role, ["doctor", "ta"]));
    const [{ courses }] = await db.select({ courses: sql<number>`count(*)::int` }).from(schema.coursesTable);
    return GetHomeFeedResponse.parse({
      dean: dean
        ? {
            id: dean.id,
            name: dean.name,
            title: dean.title ?? "عميد الكلية",
            role: "dean",
            department: dean.department,
            bio: dean.bio ?? "",
            avatarUrl: dean.avatarUrl,
            email: dean.email,
            officeHours: dean.officeHours,
            researchInterests: dean.researchInterests ?? [],
          }
        : null,
      topStaff: topStaff.map((u) => ({
        id: u.id,
        name: u.name,
        title: u.title ?? "عضو هيئة تدريس",
        role: u.role === "ta" ? "ta" : "doctor",
        department: u.department,
        bio: u.bio ?? "",
        avatarUrl: u.avatarUrl,
        email: u.email,
        officeHours: u.officeHours,
        researchInterests: u.researchInterests ?? [],
      })),
      latestNews,
      topStudents,
      featuredTalents,
      stats: {
        students,
        staff,
        courses,
        researchProjects: 47,
      },
    });
  });
});

export default router;
