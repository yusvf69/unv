import { Router, type IRouter, type Request } from "express";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "../lib/db";
import { handle } from "../lib/util";

const router: IRouter = Router();

async function currentUser(req: Request) {
  const userId = req.demo.currentUserId;
  if (!userId) return undefined;
  const [u] = await db
    .select()
    .from(schema.usersTable)
    .where(eq(schema.usersTable.id, userId))
    .limit(1);
  return u;
}

function ensureRoles(roles: string[]) {
  return async (req: Request, res: any, next: any) => {
    const u = await currentUser(req);
    if (!u || !roles.includes(u.role)) {
      res.status(403).json({ error: "غير مصرح" });
      return;
    }
    (req as any).me = u;
    next();
  };
}

// ---------- TITLES from points ----------
function titleFromPoints(points: number): string {
  if (points >= 2000) return "أسطورة الكلية";
  if (points >= 1000) return "خبير المحتوى";
  if (points >= 500) return "نشيط مميز";
  if (points >= 200) return "مساهم نشط";
  if (points >= 50) return "متعلم متفاعل";
  return "مستجد";
}

async function awardPoints(userId: number, delta: number) {
  await db
    .update(schema.usersTable)
    .set({ points: sql`${schema.usersTable.points} + ${delta}` })
    .where(eq(schema.usersTable.id, userId));
  const [u] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, userId));
  if (u) {
    const newTitle = titleFromPoints(u.points);
    if (u.title !== newTitle && (u.role === "student" || !u.title)) {
      await db.update(schema.usersTable).set({ title: newTitle }).where(eq(schema.usersTable.id, userId));
    }
  }
}

// ---------- EVENTS (exams + deadlines) ----------
router.get("/events", (req, res) => {
  void handle(res, async () => {
    const me = await currentUser(req);
    const rows = await db.select().from(schema.eventsTable).orderBy(schema.eventsTable.dueAt);
    const filtered = me && me.role === "student"
      ? rows.filter(
          (e) =>
            (!e.yearInCollege || e.yearInCollege === me.yearInCollege) &&
            (!e.groupName || e.groupName === me.groupName),
        )
      : rows;
    return filtered.map((e) => ({ ...e, dueAt: e.dueAt.toISOString(), createdAt: e.createdAt.toISOString() }));
  });
});

router.post("/admin/events", ensureRoles(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const me = (req as any).me as typeof schema.usersTable.$inferSelect;
    const { title, description, kind, yearInCollege, groupName, dueAt, location } = req.body as any;
    if (!title || !dueAt) throw Object.assign(new Error("العنوان وموعد الحدث مطلوبان"), { status: 400 });
    const [r] = await db
      .insert(schema.eventsTable)
      .values({
        title,
        description: description || "",
        kind: kind || "exam",
        yearInCollege: yearInCollege ? Number(yearInCollege) : null,
        groupName: groupName || null,
        dueAt: new Date(dueAt),
        location: location || null,
        createdById: me.id,
      })
      .returning();
    // notify matching students
    const students = await db.select().from(schema.usersTable).where(eq(schema.usersTable.role, "student"));
    for (const s of students) {
      if ((!r.yearInCollege || r.yearInCollege === s.yearInCollege) && (!r.groupName || r.groupName === s.groupName)) {
        await db.insert(schema.notificationsTable).values({
          userId: s.id,
          title: `${r.kind === "exam" ? "امتحان جديد" : "موعد نهائي"}: ${r.title}`,
          body: `${r.description || ""} — في ${new Date(r.dueAt).toLocaleString("ar-EG")}`,
          type: r.kind === "exam" ? "warning" : "info",
        });
      }
    }
    return { ...r, dueAt: r.dueAt.toISOString(), createdAt: r.createdAt.toISOString() };
  });
});

router.delete("/admin/events/:id", ensureRoles(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    await db.delete(schema.eventsTable).where(eq(schema.eventsTable.id, id));
    return { ok: true };
  });
});

// ---------- DOCTORS / TAS for course assignment ----------
router.get("/v2/staff/doctors", (_req, res) => {
  void handle(res, async () => {
    const rows = await db
      .select()
      .from(schema.usersTable)
      .where(inArray(schema.usersTable.role, ["doctor", "ta"]));
    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      department: u.department,
      avatarUrl: u.avatarUrl,
      title: u.title,
    }));
  });
});

