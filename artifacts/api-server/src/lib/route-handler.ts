/**
 * route-handler.ts — async route wrapper (DRY: replaces repeated try/catch in every route handler)
 *
 * Usage:
 *   router.get("/school/propinas", schoolAuth, handle(async (req, res) => {
 *     const rows = await pool.query("SELECT ...");
 *     res.json(rows.rows);
 *   }));
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async route handler and forwards any thrown errors to Express's
 * error-handling middleware (or sends a 500 JSON response if no handler is set).
 */
export function handle(
  fn: (req: Request, res: Response) => Promise<void>
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (e: any) {
      if (res.headersSent) return next(e);
      res.status(500).json({ error: e?.message ?? "Erro interno do servidor" });
    }
  };
}
