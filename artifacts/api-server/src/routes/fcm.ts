import { Router } from "express";
import crypto from "crypto";
import { pool } from "@workspace/db";

const router = Router();

/* ── DB Migration ── */
pool.query(`
  CREATE TABLE IF NOT EXISTS fcm_device_tokens (
    id          SERIAL PRIMARY KEY,
    school_id   INTEGER REFERENCES schools(id) ON DELETE CASCADE,
    user_type   VARCHAR(20) NOT NULL CHECK (user_type IN ('guardian','staff')),
    user_id     INTEGER NOT NULL,
    token       TEXT NOT NULL,
    platform    VARCHAR(20) DEFAULT 'web',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_type, user_id, token)
  )
`).catch(console.error);

/* ── Helpers ── */
async function getSchoolFromToken(token: string) {
  const r = await pool.query(
    `SELECT s.id, s.name FROM sessions sess
     JOIN schools s ON s.id = sess.school_id
     WHERE sess.token = $1 AND sess.expires_at > now() LIMIT 1`,
    [token]
  );
  return r.rows[0] ?? null;
}

async function getFcmConfig(): Promise<{ active_env: string; test?: any; production?: any } | null> {
  const r = await pool.query("SELECT value FROM platform_config WHERE key='fcm_config'");
  return (r.rows[0]?.value as any) ?? null;
}

/* Generate Google OAuth2 access token via JWT (no firebase-admin needed) */
async function getFcmAccessToken(creds: { project_id: string; client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss:   creds.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  })).toString("base64url");

  const signingInput = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingInput);
  const key = creds.private_key.replace(/\\n/g, "\n");
  const sig = sign.sign(key).toString("base64url");

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  `${signingInput}.${sig}`,
    }),
  });
  const data = (await r.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token)
    throw new Error(`FCM OAuth erro: ${data.error_description ?? data.error ?? "desconhecido"}`);
  return data.access_token;
}

async function sendFcmBatch(
  creds:    { project_id: string; client_email: string; private_key: string },
  tokens:   string[],
  title:    string,
  body:     string,
  extraData?: Record<string, string>
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const accessToken = await getFcmAccessToken(creds);
  const url = `https://fcm.googleapis.com/v1/projects/${creds.project_id}/messages:send`;
  let sent = 0, failed = 0;
  const errors: string[] = [];

  const BATCH = 100;
  for (let i = 0; i < tokens.length; i += BATCH) {
    await Promise.all(tokens.slice(i, i + BATCH).map(async (token) => {
      try {
        const r = await fetch(url, {
          method:  "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: { token, notification: { title, body }, data: extraData ?? {} },
          }),
        });
        if (r.ok) { sent++; } else {
          failed++;
          const d = (await r.json()) as { error?: { message?: string } };
          errors.push(d.error?.message ?? `HTTP ${r.status}`);
        }
      } catch (e: any) {
        failed++;
        errors.push(e.message);
      }
    }));
  }
  return { sent, failed, errors: errors.slice(0, 10) };
}

/* ──────────────────────────────────────────────────────────────────
   POST /api/fcm/register-token  — guardian or staff registers token
────────────────────────────────────────────────────────────────── */
router.post("/fcm/register-token", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autorizado." });
    const bearerToken = auth.slice(7);
    const { fcm_token, platform = "web" } = req.body;
    if (!fcm_token?.trim()) return res.status(400).json({ error: "fcm_token é obrigatório." });

    // Try guardian session
    const gRes = await pool.query(
      `SELECT e.id, s.id AS school_id
       FROM guardian_sessions gs
       JOIN encarregados e ON e.id = gs.encarregado_id
       JOIN encarregado_aluno ea ON ea.encarregado_id = e.id
       JOIN students st ON st.id = ea.aluno_id
       JOIN schools s ON s.id = st.school_id
       WHERE gs.token = $1 AND gs.expires_at > NOW() LIMIT 1`,
      [bearerToken]
    );
    if (gRes.rows.length) {
      const { id, school_id } = gRes.rows[0];
      await pool.query(
        `INSERT INTO fcm_device_tokens (school_id,user_type,user_id,token,platform,updated_at)
         VALUES ($1,'guardian',$2,$3,$4,NOW())
         ON CONFLICT (user_type,user_id,token) DO UPDATE SET updated_at=NOW()`,
        [school_id, id, fcm_token.trim(), platform]
      );
      return res.json({ ok: true });
    }

    // Try staff session
    const sRes = await pool.query(
      `SELECT sm.id, sm.school_id
       FROM staff_sessions ss
       JOIN school_members sm ON sm.id = ss.member_id
       WHERE ss.token = $1 AND ss.expires_at > NOW() LIMIT 1`,
      [bearerToken]
    );
    if (sRes.rows.length) {
      const { id, school_id } = sRes.rows[0];
      await pool.query(
        `INSERT INTO fcm_device_tokens (school_id,user_type,user_id,token,platform,updated_at)
         VALUES ($1,'staff',$2,$3,$4,NOW())
         ON CONFLICT (user_type,user_id,token) DO UPDATE SET updated_at=NOW()`,
        [school_id, id, fcm_token.trim(), platform]
      );
      return res.json({ ok: true });
    }

    return res.status(401).json({ error: "Sessão inválida." });
  } catch (e: any) {
    console.error("[fcm/register-token]", e);
    return res.status(500).json({ error: "Erro interno." });
  }
});

