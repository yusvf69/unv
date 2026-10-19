import { pgTable, serial, text, integer, boolean, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { universitiesTable, facultiesTable } from "./institutions";

export const communitiesTable = pgTable(
  "communities",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(),
    universityId: integer("university_id")
      .notNull()
      .references(() => universitiesTable.id, { onDelete: "cascade" }),
    facultyId: integer("faculty_id").references(() => facultiesTable.id, { onDelete: "cascade" }),
    year: integer("year"),
    nameAr: text("name_ar").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    communityPostsIdx: index("communities_scope_idx").on(table.kind, table.universityId, table.facultyId, table.year),
  }),
);

export const communityPostsTable = pgTable(
  "community_posts",
  {
    id: serial("id").primaryKey(),
    communityId: integer("community_id")
      .notNull()
      .references(() => communitiesTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull(),
    body: text("body").notNull(),
    imageUrl: text("image_url"),
    isDeleted: boolean("is_deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    communityCreatedIdx: index("community_posts_community_idx").on(table.communityId, table.createdAt),
  }),
);

export const communityPostLikesTable = pgTable(
  "community_post_likes",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => communityPostsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.userId] }),
  }),
);

export const communityCommentsTable = pgTable(
  "community_comments",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => communityPostsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull(),
    body: text("body").notNull(),
    isDeleted: boolean("is_deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    postIdx: index("community_comments_post_idx").on(table.postId, table.createdAt),
  }),
);

export type Community = typeof communitiesTable.$inferSelect;
export type CommunityPost = typeof communityPostsTable.$inferSelect;
export type CommunityComment = typeof communityCommentsTable.$inferSelect;
