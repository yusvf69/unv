import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { ListStaffResponse, GetStaffMemberResponse } from "@workspace/api-zod";
import { db, schema } from "../lib/db";
import { handle } from "../lib/util";

const router: IRouter = Router();

const STAFF_ROLES = ["doctor", "ta"] as const;

function toStaff(u: typeof schema.usersTable.$inferSelect) {
  const role = u.isDean ? "dean" : u.role === "ta" ? "ta" : "doctor";
  return {
    id: u.id,
    name: u.name,
    title: u.title ?? "عضو هيئة تدريس",
    role,
    department: u.department,
    bio: u.bio ?? "",
    avatarUrl: u.avatarUrl,
    email: u.email,
    officeHours: u.officeHours,
    researchInterests: u.researchInterests ?? [],
  };
}

router.get("/staff", (req, res) => {
  void handle(res, async () => {
    const dept = typeof req.query.department === "string" ? req.query.department : undefined;
    const where = dept
      ? and(inArray(schema.usersTable.role, [...STAFF_ROLES]), eq(schema.usersTable.department, dept))
      : inArray(schema.usersTable.role, [...STAFF_ROLES]);
    const rows = await db.select().from(schema.usersTable).where(where);
    return ListStaffResponse.parse(rows.map(toStaff));
  });
});

router.get("/staff/:id", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const [row] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, id)).limit(1);
    if (!row) throw Object.assign(new Error("Staff not found"), { status: 404 });
    return GetStaffMemberResponse.parse(toStaff(row));
  });
});

export default router;
