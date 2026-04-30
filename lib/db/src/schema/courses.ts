import { pgTable, serial, text, integer, real, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";

export const coursesTable = pgTable("courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  code: text("code").notNull().unique(),
  description: text("description").notNull(),
  credits: integer("credits").notNull().default(3),
  department: text("department").notNull(),
  instructor: text("instructor").notNull(),
  instructorId: integer("instructor_id"),
  taIds: integer("ta_ids").array(),
  instructorBio: text("instructor_bio").notNull().default(""),
  coverUrl: text("cover_url"),
  progress: real("progress").notNull().default(0),
  enrolled: integer("enrolled").notNull().default(0),
  syllabus: text("syllabus").array(),
  yearInCollege: integer("year_in_college"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const materialsTable = pgTable("materials", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  url: text("url").notNull(),
  lecturer: text("lecturer"),
  durationMinutes: integer("duration_minutes"),
  ord: integer("ord").notNull().default(0),
});

export const lecturesTable = pgTable("lectures", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type").notNull().default("lecture"),
  ord: integer("ord").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lectureVideosTable = pgTable("lecture_videos", {
  id: serial("id").primaryKey(),
  lectureId: integer("lecture_id").notNull().references(() => lecturesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  youtubeUrl: text("youtube_url").notNull(),
  youtubeId: text("youtube_id").notNull(),
  ord: integer("ord").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lectureQuizzesTable = pgTable("lecture_quizzes", {
  id: serial("id").primaryKey(),
  lectureId: integer("lecture_id").notNull().references(() => lecturesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lectureQuizQuestionsTable = pgTable("lecture_quiz_questions", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => lectureQuizzesTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  options: text("options").array().notNull(),
  correctIndex: integer("correct_index").notNull(),
  points: integer("points").notNull().default(1),
  ord: integer("ord").notNull().default(0),
});

export const lecturePdfsTable = pgTable("lecture_pdfs", {
  id: serial("id").primaryKey(),
  lectureId: integer("lecture_id").notNull().references(() => lecturesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  materialFileId: integer("material_file_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const videoProgressTable = pgTable("video_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  videoId: integer("video_id").notNull().references(() => lectureVideosTable.id, { onDelete: "cascade" }),
  completed: boolean("completed").notNull().default(false),
  watchedAt: timestamp("watched_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pair: uniqueIndex("video_progress_pair_idx").on(t.userId, t.videoId),
}));

export const lectureQuizAttemptsTable = pgTable("lecture_quiz_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  quizId: integer("quiz_id").notNull().references(() => lectureQuizzesTable.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  total: integer("total").notNull(),
  answers: text("answers").array().notNull().default([]),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pair: uniqueIndex("lq_attempt_pair_idx").on(t.userId, t.quizId),
}));

export type CourseRow = typeof coursesTable.$inferSelect;
export type MaterialRow = typeof materialsTable.$inferSelect;
export type LectureRow = typeof lecturesTable.$inferSelect;
export type LectureVideoRow = typeof lectureVideosTable.$inferSelect;
export type LectureQuizRow = typeof lectureQuizzesTable.$inferSelect;
export type LectureQuizQuestionRow = typeof lectureQuizQuestionsTable.$inferSelect;
export type LecturePdfRow = typeof lecturePdfsTable.$inferSelect;
export type VideoProgressRow = typeof videoProgressTable.$inferSelect;
export type LectureQuizAttemptRow = typeof lectureQuizAttemptsTable.$inferSelect;
