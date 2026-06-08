/**
 * school-auth.ts — shared school authentication middleware + token helper
 * (DRY: replaces duplicate schoolAuth + getSchoolFromToken in school.ts, splitpay.ts, reports.ts)
 */

import type { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";

export interface SchoolTokenPayload {
  school_id: number;
  school_name: string;
  institution_type?: string;
  portal_nomenclatura?: string;
  usa_pacotes?: boolean;
}

/**
 * Lightweight middleware: extracts the Bearer token from the Authorization header
 * and sets req.schoolToken. Does NOT query the DB — routes call getSchoolFromToken()
 * when they need school details.
 */
export function schoolAuth(req: Request & { schoolToken?: string }, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Não autenticado." });
  }
  (req as any).schoolToken = header.slice(7);
  next();
}

/**
 * Full middleware: validates the token against the DB and sets req.schoolId + req.schoolName.
 * Use this when you need the school identity in every handler of a sub-router.
 */
export async function schoolAuthFull(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Não autorizado" });
  }
  const token = header.slice(7);
  const result = await pool.query(
    `SELECT s.id AS school_id, s.name AS school_name
     FROM sessions sess
     JOIN schools s ON s.id = sess.school_id
     WHERE sess.token = $1 AND sess.expires_at > NOW()
     LIMIT 1`,
    [token]
  );
  if (!result.rows.length) {
    return res.status(401).json({ error: "Sessão inválida" });
  }
  (req as any).schoolId = result.rows[0].school_id as number;
  (req as any).schoolName = result.rows[0].school_name as string;
  next();
}

/**
 * DB helper: resolve a school session token to the full school record.
 * Returns null if the token is invalid/expired.
 */
export async function getSchoolFromToken(token: string): Promise<SchoolTokenPayload | null> {
  const res = await pool.query(
    `SELECT sc.id AS school_id, sc.name AS school_name,
            sc.institution_type, sc.portal_nomenclatura, sc.usa_pacotes
     FROM sessions s
     JOIN schools sc ON sc.id = s.school_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );
  return res.rows[0] ?? null;
}
