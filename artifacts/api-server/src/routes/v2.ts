import { Router, type IRouter, type Request } from "express";
import { eq, desc, and, sql, inArray, ilike, or } from "drizzle-orm";
import { db, schema } from "../lib/db";
import { handle } from "../lib/util";
import { setDemoUser } from "../lib/session";
import bcrypt from "bcryptjs";
import { isMailConfigured, sendMail } from "../lib/mail";

const router: IRouter = Router();

function generateUniqueCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "UV-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function getCurrentUser(req: Request) {
  const id = req.demo.currentUserId!;
  if (!id) return null;
  const [user] = await db
    .select()
    .from(schema.usersTable)
    .where(eq(schema.usersTable.id, id))
    .limit(1);
  return user;
}

function requireRole(roles: string[]) {
  return async (req: Request, res: any, next: any) => {
    const user = await getCurrentUser(req);
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: "غير مصرح" });
      return;
    }
    (req as any).currentUser = user;
    next();
  };
}

// ---------- NOTIFICATIONS ----------
router.get("/v2/notifications", (req, res) => {
  void handle(res, async () => {
    const userId = req.demo.currentUserId!;
    if (!userId) throw Object.assign(new Error("غير مسجل"), { status: 401 });
    const rows = await db
      .select()
      .from(schema.notificationsTable)
      .where(eq(schema.notificationsTable.userId, userId))
      .orderBy(desc(schema.notificationsTable.createdAt))
      .limit(50);
    return rows.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }));
  });
});

router.post("/v2/notifications/:id/read", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    await db
      .update(schema.notificationsTable)
      .set({ read: true })
      .where(and(eq(schema.notificationsTable.id, id), eq(schema.notificationsTable.userId, req.demo.currentUserId!)));
    return { ok: true };
  });
});

router.post("/v2/notifications/mark-all-read", (req, res) => {
  void handle(res, async () => {
    await db
      .update(schema.notificationsTable)
      .set({ read: true })
      .where(eq(schema.notificationsTable.userId, req.demo.currentUserId!));
    return { ok: true };
  });
});

// ---------- SYSTEM NOTIFICATIONS (admin sends to all) ----------
router.post("/v2/admin/notifications/system", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const { title, body, type, targetRole, targetGroup, targetYear } = req.body as {
      title: string; body: string; type?: string; targetRole?: string; targetGroup?: string; targetYear?: number;
    };
    if (!title || !body) throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
    const conditions = [];
    if (targetRole) conditions.push(eq(schema.usersTable.role, targetRole));
    if (targetGroup) conditions.push(eq(schema.usersTable.groupName, targetGroup));
    if (targetYear !== undefined) conditions.push(eq(schema.usersTable.yearInCollege, targetYear));
    const users = conditions.length > 0
      ? await db.select({ id: schema.usersTable.id }).from(schema.usersTable).where(and(...conditions))
      : await db.select({ id: schema.usersTable.id }).from(schema.usersTable);
    if (users.length > 0) {
      await db.insert(schema.notificationsTable).values(
        users.map((u) => ({ userId: u.id, title, body, type: type || "info" }))
      );
    }
    return { ok: true, sentTo: users.length };
  });
});

// ---------- AUTH (password-based) ----------
router.post("/v2/auth/login", (req, res) => {
  void handle(res, async () => {
    const { identifier, password } = req.body as { identifier?: string; password?: string };
    if (!identifier || !password) throw Object.assign(new Error("البريد/الهاتف وكلمة المرور مطلوبة"), { status: 400 });
    const [user] = await db
      .select()
      .from(schema.usersTable)
      .where(or(eq(schema.usersTable.email, identifier), eq(schema.usersTable.phone, identifier)))
      .limit(1);
    if (!user) throw Object.assign(new Error("الحساب غير موجود"), { status: 404 });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw Object.assign(new Error("كلمة المرور غير صحيحة"), { status: 401 });
    setDemoUser(res, user.id);
    return { userId: user.id, role: user.role };
  });
});

router.post("/v2/auth/logout", (_req, res) => {
  void handle(res, async () => {
    res.clearCookie("uv_demo_user");
    return { ok: true };
  });
});

// ---------- FORGOT PASSWORD (in-memory codes) ----------
const resetCodes = new Map<string, { code: string; expiresAt: Date }>();

router.post("/v2/auth/forgot-password", (req, res) => {
  void handle(res, async () => {
    const { email, phone } = req.body as { email?: string; phone?: string };
    const identifier = email || phone;
    if (!identifier) throw Object.assign(new Error("البريد أو الهاتف مطلوب"), { status: 400 });

    const [user] = await db
      .select()
      .from(schema.usersTable)
      .where(email ? eq(schema.usersTable.email, identifier) : eq(schema.usersTable.phone, identifier))
      .limit(1);
    if (!user) throw Object.assign(new Error("الحساب غير موجود"), { status: 404 });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    resetCodes.set(identifier, { code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });

    // Send code via email if email provided
    if (email && isMailConfigured()) {
      await sendMail({
        to: email,
        subject: "[UniVerse] كود استعادة كلمة المرور",
        html: `
          <div dir="rtl" style="font-family: 'Cairo', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #2d6a4f, #40916c); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🌿 UniVerse</h1>
              <p style="color: rgba(255,255,255,0.85); margin-top: 8px;">استعادة كلمة المرور</p>
            </div>
            <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; text-align: center;">
              <p style="color: #374151; font-size: 16px;">مرحباً <strong>${user.name}</strong>،</p>
              <p style="color: #374151; font-size: 16px;">كود استعادة كلمة المرور الخاص بك هو:</p>
              <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; margin: 20px 0; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #2d6a4f;">${code}</div>
              <p style="color: #6b7280; font-size: 14px;">هذا الكود صالح لمدة 10 دقائق.</p>
              <p style="color: #9ca3af; font-size: 12px;">إذا لم تطلب استعادة كلمة المرور، تجاهل هذه الرسالة.</p>
            </div>
          </div>
        `,
      });
    }

    return { ok: true, identifier: email ? "email" : "phone" };
  });
});

router.post("/v2/auth/verify-reset-code", (req, res) => {
  void handle(res, async () => {
    const { email, phone, code } = req.body as { email?: string; phone?: string; code?: string };
    const identifier = email || phone;
    if (!identifier || !code) throw Object.assign(new Error("البيانات ناقصة"), { status: 400 });

    const stored = resetCodes.get(identifier);
    if (!stored) throw Object.assign(new Error("لم يتم طلب استعادة كلمة المرور"), { status: 400 });
    if (new Date() > stored.expiresAt) {
      resetCodes.delete(identifier);
      throw Object.assign(new Error("انتهت صلاحية الكود، أعد الطلب"), { status: 400 });
    }
    if (stored.code !== code) throw Object.assign(new Error("الكود غير صحيح"), { status: 401 });

    return { ok: true, verified: true };
  });
});

router.post("/v2/auth/reset-password", (req, res) => {
  void handle(res, async () => {
    const { email, phone, code, newPassword } = req.body as { email?: string; phone?: string; code?: string; newPassword?: string };
    const identifier = email || phone;
    if (!identifier || !code || !newPassword) throw Object.assign(new Error("البيانات ناقصة"), { status: 400 });
    if (newPassword.length < 6) throw Object.assign(new Error("كلمة المرور يجب أن تكون 6 أحرف على الأقل"), { status: 400 });

    const stored = resetCodes.get(identifier);
    if (!stored) throw Object.assign(new Error("لم يتم طلب استعادة كلمة المرور"), { status: 400 });
    if (new Date() > stored.expiresAt) {
      resetCodes.delete(identifier);
      throw Object.assign(new Error("انتهت صلاحية الكود، أعد الطلب"), { status: 400 });
    }
    if (stored.code !== code) throw Object.assign(new Error("الكود غير صحيح"), { status: 401 });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db
      .update(schema.usersTable)
      .set({ password: hashedPassword })
      .where(email ? eq(schema.usersTable.email, identifier) : eq(schema.usersTable.phone, identifier));

    resetCodes.delete(identifier);

    // Log the user in after reset
    const [user] = await db
      .select()
      .from(schema.usersTable)
      .where(email ? eq(schema.usersTable.email, identifier) : eq(schema.usersTable.phone, identifier))
      .limit(1);
    if (user) setDemoUser(res, user.id);

    return { ok: true, token: "reset" };
  });
});

router.get("/v2/auth/username-available", (req, res) => {
  void handle(res, async () => {
    const username = req.query.username as string;
    if (!username || username.length < 4) return { available: false, reason: username ? "اليوزر لازم يكون 4 حروف على الأقل" : "أدخل يوزر" };
    const [existing] = await db.select({ id: schema.usersTable.id }).from(schema.usersTable).where(eq(schema.usersTable.username, username)).limit(1);
    if (existing) {
      const suggestions: string[] = [];
      const suffixes = [Math.floor(Math.random() * 900 + 100).toString(), Math.floor(Math.random() * 9000 + 1000).toString()];
      for (const s of suffixes) {
        const suggestion = `${username}${s}`;
        const [taken] = await db.select({ id: schema.usersTable.id }).from(schema.usersTable).where(eq(schema.usersTable.username, suggestion)).limit(1);
        if (!taken) suggestions.push(suggestion);
        if (suggestions.length >= 2) break;
      }
      return { available: false, reason: "اليوزر ده مأخوذ", suggestions };
    }
    return { available: true };
  });
});

// ---------- ADMIN PROPOSALS (super-admin approval flow) ----------
router.get("/v2/admin/proposals", (req, res) => {
  void handle(res, async () => {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      throw Object.assign(new Error("غير مصرح"), { status: 403 });
    }
    const status = (req.query.status as string) || "pending";
    const where = user.role === "super_admin"
      ? eq(schema.adminProposalsTable.status, status)
      : and(eq(schema.adminProposalsTable.proposerId, user.id), eq(schema.adminProposalsTable.status, status));
    const rows = await db
      .select()
      .from(schema.adminProposalsTable)
      .where(where)
      .orderBy(desc(schema.adminProposalsTable.createdAt));
    const proposers = await db.select().from(schema.usersTable).where(inArray(schema.usersTable.id, rows.map((r) => r.proposerId)));
    const byId = new Map(proposers.map((p) => [p.id, p]));
    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
      proposerName: byId.get(r.proposerId)?.name,
      proposerRole: byId.get(r.proposerId)?.role,
    }));
  });
});

async function applyProposal(p: typeof schema.adminProposalsTable.$inferSelect) {
  const payload = p.payload as Record<string, unknown>;
  switch (p.resourceKind) {
    case "news": {
      if (p.action === "create") {
        await db.insert(schema.newsTable).values(payload as any);
      } else if (p.action === "update" && p.resourceId) {
        await db.update(schema.newsTable).set(payload as any).where(eq(schema.newsTable.id, p.resourceId));
      } else if (p.action === "delete" && p.resourceId) {
        await db.delete(schema.newsTable).where(eq(schema.newsTable.id, p.resourceId));
      }
      break;
    }
    case "user": {
      if (p.action === "create") {
        await db.insert(schema.usersTable).values(payload as any);
      } else if (p.action === "update" && p.resourceId) {
        await db.update(schema.usersTable).set(payload as any).where(eq(schema.usersTable.id, p.resourceId));
      } else if (p.action === "delete" && p.resourceId) {
        await db.update(schema.usersTable).set({ status: "inactive" }).where(eq(schema.usersTable.id, p.resourceId));
      }
      break;
    }
    case "talent": {
      if (p.action === "remove_talent" && p.resourceId) {
        const [t] = await db.select().from(schema.talentsTable).where(eq(schema.talentsTable.id, p.resourceId));
        if (t) {
          await db.update(schema.talentsTable).set({ status: "removed" }).where(eq(schema.talentsTable.id, p.resourceId));
          const warning = (payload.warning as string) ?? "تم حذف موهبتك من قبل الإدارة. يرجى مراجعة سياسة المحتوى.";
          await db.insert(schema.notificationsTable).values({
            userId: t.ownerId,
            title: "تحذير من الإدارة بشأن موهبة",
            body: warning,
            type: "alert",
          });
        }
      }
      break;
    }
    case "course": {
      if (p.action === "create") await db.insert(schema.coursesTable).values(payload as any);
      else if (p.action === "update" && p.resourceId) await db.update(schema.coursesTable).set(payload as any).where(eq(schema.coursesTable.id, p.resourceId));
      else if (p.action === "delete" && p.resourceId) await db.delete(schema.coursesTable).where(eq(schema.coursesTable.id, p.resourceId));
      break;
    }
    case "material": {
      if (p.action === "create") await db.insert(schema.materialsTable).values(payload as any);
      else if (p.action === "update" && p.resourceId) await db.update(schema.materialsTable).set(payload as any).where(eq(schema.materialsTable.id, p.resourceId));
      else if (p.action === "delete" && p.resourceId) await db.delete(schema.materialsTable).where(eq(schema.materialsTable.id, p.resourceId));
      break;
    }
    case "quiz": {
      if (p.action === "create") await db.insert(schema.quizzesTable).values(payload as any);
      else if (p.action === "update" && p.resourceId) await db.update(schema.quizzesTable).set(payload as any).where(eq(schema.quizzesTable.id, p.resourceId));
      else if (p.action === "delete" && p.resourceId) await db.delete(schema.quizzesTable).where(eq(schema.quizzesTable.id, p.resourceId));
      break;
    }
    case "question": {
      if (p.action === "create") await db.insert(schema.quizQuestionsTable).values(payload as any);
      else if (p.action === "update" && p.resourceId) await db.update(schema.quizQuestionsTable).set(payload as any).where(eq(schema.quizQuestionsTable.id, p.resourceId));
      else if (p.action === "delete" && p.resourceId) await db.delete(schema.quizQuestionsTable).where(eq(schema.quizQuestionsTable.id, p.resourceId));
      break;
    }
  }
}

