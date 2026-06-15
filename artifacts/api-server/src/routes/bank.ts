/**
 * bank.ts — Integração Bancária Bilateral
 *
 * Dois modos de conciliação:
 *   FILE — Leitura periódica de extratos via SFTP
 *   SPTR — Webhooks em tempo real (Sistema de Pagamentos em Tempo Real)
 *
 * Tabela: bank_integration_configs
 * Credenciais cifradas com AES-256-GCM via lib/crypto.ts
 */

import { Router }    from "express";
import { z }         from "zod";
import multer        from "multer";
import { pool }      from "@workspace/db";
import { encryptAES, decryptAES, safeEqual } from "../lib/crypto";

const router = Router();

/* ─── Multer (memória — max 5 MB) ─────────────────────────────────────────── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = "." + (file.originalname.split(".").pop() ?? "").toLowerCase();
    const allowed = [".txt", ".csv", ".mt940", ".sta", ".camt", ".xml"];
    cb(null, allowed.includes(ext) || (file.mimetype?.startsWith("text/") ?? false));
  },
});

/* ─── Middleware adminAuth inline (mesma lógica de admin.ts) ──────────────── */
async function adminAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Token de administrador em falta." });
  try {
    const { rows } = await pool.query(
      `SELECT id FROM admin_sessions WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );
    if (!rows.length) return res.status(401).json({ error: "Sessão inválida ou expirada." });
    next();
  } catch (e) {
    console.error("[adminAuth]", e);
    res.status(500).json({ error: "Erro ao verificar sessão." });
  }
}

/* ─── Zod Schemas ─────────────────────────────────────────────────────────── */

const FileCredSchema = z.object({
  sftp_host:     z.string().min(1),
  sftp_port:     z.coerce.number().int().min(1).max(65535).default(22),
  sftp_user:     z.string().min(1),
  sftp_password: z.string().min(1),
  sftp_path:     z.string().default("/"),
  file_format:   z.enum(["TXT_PADRAO", "MT940", "CSV", "CAMT053"]).default("TXT_PADRAO"),
  sync_interval: z.enum(["hourly", "daily", "manual"]).default("daily"),
});

const SptrCredSchema = z.object({
  client_id:         z.string().min(1),
  client_secret:     z.string().min(1),
  sptr_endpoint_url: z.string().url(),
  webhook_token:     z.string().min(16),
  cert_pem:          z.string().optional(),
});

const SaveBankConfigSchema = z.object({
  bank_code:        z.enum(["BFA", "BAI", "BIC", "BDA", "ATL", "SOL", "OUTRO"]),
  integration_mode: z.enum(["FILE", "SPTR"]),
  is_active:        z.boolean().default(false),
  credentials:      z.record(z.unknown()),
});

/* ─── Migration ───────────────────────────────────────────────────────────── */

export async function runBankMigration(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bank_integration_configs (
      id                  SERIAL PRIMARY KEY,
      school_id           INTEGER NOT NULL,
      bank_code           VARCHAR(10) NOT NULL,
      integration_mode    VARCHAR(10) NOT NULL DEFAULT 'FILE'
                          CHECK (integration_mode IN ('FILE', 'SPTR')),
      credentials_iv      TEXT,
      credentials_tag     TEXT,
      credentials_ct      TEXT,
      webhook_token_hash  TEXT,
      is_active           BOOLEAN NOT NULL DEFAULT FALSE,
      last_sync_at        TIMESTAMPTZ,
      criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actualizado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT bank_configs_school_bank_uq UNIQUE (school_id, bank_code)
    )
  `);
  console.log("[bank migration] bank_integration_configs OK");
}

/* ─── GET /admin/colegios/:id/bank-config ─────────────────────────────────── */

