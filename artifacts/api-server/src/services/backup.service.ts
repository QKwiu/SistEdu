/**
 * Kiwara Tech — In-Process Backup Service
 *
 * Executa pg_dump diariamente dentro do processo Node.js,
 * cifra com AES-256-GCM e envia para AWS S3.
 *
 * Variáveis de ambiente necessárias:
 *   BACKUP_S3_BUCKET          ex: kiwara-backups-prod
 *   BACKUP_S3_PREFIX          ex: kiwara/db
 *   BACKUP_ENCRYPTION_KEY     passphrase >= 32 chars
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_REGION                ex: af-south-1
 *   BACKUP_ENABLED            "true" para activar (default: false em dev)
 */

import { spawn } from "child_process";
import { createCipheriv, randomBytes, pbkdf2Sync } from "crypto";
import { PassThrough, Readable } from "stream";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type BackupType = "daily" | "weekly" | "monthly" | "manual";
export type BackupStatus = "running" | "success" | "failed";

export interface BackupRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: BackupStatus;
  type: BackupType;
  size_bytes: number | null;
  s3_key: string | null;
  duration_ms: number | null;
  error_message: string | null;
}

// ── Migração da tabela backup_runs ────────────────────────────────────────────
export async function runBackupMigration(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS backup_runs (
      id            SERIAL PRIMARY KEY,
      started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at   TIMESTAMPTZ,
      status        TEXT NOT NULL CHECK (status IN ('running','success','failed')),
      type          TEXT NOT NULL CHECK (type IN ('daily','weekly','monthly','manual')),
      size_bytes    BIGINT,
      s3_key        TEXT,
      duration_ms   INTEGER,
      error_message TEXT
    );
    CREATE INDEX IF NOT EXISTS backup_runs_started_at_idx ON backup_runs (started_at DESC);
  `);
  logger.info("[backup] migration ok");
}

// ── Configuração ──────────────────────────────────────────────────────────────
function getConfig() {
  const bucket  = process.env["BACKUP_S3_BUCKET"] ?? "";
  const prefix  = process.env["BACKUP_S3_PREFIX"] ?? "kiwara/db";
  const enabled = process.env["BACKUP_ENABLED"] === "true";

  // Chave obrigatória quando backup está activo — falha explícita em vez de cifrar com string vazia
  const key = enabled
    ? (() => {
        const k = process.env["BACKUP_ENCRYPTION_KEY"];
        if (!k || k.length < 32)
          throw new Error("[backup] BACKUP_ENCRYPTION_KEY não definida ou demasiado curta (mín. 32 chars). Configure em Replit Secrets.");
        return k;
      })()
    : (process.env["BACKUP_ENCRYPTION_KEY"] ?? "");

  const region  = process.env["AWS_REGION"] ?? process.env["AWS_DEFAULT_REGION"] ?? "af-south-1";

  const pgHost  = process.env["PGHOST"] ?? "localhost";
  const pgPort  = process.env["PGPORT"] ?? "5432";
  const pgUser  = process.env["PGUSER"] ?? "postgres";
  const pgPass  = process.env["PGPASSWORD"] ?? "";
  const pgDb    = process.env["PGDATABASE"] ?? "postgres";

  return { bucket, prefix, key, region, enabled, pgHost, pgPort, pgUser, pgPass, pgDb };
}

// ── Utilitários de cifra ──────────────────────────────────────────────────────
function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return pbkdf2Sync(passphrase, salt, 100_000, 32, "sha256");
}

function createEncryptStream(passphrase: string): {
  stream: PassThrough;
  salt: Buffer;
  iv: Buffer;
} {
  const salt   = randomBytes(16);
  const iv     = randomBytes(12);
  const aesKey = deriveKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", aesKey, iv);

  const out = new PassThrough();

  // Cabeçalho: [magic(4)] [salt(16)] [iv(12)]
  const magic = Buffer.from("KWBK");
  out.push(magic);
  out.push(salt);
  out.push(iv);

  cipher.on("data", (chunk: Buffer) => out.push(chunk));
  cipher.on("end", () => {
    // Auth tag (16 bytes) no final
    out.push(cipher.getAuthTag());
    out.push(null);
  });
  cipher.on("error", (err) => out.destroy(err));

  return { stream: out, salt, iv };
}

// ── pg_dump → stream ──────────────────────────────────────────────────────────
function runPgDump(config: ReturnType<typeof getConfig>): {
  stream: Readable;
  proc: ReturnType<typeof spawn>;
} {
  const proc = spawn(
    "pg_dump",
    [
      "--host",     config.pgHost,
      "--port",     config.pgPort,
      "--username", config.pgUser,
      "--dbname",   config.pgDb,
      "--format",   "custom",
      "--compress", "9",
      "--no-password",
    ],
    {
      env: { ...process.env, PGPASSWORD: config.pgPass },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  proc.stderr.on("data", (d: Buffer) => {
    logger.debug({ msg: d.toString().trim() }, "[backup] pg_dump stderr");
  });

  return { stream: proc.stdout as unknown as Readable, proc };
}

// ── Upload S3 com multipart ───────────────────────────────────────────────────
async function uploadToS3(
  stream: Readable,
  s3Client: S3Client,
  bucket: string,
  s3Key: string
): Promise<number> {
  let totalBytes = 0;

  const countingStream = new PassThrough();
  countingStream.on("data", (chunk: Buffer) => { totalBytes += chunk.length; });

  stream.pipe(countingStream);

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket:       bucket,
      Key:          s3Key,
      Body:         countingStream,
      StorageClass: "STANDARD_IA",
      Metadata: {
        backup_tool: "kiwara-backup-service",
        created_at:  new Date().toISOString(),
      },
    },
    queueSize:  4,
    partSize:   10 * 1024 * 1024, // 10 MB por part
    leavePartsOnError: false,
  });

  await upload.done();
  return totalBytes;
}

// ── Função principal de backup ────────────────────────────────────────────────
export async function runBackup(type: BackupType = "daily"): Promise<BackupRun> {
  const cfg = getConfig();

  if (!cfg.bucket || !cfg.key || cfg.key.length < 32) {
    throw new Error(
      "Configuração incompleta: BACKUP_S3_BUCKET e BACKUP_ENCRYPTION_KEY (min 32 chars) obrigatórios."
    );
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + "Z";
  const dateStr   = new Date().toISOString().slice(0, 10);
  const s3Key     = `${cfg.prefix}/${type}/${dateStr}/backup_${timestamp}.pgc.enc`;

  // Registar início na BD
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO backup_runs (status, type, s3_key) VALUES ('running', $1, $2) RETURNING id`,
    [type, s3Key]
  );
  const runId = rows[0].id;
  const startedAt = Date.now();

  logger.info({ runId, type, s3Key }, "[backup] a iniciar pg_dump...");

  const s3Client = new S3Client({
    region: cfg.region,
    credentials: {
      accessKeyId:     process.env["AWS_ACCESS_KEY_ID"] ?? "",
      secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"] ?? "",
    },
  });

  try {
    const { stream: dumpStream, proc } = runPgDump(cfg);
    const { stream: encStream } = createEncryptStream(cfg.key);

    // Pipeline: pg_dump → cifra AES-256-GCM → S3
    dumpStream.pipe(encStream as unknown as NodeJS.WritableStream);

    const sizeBytes = await uploadToS3(encStream, s3Client, cfg.bucket, s3Key);

    await new Promise<void>((resolve, reject) => {
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`pg_dump saiu com código ${code}`));
      });
    });

    const durationMs = Date.now() - startedAt;

    const { rows: updated } = await pool.query<BackupRun>(
      `UPDATE backup_runs
       SET status='success', finished_at=NOW(), size_bytes=$1, duration_ms=$2
       WHERE id=$3
       RETURNING *`,
      [sizeBytes, durationMs, runId]
    );

    logger.info(
      { runId, type, sizeBytes, durationMs, s3Key },
      "[backup] ✅ concluído com sucesso"
    );

    return updated[0];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await pool.query(
      `UPDATE backup_runs
       SET status='failed', finished_at=NOW(), error_message=$1, duration_ms=$2
       WHERE id=$3`,
      [msg, Date.now() - startedAt, runId]
    );
    logger.error({ runId, type, err: msg }, "[backup] ❌ falhou");
    throw err;
  }
}