router.post("/v2/admin/proposals", (req, res) => {
  void handle(res, async () => {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      throw Object.assign(new Error("غير مصرح"), { status: 403 });
    }
    const { action, resourceKind, resourceId, payload, reason } = req.body as any;
    if (!action || !resourceKind) throw Object.assign(new Error("action و resourceKind مطلوب"), { status: 400 });

    // If super_admin, apply directly
    if (user.role === "super_admin") {
      const [p] = await db
        .insert(schema.adminProposalsTable)
        .values({
          proposerId: user.id,
          action,
          resourceKind,
          resourceId,
          payload: payload ?? {},
          reason,
          status: "approved",
          decidedById: user.id,
          decidedAt: new Date(),
          decisionNote: "تنفيذ مباشر من السوبر أدمن",
        })
        .returning();
      await applyProposal(p);
      return { proposal: p, applied: true };
    }

    // Admin: create pending proposal + notify super_admins
    const [p] = await db
      .insert(schema.adminProposalsTable)
      .values({
        proposerId: user.id,
        action,
        resourceKind,
        resourceId,
        payload: payload ?? {},
        reason,
        status: "pending",
      })
      .returning();
    const supers = await db.select().from(schema.usersTable).where(eq(schema.usersTable.role, "super_admin"));
    for (const su of supers) {
      await db.insert(schema.notificationsTable).values({
        userId: su.id,
        title: "اقتراح جديد بانتظار موافقتك",
        body: `${user.name} يقترح ${action} على ${resourceKind}${reason ? ` — ${reason}` : ""}`,
        type: "warning",
      });
    }
    return { proposal: p, applied: false };
  });
});

router.post("/v2/admin/proposals/:id/decide", (req, res) => {
  void handle(res, async () => {
    const user = await getCurrentUser(req);
    if (!user || user.role !== "super_admin") {
      throw Object.assign(new Error("السوبر أدمن فقط يقدر يوافق أو يرفض"), { status: 403 });
    }
    const id = Number(req.params.id);
    const { decision, note } = req.body as { decision: "approve" | "reject"; note?: string };
    const [p] = await db.select().from(schema.adminProposalsTable).where(eq(schema.adminProposalsTable.id, id));
    if (!p) throw Object.assign(new Error("الاقتراح غير موجود"), { status: 404 });
    if (p.status !== "pending") throw Object.assign(new Error("تم البت في الاقتراح بالفعل"), { status: 400 });

    if (decision === "approve") {
      await applyProposal(p);
      await db
        .update(schema.adminProposalsTable)
        .set({ status: "approved", decidedById: user.id, decidedAt: new Date(), decisionNote: note })
        .where(eq(schema.adminProposalsTable.id, id));
      await db.insert(schema.notificationsTable).values({
        userId: p.proposerId,
        title: "تمت الموافقة على اقتراحك",
        body: `وافق السوبر أدمن على ${p.action} - ${p.resourceKind}${note ? ` — ${note}` : ""}`,
        type: "success",
      });
    } else {
      await db
        .update(schema.adminProposalsTable)
        .set({ status: "rejected", decidedById: user.id, decidedAt: new Date(), decisionNote: note })
        .where(eq(schema.adminProposalsTable.id, id));
      await db.insert(schema.notificationsTable).values({
        userId: p.proposerId,
        title: "تم رفض اقتراحك",
        body: `رفض السوبر أدمن ${p.action} - ${p.resourceKind}${note ? ` — ${note}` : ""}`,
        type: "alert",
      });
    }
    return { ok: true };
  });
});

// ---------- TALENTS Instagram-style ----------
router.get("/v2/talents-feed", (req, res) => {
  void handle(res, async () => {
    const rows = await db
      .select()
      .from(schema.talentsTable)
      .where(eq(schema.talentsTable.status, "active"))
      .orderBy(desc(schema.talentsTable.createdAt));
    const ownerIds = Array.from(new Set(rows.map((t) => t.ownerId)));
    const owners = ownerIds.length ? await db.select().from(schema.usersTable).where(inArray(schema.usersTable.id, ownerIds)) : [];
    const ownerById = new Map(owners.map((u) => [u.id, u]));
    const talentIds = rows.map((t) => t.id);
    const likes = talentIds.length
      ? await db.select().from(schema.talentLikesTable).where(inArray(schema.talentLikesTable.talentId, talentIds))
      : [];
    const comments = talentIds.length
      ? await db.select().from(schema.talentCommentsTable).where(inArray(schema.talentCommentsTable.talentId, talentIds))
      : [];
    return rows.map((t) => {
      const tLikes = likes.filter((l) => l.talentId === t.id);
      const tComments = comments.filter((c) => c.talentId === t.id);
      const owner = ownerById.get(t.ownerId);
      return {
        ...t,
        createdAt: t.createdAt.toISOString(),
        owner: owner ? { id: owner.id, name: owner.name, avatarUrl: owner.avatarUrl, groupName: owner.groupName, department: owner.department } : null,
        likesCount: tLikes.length,
        likedByMe: tLikes.some((l) => l.userId === req.demo.currentUserId!),
        commentsCount: tComments.length,
      };
    });
  });
});

router.post("/v2/talents", (req, res) => {
  void handle(res, async () => {
    const user = await getCurrentUser(req);
    if (!user) throw Object.assign(new Error("سجل دخول"), { status: 401 });
    const { title, description, category, mediaUrl, groupOnly } = req.body as any;
    if (!title || !description || !category) throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
    const [t] = await db
      .insert(schema.talentsTable)
      .values({ title, description, category, mediaUrl, ownerId: user.id, groupOnly: groupOnly ?? null })
      .returning();
    return t;
  });
});

router.post("/v2/talents/:id/like", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const userId = req.demo.currentUserId!;
    const existing = await db
      .select()
      .from(schema.talentLikesTable)
      .where(and(eq(schema.talentLikesTable.talentId, id), eq(schema.talentLikesTable.userId, userId)));
    if (existing.length) {
      await db
        .delete(schema.talentLikesTable)
        .where(and(eq(schema.talentLikesTable.talentId, id), eq(schema.talentLikesTable.userId, userId)));
      return { liked: false };
    }
    await db.insert(schema.talentLikesTable).values({ talentId: id, userId });
    return { liked: true };
  });
});

router.get("/v2/talents/:id/comments", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const rows = await db
      .select()
      .from(schema.talentCommentsTable)
      .where(eq(schema.talentCommentsTable.talentId, id))
      .orderBy(desc(schema.talentCommentsTable.createdAt));
    const authorIds = Array.from(new Set(rows.map((r) => r.authorId)));
    const authors = authorIds.length ? await db.select().from(schema.usersTable).where(inArray(schema.usersTable.id, authorIds)) : [];
    const byId = new Map(authors.map((u) => [u.id, u]));
    return rows.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      authorName: byId.get(c.authorId)?.name,
      authorAvatar: byId.get(c.authorId)?.avatarUrl,
    }));
  });
});

router.post("/v2/talents/:id/comments", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const { body } = req.body as { body?: string };
    if (!body) throw Object.assign(new Error("نص التعليق مطلوب"), { status: 400 });
    const [c] = await db
      .insert(schema.talentCommentsTable)
      .values({ talentId: id, authorId: req.demo.currentUserId!, body })
      .returning();
    return c;
  });
});

// Admin delete talent comment
router.delete("/v2/admin/talent-comments/:id", requireRole(["admin", "super_admin"]), (_req, res) => {
  void handle(res, async () => {
    const id = Number(_req.params.id);
    await db.delete(schema.talentCommentsTable).where(eq(schema.talentCommentsTable.id, id));
    return { ok: true };
  });
});

// ---------- GAMES ----------
router.post("/v2/games/score", (req, res) => {
  void handle(res, async () => {
    const { gameKey, score, durationMs } = req.body as { gameKey: string; score: number; durationMs?: number };
    if (!gameKey || typeof score !== "number") throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
    const [row] = await db
      .insert(schema.gameScoresTable)
      .values({ userId: req.demo.currentUserId!, gameKey, score, durationMs: durationMs ?? 0 })
      .returning();
    // award points
    await db
      .update(schema.usersTable)
      .set({ points: sql`${schema.usersTable.points} + ${Math.floor(score / 10)}` })
      .where(eq(schema.usersTable.id, req.demo.currentUserId!));
    return row;
  });
});

router.get("/v2/games/leaderboard", (req, res) => {
  void handle(res, async () => {
    const gameKey = req.query.gameKey as string | undefined;
    const where = gameKey ? eq(schema.gameScoresTable.gameKey, gameKey) : undefined;
    const rows = where
      ? await db.select().from(schema.gameScoresTable).where(where).orderBy(desc(schema.gameScoresTable.score)).limit(20)
      : await db.select().from(schema.gameScoresTable).orderBy(desc(schema.gameScoresTable.score)).limit(20);
    const userIds = Array.from(new Set(rows.map((r) => r.userId)));
    const users = userIds.length ? await db.select().from(schema.usersTable).where(inArray(schema.usersTable.id, userIds)) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      userName: byId.get(r.userId)?.name,
      userAvatar: byId.get(r.userId)?.avatarUrl,
      groupName: byId.get(r.userId)?.groupName,
    }));
  });
});

// ---------- ADMIN: Direct CRUD (super_admin) or proposals (admin) ----------
// These thin endpoints help frontend without computing payload again.
router.get("/v2/admin/students", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_students");
  void handle(res, async () => {
    const rows = await db
      .select()
      .from(schema.usersTable)
      .where(eq(schema.usersTable.role, "student"))
      .orderBy(desc(schema.usersTable.points));
    return rows.map((u) => ({ ...u, lastSeen: u.lastSeen.toISOString(), createdAt: u.createdAt.toISOString() }));
  });
});

router.delete("/v2/admin/users/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    ensureSuper(req);
    const id = Number(req.params.id);
    const [u] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, id));
    if (!u) throw Object.assign(new Error("المستخدم غير موجود"), { status: 404 });
    if (u.role === "super_admin") throw Object.assign(new Error("لا يمكن حذف سوبر أدمن"), { status: 400 });
    await db.delete(schema.usersTable).where(eq(schema.usersTable.id, id));
    return { ok: true };
  });
});

router.patch("/v2/admin/users/:id/grant", requireRole(["super_admin"]), (req, res) => {
  ensurePermission(req, "manage_students");
  void handle(res, async () => {
    const id = Number(req.params.id);
    const { points, title } = req.body as { points?: number; title?: string };
    const [u] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, id));
    if (!u) throw Object.assign(new Error("الطالب غير موجود"), { status: 404 });
    const update: Record<string, unknown> = {};
    if (typeof points === "number") update.points = u.points + points;
    if (typeof title === "string" && title.trim()) update.title = title.trim();
    if (Object.keys(update).length === 0) throw Object.assign(new Error("لا توجد بيانات للتحديث"), { status: 400 });
    await db.update(schema.usersTable).set(update).where(eq(schema.usersTable.id, id));
    const [updated] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, id));
    return { ...updated, lastSeen: updated.lastSeen.toISOString(), createdAt: updated.createdAt.toISOString() };
  });
});

