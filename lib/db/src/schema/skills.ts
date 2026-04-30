import { pgTable, serial, text, integer, real, boolean } from "drizzle-orm/pg-core";

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

export type SkillTrackRow = typeof skillTracksTable.$inferSelect;
export type SkillLessonRow = typeof skillLessonsTable.$inferSelect;