router.get("/admin/colegios/:id/bank-config", adminAuth, async (req, res) => {
  try {
    const schoolId = Number(req.params.id);
    if (!schoolId || schoolId < 1) return res.status(400).json({ error: "school_id inválido." });

    const { rows } = await pool.query(
      `SELECT id, school_id, bank_code, integration_mode, is_active, last_sync_at,
              credentials_iv, credentials_tag, credentials_ct
       FROM bank_integration_configs WHERE school_id = $1 ORDER BY criado_em ASC`,
      [schoolId]
    );

    const configs = rows.map(row => {
      let credentials: Record<string, unknown> = {};
      if (row.credentials_iv && row.credentials_tag && row.credentials_ct) {
        try {
          const plain = decryptAES({
            iv: row.credentials_iv, tag: row.credentials_tag, ciphertext: row.credentials_ct,
          });
          const parsed = JSON.parse(plain);
          const masked: Record<string, unknown> = { ...parsed };
          for (const k of ["sftp_password", "client_secret", "cert_pem", "webhook_token"]) {
            if (masked[k]) masked[k] = "••••••••";
          }
          credentials = masked;
        } catch { credentials = {}; }
      }
      return {
        id: row.id,
        school_id: row.school_id,
        bank_code: row.bank_code,
        integration_mode: row.integration_mode,
        is_active: row.is_active,
        last_sync_at: row.last_sync_at,
        credentials,
      };
    });

    res.json({ configs });
  } catch (e) {
    console.error("[bank-config GET]", e);
    res.status(500).json({ error: "Erro ao carregar configuração bancária." });
  }
});

/* ─── PUT /admin/colegios/:id/bank-config ─────────────────────────────────── */

router.put("/admin/colegios/:id/bank-config", adminAuth, async (req, res) => {
  try {
    const schoolId = Number(req.params.id);
    if (!schoolId || schoolId < 1) return res.status(400).json({ error: "school_id inválido." });

    const parsed = SaveBankConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos.", detalhes: parsed.error.flatten().fieldErrors });
    }
    const { bank_code, integration_mode, is_active, credentials } = parsed.data;

    const credSchema = integration_mode === "FILE" ? FileCredSchema : SptrCredSchema;
    const credParsed = credSchema.safeParse(credentials);
    if (!credParsed.success) {
      return res.status(400).json({ error: "Credenciais inválidas.", detalhes: credParsed.error.flatten().fieldErrors });
    }

    const credJson = JSON.stringify(credParsed.data);
    const encrypted = encryptAES(credJson);

    let webhookTokenHash: string | null = null;
    if (integration_mode === "SPTR") {
      const { createHash } = await import("node:crypto");
      webhookTokenHash = createHash("sha256")
        .update((credParsed.data as z.infer<typeof SptrCredSchema>).webhook_token)
        .digest("hex");
    }

    const { rows } = await pool.query(
      `INSERT INTO bank_integration_configs
         (school_id, bank_code, integration_mode,
          credentials_iv, credentials_tag, credentials_ct,
          webhook_token_hash, is_active, actualizado_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (school_id, bank_code) DO UPDATE SET
         integration_mode   = EXCLUDED.integration_mode,
         credentials_iv     = EXCLUDED.credentials_iv,
         credentials_tag    = EXCLUDED.credentials_tag,
         credentials_ct     = EXCLUDED.credentials_ct,
         webhook_token_hash = EXCLUDED.webhook_token_hash,
         is_active          = EXCLUDED.is_active,
         actualizado_em     = NOW()
       RETURNING id, bank_code, integration_mode, is_active, actualizado_em`,
      [schoolId, bank_code, integration_mode,
       encrypted.iv, encrypted.tag, encrypted.ciphertext,
       webhookTokenHash, is_active]
    );

    res.json({ success: true, config: rows[0] });
  } catch (e) {
    console.error("[bank-config PUT]", e);
    res.status(500).json({ error: "Erro ao guardar configuração bancária." });
  }
});

/* ─── POST /admin/colegios/:id/bank/test-connection ──────────────────────── */

