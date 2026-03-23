import { pgTable, text, timestamp, serial, integer } from "drizzle-orm/pg-core";
import { schoolsTable } from "./schools";

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schoolsTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Session = typeof sessionsTable.$inferSelect;
