import { pgTable, text, timestamp, serial, integer } from "drizzle-orm/pg-core";
import { schoolsTable } from "./schools";
import { turmasTable } from "./turmas";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schoolsTable.id, { onDelete: "cascade" }),
  turmaId: integer("turma_id").references(() => turmasTable.id, { onDelete: "set null" }),
  nome: text("nome").notNull(),
  bilhete: text("bilhete"),
  telefoneEncarregado: text("telefone_encarregado"),
  nomeEncarregado: text("nome_encarregado"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;