router.post("/admin/colegios/:id/bank/test-connection", adminAuth, async (req, res) => {
  try {
    const schoolId = Number(req.params.id);
    const { bank_code } = req.body;
    if (!schoolId || !bank_code) {
      return res.status(400).json({ error: "school_id e bank_code são obrigatórios." });
    }

    const { rows } = await pool.query(
      `SELECT integration_mode, credentials_iv, credentials_tag, credentials_ct
       FROM bank_integration_configs WHERE school_id=$1 AND bank_code=$2`,
      [schoolId, bank_code]
    );
    if (!rows.length) return res.status(404).json({ error: "Configuração não encontrada. Guarde primeiro as credenciais." });

    const row = rows[0];
    if (!row.credentials_iv) return res.status(400).json({ error: "Sem credenciais guardadas para testar." });

    const plain = decryptAES({ iv: row.credentials_iv, tag: row.credentials_tag, ciphertext: row.credentials_ct });
    const creds = JSON.parse(plain);
    const started = Date.now();

    if (row.integration_mode === "FILE") {
      /* FILE — resolver DNS + TCP connect ao SFTP */
      const { Resolver } = await import("node:dns/promises");
      const { createConnection } = await import("node:net");
      const host = creds.sftp_host as string;
      const port = Number(creds.sftp_port) || 22;

      const resolver = new Resolver();
      try {
        await resolver.resolve4(host);
      } catch {
        try {
          await resolver.resolve6(host);
        } catch {
          return res.status(502).json({
            success: false,
            erro: `Hostname '${host}' não foi resolvido — verifique sftp_host.`,
            latencia_ms: Date.now() - started,
          });
        }
      }

      await new Promise<void>((resolve, reject) => {
        const socket = createConnection({ host, port, timeout: 6000 }, () => {
          socket.destroy(); resolve();
        });
        socket.on("error", reject);
        socket.on("timeout", () => { socket.destroy(); reject(new Error("TCP timeout após 6s")); });
      });

      return res.json({
        success: true,
        mensagem: `Ligação SFTP a ${host}:${port} estabelecida com sucesso.`,
        host, port,
        latencia_ms: Date.now() - started,
      });

    } else {
      /* SPTR — HTTP GET ping com timeout */
      const url = creds.sptr_endpoint_url as string;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

      try {
        const r = await fetch(url, {
          method: "GET",
          signal: controller.signal,
          headers: { "User-Agent": "PropinaPlus-BankPing/1.0" },
        });
        clearTimeout(timer);
        return res.json({
          success: r.ok || r.status < 500,
          mensagem: `Endpoint SPTR respondeu com HTTP ${r.status}.`,
          http_status: r.status,
          url,
          latencia_ms: Date.now() - started,
        });
      } catch (err: any) {
        clearTimeout(timer);
        const isAbort = err.name === "AbortError";
        return res.status(502).json({
          success: false,
          erro: isAbort
            ? `Timeout de 8s — endpoint SPTR não respondeu: ${url}`
            : `Falha de rede: ${err.message}`,
          latencia_ms: Date.now() - started,
        });
      }
    }
  } catch (e: any) {
    if (e?.code === "ECONNREFUSED" || e?.code === "ETIMEDOUT" || e?.message?.includes("timeout")) {
      return res.status(502).json({
        success: false,
        erro: `Falha TCP: ${e.message} — verifique sftp_host e sftp_port.`,
      });
    }
    console.error("[bank/test-connection]", e);
    res.status(500).json({ error: "Erro interno ao testar ligação." });
  }
});

/* ─── POST /bank/sptr-callback (Webhook → Tempo Real) ────────────────────── */
/* Sem adminAuth — autenticado via X-Webhook-Token (SHA-256 do token em config) */

router.post("/bank/sptr-callback", async (req, res) => {
  try {
    const token    = req.headers["x-webhook-token"]  as string | undefined;
    const schoolId = req.headers["x-school-id"]      as string | undefined;
    const bankCode = req.headers["x-bank-code"]      as string | undefined;

    if (!token || !schoolId || !bankCode) {
      return res.status(401).json({ error: "Cabeçalhos obrigatórios em falta: X-Webhook-Token, X-School-Id, X-Bank-Code." });
    }

    const { rows } = await pool.query(
      `SELECT id, webhook_token_hash
       FROM bank_integration_configs
       WHERE school_id=$1 AND bank_code=$2 AND is_active=TRUE AND integration_mode='SPTR'`,
      [Number(schoolId), bankCode]
    );
    if (!rows.length) return res.status(403).json({ error: "Integração SPTR não encontrada ou inactiva." });

    const { createHash } = await import("node:crypto");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    if (!safeEqual(tokenHash, rows[0].webhook_token_hash)) {
      return res.status(403).json({ error: "Token inválido." });
    }

    const configId = rows[0].id as number;
    const payload  = req.body ?? {};

    await pool.query(
      `UPDATE bank_integration_configs SET last_sync_at=NOW() WHERE id=$1`,
      [configId]
    );

    /* Tentar reconciliar propina por referência de pagamento */
    const reference = String(payload?.reference ?? payload?.referencia ?? payload?.ref ?? "").trim();
    let reconciled = false;

    if (reference) {
      const { rows: propRows } = await pool.query(
        `SELECT id, montante FROM propinas
         WHERE referencia_pagamento=$1 AND school_id=$2 AND status='pendente' LIMIT 1`,
        [reference, Number(schoolId)]
      );
      if (propRows.length) {
        const amount = Number(payload?.amount ?? payload?.montante ?? 0);
        if (amount >= Number(propRows[0].montante)) {
          await pool.query(
            `UPDATE propinas SET status='pago', data_pagamento=NOW(), updated_at=NOW() WHERE id=$1`,
            [propRows[0].id]
          );
          reconciled = true;
        }
      }
    }

    res.json({ received: true, reconciled, timestamp: new Date().toISOString() });
  } catch (e) {
    console.error("[bank/sptr-callback]", e);
    res.status(500).json({ error: "Erro ao processar callback SPTR." });
  }
});

