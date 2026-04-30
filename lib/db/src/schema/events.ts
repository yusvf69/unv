import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  kind: text("kind").notNull().default("exam"),
  yearInCollege: integer("year_in_college"),
  groupName: text("group_name"),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  location: text("location"),
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EventRow = typeof eventsTable.$inferSelect;
