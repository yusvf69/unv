import { Router, type IRouter } from "express";
import { eq, desc, sql, inArray, and } from "drizzle-orm";
import {
  ListForumPostsResponse,
  CreateForumPostBody,
  GetForumPostResponse,
  CreateForumReplyBody,
  UpvoteForumPostResponse,
} from "@workspace/api-zod";
import { db, schema } from "../lib/db";
import { handle } from "../lib/util";

const router: IRouter = Router();

function authorRef(u: typeof schema.usersTable.$inferSelect) {
  return { id: u.id, name: u.name, avatarUrl: u.avatarUrl, role: u.role };
}

function ensureAdmin(req: any) {
  const u = (req as any).currentUser as typeof schema.usersTable.$inferSelect;
  if (!u || (u.role !== "admin" && u.role !== "super_admin")) {
    throw Object.assign(new Error("غير مصرح"), { status: 403 });
  }
  return u;
}

router.get("/forum/posts", (req, res) => {
  void handle(res, async () => {
    const cat = typeof req.query.category === "string" ? req.query.category : undefined;
    const where = cat ? eq(schema.forumPostsTable.category, cat) : undefined;
    const posts = where
      ? await db.select().from(schema.forumPostsTable).where(where).orderBy(desc(schema.forumPostsTable.createdAt))
      : await db.select().from(schema.forumPostsTable).orderBy(desc(schema.forumPostsTable.createdAt));
    const authors =
      posts.length > 0
        ? await db.select().from(schema.usersTable).where(inArray(schema.usersTable.id, posts.map((p) => p.authorId)))
        : [];
    const aMap = new Map(authors.map((a) => [a.id, a]));
    const replyCounts = await db
      .select({ postId: schema.forumRepliesTable.postId, c: sql<number>`count(*)::int` })
      .from(schema.forumRepliesTable)
      .groupBy(schema.forumRepliesTable.postId);
    const cMap = new Map(replyCounts.map((r) => [r.postId, r.c]));
    return ListForumPostsResponse.parse(
      posts.map((p) => {
        const a = aMap.get(p.authorId);
        return {
          id: p.id,
          title: p.title,
          excerpt: p.body.slice(0, 200),
          category: p.category,
          author: a ? authorRef(a) : { id: 0, name: "Unknown", avatarUrl: null, role: "student" },
          upvotes: p.upvotes,
          replyCount: cMap.get(p.id) ?? 0,
          hasBestAnswer: p.bestReplyId != null,
          createdAt: p.createdAt.toISOString(),
        };
      }),
    );
  });
});

router.post("/forum/posts", (req, res) => {
  void handle(res, async () => {
    const userId = req.demo.currentUserId;
    if (!userId) throw Object.assign(new Error("غير مسجل"), { status: 401 });
    const body = CreateForumPostBody.parse(req.body);
    const [created] = await db
      .insert(schema.forumPostsTable)
      .values({ title: body.title, body: body.body, category: body.category, authorId: userId })
      .returning();
    const [author] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, created.authorId));
    return {
      id: created.id,
      title: created.title,
      excerpt: created.body.slice(0, 200),
      category: created.category,
      author: author ? authorRef(author) : { id: 0, name: "Unknown", avatarUrl: null, role: "student" },
      upvotes: created.upvotes,
      replyCount: 0,
      hasBestAnswer: false,
      createdAt: created.createdAt.toISOString(),
    };
  });
});

