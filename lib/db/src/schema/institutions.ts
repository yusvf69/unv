import { pgTable, serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const universitiesTable = pgTable("universities", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  slug: text("slug").notNull().unique(),
  country: text("country").notNull().default("EG"),
  city: text("city"),
  logoUrl: text("logo_url"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const facultiesTable = pgTable(
  "faculties",
  {
    id: serial("id").primaryKey(),
    universityId: integer("university_id")
      .notNull()
      .references(() => universitiesTable.id, { onDelete: "cascade" }),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en"),
    slug: text("slug"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    universityNameUnique: uniqueIndex("faculties_university_name_ar_unique").on(table.universityId, table.nameAr),
  }),
);

export const departmentsTable = pgTable(
  "departments",
  {
    id: serial("id").primaryKey(),
    facultyId: integer("faculty_id")
      .notNull()
      .references(() => facultiesTable.id, { onDelete: "cascade" }),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    facultyNameUnique: uniqueIndex("departments_faculty_name_ar_unique").on(table.facultyId, table.nameAr),
  }),
);

export const institutionSuggestionsTable = pgTable("institution_suggestions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  kind: text("kind").notNull(),
  parentId: integer("parent_id"),
  nameAr: text("name_ar").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type University = typeof universitiesTable.$inferSelect;
export type Faculty = typeof facultiesTable.$inferSelect;
export type Department = typeof departmentsTable.$inferSelect;
export type InstitutionSuggestion = typeof institutionSuggestionsTable.$inferSelect;