/* ─── POST /admin/bank/upload-statement ──────────────────────────────────── */

router.post(
  "/admin/bank/upload-statement",
  adminAuth,
  upload.single("statement_file"),
  async (req, res) => {
    try {
      const schoolId  = Number(req.body.school_id);
      const bankCode  = req.body.bank_code  as string | undefined;
      const fileFormat = (req.body.file_format as string | undefined) ?? "AUTO";

      if (!schoolId || !bankCode) {
        return res.status(400).json({ error: "school_id e bank_code são obrigatórios." });
      }
      if (!req.file) {
        return res.status(400).json({ error: "Ficheiro não recebido (campo: statement_file)." });
      }

      const content = req.file.buffer.toString("utf8");

      type Tx = { reference: string; amount: number; date: string };
      const transactions: Tx[] = [];

      if (fileFormat === "MT940" || content.includes(":61:")) {
        /* MT940 — extrair linhas :61: */
        const re = /:61:(\d{6})\w?([DC])(\d+),(\d{0,2})(?:N[A-Z]{3})?([^\r\n]*)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(content)) !== null) {
          const [, ds, dc, intP, decP, desc] = m;
          const amount = Number(`${intP}.${decP || "00"}`);
          transactions.push({
            reference: desc.trim().slice(0, 50),
            amount:    dc === "C" ? amount : -amount,
            date:      `20${ds.slice(0,2)}-${ds.slice(2,4)}-${ds.slice(4,6)}`,
          });
        }
      } else {
        /* CSV / TXT genérico */
        const lines = content.split(/\r?\n/).filter(l => l.trim() && !l.startsWith("#"));
        for (const line of lines) {
          const parts = line.split(/[,;\t|]/);
          if (parts.length < 2) continue;
          const rawAmount = parts.find(p => /^\d[\d.,]*$/.test(p.trim()));
          const amount = rawAmount ? parseFloat(rawAmount.replace(",", ".")) : 0;
          const reference = parts.find(p => p.trim().length >= 4 && !/^\d[\d.,]*$/.test(p.trim()))?.trim() ?? "";
          if (amount > 0 && reference) {
            transactions.push({ reference, amount, date: new Date().toISOString().slice(0, 10) });
          }
        }
      }

      let matched = 0;
      let unmatched = 0;

      for (const tx of transactions) {
        if (tx.amount <= 0) continue;
        const { rows } = await pool.query(
          `SELECT id, montante FROM propinas
           WHERE school_id=$1 AND referencia_pagamento=$2 AND status='pendente' LIMIT 1`,
          [schoolId, tx.reference]
        );
        if (rows.length && Number(rows[0].montante) <= tx.amount) {
          await pool.query(
            `UPDATE propinas SET status='pago', data_pagamento=NOW(), updated_at=NOW() WHERE id=$1`,
            [rows[0].id]
          );
          matched++;
        } else {
          unmatched++;
        }
      }

      await pool.query(
        `UPDATE bank_integration_configs SET last_sync_at=NOW()
         WHERE school_id=$1 AND bank_code=$2`,
        [schoolId, bankCode]
      );

      res.json({
        success: true,
        ficheiro: req.file.originalname,
        tamanho_bytes: req.file.size,
        transacoes_detectadas: transactions.length,
        reconciliadas: matched,
        nao_encontradas: unmatched,
        processado_em: new Date().toISOString(),
      });
    } catch (e) {
      console.error("[bank/upload-statement]", e);
      res.status(500).json({ error: "Erro ao processar extrato bancário." });
    }
  }
);

export default router;