router.get("/v2/admin/student/:id/full", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_students");
  void handle(res, async () => {
    const id = Number(req.params.id);
    const [user] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, id));
    if (!user) throw Object.assign(new Error("الطالب غير موجود"), { status: 404 });
    const grades = await db.select().from(schema.gradesTable).where(eq(schema.gradesTable.userId, id));
    const attendance = await db.select().from(schema.attendanceTable).where(eq(schema.attendanceTable.userId, id));
    const schedule = await db.select().from(schema.scheduleItemsTable).where(eq(schema.scheduleItemsTable.userId, id));
    const activity = await db.select().from(schema.activityTable).where(eq(schema.activityTable.userId, id));
    return {
      user: { ...user, lastSeen: user.lastSeen.toISOString(), createdAt: user.createdAt.toISOString() },
      grades,
      attendance,
      schedule,
      activity,
    };
  });
});

// All staff for admin
router.get("/v2/admin/staff", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_staff");
  void handle(res, async () => {
    const rows = await db
      .select()
      .from(schema.usersTable)
      .where(inArray(schema.usersTable.role, ["doctor", "ta", "admin", "super_admin"]))
      .orderBy(schema.usersTable.role);
    return rows.map((u) => ({ ...u, lastSeen: u.lastSeen.toISOString(), createdAt: u.createdAt.toISOString() }));
  });
});

// Admin moderation panel: list talents (including removed)
router.get("/v2/admin/talents", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_talents");
  void handle(res, async () => {
    const rows = await db.select().from(schema.talentsTable).orderBy(desc(schema.talentsTable.createdAt));
    const ownerIds = Array.from(new Set(rows.map((t) => t.ownerId)));
    const owners = ownerIds.length ? await db.select().from(schema.usersTable).where(inArray(schema.usersTable.id, ownerIds)) : [];
    const byId = new Map(owners.map((u) => [u.id, u]));
    return rows.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      ownerName: byId.get(t.ownerId)?.name,
      ownerGroup: byId.get(t.ownerId)?.groupName,
    }));
  });
});

// Admin delete talent post
router.delete("/v2/admin/talents/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_talents");
  void handle(res, async () => {
    const id = Number(req.params.id);
    await db.delete(schema.talentsTable).where(eq(schema.talentsTable.id, id));
    return { ok: true };
  });
});

// Admin delete material file comment
router.delete("/v2/admin/material-comments/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    await db.delete(schema.materialFileCommentsTable).where(eq(schema.materialFileCommentsTable.id, id));
    return { ok: true };
  });
});

// Get all materials of a course (with lecturer)
router.get("/v2/courses/:id/materials", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const rows = await db
      .select()
      .from(schema.materialsTable)
      .where(eq(schema.materialsTable.courseId, id))
      .orderBy(schema.materialsTable.ord);
    return rows;
  });
});

// User group info
router.post("/v2/me/group", (req, res) => {
  void handle(res, async () => {
    const { groupName } = req.body as { groupName: string };
    if (!["A", "B", "C", "D", "E"].includes(groupName)) {
      throw Object.assign(new Error("اختر مجموعة صحيحة"), { status: 400 });
    }
    await db.update(schema.usersTable).set({ groupName }).where(eq(schema.usersTable.id, req.demo.currentUserId!));
    return { ok: true };
  });
});

// ---------- FORUM v2: allow create + like ----------
router.post("/v2/forum/posts", (req, res) => {
  void handle(res, async () => {
    const { title, body, category, groupOnly } = req.body as any;
    if (!title || !body) throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
    const [post] = await db
      .insert(schema.forumPostsTable)
      .values({ title, body, category: category || "عام", authorId: req.demo.currentUserId!, groupOnly: groupOnly ?? null })
      .returning();
    return post;
  });
});

router.post("/v2/forum/posts/:id/upvote", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    await db
      .update(schema.forumPostsTable)
      .set({ upvotes: sql`${schema.forumPostsTable.upvotes} + 1` })
      .where(eq(schema.forumPostsTable.id, id));
    return { ok: true };
  });
});

router.post("/v2/forum/posts/:id/replies", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const { body } = req.body as { body: string };
    if (!body) throw Object.assign(new Error("نص الرد مطلوب"), { status: 400 });
    const [r] = await db
      .insert(schema.forumRepliesTable)
      .values({ postId: id, body, authorId: req.demo.currentUserId! })
      .returning();
    return r;
  });
});

// ---------- "me" enriched (group + verified + specialization + year + username + uniqueCode) ----------
router.get("/v2/me", async (req, res) => {
  void handle(res, async () => {
    const user = await getCurrentUser(req);
    if (!user) throw Object.assign(new Error("لا يوجد مستخدم"), { status: 404 });
    const unread = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.notificationsTable)
      .where(and(eq(schema.notificationsTable.userId, user.id), eq(schema.notificationsTable.read, false)));
    const unreadDm = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.dmMessagesTable)
      .where(and(eq(schema.dmMessagesTable.read, false), sql`${schema.dmMessagesTable.fromId} <> ${user.id}`));
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
      groupName: user.groupName,
      avatarUrl: user.avatarUrl,
      department: user.department,
      year: user.year,
      yearInCollege: user.yearInCollege,
      specialization: user.specialization,
      points: user.points,
      level: user.level,
      streak: user.streak,
      title: user.title,
      uniqueCode: user.uniqueCode,
      adminPermissions: user.adminPermissions,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      unreadCount: unread[0]?.c ?? 0,
      unreadDmCount: unreadDm[0]?.c ?? 0,
    };
  });
});

// ---------- PROFILE EDIT (name + avatar + phone + bio + specialization + year) ----------
router.patch("/v2/me/profile", (req, res) => {
  void handle(res, async () => {
    const { name, phone, avatarUrl, bio, specialization, yearInCollege, groupName } = req.body as any;
    const update: Record<string, unknown> = {};
    if (typeof name === "string" && name.trim()) update.name = name.trim();
    if (typeof phone === "string") update.phone = phone;
    if (typeof avatarUrl === "string") update.avatarUrl = avatarUrl;
    if (typeof bio === "string") update.bio = bio;
    if (typeof specialization === "string") update.specialization = specialization;
    if (typeof yearInCollege === "number") update.yearInCollege = yearInCollege;
    if (typeof groupName === "string" && ["A","B","C","D","E"].includes(groupName)) update.groupName = groupName;
    if (!Object.keys(update).length) return { ok: true };
    await db.update(schema.usersTable).set(update).where(eq(schema.usersTable.id, req.demo.currentUserId!));
    return { ok: true };
  });
});

// ---------- STUDENTS LIST (must be before /v2/users/:id) ----------
router.get("/v2/users/students", (_req, res) => {
  void handle(res, async () => {
    const rows = await db
      .select()
      .from(schema.usersTable)
      .where(eq(schema.usersTable.role, "student"))
      .orderBy(desc(schema.usersTable.points))
      .limit(100);
    return rows.map((u) => ({
      id: u.id, name: u.name, username: u.username, avatarUrl: u.avatarUrl, groupName: u.groupName,
      specialization: u.specialization, yearInCollege: u.yearInCollege, points: u.points, uniqueCode: u.uniqueCode,
    }));
  });
});

// Get user profile (any user)
router.get("/v2/users/:id", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const [user] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, id)).limit(1);
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

    // Follower/following counts
    const [{ followerCount }] = await db
      .select({ followerCount: sql<number>`count(*)::int` })
      .from(schema.userFollowsTable)
      .where(eq(schema.userFollowsTable.followingId, id));
    const [{ followingCount }] = await db
      .select({ followingCount: sql<number>`count(*)::int` })
      .from(schema.userFollowsTable)
      .where(eq(schema.userFollowsTable.followerId, id));

    // Total likes received across talents
    const [{ totalTalentLikes }] = await db
      .select({ totalTalentLikes: sql<number>`count(*)::int` })
      .from(schema.talentLikesTable)
      .where(eq(schema.talentLikesTable.userId, user.id));

    // Total likes received across forum posts
    const userPostIds = await db.select({ id: schema.forumPostsTable.id }).from(schema.forumPostsTable).where(eq(schema.forumPostsTable.authorId, id));
    let totalForumLikes = 0;
    if (userPostIds.length > 0) {
      const postIds = userPostIds.map((p) => p.id);
      const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(schema.forumPostLikesTable).where(inArray(schema.forumPostLikesTable.postId, postIds));
      totalForumLikes = c;
    }

    // Forum posts
    const forumPosts = await db.select().from(schema.forumPostsTable).where(eq(schema.forumPostsTable.authorId, id)).orderBy(desc(schema.forumPostsTable.createdAt)).limit(50);

    // Talents
    const talents = await db.select().from(schema.talentsTable).where(and(eq(schema.talentsTable.ownerId, id), eq(schema.talentsTable.status, "active"))).orderBy(desc(schema.talentsTable.createdAt)).limit(50);

    // Material files (student summaries)
    const summaries = await db.select().from(schema.materialFilesTable).where(and(eq(schema.materialFilesTable.uploadedById, id), eq(schema.materialFilesTable.category, "student-summary"))).orderBy(desc(schema.materialFilesTable.createdAt)).limit(50);

    // Check if current user is following this user
    const currentUserId = req.demo.currentUserId;
    let following = false;
    if (currentUserId) {
      const [f] = await db.select().from(schema.userFollowsTable).where(and(eq(schema.userFollowsTable.followerId, currentUserId), eq(schema.userFollowsTable.followingId, id)));
      following = !!f;
    }

    return {
      ...user,
      lastSeen: user.lastSeen?.toISOString(),
      createdAt: user.createdAt?.toISOString(),
      followerCount,
      followingCount,
      totalLikesReceived: totalTalentLikes + totalForumLikes,
      forumPosts: forumPosts.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
      talents: talents.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
      summaries: summaries.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
      following,
    };
  });
});

// ---------- AUTH v3: full signup with password, username, unique code ----------
router.post("/v2/auth/signup", (req, res) => {
  void handle(res, async () => {
    const { name, username, email, phone, password, yearInCollege, specialization, groupName, avatarUrl } = req.body as any;
    if (!name || !username || !email || !phone || !password) throw Object.assign(new Error("كل الحقول مطلوبة"), { status: 400 });
    if (username.length < 4) throw Object.assign(new Error("اليوزر لازم يكون 4 حروف على الأقل"), { status: 400 });
    if (password.length < 6) throw Object.assign(new Error("كلمة المرور لازم تكون 6 حروف على الأقل"), { status: 400 });

    const [usernameTaken] = await db.select({ id: schema.usersTable.id }).from(schema.usersTable).where(eq(schema.usersTable.username, username)).limit(1);
    if (usernameTaken) throw Object.assign(new Error("اليوزر ده مأخوذ، اختار يوزر تاني"), { status: 409 });

    const [emailExists] = await db.select({ id: schema.usersTable.id }).from(schema.usersTable).where(eq(schema.usersTable.email, email)).limit(1);
    if (emailExists) throw Object.assign(new Error("الإيميل ده مسجل قبل كده"), { status: 409 });

    const hashedPassword = await bcrypt.hash(password, 10);
    let uniqueCode = generateUniqueCode();
    let codeExists = true;
    while (codeExists) {
      const [existing] = await db.select({ id: schema.usersTable.id }).from(schema.usersTable).where(eq(schema.usersTable.uniqueCode, uniqueCode)).limit(1);
      if (!existing) codeExists = false;
      else uniqueCode = generateUniqueCode();
    }

    const [created] = await db
      .insert(schema.usersTable)
      .values({
        name,
        username,
        email,
        phone,
        password: hashedPassword,
        role: "student",
        department: specialization || "غير محدد",
        specialization: specialization || null,
        yearInCollege: yearInCollege || null,
        groupName: groupName || null,
        avatarUrl: avatarUrl || null,
        uniqueCode,
        emailVerified: true,
        phoneVerified: true,
      })
      .returning();
    setDemoUser(res, created.id);
    await db.insert(schema.notificationsTable).values({
      userId: created.id,
      title: `أهلاً ${name} في UniVerse`,
      body: `كودك الخاص: ${uniqueCode}. احفظه لأنه مهم. ابدأ رحلتك من الصفحة الرئيسية.`,
      type: "success",
    });
    return { userId: created.id, isNew: true, uniqueCode };
  });
});

