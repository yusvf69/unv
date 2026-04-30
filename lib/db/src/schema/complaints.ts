import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const complaintsTable = pgTable("complaints", {
  id: serial("id").primaryKey(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("open"),
  response: text("response"),
  authorId: integer("author_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ComplaintRow = typeof complaintsTable.$inferSelect;
