import { pgTable, serial, text, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

export const quizzesTable = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  courseId: integer("course_id").notNull(),
  courseTitle: text("course_title").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(15),
  totalPoints: integer("total_points").notNull().default(100),
  difficulty: text("difficulty").notNull().default("medium"),
  groupOnly: text("group_only"),
  yearOnly: integer("year_only"),
  isOpen: boolean("is_open").notNull().default(true),
  randomize: boolean("randomize").notNull().default(true),
  passPercent: integer("pass_percent").notNull().default(50),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quizAttemptsTable = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull(),
  score: integer("score").notNull().default(0),
  total: integer("total").notNull().default(0),
  durationSec: integer("duration_sec").notNull().default(0),
  passed: boolean("passed").notNull().default(false),
  answers: jsonb("answers").$type<{ questionId: number; chosen: number; correct: boolean }[]>().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quizQuestionsTable = pgTable("quiz_questions", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzesTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  type: text("type").notNull().default("mc"), // "mc" for multiple choice, "tf" for true/false
  options: jsonb("options").$type<string[]>().notNull(),
  correctIndex: integer("correct_index").notNull(),
  points: integer("points").notNull().default(10),
  explanation: text("explanation").notNull().default(""),
  ord: integer("ord").notNull().default(0),
});

export type QuizRow = typeof quizzesTable.$inferSelect;
export type QuizQuestionRow = typeof quizQuestionsTable.$inferSelect;
export type QuizAttemptRow = typeof quizAttemptsTable.$inferSelect;