// ---------- DEMO QUICK LOGIN (email/phone + password) ----------
router.post("/v2/auth/demo-login", (req, res) => {
  void handle(res, async () => {
    const { email, password } = req.body as { email: string; password?: string };
    const [u] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.email, email)).limit(1);
    if (!u) throw Object.assign(new Error("الحساب غير موجود"), { status: 404 });
    if (password) {
      const valid = await bcrypt.compare(password, u.password);
      if (!valid) throw Object.assign(new Error("كلمة المرور غير صحيحة"), { status: 401 });
    }
    setDemoUser(res, u.id);
    return { userId: u.id, role: u.role };
  });
});

router.post("/v2/follow/:id", (req, res) => {
  void handle(res, async () => {
    const targetId = Number(req.params.id);
    const me = req.demo.currentUserId!;
    if (targetId === me) throw Object.assign(new Error("لا يمكنك متابعة نفسك"), { status: 400 });
    const existing = await db
      .select()
      .from(schema.userFollowsTable)
      .where(and(eq(schema.userFollowsTable.followerId, me), eq(schema.userFollowsTable.followingId, targetId)));
    if (existing.length) {
      await db.delete(schema.userFollowsTable).where(and(eq(schema.userFollowsTable.followerId, me), eq(schema.userFollowsTable.followingId, targetId)));
      return { following: false };
    }
    await db.insert(schema.userFollowsTable).values({ followerId: me, followingId: targetId });
    // notify target
    const [meUser] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, me));
    await db.insert(schema.notificationsTable).values({
      userId: targetId,
      title: "متابعة جديدة",
      body: `${meUser?.name || "أحدهم"} بدأ متابعتك`,
      type: "info",
    });
    return { following: true };
  });
});

router.get("/v2/follows/me", (req, res) => {
  void handle(res, async () => {
    const me = req.demo.currentUserId!;
    const followers = await db.select().from(schema.userFollowsTable).where(eq(schema.userFollowsTable.followingId, me));
    const following = await db.select().from(schema.userFollowsTable).where(eq(schema.userFollowsTable.followerId, me));
    const ids = Array.from(new Set([...followers.map((f) => f.followerId), ...following.map((f) => f.followingId)]));
    const users = ids.length ? await db.select().from(schema.usersTable).where(inArray(schema.usersTable.id, ids)) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const map = (id: number) => {
      const u = byId.get(id);
      return u ? { id: u.id, name: u.name, avatarUrl: u.avatarUrl, groupName: u.groupName, specialization: u.specialization } : null;
    };
    return {
      followers: followers.map((f) => map(f.followerId)).filter(Boolean),
      following: following.map((f) => map(f.followingId)).filter(Boolean),
    };
  });
});

router.get("/v2/follows/:userId/status", (req, res) => {
  void handle(res, async () => {
    const target = Number(req.params.userId);
    const me = req.demo.currentUserId!;
    const r = await db.select().from(schema.userFollowsTable).where(and(eq(schema.userFollowsTable.followerId, me), eq(schema.userFollowsTable.followingId, target)));
    return { following: r.length > 0 };
  });
});

// ---------- DM ----------
async function ensureThread(a: number, b: number): Promise<number> {
  const [low, high] = a < b ? [a, b] : [b, a];
  const [existing] = await db
    .select()
    .from(schema.dmThreadsTable)
    .where(and(eq(schema.dmThreadsTable.userAId, low), eq(schema.dmThreadsTable.userBId, high)))
    .limit(1);
  if (existing) return existing.id;
  const [t] = await db.insert(schema.dmThreadsTable).values({ userAId: low, userBId: high }).returning();
  return t.id;
}

router.get("/v2/dm/threads", (req, res) => {
  void handle(res, async () => {
    const me = req.demo.currentUserId!;
    const threads = await db
      .select()
      .from(schema.dmThreadsTable)
      .where(sql`${schema.dmThreadsTable.userAId} = ${me} OR ${schema.dmThreadsTable.userBId} = ${me}`)
      .orderBy(desc(schema.dmThreadsTable.lastMessageAt));
    if (!threads.length) return [];
    const otherIds = threads.map((t) => (t.userAId === me ? t.userBId : t.userAId));
    const users = await db.select().from(schema.usersTable).where(inArray(schema.usersTable.id, otherIds));
    const byId = new Map(users.map((u) => [u.id, u]));
    const lastMsgs = await db
      .select()
      .from(schema.dmMessagesTable)
      .where(inArray(schema.dmMessagesTable.threadId, threads.map((t) => t.id)));
    return threads.map((t) => {
      const otherId = t.userAId === me ? t.userBId : t.userAId;
      const other = byId.get(otherId);
      const msgs = lastMsgs.filter((m) => m.threadId === t.id).sort((a, b) => +b.createdAt - +a.createdAt);
      const last = msgs[0];
      const unread = msgs.filter((m) => m.fromId !== me && !m.read).length;
      return {
        threadId: t.id,
        other: other ? { id: other.id, name: other.name, avatarUrl: other.avatarUrl, groupName: other.groupName } : null,
        lastMessage: last ? { body: last.body, createdAt: last.createdAt.toISOString(), fromMe: last.fromId === me } : null,
        unread,
        lastMessageAt: t.lastMessageAt.toISOString(),
      };
    });
  });
});

router.get("/v2/dm/with/:userId", (req, res) => {
  void handle(res, async () => {
    const me = req.demo.currentUserId!;
    const other = Number(req.params.userId);
    const threadId = await ensureThread(me, other);
    const msgs = await db.select().from(schema.dmMessagesTable).where(eq(schema.dmMessagesTable.threadId, threadId)).orderBy(schema.dmMessagesTable.createdAt);
    // mark received as read
    await db.update(schema.dmMessagesTable).set({ read: true }).where(and(eq(schema.dmMessagesTable.threadId, threadId), sql`${schema.dmMessagesTable.fromId} <> ${me}`));
    const [otherUser] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, other));
    return {
      threadId,
      other: otherUser ? { id: otherUser.id, name: otherUser.name, avatarUrl: otherUser.avatarUrl, groupName: otherUser.groupName, specialization: otherUser.specialization } : null,
      messages: msgs.map((m) => ({ ...m, createdAt: m.createdAt.toISOString(), fromMe: m.fromId === me })),
    };
  });
});

router.post("/v2/dm/with/:userId", (req, res) => {
  void handle(res, async () => {
    const me = req.demo.currentUserId!;
    const other = Number(req.params.userId);
    const { body } = req.body as { body: string };
    if (!body || !body.trim()) throw Object.assign(new Error("اكتب رسالة"), { status: 400 });
    const threadId = await ensureThread(me, other);
    const [msg] = await db.insert(schema.dmMessagesTable).values({ threadId, fromId: me, body: body.trim() }).returning();
    await db.update(schema.dmThreadsTable).set({ lastMessageAt: new Date() }).where(eq(schema.dmThreadsTable.id, threadId));
    const [meUser] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, me));
    await db.insert(schema.notificationsTable).values({
      userId: other,
      title: `رسالة من ${meUser?.name || "أحدهم"}`,
      body: body.trim().slice(0, 100),
      type: "info",
    });
    return { ...msg, createdAt: msg.createdAt.toISOString() };
  });
});

// ---------- FORUM v2: fetch with replies + author info ----------
router.get("/v2/admin/dm/threads", requireRole(["super_admin"]), (_req, res) => {
  void handle(res, async () => {
    const threads = await db.select().from(schema.dmThreadsTable).orderBy(desc(schema.dmThreadsTable.lastMessageAt));
    if (!threads.length) return [];
    const allUserIds = new Set<number>();
    threads.forEach((t) => { allUserIds.add(t.userAId); allUserIds.add(t.userBId); });
    const users = await db.select().from(schema.usersTable).where(inArray(schema.usersTable.id, Array.from(allUserIds)));
    const byId = new Map(users.map((u) => [u.id, u]));
    const lastMsgs = await db.select().from(schema.dmMessagesTable).where(inArray(schema.dmMessagesTable.threadId, threads.map((t) => t.id)));
    return threads.map((t) => {
      const userA = byId.get(t.userAId);
      const userB = byId.get(t.userBId);
      const msgs = lastMsgs.filter((m) => m.threadId === t.id).sort((a, b) => +b.createdAt - +a.createdAt);
      const last = msgs[0];
      return {
        threadId: t.id,
        userA: userA ? { id: userA.id, name: userA.name, avatarUrl: userA.avatarUrl, role: userA.role } : null,
        userB: userB ? { id: userB.id, name: userB.name, avatarUrl: userB.avatarUrl, role: userB.role } : null,
        lastMessage: last ? { body: last.body, createdAt: last.createdAt.toISOString(), fromId: last.fromId } : null,
        totalMessages: msgs.length,
        lastMessageAt: t.lastMessageAt.toISOString(),
      };
    });
  });
});

router.get("/v2/admin/dm/threads/:threadId", requireRole(["super_admin"]), (req, res) => {
  void handle(res, async () => {
    const threadId = Number(req.params.threadId);
    const [thread] = await db.select().from(schema.dmThreadsTable).where(eq(schema.dmThreadsTable.id, threadId));
    if (!thread) throw Object.assign(new Error("المحادثة غير موجودة"), { status: 404 });
    const msgs = await db.select().from(schema.dmMessagesTable).where(eq(schema.dmMessagesTable.threadId, threadId)).orderBy(schema.dmMessagesTable.createdAt);
    const allUserIds = new Set<number>([thread.userAId, thread.userBId, ...msgs.map((m) => m.fromId)]);
    const users = await db.select().from(schema.usersTable).where(inArray(schema.usersTable.id, Array.from(allUserIds)));
    const byId = new Map(users.map((u) => [u.id, u]));
    const userA = byId.get(thread.userAId);
    const userB = byId.get(thread.userBId);
    return {
      threadId: thread.id,
      userA: userA ? { id: userA.id, name: userA.name, avatarUrl: userA.avatarUrl, role: userA.role } : null,
      userB: userB ? { id: userB.id, name: userB.name, avatarUrl: userB.avatarUrl, role: userB.role } : null,
      messages: msgs.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        fromName: byId.get(m.fromId)?.name || "مستخدم محذوف",
        fromAvatar: byId.get(m.fromId)?.avatarUrl,
      })),
    };
  });
});
router.get("/v2/forum/posts", (_req, res) => {
  void handle(res, async () => {
    const posts = await db.select().from(schema.forumPostsTable).orderBy(desc(schema.forumPostsTable.createdAt));
    const authorIds = Array.from(new Set(posts.map((p) => p.authorId)));
    const users = authorIds.length ? await db.select().from(schema.usersTable).where(inArray(schema.usersTable.id, authorIds)) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const replyCounts = posts.length
      ? await db
          .select({ postId: schema.forumRepliesTable.postId, c: sql<number>`count(*)::int` })
          .from(schema.forumRepliesTable)
          .where(inArray(schema.forumRepliesTable.postId, posts.map((p) => p.id)))
          .groupBy(schema.forumRepliesTable.postId)
      : [];
    const countMap = new Map(replyCounts.map((r) => [r.postId, r.c]));
    return posts.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      authorName: byId.get(p.authorId)?.name,
      authorAvatar: byId.get(p.authorId)?.avatarUrl,
      authorGroup: byId.get(p.authorId)?.groupName,
      repliesCount: countMap.get(p.id) ?? 0,
    }));
  });
});

router.get("/v2/forum/posts/:id/replies", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const replies = await db.select().from(schema.forumRepliesTable).where(eq(schema.forumRepliesTable.postId, id)).orderBy(schema.forumRepliesTable.createdAt);
    const ids = Array.from(new Set(replies.map((r) => r.authorId)));
    const users = ids.length ? await db.select().from(schema.usersTable).where(inArray(schema.usersTable.id, ids)) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return replies.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      authorName: byId.get(r.authorId)?.name,
      authorAvatar: byId.get(r.authorId)?.avatarUrl,
      authorRole: byId.get(r.authorId)?.role,
    }));
  });
});

// ---------- SKILLS v2: list with lessons + complete ----------
router.get("/v2/skills/tracks", (_req, res) => {
  void handle(res, async () => {
    const tracks = await db.select().from(schema.skillTracksTable);
    if (!tracks.length) return [];
    const lessons = await db.select().from(schema.skillLessonsTable).where(inArray(schema.skillLessonsTable.trackId, tracks.map((t) => t.id))).orderBy(schema.skillLessonsTable.ord);
    return tracks.map((t) => ({
      ...t,
      lessons: lessons.filter((l) => l.trackId === t.id),
    }));
  });
});

