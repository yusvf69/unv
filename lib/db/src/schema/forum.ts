import { pgTable, serial, text, integer, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";

export const forumPostsTable = pgTable("forum_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull(),
  authorId: integer("author_id").notNull(),
  upvotes: integer("upvotes").notNull().default(0),
  bestReplyId: integer("best_reply_id"),
  groupOnly: text("group_only"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const forumRepliesTable = pgTable("forum_replies", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => forumPostsTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  authorId: integer("author_id").notNull(),
  upvotes: integer("upvotes").notNull().default(0),
  isBest: boolean("is_best").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const forumPostLikesTable = pgTable(
  "forum_post_likes",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull().references(() => forumPostsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pair: uniqueIndex("forum_post_likes_pair_idx").on(t.postId, t.userId),
  }),
);

export const forumReplyLikesTable = pgTable(
  "forum_reply_likes",
  {
    id: serial("id").primaryKey(),
    replyId: integer("reply_id").notNull().references(() => forumRepliesTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pair: uniqueIndex("forum_reply_likes_pair_idx").on(t.replyId, t.userId),
  }),
);

export type ForumPostRow = typeof forumPostsTable.$inferSelect;
export type ForumReplyRow = typeof forumRepliesTable.$inferSelect;
export type ForumPostLikeRow = typeof forumPostLikesTable.$inferSelect;
export type ForumReplyLikeRow = typeof forumReplyLikesTable.$inferSelect;
