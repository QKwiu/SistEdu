import { pgTable, text, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const schoolsTable = pgTable("schools", {
  id: serial("id").primaryKey(),
  schoolId: text("school_id").notNull().unique(),
  name: text("name").notNull(),
  nif: text("nif").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  institutionType: text("institution_type").notNull().default("colegio_geral"),
  portalNomenclatura: text("portal_nomenclatura").notNull().default("encarregado"),
});

export const insertSchoolSchema = createInsertSchema(schoolsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type School = typeof schoolsTable.$inferSelect;