router.post("/v2/skills/lessons/:id/complete", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    await db.update(schema.skillLessonsTable).set({ completed: true }).where(eq(schema.skillLessonsTable.id, id));
    // recompute track progress
    const [lesson] = await db.select().from(schema.skillLessonsTable).where(eq(schema.skillLessonsTable.id, id));
    if (lesson) {
      const all = await db.select().from(schema.skillLessonsTable).where(eq(schema.skillLessonsTable.trackId, lesson.trackId));
      const done = all.filter((l) => l.completed).length;
      const progress = all.length ? done / all.length : 0;
      await db.update(schema.skillTracksTable).set({ progress }).where(eq(schema.skillTracksTable.id, lesson.trackId));
      // award points (stricter: only 5 pts per lesson)
      await db.update(schema.usersTable).set({ points: sql`${schema.usersTable.points} + 5` }).where(eq(schema.usersTable.id, req.demo.currentUserId!));
    }
    return { ok: true };
  });
});

// ---------- QUIZZES v2: open quizzes only, randomized, attempt tracking ----------
router.get("/v2/quizzes/open", (req, res) => {
  void handle(res, async () => {
    const me = await getCurrentUser(req);
    const all = await db.select().from(schema.quizzesTable).where(eq(schema.quizzesTable.isOpen, true)).orderBy(desc(schema.quizzesTable.createdAt));
    // filter by group/year if applicable
    const filtered = me
      ? all.filter((q) => (!q.groupOnly || q.groupOnly === me.groupName) && (!q.yearOnly || q.yearOnly === me.yearInCollege))
      : all;
    // get attempt counts per quiz for current user
    const attempts = me
      ? await db.select().from(schema.quizAttemptsTable).where(eq(schema.quizAttemptsTable.userId, me.id))
      : [];
    return filtered.map((q) => {
      const myAttempts = attempts.filter((a) => a.quizId === q.id);
      const best = myAttempts.reduce((m, a) => Math.max(m, a.score), 0);
      return { ...q, createdAt: q.createdAt.toISOString(), myAttemptsCount: myAttempts.length, myBestScore: best };
    });
  });
});

router.get("/v2/quizzes/:id/start", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const [q] = await db.select().from(schema.quizzesTable).where(eq(schema.quizzesTable.id, id));
    if (!q) throw Object.assign(new Error("الاختبار غير موجود"), { status: 404 });
    if (!q.isOpen) throw Object.assign(new Error("هذا الاختبار مغلق حالياً"), { status: 403 });
    const questions = await db.select().from(schema.quizQuestionsTable).where(eq(schema.quizQuestionsTable.quizId, id));
    // randomize question order + option order, never repeat exactly the same set
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    const out = shuffled.map((qq) => {
      const opts = qq.options.map((o, i) => ({ text: o, originalIndex: i }));
      const shuffledOpts = [...opts].sort(() => Math.random() - 0.5);
      return {
        id: qq.id,
        text: qq.text,
        type: qq.type,
        options: qq.type === "complete" ? qq.options : shuffledOpts.map((o) => o.text),
        optionMap: qq.type === "complete" ? [0] : shuffledOpts.map((o) => o.originalIndex), // server uses to verify
        points: qq.points,
      };
    });
    return { quiz: { ...q, createdAt: q.createdAt.toISOString() }, questions: out };
  });
});

router.post("/v2/quizzes/:id/submit", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const { answers, durationSec } = req.body as { answers: { questionId: number; chosenOriginalIndex: number }[]; durationSec: number };
    const [q] = await db.select().from(schema.quizzesTable).where(eq(schema.quizzesTable.id, id));
    if (!q) throw Object.assign(new Error("الاختبار غير موجود"), { status: 404 });
    if (!q.isOpen) throw Object.assign(new Error("هذا الاختبار مغلق حالياً"), { status: 403 });
    const questions = await db.select().from(schema.quizQuestionsTable).where(eq(schema.quizQuestionsTable.quizId, id));
    let score = 0;
    let total = 0;
    const ans: { questionId: number; chosen: number; correct: boolean }[] = [];
    for (const a of answers) {
      const qq = questions.find((x) => x.id === a.questionId);
      if (!qq) continue;
      total += qq.points;
      let correct: boolean;
      if (qq.type === "complete") {
        const userText = (a as any).textAnswer || "";
        const expectedAnswer = qq.options[qq.correctIndex] || "";
        correct = userText.trim().toLowerCase() === expectedAnswer.trim().toLowerCase();
      } else {
        correct = qq.correctIndex === a.chosenOriginalIndex;
      }
      if (correct) score += qq.points;
      ans.push({
        questionId: qq.id,
        chosen: a.chosenOriginalIndex,
        correct,
        ...(qq.type === "complete" ? { textAnswer: (a as any).textAnswer || "" } : {}),
      });
    }
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const passed = pct >= (q.passPercent || 50);
    const [attempt] = await db
      .insert(schema.quizAttemptsTable)
      .values({ quizId: id, userId: req.demo.currentUserId!, score, total, durationSec: durationSec || 0, answers: ans, passed })
      .returning();
    // award points: 1 pt per correct mark, bonus if passed
    const pointsAwarded = Math.floor(score / 5) + (passed ? 10 : 0);
    await db.update(schema.usersTable).set({ points: sql`${schema.usersTable.points} + ${pointsAwarded}` }).where(eq(schema.usersTable.id, req.demo.currentUserId!));
    // return full question details for result review
    const questionDetails = questions.map((qq) => {
      const userAns = ans.find((a) => a.questionId === qq.id);
      return {
        questionId: qq.id,
        text: qq.text,
        type: qq.type,
        options: qq.options,
        correctIndex: qq.correctIndex,
        explanation: qq.explanation,
        points: qq.points,
        userChosen: userAns?.chosen ?? -1,
        textAnswer: (userAns as any)?.textAnswer,
        correct: userAns?.correct ?? false,
      };
    });
    return { ...attempt, completedAt: attempt.completedAt.toISOString(), passed, pointsAwarded, questionDetails };
  });
});

router.get("/v2/admin/quizzes/:id/attempts", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const attempts = await db.select().from(schema.quizAttemptsTable).where(eq(schema.quizAttemptsTable.quizId, id)).orderBy(desc(schema.quizAttemptsTable.completedAt));
    const ids = Array.from(new Set(attempts.map((a) => a.userId)));
    const users = ids.length ? await db.select().from(schema.usersTable).where(inArray(schema.usersTable.id, ids)) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return attempts.map((a) => ({
      ...a,
      completedAt: a.completedAt.toISOString(),
      userName: byId.get(a.userId)?.name,
      userAvatar: byId.get(a.userId)?.avatarUrl,
      userGroup: byId.get(a.userId)?.groupName,
    }));
  });
});

router.get("/v2/admin/quizzes/:quizId/attempts/:attemptId", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const attemptId = Number(req.params.attemptId);
    return getAttemptDetail(attemptId);
  });
});

router.get("/v2/admin/quiz-attempts/:attemptId", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const attemptId = Number(req.params.attemptId);
    return getAttemptDetail(attemptId);
  });
});

async function getAttemptDetail(attemptId: number) {
  const [attempt] = await db.select().from(schema.quizAttemptsTable).where(eq(schema.quizAttemptsTable.id, attemptId));
  if (!attempt) throw Object.assign(new Error("المحاولة غير موجودة"), { status: 404 });
  const [user] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, attempt.userId));
  const questions = await db.select().from(schema.quizQuestionsTable).where(eq(schema.quizQuestionsTable.quizId, attempt.quizId));
  const details = questions.map((qq) => {
    const userAns = (attempt.answers as any[]).find((a: any) => a.questionId === qq.id);
    return {
      questionId: qq.id,
      text: qq.text,
      type: qq.type,
      options: qq.options,
      correctIndex: qq.correctIndex,
      explanation: qq.explanation,
      points: qq.points,
      userChosen: userAns?.chosen ?? -1,
      textAnswer: (userAns as any)?.textAnswer,
      correct: userAns?.correct ?? false,
    };
  });
  return {
    attemptId: attempt.id,
    userName: user?.name,
    userAvatar: user?.avatarUrl,
    userGroup: user?.groupName,
    score: attempt.score,
    total: attempt.total,
    durationSec: attempt.durationSec,
    passed: attempt.passed,
    completedAt: attempt.completedAt.toISOString(),
    questions: details,
  };
}

// ---------- ADMIN: full lists for management UI ----------
router.get("/v2/admin/all-quizzes", requireRole(["admin", "super_admin"]), (_req, res) => {
  void handle(res, async () => {
    const all = await db.select().from(schema.quizzesTable).orderBy(desc(schema.quizzesTable.createdAt));
    const counts = await db.execute(sql`SELECT quiz_id, COUNT(*)::int AS c FROM quiz_attempts GROUP BY quiz_id` as any) as any;
    const map = new Map<number, number>(((counts.rows ?? counts) as any[]).map((r: any) => [Number(r.quiz_id), Number(r.c)]));
    return all.map((q) => ({ ...q, createdAt: q.createdAt.toISOString(), attemptsCount: map.get(q.id) ?? 0 }));
  });
});

// ---------- ADMIN: CRUD for standalone quizzes ----------
router.post("/v2/admin/quizzes", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const { title, description, courseId, courseTitle, durationMinutes, totalPoints, difficulty, groupOnly, yearOnly, randomize, passPercent } = req.body as any;
    if (!title || !courseId) throw Object.assign(new Error("العنوان والمادة مطلوبان"), { status: 400 });
    const [q] = await db.insert(schema.quizzesTable).values({
      title,
      description: description || "",
      courseId,
      courseTitle: courseTitle || "",
      durationMinutes: durationMinutes ?? 15,
      totalPoints: totalPoints ?? 100,
      difficulty: difficulty || "medium",
      groupOnly: groupOnly || null,
      yearOnly: yearOnly || null,
      randomize: randomize ?? true,
      passPercent: passPercent ?? 50,
    }).returning();
    return { ...q, createdAt: q.createdAt.toISOString() };
  });
});

router.put("/v2/admin/quizzes/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const { title, description, durationMinutes, totalPoints, difficulty, groupOnly, yearOnly, randomize, passPercent } = req.body as any;
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (durationMinutes !== undefined) updateData.durationMinutes = durationMinutes;
    if (totalPoints !== undefined) updateData.totalPoints = totalPoints;
    if (difficulty !== undefined) updateData.difficulty = difficulty;
    if (groupOnly !== undefined) updateData.groupOnly = groupOnly;
    if (yearOnly !== undefined) updateData.yearOnly = yearOnly;
    if (randomize !== undefined) updateData.randomize = randomize;
    if (passPercent !== undefined) updateData.passPercent = passPercent;
    await db.update(schema.quizzesTable).set(updateData).where(eq(schema.quizzesTable.id, id));
    return { ok: true };
  });
});

router.delete("/v2/admin/quizzes/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    await db.delete(schema.quizzesTable).where(eq(schema.quizzesTable.id, id));
    return { ok: true };
  });
});

// ---------- ADMIN: CRUD for quiz questions ----------
router.get("/v2/admin/quizzes/:id/questions", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    return await db.select().from(schema.quizQuestionsTable).where(eq(schema.quizQuestionsTable.quizId, id)).orderBy(schema.quizQuestionsTable.ord);
  });
});

router.post("/v2/admin/quizzes/:quizId/questions", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const quizId = Number(req.params.quizId);
    const { text, type, options, correctIndex, points, explanation } = req.body as any;
    if (!text || !options || typeof correctIndex !== "number") throw Object.assign(new Error("بيانات السؤال ناقصة"), { status: 400 });
    const maxOrd = await db.select({ max: schema.quizQuestionsTable.ord }).from(schema.quizQuestionsTable).where(eq(schema.quizQuestionsTable.quizId, quizId));
    const [qq] = await db.insert(schema.quizQuestionsTable).values({
      quizId,
      text,
      type: type || "mc",
      options,
      correctIndex,
      points: points ?? 10,
      explanation: explanation || "",
      ord: (maxOrd[0]?.max ?? 0) + 1,
    }).returning();
    return qq;
  });
});