// ── Histórico de backups ───────────────────────────────────────────────────────
export async function getBackupHistory(limit = 20): Promise<BackupRun[]> {
  const { rows } = await pool.query<BackupRun>(
    `SELECT * FROM backup_runs ORDER BY started_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

// ── Scheduler: corre via setInterval (idêntico ao padrão DD jobs) ─────────────
let _schedulerStarted = false;

function nextRunMs(targetHourUTC: number, targetMinUTC = 0): number {
  const now   = new Date();
  const next  = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
    targetHourUTC, targetMinUTC, 0, 0
  ));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

export function startBackupScheduler(): void {
  if (_schedulerStarted) return;
  _schedulerStarted = true;

  const cfg = getConfig();
  if (!cfg.enabled) {
    logger.info("[backup] scheduler DESACTIVADO (BACKUP_ENABLED != 'true').");
    return;
  }

  logger.info("[backup] scheduler ACTIVADO.");

  // ── Daily: todos os dias às 02:00 UTC ────────────────────────────────────
  function scheduleDailyBackup() {
    const delay = nextRunMs(2, 0);
    logger.info({ nextIn: Math.round(delay / 60_000) + "min" }, "[backup] próximo backup daily");
    setTimeout(async () => {
      try { await runBackup("daily"); } catch { /* já logado dentro */ }
      scheduleDailyBackup();
    }, delay);
  }

  // ── Weekly: domingos às 01:00 UTC ────────────────────────────────────────
  function scheduleWeeklyBackup() {
    const now  = new Date();
    const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
    const next = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(),
      now.getUTCDate() + daysUntilSunday,
      1, 0, 0, 0
    ));
    const delay = Math.max(0, next.getTime() - now.getTime());
    setTimeout(async () => {
      try { await runBackup("weekly"); } catch { /* já logado */ }
      scheduleWeeklyBackup();
    }, delay);
  }

  // ── Monthly: dia 1 de cada mês às 00:30 UTC ───────────────────────────────
  function scheduleMonthlyBackup() {
    const now  = new Date();
    const next = new Date(Date.UTC(
      now.getUTCMonth() === 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear(),
      (now.getUTCMonth() + 1) % 12,
      1, 0, 30, 0, 0
    ));
    const delay = Math.max(0, next.getTime() - now.getTime());
    setTimeout(async () => {
      try { await runBackup("monthly"); } catch { /* já logado */ }
      scheduleMonthlyBackup();
    }, delay);
  }

  scheduleDailyBackup();
  scheduleWeeklyBackup();
  scheduleMonthlyBackup();
}
