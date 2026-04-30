import { pgTable, serial, text, integer, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";

export const userFollowsTable = pgTable(
  "user_follows",
  {
    id: serial("id").primaryKey(),
    followerId: integer("follower_id").notNull(),
    followingId: integer("following_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pair: uniqueIndex("user_follows_pair_idx").on(t.followerId, t.followingId),
  }),
);

export const dmThreadsTable = pgTable(
  "dm_threads",
  {
    id: serial("id").primaryKey(),
    userAId: integer("user_a_id").notNull(),
    userBId: integer("user_b_id").notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pair: uniqueIndex("dm_threads_pair_idx").on(t.userAId, t.userBId),
  }),
);

export const dmMessagesTable = pgTable("dm_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull().references(() => dmThreadsTable.id, { onDelete: "cascade" }),
  fromId: integer("from_id").notNull(),
  body: text("body").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const materialFilesTable = pgTable("material_files", {
  id: serial("id").primaryKey(),
  materialId: integer("material_id"),
  courseId: integer("course_id").notNull(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("pdf"),
  category: text("category").notNull().default("official"),
  url: text("url").notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  uploadedById: integer("uploaded_by_id").notNull(),
  uploadedByName: text("uploaded_by_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const materialFileLikesTable = pgTable(
  "material_file_likes",
  {
    id: serial("id").primaryKey(),
    fileId: integer("file_id").notNull().references(() => materialFilesTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pair: uniqueIndex("material_file_likes_pair_idx").on(t.fileId, t.userId),
  }),
);

export const materialFileViewsTable = pgTable(
  "material_file_views",
  {
    id: serial("id").primaryKey(),
    fileId: integer("file_id").notNull().references(() => materialFilesTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pair: uniqueIndex("material_file_views_pair_idx").on(t.fileId, t.userId),
  }),
);

export const materialFileCommentsTable = pgTable("material_file_comments", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").notNull().references(() => materialFilesTable.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupScheduleTable = pgTable("group_schedule", {
  id: serial("id").primaryKey(),
  groupName: text("group_name").notNull(),
  yearInCollege: integer("year_in_college").notNull(),
  day: text("day").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  courseTitle: text("course_title").notNull(),
  courseCode: text("course_code"),
  instructor: text("instructor").notNull(),
  room: text("room").notNull(),
  type: text("type").notNull().default("lecture"),
});

export const examScheduleTable = pgTable("exam_schedule", {
  id: serial("id").primaryKey(),
  groupName: text("group_name").notNull(),
  yearInCollege: integer("year_in_college").notNull(),
  day: text("day").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  courseTitle: text("course_title").notNull(),
  courseCode: text("course_code"),
  room: text("room").notNull().default(""),
  type: text("type").notNull().default("midterm"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserFollowRow = typeof userFollowsTable.$inferSelect;
export type DmThreadRow = typeof dmThreadsTable.$inferSelect;
export type DmMessageRow = typeof dmMessagesTable.$inferSelect;
export type MaterialFileRow = typeof materialFilesTable.$inferSelect;
export type MaterialFileLikeRow = typeof materialFileLikesTable.$inferSelect;
export type MaterialFileViewRow = typeof materialFileViewsTable.$inferSelect;
export type MaterialFileCommentRow = typeof materialFileCommentsTable.$inferSelect;
export type GroupScheduleRow = typeof groupScheduleTable.$inferSelect;
export type ExamScheduleRow = typeof examScheduleTable.$inferSelect;
