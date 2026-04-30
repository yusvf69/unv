import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const newsTable = pgTable("news", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull(),
  imageUrl: text("image_url"),
  author: text("author").notNull(),
  authorId: integer("author_id"),
  status: text("status").notNull().default("approved"),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NewsRow = typeof newsTable.$inferSelect;