router.post("/v2/admin/quizzes/:quizId/questions/bulk", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const quizId = Number(req.params.quizId);
    const { questions } = req.body as any;
    if (!Array.isArray(questions) || !questions.length) {
      throw Object.assign(new Error("لم يتم إرسال أي أسئلة"), { status: 400 });
    }
    const created: any[] = [];
    for (const q of questions) {
      const { text, type, options, correctIndex, points, explanation } = q;
      if (!text || !options || typeof correctIndex !== "number") {
        throw Object.assign(new Error(`بيانات السؤال ناقصة: "${(text || "").slice(0, 50)}"`), { status: 400 });
      }
      const maxOrd = await db.select({ max: schema.quizQuestionsTable.ord }).from(schema.quizQuestionsTable).where(eq(schema.quizQuestionsTable.quizId, quizId));
      const [qq] = await db.insert(schema.quizQuestionsTable).values({
        quizId,
        text,
        type: type || "mc",
        options,
        correctIndex,
        points: points ?? 10,
        explanation: explanation || "",
        ord: (maxOrd[0]?.max ?? 0) + 1,
      }).returning();
      created.push(qq);
    }
    return { created: created.length };
  });
});

router.put("/v2/admin/quiz-questions/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const { text, type, options, correctIndex, points, explanation } = req.body as any;
    const updateData: any = {};
    if (text !== undefined) updateData.text = text;
    if (type !== undefined) updateData.type = type;
    if (options !== undefined) updateData.options = options;
    if (typeof correctIndex === "number") updateData.correctIndex = correctIndex;
    if (points !== undefined) updateData.points = points;
    if (explanation !== undefined) updateData.explanation = explanation;
    await db.update(schema.quizQuestionsTable).set(updateData).where(eq(schema.quizQuestionsTable.id, id));
    return { ok: true };
  });
});

router.delete("/v2/admin/quiz-questions/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    await db.delete(schema.quizQuestionsTable).where(eq(schema.quizQuestionsTable.id, id));
    return { ok: true };
  });
});

router.delete("/v2/admin/quizzes/:quizId/questions", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const quizId = Number(req.params.quizId);
    await db.delete(schema.quizQuestionsTable).where(eq(schema.quizQuestionsTable.quizId, quizId));
    return { ok: true };
  });
});

router.get("/v2/admin/all-courses", requireRole(["admin", "super_admin"]), (_req, res) => {
  void handle(res, async () => {
    return await db.select().from(schema.coursesTable).orderBy(schema.coursesTable.code);
  });
});

router.get("/v2/admin/all-materials", requireRole(["admin", "super_admin"]), (_req, res) => {
  void handle(res, async () => {
    return await db.select().from(schema.materialsTable).orderBy(schema.materialsTable.courseId);
  });
});

router.post("/v2/admin/materials", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_materials");
  void handle(res, async () => {
    const { courseId, title, kind, url, lecturer, durationMinutes, ord } = req.body as any;
    if (!courseId || !title || !kind) throw Object.assign(new Error("المقرر والعنوان والنوع مطلوبة"), { status: 400 });
    const [f] = await db.insert(schema.materialsTable).values({
      courseId, title, kind, url: url || "", lecturer: lecturer || null,
      durationMinutes: durationMinutes || null, ord: ord || 0,
    }).returning();
    return f;
  });
});

router.patch("/v2/admin/materials/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_materials");
  void handle(res, async () => {
    const id = Number(req.params.id);
    const { title, kind, lecturer, durationMinutes, ord } = req.body as any;
    const [existing] = await db.select().from(schema.materialsTable).where(eq(schema.materialsTable.id, id));
    if (!existing) throw Object.assign(new Error("المادة غير موجودة"), { status: 404 });
    const [updated] = await db.update(schema.materialsTable).set({
      title: title ?? existing.title,
      kind: kind ?? existing.kind,
      lecturer: lecturer !== undefined ? lecturer : existing.lecturer,
      durationMinutes: durationMinutes !== undefined ? durationMinutes : existing.durationMinutes,
      ord: ord !== undefined ? ord : existing.ord,
    }).where(eq(schema.materialsTable.id, id)).returning();
    return updated;
  });
});

router.delete("/v2/admin/materials/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_materials");
  void handle(res, async () => {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(schema.materialsTable).where(eq(schema.materialsTable.id, id));
    if (!existing) throw Object.assign(new Error("المادة غير موجودة"), { status: 404 });
    await db.delete(schema.materialsTable).where(eq(schema.materialsTable.id, id));
    return { ok: true };
  });
});

// ---------- MATERIAL FILES (file uploads as data URLs) ----------
router.get("/v2/materials/:id/files", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    return await db.select().from(schema.materialFilesTable).where(and(eq(schema.materialFilesTable.materialId, id), sql`COALESCE(category, 'official') != 'student-summary'`)).orderBy(desc(schema.materialFilesTable.createdAt));
  });
});

router.get("/v2/courses/:id/all-files", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    return await db.select().from(schema.materialFilesTable).where(and(eq(schema.materialFilesTable.courseId, id), sql`COALESCE(category, 'official') != 'student-summary'`)).orderBy(desc(schema.materialFilesTable.createdAt));
  });
});

router.post("/v2/admin/materials/:id/files", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_materials");
  void handle(res, async () => {
    const id = Number(req.params.id);
    const user = (req as any).currentUser as typeof schema.usersTable.$inferSelect;
    const { name, kind, url, sizeBytes } = req.body as any;
    if (!name || !url) throw Object.assign(new Error("name و url مطلوبان"), { status: 400 });
    const [mat] = await db.select().from(schema.materialsTable).where(eq(schema.materialsTable.id, id));
    if (!mat) throw Object.assign(new Error("المادة غير موجودة"), { status: 404 });
    const [f] = await db.insert(schema.materialFilesTable).values({
      materialId: id,
      courseId: mat.courseId,
      name,
      kind: kind || "pdf",
      url,
      sizeBytes: sizeBytes || 0,
      uploadedById: user.id,
      uploadedByName: user.name,
    }).returning();
    return f;
  });
});

router.delete("/v2/admin/material-files/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_materials");
  void handle(res, async () => {
    const id = Number(req.params.id);
    await db.delete(schema.materialFilesTable).where(eq(schema.materialFilesTable.id, id));
    return { ok: true };
  });
});

// ---------- GROUP SCHEDULE (admin manages by group + year) ----------
const AR_DAY_TO_NUM: Record<string, number> = {
  "الأحد": 0, "الاثنين": 1, "الإثنين": 1, "الثلاثاء": 2, "الأربعاء": 3, "الخميس": 4, "الجمعة": 5, "السبت": 6,
  "sun": 0, "mon": 1, "tue": 2, "wed": 3, "thu": 4, "fri": 5, "sat": 6,
};
router.get("/v2/group-schedule", (req, res) => {
  void handle(res, async () => {
    const me = await getCurrentUser(req);
    const group = (req.query.group as string) || me?.groupName;
    const year = Number(req.query.year || me?.yearInCollege || 0);
    if (!group || !year) return [];
    const rows = await db
      .select()
      .from(schema.groupScheduleTable)
      .where(and(eq(schema.groupScheduleTable.groupName, group), eq(schema.groupScheduleTable.yearInCollege, year)));
    return rows.map((r) => ({ ...r, dayNumber: AR_DAY_TO_NUM[r.day] ?? 0 }));
  });
});

router.get("/v2/admin/group-schedule", requireRole(["admin", "super_admin"]), (_req, res) => {
  void handle(res, async () => {
    return await db.select().from(schema.groupScheduleTable).orderBy(schema.groupScheduleTable.yearInCollege, schema.groupScheduleTable.groupName, schema.groupScheduleTable.day);
  });
});

router.post("/v2/admin/group-schedule", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const { groupName, yearInCollege, day, startTime, endTime, courseTitle, courseCode, instructor, room, type } = req.body as any;
    if (!groupName || !yearInCollege || !day || !startTime || !endTime || !courseTitle || !instructor || !room) {
      throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
    }
    const [r] = await db.insert(schema.groupScheduleTable).values({
      groupName, yearInCollege, day, startTime, endTime, courseTitle, courseCode, instructor, room, type: type || "lecture",
    }).returning();
    return r;
  });
});

router.delete("/v2/admin/group-schedule/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    await db.delete(schema.groupScheduleTable).where(eq(schema.groupScheduleTable.id, id));
    return { ok: true };
  });
});

// ---------- STUDY ACTIVITY LOGGING ----------
router.post("/v2/activity/log", (req, res) => {
  void handle(res, async () => {
    const userId = req.demo.currentUserId;
    if (!userId) throw Object.assign(new Error("غير مسجل"), { status: 401 });
    const { minutes } = req.body as { minutes: number };
    if (!minutes || minutes <= 0) throw Object.assign(new Error("Invalid minutes"), { status: 400 });
    const today = new Date().toISOString().split("T")[0];
    const [existing] = await db.select().from(schema.activityTable).where(and(eq(schema.activityTable.userId, userId), eq(schema.activityTable.date, today))).limit(1);
    const earnedPoints = Math.floor(minutes / 10);
    if (existing) {
      const prevMinutes = existing.minutesStudied;
      const [updated] = await db
        .update(schema.activityTable)
        .set({ minutesStudied: sql`${schema.activityTable.minutesStudied} + ${minutes}`, pointsEarned: sql`${schema.activityTable.pointsEarned} + ${earnedPoints}` })
        .where(eq(schema.activityTable.id, existing.id))
        .returning();
      await db.update(schema.usersTable).set({ points: sql`${schema.usersTable.points} + ${earnedPoints}` }).where(eq(schema.usersTable.id, userId));
      // Milestone notifications
      if (updated.minutesStudied >= 60 && prevMinutes < 60) {
        await db.insert(schema.notificationsTable).values({
          userId, title: "⏰ ساعة مذاكرة!", body: "وصلت لساعة مذاكرة اليوم. استمر!", type: "success",
        });
      }
      if (updated.minutesStudied >= 120 && prevMinutes < 120) {
        await db.insert(schema.notificationsTable).values({
          userId, title: "🔥 ساعتين مذاكرة!", body: "يوم مميز! واصل التقدم.", type: "success",
        });
      }
      return updated;
    }
    const [row] = await db.insert(schema.activityTable).values({
      userId, date: today, minutesStudied: minutes, pointsEarned: earnedPoints,
    }).returning();
    await db.update(schema.usersTable).set({ points: sql`${schema.usersTable.points} + ${earnedPoints}` }).where(eq(schema.usersTable.id, userId));
    if (minutes >= 30) {
      await db.insert(schema.notificationsTable).values({
        userId, title: "📚 مذاكرة مسجلة", body: `تم تسجيل ${minutes} دقيقة مذاكرة. حصلت على ${earnedPoints} نقطة.`, type: "info",
      });
    }
    return row;
  });
});

// ---------- EXAM SCHEDULE (admin manages, students view) ----------
router.get("/v2/exam-schedule", (req, res) => {
  void handle(res, async () => {
    const me = await getCurrentUser(req);
    const group = (req.query.group as string) || me?.groupName;
    const year = Number(req.query.year || me?.yearInCollege || 0);
    if (!group || !year) return [];
    return await db
      .select()
      .from(schema.examScheduleTable)
      .where(and(eq(schema.examScheduleTable.groupName, group), eq(schema.examScheduleTable.yearInCollege, year)))
      .orderBy(schema.examScheduleTable.date, schema.examScheduleTable.time);
  });
});

router.get("/v2/admin/exam-schedule", requireRole(["admin", "super_admin"]), (_req, res) => {
  void handle(res, async () => {
    return await db.select().from(schema.examScheduleTable).orderBy(schema.examScheduleTable.yearInCollege, schema.examScheduleTable.groupName, schema.examScheduleTable.date);
  });
});

router.post("/v2/admin/exam-schedule", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const { groupName, yearInCollege, day, date, time, courseTitle, courseCode, room, type } = req.body as any;
    if (!groupName || !yearInCollege || !day || !date || !time || !courseTitle || !room) {
      throw Object.assign(new Error("بيانات ناقصة"), { status: 400 });
    }
    const [r] = await db.insert(schema.examScheduleTable).values({
      groupName, yearInCollege, day, date, time, courseTitle, courseCode, room, type: type || "midterm",
    }).returning();
    return r;
  });
});

router.delete("/v2/admin/exam-schedule/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    await db.delete(schema.examScheduleTable).where(eq(schema.examScheduleTable.id, id));
    return { ok: true };
  });
});