// ---------- MATERIAL FILES — view, like, comment ----------
router.get("/v2/material-files/:id", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const userId = req.demo.currentUserId;
    if (!userId) throw Object.assign(new Error("غير مسجل"), { status: 401 });
    const [f] = await db.select().from(schema.materialFilesTable).where(eq(schema.materialFilesTable.id, id));
    if (!f) throw Object.assign(new Error("الملف غير موجود"), { status: 404 });
    const [likeRow] = await db
      .select()
      .from(schema.materialFileLikesTable)
      .where(and(eq(schema.materialFileLikesTable.fileId, id), eq(schema.materialFileLikesTable.userId, userId)));
    const [viewRow] = await db
      .select()
      .from(schema.materialFileViewsTable)
      .where(and(eq(schema.materialFileViewsTable.fileId, id), eq(schema.materialFileViewsTable.userId, userId)));
    return {
      ...f,
      createdAt: f.createdAt.toISOString(),
      likedByMe: !!likeRow,
      viewedByMe: !!viewRow,
    };
  });
});

router.post("/v2/material-files/:id/view", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const userId = req.demo.currentUserId;
    if (!userId) throw Object.assign(new Error("غير مسجل"), { status: 401 });
    const [existing] = await db
      .select()
      .from(schema.materialFileViewsTable)
      .where(and(eq(schema.materialFileViewsTable.fileId, id), eq(schema.materialFileViewsTable.userId, userId)));
    if (existing) return { counted: false };
    await db.insert(schema.materialFileViewsTable).values({ fileId: id, userId });
    await db
      .update(schema.materialFilesTable)
      .set({ views: sql`${schema.materialFilesTable.views} + 1` })
      .where(eq(schema.materialFilesTable.id, id));
    const [f] = await db.select().from(schema.materialFilesTable).where(eq(schema.materialFilesTable.id, id));
    if (f && f.uploadedById !== userId) await awardPoints(f.uploadedById, 1);
    return { counted: true };
  });
});

router.post("/v2/material-files/:id/like", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const userId = req.demo.currentUserId;
    if (!userId) throw Object.assign(new Error("غير مسجل"), { status: 401 });
    const [existing] = await db
      .select()
      .from(schema.materialFileLikesTable)
      .where(and(eq(schema.materialFileLikesTable.fileId, id), eq(schema.materialFileLikesTable.userId, userId)));
    const [f] = await db.select().from(schema.materialFilesTable).where(eq(schema.materialFilesTable.id, id));
    if (!f) throw Object.assign(new Error("الملف غير موجود"), { status: 404 });
    if (existing) {
      await db
        .delete(schema.materialFileLikesTable)
        .where(and(eq(schema.materialFileLikesTable.fileId, id), eq(schema.materialFileLikesTable.userId, userId)));
      await db
        .update(schema.materialFilesTable)
        .set({ likes: sql`GREATEST(${schema.materialFilesTable.likes} - 1, 0)` })
        .where(eq(schema.materialFilesTable.id, id));
      if (f.uploadedById !== userId) await awardPoints(f.uploadedById, -2);
      return { liked: false };
    }
    await db.insert(schema.materialFileLikesTable).values({ fileId: id, userId });
    await db
      .update(schema.materialFilesTable)
      .set({ likes: sql`${schema.materialFilesTable.likes} + 1` })
      .where(eq(schema.materialFilesTable.id, id));
    if (f.uploadedById !== userId) await awardPoints(f.uploadedById, 2);
    return { liked: true };
  });
});

router.get("/v2/material-files/:id/comments", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const rows = await db
      .select()
      .from(schema.materialFileCommentsTable)
      .where(eq(schema.materialFileCommentsTable.fileId, id))
      .orderBy(desc(schema.materialFileCommentsTable.createdAt));
    const ids = Array.from(new Set(rows.map((r) => r.authorId)));
    const users = ids.length ? await db.select().from(schema.usersTable).where(inArray(schema.usersTable.id, ids)) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      authorName: byId.get(c.authorId)?.name,
      authorAvatar: byId.get(c.authorId)?.avatarUrl,
      authorRole: byId.get(c.authorId)?.role,
    }));
  });
});

router.post("/v2/material-files/:id/comments", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const { body } = req.body as { body?: string };
    if (!body || !body.trim()) throw Object.assign(new Error("نص التعليق مطلوب"), { status: 400 });
    const userId = req.demo.currentUserId;
    if (!userId) throw Object.assign(new Error("غير مسجل"), { status: 401 });
    const [c] = await db
      .insert(schema.materialFileCommentsTable)
      .values({ fileId: id, authorId: userId, body: body.trim() })
      .returning();
    return { ...c, createdAt: c.createdAt.toISOString() };
  });
});

