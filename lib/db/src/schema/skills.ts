import { pgTable, serial, text, integer, real, boolean, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const skillTracksTable = pgTable("skill_tracks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  difficulty: text("difficulty").notNull().default("beginner"),
  coverUrl: text("cover_url"),
  progress: real("progress").notNull().default(0),
});

export const skillLessonsTable = pgTable("skill_lessons", {
  id: serial("id").primaryKey(),
  trackId: integer("track_id").notNull().references(() => skillTracksTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(10),
  kind: text("kind").notNull().default("lesson"),
  completed: boolean("completed").notNull().default(false),
  ord: integer("ord").notNull().default(0),
});

export const userSkillProgressTable = pgTable("user_skill_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  lessonId: integer("lesson_id").notNull().references(() => skillLessonsTable.id, { onDelete: "cascade" }),
  trackId: integer("track_id").notNull().references(() => skillTracksTable.id, { onDelete: "cascade" }),
  completed: boolean("completed").notNull().default(true),
  quickCheckScore: integer("quick_check_score").notNull().default(0),
  level: text("level").notNull().default("beginner"),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userLessonUnique: uniqueIndex("user_lesson_unique").on(table.userId, table.lessonId),
}));

export const skillQuickChecksTable = pgTable("skill_quick_checks", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id").notNull().references(() => skillLessonsTable.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  options: jsonb("options").$type<string[]>().notNull(),
  correctIndex: integer("correct_index").notNull(),
  explanation: text("explanation").notNull().default(""),
  ord: integer("ord").notNull().default(0),
});

export type SkillTrackRow = typeof skillTracksTable.$inferSelect;
export type SkillLessonRow = typeof skillLessonsTable.$inferSelect;
export type UserSkillProgressRow = typeof userSkillProgressTable.$inferSelect;
export type SkillQuickCheckRow = typeof skillQuickChecksTable.$inferSelect;