// ---------- ADMIN PERMISSIONS ----------
const ADMIN_PERMISSION_DEFS = [
  { key: "manage_courses", ar: "إدارة المقررات", en: "Manage Courses" },
  { key: "manage_materials", ar: "ملفات المواد", en: "Manage Materials" },
  { key: "manage_quizzes", ar: "إدارة الاختبارات", en: "Manage Quizzes" },
  { key: "manage_exams", ar: "إدارة الامتحانات", en: "Manage Exams" },
  { key: "manage_schedule", ar: "جداول المجموعات", en: "Manage Schedule" },
  { key: "manage_events", ar: "إدارة الأحداث", en: "Manage Events" },
  { key: "manage_news", ar: "إدارة الأخبار", en: "Manage News" },
  { key: "manage_talents", ar: "مراجعة المواهب", en: "Manage Talents" },
  { key: "manage_forum", ar: "إدارة المنتدى", en: "Manage Forum" },
  { key: "manage_users", ar: "الطلاب", en: "Manage Users" },
  { key: "manage_staff", ar: "هيئة التدريس", en: "Manage Staff" },
  { key: "manage_complaints", ar: "إدارة الشكاوى", en: "Manage Complaints" },
  { key: "manage_notifications", ar: "الإشعارات", en: "Manage Notifications" },
  { key: "manage_dm", ar: "مراقبة المحادثات", en: "Monitor DMs" },
  { key: "manage_proposals", ar: "الاقتراحات", en: "Manage Proposals" },
];

function getAdminPermissions(user: typeof schema.usersTable.$inferSelect): string[] {
  if (user.role === "super_admin") return ADMIN_PERMISSION_DEFS.map((p) => p.key);
  if (user.role === "admin" && user.adminPermissions) {
    try { return JSON.parse(user.adminPermissions); } catch { return []; }
  }
  return [];
}

// Check if user has a specific admin permission (super_admin has all)
function ensurePermission(req: Request, permission: string) {
  const user = (req as any).currentUser as typeof schema.usersTable.$inferSelect;
  if (!user) throw Object.assign(new Error("غير مصرح"), { status: 403 });
  if (user.role === "super_admin") return;
  const perms = user.adminPermissions ? (JSON.parse(user.adminPermissions) as string[]) : [];
  if (!perms.includes(permission)) throw Object.assign(new Error("ليس لديك صلاحية لهذا الإجراء"), { status: 403 });
}

// GET /v2/admin/permissions — list all available permissions
router.get("/v2/admin/permissions", requireRole(["admin", "super_admin"]), (_req, res) => {
  void handle(res, async () => ADMIN_PERMISSION_DEFS);
});

// GET /v2/admin/admins — list all admins (super_admin only)
router.get("/v2/admin/admins", requireRole(["super_admin"]), (_req, res) => {
  void handle(res, async () => {
    const admins = await db
      .select()
      .from(schema.usersTable)
      .where(inArray(schema.usersTable.role, ["admin", "super_admin"]))
      .orderBy(schema.usersTable.role);
    return admins.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      permissions: getAdminPermissions(u),
      adminPermissions: u.adminPermissions,
      avatarUrl: u.avatarUrl,
    }));
  });
});

// POST /v2/admin/admins — promote a student to admin (super_admin only)
router.post("/v2/admin/admins", requireRole(["super_admin"]), (req, res) => {
  void handle(res, async () => {
    const { userId, permissions } = req.body as { userId: number; permissions: string[] };
    if (!userId) throw Object.assign(new Error("معرف المستخدم مطلوب"), { status: 400 });
    const [user] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, userId)).limit(1);
    if (!user) throw Object.assign(new Error("المستخدم غير موجود"), { status: 404 });
    if (user.role !== "student") throw Object.assign(new Error("يمكن ترقية الطلاب فقط"), { status: 400 });

    const validKeys = ADMIN_PERMISSION_DEFS.map((p) => p.key);
    const filteredPerms = (permissions || []).filter((p: string) => validKeys.includes(p));

    await db
      .update(schema.usersTable)
      .set({ role: "admin", adminPermissions: JSON.stringify(filteredPerms) })
      .where(eq(schema.usersTable.id, userId));

    return { ok: true, role: "admin", permissions: filteredPerms };
  });
});

// PATCH /v2/admin/admins/:id — update admin permissions (super_admin only)
router.patch("/v2/admin/admins/:id", requireRole(["super_admin"]), (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const { permissions } = req.body as { permissions: string[] };
    const [user] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, id)).limit(1);
    if (!user) throw Object.assign(new Error("المستخدم غير موجود"), { status: 404 });
    if (user.role !== "admin") throw Object.assign(new Error("المستخدم ليس أدمن"), { status: 400 });

    const validKeys = ADMIN_PERMISSION_DEFS.map((p) => p.key);
    const filteredPerms = (permissions || []).filter((p: string) => validKeys.includes(p));

    await db
      .update(schema.usersTable)
      .set({ adminPermissions: JSON.stringify(filteredPerms) })
      .where(eq(schema.usersTable.id, id));

    return { ok: true, permissions: filteredPerms };
  });
});

// DELETE /v2/admin/admins/:id — demote admin back to student (super_admin only)
router.delete("/v2/admin/admins/:id", requireRole(["super_admin"]), (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const [user] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, id)).limit(1);
    if (!user) throw Object.assign(new Error("المستخدم غير موجود"), { status: 404 });
    if (user.role !== "admin") throw Object.assign(new Error("المستخدم ليس أدمن"), { status: 400 });

    await db
      .update(schema.usersTable)
      .set({ role: "student", adminPermissions: null })
      .where(eq(schema.usersTable.id, id));

    return { ok: true, role: "student" };
  });
});

// ---------- ADMIN: direct CRUD (super_admin only — admin must use proposals) ----------
function ensureSuper(req: Request) {
  const u = (req as any).currentUser as typeof schema.usersTable.$inferSelect;
  if (u.role !== "super_admin") throw Object.assign(new Error("السوبر أدمن فقط"), { status: 403 });
}

router.post("/v2/admin/quizzes/toggle/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    ensureSuper(req);
    const id = Number(req.params.id);
    const [q] = await db.select().from(schema.quizzesTable).where(eq(schema.quizzesTable.id, id));
    if (!q) throw Object.assign(new Error("الاختبار غير موجود"), { status: 404 });
    await db.update(schema.quizzesTable).set({ isOpen: !q.isOpen }).where(eq(schema.quizzesTable.id, id));
    return { ok: true, isOpen: !q.isOpen };
  });
});

router.delete("/v2/admin/staff/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  void handle(res, async () => {
    ensureSuper(req);
    const id = Number(req.params.id);
    const [u] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, id));
    if (!u) throw Object.assign(new Error("غير موجود"), { status: 404 });
    if (u.role === "super_admin") throw Object.assign(new Error("لا يمكن حذف سوبر أدمن"), { status: 400 });
    await db.delete(schema.usersTable).where(eq(schema.usersTable.id, id));
    return { ok: true };
  });
});

// ---------- ACHIEVEMENTS (stricter) ----------
router.get("/v2/achievements", (req, res) => {
  void handle(res, async () => {
    const me = await getCurrentUser(req);
    if (!me) return [];
    const attempts = await db.select().from(schema.quizAttemptsTable).where(eq(schema.quizAttemptsTable.userId, me.id));
    const passes = attempts.filter((a) => a.total > 0 && a.score / a.total >= 0.8).length;
    const games = await db.select().from(schema.gameScoresTable).where(eq(schema.gameScoresTable.userId, me.id));
    const totalGames = games.length;
    const followers = await db.select().from(schema.userFollowsTable).where(eq(schema.userFollowsTable.followingId, me.id));
    const lessons = await db.select().from(schema.skillLessonsTable).where(eq(schema.skillLessonsTable.completed, true));
    const completedLessons = lessons.length;
    const list = [
      { id: "quiz-passer-5", title: "ناجح متمكن", desc: "اجتز 5 اختبارات بنسبة 80%+", target: 5, value: passes, icon: "🎯" },
      { id: "quiz-passer-25", title: "خبير الاختبارات", desc: "اجتز 25 اختباراً بنسبة 80%+", target: 25, value: passes, icon: "🏆" },
      { id: "game-master-10", title: "لاعب متفان", desc: "العب 10 ألعاب", target: 10, value: totalGames, icon: "🎮" },
      { id: "skill-builder-15", title: "صانع المهارات", desc: "أنجز 15 درس مهارة", target: 15, value: completedLessons, icon: "📚" },
      { id: "follower-10", title: "مؤثر صاعد", desc: "احصل على 10 متابعين", target: 10, value: followers.length, icon: "⭐" },
      { id: "points-500", title: "جامع النقاط", desc: "اجمع 500 نقطة", target: 500, value: me.points, icon: "💎" },
      { id: "level-5", title: "مستوى متقدم", desc: "وصول للمستوى 5", target: 5, value: me.level, icon: "🚀" },
    ];
    return list.map((a) => ({ ...a, completed: a.value >= a.target, percent: Math.min(100, Math.round((a.value / a.target) * 100)) }));
  });
});

// ---------- COURSE LECTURES & SECTIONS ----------
function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([^&?\s]+)/);
  return m ? m[1] : null;
}

// List lectures + sections for a course (public for enrolled students)
router.get("/v2/courses/:id/lectures", (req, res) => {
  void handle(res, async () => {
    const courseId = Number(req.params.id);
    const lectures = await db.select().from(schema.lecturesTable).where(eq(schema.lecturesTable.courseId, courseId)).orderBy(schema.lecturesTable.ord);
    const vids = await db.select().from(schema.lectureVideosTable).where(inArray(schema.lectureVideosTable.lectureId, lectures.map((l) => l.id))).orderBy(schema.lectureVideosTable.ord);
    const quizzes = await db.select().from(schema.lectureQuizzesTable).where(inArray(schema.lectureQuizzesTable.lectureId, lectures.map((l) => l.id)));
    const quizQs = await db.select().from(schema.lectureQuizQuestionsTable).where(inArray(schema.lectureQuizQuestionsTable.quizId, quizzes.map((q) => q.id))).orderBy(schema.lectureQuizQuestionsTable.ord);
    const pdfs = await db.select().from(schema.lecturePdfsTable).where(inArray(schema.lecturePdfsTable.lectureId, lectures.map((l) => l.id)));
    return lectures.map((l) => ({
      ...l,
      videos: vids.filter((v) => v.lectureId === l.id),
      quizzes: quizzes.filter((q) => q.lectureId === l.id).map((q) => ({
        ...q,
        questions: quizQs.filter((qq) => qq.quizId === q.id),
      })),
      pdfs: pdfs.filter((p) => p.lectureId === l.id),
    }));
  });
});

// Admin: create lecture/section
router.post("/v2/admin/courses/:courseId/lectures", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_courses");
  void handle(res, async () => {
    const courseId = Number(req.params.id || req.params.courseId);
    const { title, type, ord } = req.body as { title: string; type: "lecture" | "section"; ord?: number };
    if (!title) throw Object.assign(new Error("العنوان مطلوب"), { status: 400 });
    const maxOrd = await db.select({ max: schema.lecturesTable.ord }).from(schema.lecturesTable).where(eq(schema.lecturesTable.courseId, courseId));
    const [l] = await db.insert(schema.lecturesTable).values({ courseId, title, type: type || "lecture", ord: ord ?? (maxOrd[0]?.max ?? 0) + 1 }).returning();
    return l;
  });
});

// Admin: update lecture
router.patch("/v2/admin/lectures/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_courses");
  void handle(res, async () => {
    const id = Number(req.params.id);
    const { title, ord } = req.body as { title?: string; ord?: number };
    await db.update(schema.lecturesTable).set({ title, ord }).where(eq(schema.lecturesTable.id, id));
    return { ok: true };
  });
});

// Admin: delete lecture
router.delete("/v2/admin/lectures/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_courses");
  void handle(res, async () => {
    const id = Number(req.params.id);
    await db.delete(schema.lecturesTable).where(eq(schema.lecturesTable.id, id));
    return { ok: true };
  });
});

// Admin: add video to lecture
router.post("/v2/admin/lectures/:lectureId/videos", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_courses");
  void handle(res, async () => {
    const lectureId = Number(req.params.lectureId);
    const { title, youtubeUrl, ord } = req.body as { title: string; youtubeUrl: string; ord?: number };
    if (!title || !youtubeUrl) throw Object.assign(new Error("العنوان ورابط يوتيوب مطلوب"), { status: 400 });
    const ytId = extractYoutubeId(youtubeUrl);
    if (!ytId) throw Object.assign(new Error("رابط يوتيوب غير صالح"), { status: 400 });
    const maxOrd = await db.select({ max: schema.lectureVideosTable.ord }).from(schema.lectureVideosTable).where(eq(schema.lectureVideosTable.lectureId, lectureId));
    const [v] = await db.insert(schema.lectureVideosTable).values({ lectureId, title, youtubeUrl, youtubeId: ytId, ord: ord ?? (maxOrd[0]?.max ?? 0) + 1 }).returning();
    return v;
  });
});

