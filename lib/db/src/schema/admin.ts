import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const adminProposalsTable = pgTable("admin_proposals", {
  id: serial("id").primaryKey(),
  proposerId: integer("proposer_id").notNull(),
  action: text("action").notNull(),
  resourceKind: text("resource_kind").notNull(),
  resourceId: integer("resource_id"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  decisionNote: text("decision_note"),
  decidedById: integer("decided_by_id"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameScoresTable = pgTable("game_scores", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  gameKey: text("game_key").notNull(),
  score: integer("score").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminProposalRow = typeof adminProposalsTable.$inferSelect;
export type GameScoreRow = typeof gameScoresTable.$inferSelect;
