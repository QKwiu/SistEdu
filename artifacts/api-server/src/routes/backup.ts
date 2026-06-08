/**
 * Kiwara Tech — Backup Admin Endpoints
 *
 * GET  /admin/backup/history  — últimos N backups
 * POST /admin/backup/trigger  — dispara backup manual (protegido por adminAuth)
 */

import { Router } from "express";
import { adminAuth } from "./admin";
import { runBackup, getBackupHistory } from "../services/backup.service";
import { logger } from "../lib/logger";

const router = Router();

/* GET /admin/backup/history */
router.get("/admin/backup/history", adminAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
    const history = await getBackupHistory(limit);
    res.json({ history });
  } catch (err) {
    logger.error({ err }, "[backup] erro ao obter histórico");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* POST /admin/backup/trigger */
router.post("/admin/backup/trigger", adminAuth, async (req, res) => {
  const type = (req.body?.type ?? "manual") as "manual" | "daily" | "weekly" | "monthly";
  const allowed = ["manual", "daily", "weekly", "monthly"];
  if (!allowed.includes(type)) {
    return res.status(400).json({ error: "Tipo inválido. Use: manual|daily|weekly|monthly" });
  }

  // Responde imediatamente e corre o backup em background
  res.json({ message: `Backup '${type}' iniciado em background.` });

  setImmediate(async () => {
    try {
      await runBackup(type);
    } catch (err) {
      logger.error({ err, type }, "[backup] backup manual falhou");
    }
  });
});

export default router;
