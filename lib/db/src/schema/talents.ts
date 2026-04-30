import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const talentsTable = pgTable("talents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  mediaUrl: text("media_url"),
  votes: integer("votes").notNull().default(0),
  ownerId: integer("owner_id").notNull(),
  status: text("status").notNull().default("active"),
  groupOnly: text("group_only"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const talentLikesTable = pgTable("talent_likes", {
  id: serial("id").primaryKey(),
  talentId: integer("talent_id").notNull().references(() => talentsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const talentCommentsTable = pgTable("talent_comments", {
  id: serial("id").primaryKey(),
  talentId: integer("talent_id").notNull().references(() => talentsTable.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TalentRow = typeof talentsTable.$inferSelect;
export type TalentLikeRow = typeof talentLikesTable.$inferSelect;
export type TalentCommentRow = typeof talentCommentsTable.$inferSelect;
