import { pgTable, text, timestamp, serial, integer, numeric } from "drizzle-orm/pg-core";
import { schoolsTable } from "./schools";
import { studentsTable } from "./students";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const propinasTable = pgTable("propinas", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schoolsTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  mes: text("mes").notNull(),
  ano: text("ano").notNull(),
  montante: numeric("montante", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("pendente"),
  referencia: text("referencia"),
  pagoEm: timestamp("pago_em"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPropinaSchema = createInsertSchema(propinasTable).omit({ id: true, createdAt: true });
export type InsertPropina = z.infer<typeof insertPropinaSchema>;
export type Propina = typeof propinasTable.$inferSelect;