// Admin: delete video
router.delete("/v2/admin/videos/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_courses");
  void handle(res, async () => {
    const id = Number(req.params.id);
    await db.delete(schema.lectureVideosTable).where(eq(schema.lectureVideosTable.id, id));
    return { ok: true };
  });
});

// Admin: add PDF to lecture (also creates material_files entry)
router.post("/v2/admin/lectures/:lectureId/pdfs", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_courses");
  void handle(res, async () => {
    const lectureId = Number(req.params.lectureId);
    const user = (req as any).currentUser as typeof schema.usersTable.$inferSelect;
    const { name, url, sizeBytes } = req.body as { name: string; url: string; sizeBytes?: number };
    if (!name || !url) throw Object.assign(new Error("الاسم والرابط مطلوب"), { status: 400 });
    // first get the course from the lecture
    const [lec] = await db.select().from(schema.lecturesTable).where(eq(schema.lecturesTable.id, lectureId));
    if (!lec) throw Object.assign(new Error("المحاضرة غير موجودة"), { status: 404 });
    // create in material_files
    const [mf] = await db.insert(schema.materialFilesTable).values({
      materialId: null,
      courseId: lec.courseId,
      name,
      kind: "pdf",
      url,
      sizeBytes: sizeBytes || 0,
      uploadedById: user.id,
      uploadedByName: user.name,
    }).returning();
    // then link from lecture_pdfs
    const [p] = await db.insert(schema.lecturePdfsTable).values({ lectureId, name, url, sizeBytes: sizeBytes || 0, materialFileId: mf.id }).returning();
    return { ...p, materialFileId: mf.id };
  });
});

// Admin: delete PDF
router.delete("/v2/admin/lecture-pdfs/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_courses");
  void handle(res, async () => {
    const id = Number(req.params.id);
    const [p] = await db.select().from(schema.lecturePdfsTable).where(eq(schema.lecturePdfsTable.id, id));
    if (!p) throw Object.assign(new Error("الملف غير موجود"), { status: 404 });
    if (p.materialFileId) await db.delete(schema.materialFilesTable).where(eq(schema.materialFilesTable.id, p.materialFileId));
    await db.delete(schema.lecturePdfsTable).where(eq(schema.lecturePdfsTable.id, id));
    return { ok: true };
  });
});

// Admin: create quiz for lecture
router.post("/v2/admin/lectures/:lectureId/quizzes", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_courses");
  void handle(res, async () => {
    const lectureId = Number(req.params.lectureId);
    const { title, questions } = req.body as { title: string; questions?: { text: string; options: string[]; correctIndex: number; points?: number; ord?: number }[] };
    if (!title) throw Object.assign(new Error("العنوان مطلوب"), { status: 400 });
    const [q] = await db.insert(schema.lectureQuizzesTable).values({ lectureId, title }).returning();
    if (questions?.length) {
      for (const qq of questions) {
        await db.insert(schema.lectureQuizQuestionsTable).values({ quizId: q.id, text: qq.text, options: qq.options, correctIndex: qq.correctIndex, points: qq.points ?? 1, ord: qq.ord ?? 0 });
      }
    }
    return { ...q, questions: questions || [] };
  });
});

// Admin: add question to quiz
router.post("/v2/admin/quizzes/:quizId/questions", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_courses");
  void handle(res, async () => {
    const quizId = Number(req.params.quizId);
    const { text, options, correctIndex, points, ord } = req.body as { text: string; options: string[]; correctIndex: number; points?: number; ord?: number };
    if (!text || !options || typeof correctIndex !== "number") throw Object.assign(new Error("بيانات السؤال ناقصة"), { status: 400 });
    const maxOrd = await db.select({ max: schema.lectureQuizQuestionsTable.ord }).from(schema.lectureQuizQuestionsTable).where(eq(schema.lectureQuizQuestionsTable.quizId, quizId));
    const [qq] = await db.insert(schema.lectureQuizQuestionsTable).values({ quizId, text, options, correctIndex, points: points ?? 1, ord: ord ?? (maxOrd[0]?.max ?? 0) + 1 }).returning();
    return qq;
  });
});

// Admin: delete quiz
router.delete("/v2/admin/lecture-quizzes/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_courses");
  void handle(res, async () => {
    const id = Number(req.params.id);
    await db.delete(schema.lectureQuizzesTable).where(eq(schema.lectureQuizzesTable.id, id));
    return { ok: true };
  });
});

// Admin: delete question
router.delete("/v2/admin/quiz-questions/:id", requireRole(["admin", "super_admin"]), (req, res) => {
  ensurePermission(req, "manage_courses");
  void handle(res, async () => {
    const id = Number(req.params.id);
    await db.delete(schema.lectureQuizQuestionsTable).where(eq(schema.lectureQuizQuestionsTable.id, id));
    return { ok: true };
  });
});

// Student: mark video as watched
router.post("/v2/videos/:id/watch", (req, res) => {
  void handle(res, async () => {
    const userId = req.demo.currentUserId!;
    if (!userId) throw Object.assign(new Error("سجل دخول"), { status: 401 });
    const videoId = Number(req.params.id);
    const existing = await db.select().from(schema.videoProgressTable).where(and(eq(schema.videoProgressTable.userId, userId), eq(schema.videoProgressTable.videoId, videoId)));
    if (existing.length) {
      await db.update(schema.videoProgressTable).set({ completed: true, watchedAt: new Date() }).where(eq(schema.videoProgressTable.id, existing[0].id));
    } else {
      await db.insert(schema.videoProgressTable).values({ userId, videoId, completed: true });
    }
    // update course progress
    const [vid] = await db.select().from(schema.lectureVideosTable).where(eq(schema.lectureVideosTable.id, videoId));
    if (vid) {
      const [lec] = await db.select().from(schema.lecturesTable).where(eq(schema.lecturesTable.id, vid.lectureId));
      if (lec) {
        const allVids = await db.select().from(schema.lectureVideosTable).where(inArray(schema.lectureVideosTable.lectureId, db.select({ id: schema.lecturesTable.id }).from(schema.lecturesTable).where(eq(schema.lecturesTable.courseId, lec.courseId))));
        const completedVids = await db.select().from(schema.videoProgressTable).where(and(eq(schema.videoProgressTable.userId, userId), inArray(schema.videoProgressTable.videoId, allVids.map((v) => v.id)), eq(schema.videoProgressTable.completed, true)));
        const progress = allVids.length ? (completedVids.length / allVids.length) * 100 : 0;
        await db.update(schema.coursesTable).set({ progress: Math.min(100, progress) }).where(eq(schema.coursesTable.id, lec.courseId));
      }
    }
    return { ok: true, completed: true };
  });
});

// Student: get video progress for a course
router.get("/v2/courses/:courseId/video-progress", (req, res) => {
  void handle(res, async () => {
    const userId = req.demo.currentUserId!;
    if (!userId) throw Object.assign(new Error("سجل دخول"), { status: 401 });
    const courseId = Number(req.params.courseId);
    const lectures = await db.select().from(schema.lecturesTable).where(eq(schema.lecturesTable.courseId, courseId));
    const vids = await db.select().from(schema.lectureVideosTable).where(inArray(schema.lectureVideosTable.lectureId, lectures.map((l) => l.id)));
    const prog = await db.select().from(schema.videoProgressTable).where(and(eq(schema.videoProgressTable.userId, userId), inArray(schema.videoProgressTable.videoId, vids.map((v) => v.id))));
    const progMap = new Map(prog.map((p) => [p.videoId, p.completed]));
    return vids.map((v) => ({ videoId: v.id, completed: progMap.get(v.id) || false }));
  });
});

// Student: submit lecture quiz attempt
router.post("/v2/lecture-quizzes/:quizId/submit", (req, res) => {
  void handle(res, async () => {
    const userId = req.demo.currentUserId!;
    if (!userId) throw Object.assign(new Error("سجل دخول"), { status: 401 });
    const quizId = Number(req.params.quizId);
    const { answers } = req.body as { answers: { questionId: number; chosenIndex: number }[] };
    if (!answers) throw Object.assign(new Error("الإجابات مطلوبة"), { status: 400 });
    const questions = await db.select().from(schema.lectureQuizQuestionsTable).where(eq(schema.lectureQuizQuestionsTable.quizId, quizId));
    let score = 0;
    let total = 0;
    const ansArr: number[] = [];
    for (const qq of questions) {
      total += qq.points;
      const a = answers.find((x) => x.questionId === qq.id);
      const correct = a?.chosenIndex === qq.correctIndex;
      if (correct) score += qq.points;
      ansArr.push(a?.chosenIndex ?? -1);
    }
    const existing = await db.select().from(schema.lectureQuizAttemptsTable).where(and(eq(schema.lectureQuizAttemptsTable.userId, userId), eq(schema.lectureQuizAttemptsTable.quizId, quizId)));
    if (existing.length) {
      await db.update(schema.lectureQuizAttemptsTable).set({ score, total, answers: ansArr.map(String), completedAt: new Date() }).where(eq(schema.lectureQuizAttemptsTable.id, existing[0].id));
    } else {
      await db.insert(schema.lectureQuizAttemptsTable).values({ userId, quizId, score, total, answers: ansArr.map(String) });
    }
    // award points
    await db.update(schema.usersTable).set({ points: sql`${schema.usersTable.points} + ${score}` }).where(eq(schema.usersTable.id, userId));
    return { score, total, passed: score / total >= 0.5 };
  });
});

// Student: get lecture quiz attempts
router.get("/v2/lecture-quizzes/:quizId/attempts", (req, res) => {
  void handle(res, async () => {
    const userId = req.demo.currentUserId!;
    if (!userId) throw Object.assign(new Error("سجل دخول"), { status: 401 });
    const quizId = Number(req.params.quizId);
    const attempts = await db.select().from(schema.lectureQuizAttemptsTable).where(and(eq(schema.lectureQuizAttemptsTable.userId, userId), eq(schema.lectureQuizAttemptsTable.quizId, quizId)));
    return attempts;
  });
});

// Student: get full course progress (videos + quizzes)
router.get("/v2/courses/:courseId/progress", (req, res) => {
  void handle(res, async () => {
    const userId = req.demo.currentUserId!;
    if (!userId) throw Object.assign(new Error("سجل دخول"), { status: 401 });
    const courseId = Number(req.params.courseId);
    const lectures = await db.select().from(schema.lecturesTable).where(eq(schema.lecturesTable.courseId, courseId));
    const vids = await db.select().from(schema.lectureVideosTable).where(inArray(schema.lectureVideosTable.lectureId, lectures.map((l) => l.id)));
    const quizzes = await db.select().from(schema.lectureQuizzesTable).where(inArray(schema.lectureQuizzesTable.lectureId, lectures.map((l) => l.id)));
    const videoProg = await db.select().from(schema.videoProgressTable).where(and(eq(schema.videoProgressTable.userId, userId), inArray(schema.videoProgressTable.videoId, vids.map((v) => v.id))));
    const quizAttempts = await db.select().from(schema.lectureQuizAttemptsTable).where(and(eq(schema.lectureQuizAttemptsTable.userId, userId), inArray(schema.lectureQuizAttemptsTable.quizId, quizzes.map((q) => q.id))));
    const videoMap = new Map(videoProg.map((p) => [p.videoId, p.completed]));
    const quizMap = new Map(quizAttempts.map((a) => [a.quizId, a.score / a.total >= 0.5]));
    const totalItems = vids.length + quizzes.length;
    const completedItems = vids.filter((v) => videoMap.get(v.id)).length + quizzes.filter((q) => quizMap.get(q.id)).length;
    return {
      totalItems,
      completedItems,
      percent: totalItems ? Math.round((completedItems / totalItems) * 100) : 0,
      videos: vids.map((v) => ({ id: v.id, completed: videoMap.get(v.id) || false })),
      quizzes: quizzes.map((q) => { const a = quizMap.get(q.id); return { id: q.id, completed: a || false }; }),
    };
  });
});

export default router;
