import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const missionsTable = pgTable("missions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  points: integer("points").notNull().default(10),
  kind: text("kind").notNull().default("study"),
  completed: boolean("completed").notNull().default(false),
  ord: integer("ord").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MissionRow = typeof missionsTable.$inferSelect;