// ---------- STUDENT SUMMARIES (separate category) ----------
router.get("/v2/student-summaries", (_req, res) => {
  void handle(res, async () => {
    const rows = await db
      .select()
      .from(schema.materialFilesTable)
      .where(eq(schema.materialFilesTable.category, "student-summary"))
      .orderBy(desc(schema.materialFilesTable.createdAt));
    const ids = Array.from(new Set(rows.map((r) => r.uploadedById)));
    const users = ids.length ? await db.select().from(schema.usersTable).where(inArray(schema.usersTable.id, ids)) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      uploaderTitle: byId.get(r.uploadedById)?.title,
      uploaderAvatar: byId.get(r.uploadedById)?.avatarUrl,
      uploaderPoints: byId.get(r.uploadedById)?.points ?? 0,
    }));
  });
});

router.get("/v2/courses/:id/student-summaries", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const rows = await db
      .select()
      .from(schema.materialFilesTable)
      .where(and(eq(schema.materialFilesTable.courseId, id), eq(schema.materialFilesTable.category, "student-summary")))
      .orderBy(desc(schema.materialFilesTable.createdAt));
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  });
});

router.post("/v2/student-summaries", (req, res) => {
  void handle(res, async () => {
    const me = await currentUser(req);
    if (!me) throw Object.assign(new Error("سجل دخول"), { status: 401 });
    const { name, kind, url, sizeBytes, courseId } = req.body as any;
    if (!name || !url || !courseId) throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
    const [f] = await db
      .insert(schema.materialFilesTable)
      .values({
        courseId: Number(courseId),
        materialId: null,
        name,
        kind: kind || "pdf",
        category: "student-summary",
        url,
        sizeBytes: sizeBytes || 0,
        uploadedById: me.id,
        uploadedByName: me.name,
      })
      .returning();
    await awardPoints(me.id, 5);
    return { ...f, createdAt: f.createdAt.toISOString() };
  });
});

router.delete("/v2/student-summaries/:id", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const me = await currentUser(req);
    if (!me) throw Object.assign(new Error("سجل دخول"), { status: 401 });
    const [f] = await db.select().from(schema.materialFilesTable).where(eq(schema.materialFilesTable.id, id));
    if (!f) return { ok: true };
    if (f.uploadedById !== me.id && me.role !== "admin" && me.role !== "super_admin") {
      throw Object.assign(new Error("لا يمكنك حذف ملف غيرك"), { status: 403 });
    }
    await db.delete(schema.materialFilesTable).where(eq(schema.materialFilesTable.id, id));
    return { ok: true };
  });
});

// ---------- ADMIN NEWS (admin → pending, super_admin → published) ----------
router.get("/v2/admin/news", ensureRoles(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const me = (req as any).me as typeof schema.usersTable.$inferSelect;
    let rows;
    if (me.role === "super_admin") {
      rows = await db.select().from(schema.newsTable).orderBy(desc(schema.newsTable.publishedAt));
    } else {
      rows = await db
        .select()
        .from(schema.newsTable)
        .where(eq(schema.newsTable.authorId, me.id))
        .orderBy(desc(schema.newsTable.publishedAt));
    }
    return rows;
  });
});

router.post("/v2/admin/news", ensureRoles(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const me = (req as any).me as typeof schema.usersTable.$inferSelect;
    const { title, excerpt, body, category, imageUrl } = req.body as any;
    if (!title || !excerpt || !body || !category) throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
    const status = me.role === "super_admin" ? "approved" : "pending";
    const [n] = await db
      .insert(schema.newsTable)
      .values({ title, excerpt, body, category, imageUrl: imageUrl || null, author: me.name, authorId: me.id, status })
      .returning();
    if (status === "pending") {
      const supers = await db.select().from(schema.usersTable).where(eq(schema.usersTable.role, "super_admin"));
      for (const su of supers) {
        await db.insert(schema.notificationsTable).values({
          userId: su.id,
          title: "خبر جديد بانتظار موافقتك",
          body: `${me.name} نشر خبراً: ${title}`,
          type: "warning",
        });
      }
    }
    return n;
  });
});

router.post("/v2/admin/news/:id/approve", ensureRoles(["super_admin"]), (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    await db.update(schema.newsTable).set({ status: "approved", publishedAt: new Date() }).where(eq(schema.newsTable.id, id));
    const [n] = await db.select().from(schema.newsTable).where(eq(schema.newsTable.id, id));
    if (n?.authorId) {
      await db.insert(schema.notificationsTable).values({
        userId: n.authorId,
        title: "تمت الموافقة على خبرك",
        body: `وافق السوبر أدمن على نشر: ${n.title}`,
        type: "success",
      });
    }
    return { ok: true };
  });
});

