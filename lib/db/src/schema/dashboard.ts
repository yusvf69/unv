import { pgTable, serial, text, integer, real, timestamp, boolean } from "drizzle-orm/pg-core";

export const scheduleItemsTable = pgTable("schedule_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  courseId: integer("course_id").notNull(),
  courseTitle: text("course_title").notNull(),
  courseCode: text("course_code").notNull(),
  instructor: text("instructor").notNull(),
  room: text("room").notNull(),
  day: text("day").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  type: text("type").notNull(),
});

export const gradesTable = pgTable("grades", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  courseId: integer("course_id").notNull(),
  courseTitle: text("course_title").notNull(),
  courseCode: text("course_code").notNull(),
  score: real("score").notNull(),
  outOf: real("out_of").notNull(),
  letter: text("letter").notNull(),
});

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  courseId: integer("course_id").notNull(),
  courseTitle: text("course_title").notNull(),
  attended: integer("attended").notNull(),
  total: integer("total").notNull(),
});

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull().default("info"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activityTable = pgTable("activity", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: text("date").notNull(),
  minutesStudied: integer("minutes_studied").notNull().default(0),
  pointsEarned: integer("points_earned").notNull().default(0),
});

export type ScheduleItemRow = typeof scheduleItemsTable.$inferSelect;
export type GradeRow = typeof gradesTable.$inferSelect;
export type AttendanceRow = typeof attendanceTable.$inferSelect;
export type NotificationRow = typeof notificationsTable.$inferSelect;
export type ActivityRow = typeof activityTable.$inferSelect;