router.get("/forum/posts/:id", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const [p] = await db.select().from(schema.forumPostsTable).where(eq(schema.forumPostsTable.id, id)).limit(1);
    if (!p) throw Object.assign(new Error("Post not found"), { status: 404 });
    const replies = await db
      .select()
      .from(schema.forumRepliesTable)
      .where(eq(schema.forumRepliesTable.postId, id))
      .orderBy(desc(schema.forumRepliesTable.upvotes));
    const userIds = [p.authorId, ...replies.map((r) => r.authorId)];
    const users = await db.select().from(schema.usersTable).where(inArray(schema.usersTable.id, userIds));
    const uMap = new Map(users.map((u) => [u.id, u]));
    const author = uMap.get(p.authorId);

    // Check if current user liked this post/replies
    const currentUserId = (req as any).demo?.currentUserId as number | undefined;
    let likedByMe = false;
    if (currentUserId) {
      const [like] = await db.select().from(schema.forumPostLikesTable).where(and(eq(schema.forumPostLikesTable.postId, id), eq(schema.forumPostLikesTable.userId, currentUserId)));
      likedByMe = !!like;
    }

    return GetForumPostResponse.parse({
      id: p.id,
      title: p.title,
      excerpt: p.body.slice(0, 200),
      body: p.body,
      category: p.category,
      author: author ? authorRef(author) : { id: 0, name: "Unknown", avatarUrl: null, role: "student" },
      upvotes: p.upvotes,
      replyCount: replies.length,
      hasBestAnswer: p.bestReplyId != null,
      createdAt: p.createdAt.toISOString(),
      likedByMe,
      replies: replies.map((r) => {
        const ra = uMap.get(r.authorId);
        return {
          id: r.id,
          body: r.body,
          author: ra ? authorRef(ra) : { id: 0, name: "Unknown", avatarUrl: null, role: "student" },
          upvotes: r.upvotes,
          isBest: r.isBest,
          createdAt: r.createdAt.toISOString(),
        };
      }),
    });
  });
});

router.post("/forum/posts/:id/replies", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const userId = req.demo.currentUserId;
    if (!userId) throw Object.assign(new Error("غير مسجل"), { status: 401 });
    const body = CreateForumReplyBody.parse(req.body);
    const [created] = await db
      .insert(schema.forumRepliesTable)
      .values({ postId: id, body: body.body, authorId: userId })
      .returning();
    const [author] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, created.authorId));
    return {
      id: created.id,
      body: created.body,
      author: author ? authorRef(author) : { id: 0, name: "Unknown", avatarUrl: null, role: "student" },
      upvotes: created.upvotes,
      isBest: created.isBest,
      createdAt: created.createdAt.toISOString(),
    };
  });
});

// Toggle like on forum posts
router.post("/forum/posts/:id/upvote", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const userId = req.demo.currentUserId;
    if (!userId) throw Object.assign(new Error("غير مسجل"), { status: 401 });

    const [existing] = await db
      .select()
      .from(schema.forumPostLikesTable)
      .where(and(eq(schema.forumPostLikesTable.postId, id), eq(schema.forumPostLikesTable.userId, userId)));

    if (existing) {
      // Unlike
      await db
        .delete(schema.forumPostLikesTable)
        .where(and(eq(schema.forumPostLikesTable.postId, id), eq(schema.forumPostLikesTable.userId, userId)));
      await db
        .update(schema.forumPostsTable)
        .set({ upvotes: sql`GREATEST(${schema.forumPostsTable.upvotes} - 1, 0)` })
        .where(eq(schema.forumPostsTable.id, id));
      return UpvoteForumPostResponse.parse({ upvotes: Math.max(0, ((await db.select({ upvotes: schema.forumPostsTable.upvotes }).from(schema.forumPostsTable).where(eq(schema.forumPostsTable.id, id)))[0]?.upvotes || 0)) });
    } else {
      // Like
      await db.insert(schema.forumPostLikesTable).values({ postId: id, userId });
      const [updated] = await db
        .update(schema.forumPostsTable)
        .set({ upvotes: sql`${schema.forumPostsTable.upvotes} + 1` })
        .where(eq(schema.forumPostsTable.id, id))
        .returning();
      return UpvoteForumPostResponse.parse({ upvotes: updated.upvotes });
    }
  });
});

// Admin delete forum post
router.delete("/admin/forum/posts/:id", (req, res) => {
  void handle(res, async () => {
    ensureAdmin(req);
    const id = Number(req.params.id);
    await db.delete(schema.forumPostsTable).where(eq(schema.forumPostsTable.id, id));
    return { ok: true };
  });
});

// Admin delete forum reply
router.delete("/admin/forum/replies/:id", (req, res) => {
  void handle(res, async () => {
    ensureAdmin(req);
    const id = Number(req.params.id);
    await db.delete(schema.forumRepliesTable).where(eq(schema.forumRepliesTable.id, id));
    return { ok: true };
  });
});

export default router;
