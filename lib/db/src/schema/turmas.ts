import { pgTable, text, timestamp, serial, integer } from "drizzle-orm/pg-core";
import { schoolsTable } from "./schools";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const turmasTable = pgTable("turmas", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schoolsTable.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  ano: text("ano").notNull(),
  turno: text("turno").notNull().default("Manhã"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTurmaSchema = createInsertSchema(turmasTable).omit({ id: true, createdAt: true });
export type InsertTurma = z.infer<typeof insertTurmaSchema>;
export type Turma = typeof turmasTable.$inferSelect;