/* ──────────────────────────────────────────────────────────────────
   GET /api/school/comunicar/fcm-stats  — device token stats
────────────────────────────────────────────────────────────────── */
router.get("/school/comunicar/fcm-stats", async (req: any, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autorizado." });
    const school = await getSchoolFromToken(auth.slice(7));
    if (!school) return res.status(401).json({ error: "Sessão inválida." });

    const r = await pool.query(
      `SELECT user_type, COUNT(*) AS total
       FROM fcm_device_tokens WHERE school_id = $1 GROUP BY user_type`,
      [school.id]
    );
    const stats: Record<string, number> = {};
    for (const row of r.rows) stats[row.user_type] = Number(row.total);
    return res.json({
      guardians: stats.guardian ?? 0,
      staff: stats.staff ?? 0,
      total: (stats.guardian ?? 0) + (stats.staff ?? 0),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro interno." });
  }
});

/* ──────────────────────────────────────────────────────────────────
   POST /api/school/comunicar/push  — send push to audience
────────────────────────────────────────────────────────────────── */
router.post("/school/comunicar/push", async (req: any, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autorizado." });
    const school = await getSchoolFromToken(auth.slice(7));
    if (!school) return res.status(401).json({ error: "Sessão inválida." });

    const { titulo, mensagem, audiencia = "todos", turma_id } = req.body;
    if (!titulo?.trim() || !mensagem?.trim())
      return res.status(400).json({ error: "Título e mensagem são obrigatórios." });

    const config = await getFcmConfig();
    if (!config) return res.status(400).json({ error: "Firebase Cloud Messaging não está configurado. Contacte o administrador da plataforma." });

    const activeEnv: "test" | "production" = (config.active_env as "test" | "production") ?? "test";
    const creds = config[activeEnv];
    if (!creds?.project_id || !creds?.client_email || !creds?.private_key)
      return res.status(400).json({ error: `Credenciais FCM do ambiente '${activeEnv}' estão incompletas. Contacte o administrador.` });

    // Build token query based on audience
    let tokensQ: string;
    let params: any[];
    if (audiencia === "encarregados") {
      tokensQ = `SELECT DISTINCT token FROM fcm_device_tokens WHERE school_id=$1 AND user_type='guardian'`;
      params = [school.id];
    } else if (audiencia === "professores") {
      tokensQ = `SELECT DISTINCT token FROM fcm_device_tokens WHERE school_id=$1 AND user_type='staff'`;
      params = [school.id];
    } else if (audiencia === "turma" && turma_id) {
      tokensQ = `
        SELECT DISTINCT t.token FROM fcm_device_tokens t
        JOIN encarregado_aluno ea ON ea.encarregado_id = t.user_id AND t.user_type='guardian'
        JOIN students s ON s.id = ea.aluno_id
        WHERE t.school_id=$1 AND s.turma_id=$2`;
      params = [school.id, turma_id];
    } else {
      tokensQ = `SELECT DISTINCT token FROM fcm_device_tokens WHERE school_id=$1`;
      params = [school.id];
    }

    const tokensRes = await pool.query(tokensQ, params);
    const tokens = tokensRes.rows.map((r: any) => r.token as string);

    if (tokens.length === 0)
      return res.json({ ok: true, sent: 0, failed: 0, total_devices: 0, message: "Nenhum dispositivo registado para a audiência seleccionada." });

    const result = await sendFcmBatch(creds, tokens, titulo.trim(), mensagem.trim(), { escola: school.name, tipo: "comunicado" });
    return res.json({ ok: true, ...result, environment: activeEnv, total_devices: tokens.length });
  } catch (e: any) {
    console.error("[school/push]", e);
    return res.status(500).json({ error: e.message ?? "Erro ao enviar notificações." });
  }
});

export default router;
export { getFcmAccessToken, sendFcmBatch, getFcmConfig };