router.post("/v2/admin/news/:id/reject", ensureRoles(["super_admin"]), (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const { reason } = req.body as { reason?: string };
    const [n] = await db.select().from(schema.newsTable).where(eq(schema.newsTable.id, id));
    await db.update(schema.newsTable).set({ status: "rejected" }).where(eq(schema.newsTable.id, id));
    if (n?.authorId) {
      await db.insert(schema.notificationsTable).values({
        userId: n.authorId,
        title: "تم رفض خبرك",
        body: `${n.title}${reason ? ` — ${reason}` : ""}`,
        type: "alert",
      });
    }
    return { ok: true };
  });
});

router.delete("/v2/admin/news/:id", ensureRoles(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const me = (req as any).me as typeof schema.usersTable.$inferSelect;
    const id = Number(req.params.id);
    const [n] = await db.select().from(schema.newsTable).where(eq(schema.newsTable.id, id));
    if (!n) return { ok: true };
    if (me.role !== "super_admin" && n.authorId !== me.id) {
      throw Object.assign(new Error("لا يمكنك حذف خبر غيرك"), { status: 403 });
    }
    await db.delete(schema.newsTable).where(eq(schema.newsTable.id, id));
    return { ok: true };
  });
});

// ---------- ADMIN COURSES (instructor selection from doctors list) ----------
router.post("/v2/admin/courses", ensureRoles(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const { title, code, description, credits, department, instructorId, taIds, yearInCollege, coverUrl } = req.body as any;
    if (!title || !code || !instructorId) throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
    const [doc] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, Number(instructorId)));
    if (!doc) throw Object.assign(new Error("الدكتور غير موجود"), { status: 400 });
    const [c] = await db
      .insert(schema.coursesTable)
      .values({
        title,
        code,
        description: description || "",
        credits: credits || 3,
        department: department || doc.department,
        instructor: doc.name,
        instructorId: doc.id,
        taIds: Array.isArray(taIds) ? taIds.map((x: any) => Number(x)) : null,
        instructorBio: doc.bio || "",
        yearInCollege: yearInCollege ? Number(yearInCollege) : null,
        coverUrl: coverUrl || null,
      })
      .returning();
    return c;
  });
});

router.delete("/v2/admin/courses/:id", ensureRoles(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    await db.delete(schema.coursesTable).where(eq(schema.coursesTable.id, id));
    return { ok: true };
  });
});

// ---------- ADMIN STAFF (create staff with avatar) ----------
router.post("/v2/admin/staff", ensureRoles(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const { name, email, phone, role, department, title, avatarUrl, bio, officeHours, researchInterests, username, password } = req.body as any;
    if (!name || !email || !role) throw Object.assign(new Error("الاسم والبريد والدور مطلوبة"), { status: 400 });
    if (!["doctor", "ta", "admin"].includes(role)) throw Object.assign(new Error("دور غير صالح"), { status: 400 });
    const [existingEmail] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.email, email));
    if (existingEmail) throw Object.assign(new Error("البريد مسجل من قبل"), { status: 400 });
    const isArabicName = /^[\u0600-\u06FF\s]+$/.test(name.trim());
    const un = username || (isArabicName ? email.split("@")[0] : name.replace(/\s+/g, "_").toLowerCase());
    const pw = password || "Staff123!";
    const hashed = await bcrypt.hash(pw, 10);
    const uniqueCode = `UV-${role.toUpperCase().slice(0, 2)}-${Date.now().toString(36).toUpperCase()}`;
    const [u] = await db
      .insert(schema.usersTable)
      .values({
        name,
        username: un,
        email,
        phone: phone || null,
        password: hashed,
        role,
        department: department || "غير محدد",
        title: title || null,
        avatarUrl: avatarUrl || null,
        bio: bio || null,
        officeHours: officeHours || null,
        researchInterests: Array.isArray(researchInterests) ? researchInterests : null,
        uniqueCode,
        emailVerified: true,
        phoneVerified: true,
      })
      .returning();
    return u;
  });
});

router.patch("/v2/admin/staff/:id", ensureRoles(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const allowed = ["name", "phone", "department", "title", "avatarUrl", "bio", "officeHours", "researchInterests"];
    const update: Record<string, unknown> = {};
    for (const k of allowed) if (k in req.body) update[k] = req.body[k];
    if (!Object.keys(update).length) return { ok: true };
    await db.update(schema.usersTable).set(update).where(eq(schema.usersTable.id, id));
    return { ok: true };
  });
});

export default router;
