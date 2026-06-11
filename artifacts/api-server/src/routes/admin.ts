import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes } from "crypto";
import { toError } from "../lib/errors";
import { lookup as dnsLookup } from "node:dns/promises";
import { pool } from "@workspace/db";
import { sendBulkSMS } from "../services/sms.service";
import { sendSchoolEmail } from "../services/email.service";
import multer from "multer";
import path from "path";
import fs from "fs";
import { loginRateLimiter } from "../lib/rate-limiters";
import { encodeSecret, decodeSecret } from "../lib/crypto.js";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

const router = Router();

const ADMIN_USER = process.env.ADMIN_USERNAME;
const ADMIN_PASS = process.env.ADMIN_PASSWORD;
if (!ADMIN_USER || !ADMIN_PASS) {
  throw new Error("[SECURITY] ADMIN_USERNAME e ADMIN_PASSWORD devem estar definidos nas variáveis de ambiente. Arranque abortado.");
}

/* ─── Auth helpers ─── */
export async function adminAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado." });
  const token = header.slice(7);
  const r = await pool.query(
    "SELECT id FROM admin_sessions WHERE token=$1 AND expires_at > NOW()",
    [token]
  );
  if (!r.rows.length) return res.status(401).json({ error: "Sessão inválida." });
  next();
}

/* ─── POST /admin/login ─── */
router.post("/admin/login", loginRateLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ error: "Credenciais incorretas." });
  }
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8h session
  await pool.query(
    "INSERT INTO admin_sessions (token, expires_at) VALUES ($1, $2)",
    [token, expiresAt]
  );
  return res.json({ token, username: ADMIN_USER });
});

/* ─── GET /admin/stats ─── */
router.get("/admin/stats", adminAuth, async (_req, res) => {
  const r = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM schools)          AS total_colegios,
      (SELECT COUNT(*) FROM students)         AS total_alunos,
      (SELECT COUNT(*) FROM propinas)         AS total_propinas,
      (SELECT COUNT(*) FROM propinas WHERE status='pago') AS propinas_pagas,
      (SELECT COUNT(*) FROM propinas WHERE status='vencido') AS propinas_vencidas,
      (SELECT COALESCE(SUM(montante+multa) FILTER (WHERE status != 'pago'), 0) FROM propinas) AS divida_total,
      (SELECT COUNT(*) FROM encarregados)     AS total_encarregados,
      (SELECT COUNT(*) FROM turmas)           AS total_turmas
  `);
  res.json(r.rows[0]);
});

/* ─── GET /admin/colegios ─── */
router.get("/admin/colegios", adminAuth, async (_req, res) => {
  const r = await pool.query(`
    SELECT s.id, s.school_id, s.name, s.nif, s.phone, s.email, s.iban, s.created_at,
           s.institution_type, s.portal_nomenclatura,
           COUNT(DISTINCT st.id)::int AS total_alunos,
           COUNT(DISTINCT t.id)::int  AS total_turmas
    FROM schools s
    LEFT JOIN students st ON st.school_id = s.id
    LEFT JOIN turmas t    ON t.school_id  = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `);
  res.json(r.rows);
});

/* ─── POST /admin/colegios — create school ─── */
router.post("/admin/colegios", adminAuth, async (req, res) => {
  const { name, nif, phone, email, password, iban, usa_pacotes, commission_rate, settings,
          institution_type, portal_nomenclatura } = req.body;
  if (!name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: "Nome e email são obrigatórios." });
  }

  // 🔒 SEGURANÇA: password obrigatória — sem credencial default hardcoded (A3); bcrypt cost 12
  if (!password?.trim() || password.length < 8) {
    return res.status(400).json({ error: "Password é obrigatória e deve ter pelo menos 8 caracteres." });
  }
  const { default: bcrypt } = await import("bcryptjs");
  const hash = await bcrypt.hash(password, 12);
  const schoolId = `SCH-${Date.now()}`;

  const instType = institution_type || "colegio_geral";
  const portalNom = portal_nomenclatura || (
    ["universidade","centro_formacao","politecnico"].includes(instType) ? "aluno" : "encarregado"
  );

  const r = await pool.query(
    `INSERT INTO schools (school_id, name, nif, phone, email, password_hash, iban, usa_pacotes, commission_rate, institution_type, portal_nomenclatura)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, school_id, name, nif, phone, email, iban, usa_pacotes, commission_rate, institution_type, portal_nomenclatura, created_at`,
    [schoolId, name.trim(), nif?.trim() || "", phone?.trim() || "", email.trim(), hash, iban?.trim() || null, !!usa_pacotes, Number(commission_rate ?? 0), instType, portalNom]
  );
  const school = r.rows[0];

  // Save initial settings if provided
  if (settings && typeof settings === "object") {
    function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
      const out: Record<string, unknown> = { ...target };
      for (const key of Object.keys(source ?? {})) {
        if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key]))
          out[key] = deepMerge((target[key] ?? {}) as Record<string, unknown>, source[key] as Record<string, unknown>);
        else out[key] = source[key];
      }
      return out;
    }
    const merged = deepMerge(DEFAULT_SETTINGS, settings);
    await pool.query(
      `INSERT INTO school_settings (school_id, settings, updated_by)
       VALUES ($1,$2,'admin')
       ON CONFLICT (school_id) DO UPDATE SET settings=$2, updated_at=NOW(), updated_by='admin'`,
      [school.id, JSON.stringify(merged)]
    );
  }

  res.status(201).json(school);
});

/* ─── GET /admin/colegios/:id ─── */
router.get("/admin/colegios/:id", adminAuth, async (req, res) => {
  const r = await pool.query(
    // 🔒 SEGURANÇA: SELECT s.* excluído — campo password_hash removido da resposta (CWE-200)
    `SELECT s.id, s.school_id, s.name, s.nif, s.phone, s.email, s.iban,
            s.created_at, s.institution_type, s.portal_nomenclatura,
            s.usa_pacotes, s.commission_rate, s.logo_url, s.modulo_infantil,
            COUNT(DISTINCT st.id)::int AS total_alunos,
            COUNT(DISTINCT t.id)::int  AS total_turmas
     FROM schools s
     LEFT JOIN students st ON st.school_id = s.id
     LEFT JOIN turmas t    ON t.school_id  = s.id
     WHERE s.id=$1
     GROUP BY s.id, s.school_id, s.name, s.nif, s.phone, s.email, s.iban,
              s.created_at, s.institution_type, s.portal_nomenclatura,
              s.usa_pacotes, s.commission_rate, s.logo_url, s.modulo_infantil`,
    [req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Colégio não encontrado." });

  const [turmas, emolumentos, mregra, pacotes] = await Promise.all([
    pool.query("SELECT * FROM turmas WHERE school_id=$1 ORDER BY nome", [req.params.id]),
    pool.query("SELECT * FROM emolumentos WHERE school_id=$1 ORDER BY tipo, ano_lectivo", [req.params.id]),
    pool.query("SELECT * FROM multa_regras WHERE school_id=$1", [req.params.id]),
    pool.query("SELECT * FROM pacotes_emolumentos WHERE school_id=$1 ORDER BY nome", [req.params.id]),
  ]);
  res.json({
    ...r.rows[0],
    turmas: turmas.rows,
    emolumentos: emolumentos.rows,
    multa_regra: mregra.rows[0] ?? null,
    pacotes: pacotes.rows,
  });
});

/* ─── PUT /admin/colegios/:id — edit basic school info ─── */
router.put("/admin/colegios/:id", adminAuth, async (req, res) => {
  const { name, nif, phone, email, commission_rate, institution_type, portal_nomenclatura } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Nome é obrigatório." });

  const instType = institution_type || "colegio_geral";
  const portalNom = portal_nomenclatura || (
    ["universidade","centro_formacao","politecnico"].includes(instType) ? "aluno" : "encarregado"
  );

  const r = await pool.query(
    `UPDATE schools
     SET name=$1, nif=$2, phone=$3, email=$4, commission_rate=$5, institution_type=$6, portal_nomenclatura=$7
     WHERE id=$8
     RETURNING id, school_id, name, nif, phone, email, iban, commission_rate, usa_pacotes, institution_type, portal_nomenclatura, created_at`,
    [name.trim(), nif?.trim() ?? "", phone?.trim() ?? "", email?.trim(), Number(commission_rate ?? 0), instType, portalNom, req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Colégio não encontrado." });
  res.json({ ok: true, school: r.rows[0] });
});

/* ─── PUT /admin/colegios/:id/reset-password — reset school password ─── */
router.put("/admin/colegios/:id/reset-password", adminAuth, async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) return res.status(400).json({ error: "Palavra-passe deve ter pelo menos 6 caracteres." });
  const { default: bcrypt } = await import("bcryptjs");
  const hash = await bcrypt.hash(new_password, 12);
  await pool.query("UPDATE schools SET password_hash=$1 WHERE id=$2", [hash, req.params.id]);
  res.json({ ok: true });
});

/* ─── PUT /admin/colegios/:id/modulo-infantil — toggle infant module ─── */
router.put("/admin/colegios/:id/modulo-infantil", adminAuth, async (req, res) => {
  const { modulo_infantil } = req.body;
  await pool.query("UPDATE schools SET modulo_infantil=$1 WHERE id=$2", [!!modulo_infantil, req.params.id]);
  res.json({ ok: true, modulo_infantil: !!modulo_infantil });
});

/* ─── PUT /admin/colegios/:id/configuracao — update school settings ─── */
router.put("/admin/colegios/:id/configuracao", adminAuth, async (req, res) => {
  const { usa_pacotes } = req.body;
  await pool.query(
    "UPDATE schools SET usa_pacotes=$1 WHERE id=$2",
    [!!usa_pacotes, req.params.id]
  );
  res.json({ ok: true, usa_pacotes: !!usa_pacotes });
});

/* ─────────────────────────────────────────────────────────────────
   SCHOOL SETTINGS — motor de regras configurável por tenant
───────────────────────────────────────────────────────────────────── */

const DEFAULT_SETTINGS = {
  financeiro: {
    propinas: {
      frequencia: "mensal",
      vencimento_dia: 15,
      permite_pagamento_parcial: false,
      valor_padrao: 0,
    },
    multas: {
      tipo: "percentagem",
      valor: 5,
      tolerancia_dias: 5,
      progressiva: false,
      limite_percentagem: 20,
      aplica_automatico: true,
    },
    emolumentos: {
      obrigatorios: false,
      tipos: ["Seguro Escolar", "Exame", "Material Didático"],
    },
    split_payment: {
      activo: false,
      comissao_percentagem: 0,
      conta_destino_escola: "",
      conta_destino_plataforma: "",
    },
  },
  pagamento: {
    middleware_url: "",
    middleware_api_key: "",
    referencia_prefixo: "",
    reconciliacao_tolerancia_percentagem: 1,
    reconciliacao_automatica: true,
    metodos_aceites: ["MCX_EXPRESS", "MULTICAIXA", "NUMERARIO", "TRANSFERENCIA"],
    metodos_pagamento: {
      allow_reference: true,
      allow_gpo_mcx: false,
      allow_direct_debit: false,
    },
    direct_debit: {
      banco_parceiro: "",
      instrucoes: "",
    },
  },
  academico: {
    limite_alunos_por_turma: 40,
    permite_matricula_online: false,
    nomenclatura_turma: "Turma",
    anos_lectivos: ["2025/2026", "2026/2027"],
    numero_processo_prefixo: "",
  },
  encarregados: {
    maximo_por_aluno: 2,
    comunicacao_activa: true,
    campos_obrigatorios: ["nome", "telefone", "bi"],
    permite_portal_encarregado: true,
  },
  comunicacao: {
    sms_activo: false,
    email_activo: false,
    whatsapp_activo: false,
    sms_provider: "",
    email_sender: "",
    eventos: {
      nova_fatura: true,
      atraso_pagamento: true,
      pagamento_confirmado: true,
      nova_ocorrencia: true,
    },
  },
  dashboard: {
    mostrar_graficos: true,
    exportacao_activa: true,
    metricas_publicas: false,
    periodo_relatorio_dias: 30,
  },
  permissoes: {
    admin:      { pode_editar_propinas: true,  pode_deletar_alunos: true,  pode_ver_financeiro: true },
    financeiro: { pode_editar_propinas: true,  pode_deletar_alunos: false, pode_ver_financeiro: true },
    operador:   { pode_editar_propinas: false, pode_deletar_alunos: false, pode_ver_financeiro: false },
  },
  tecnico: {
    timezone: "Africa/Luanda",
    moeda: "AOA",
    logs_activos: true,
    manutencao_activa: false,
  },
};

/* Deep merge: right overrides left, recursively for objects */
function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override ?? {})) {
    if (override[key] !== null && typeof override[key] === "object" && !Array.isArray(override[key])
        && base[key] !== null && typeof base[key] === "object" && !Array.isArray(base[key])) {
      result[key] = deepMerge(base[key] as Record<string, unknown>, override[key] as Record<string, unknown>);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

/* ─── GET /admin/colegios/:id/settings ─── */
router.get("/admin/colegios/:id/settings", adminAuth, async (req, res) => {
  const schoolId = Number(req.params.id);

  /* Upsert default settings on first access */
  await pool.query(`
    INSERT INTO school_settings (school_id, settings)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (school_id) DO NOTHING
  `, [schoolId, JSON.stringify(DEFAULT_SETTINGS)]);

  const r = await pool.query(
    "SELECT settings, updated_at, updated_by FROM school_settings WHERE school_id = $1",
    [schoolId]
  );

  const stored = r.rows[0]?.settings ?? {};
  const merged = deepMerge(DEFAULT_SETTINGS, stored);

  res.json({
    settings: merged,
    updated_at: r.rows[0]?.updated_at ?? null,
    updated_by: r.rows[0]?.updated_by ?? null,
  });
});

/* ─── PUT /admin/colegios/:id/settings ─── */
router.put("/admin/colegios/:id/settings", adminAuth, async (req, res) => {
  const schoolId = Number(req.params.id);
  const incoming = req.body?.settings;

  if (!incoming || typeof incoming !== "object") {
    return res.status(400).json({ error: "Campo 'settings' (objeto) obrigatório." });
  }

  /* Get existing to deep-merge */
  const existing = await pool.query(
    "SELECT settings FROM school_settings WHERE school_id = $1",
    [schoolId]
  );
  const base = deepMerge(DEFAULT_SETTINGS, existing.rows[0]?.settings ?? {});
  const merged = deepMerge(base, incoming);

  await pool.query(`
    INSERT INTO school_settings (school_id, settings, updated_at, updated_by)
    VALUES ($1, $2::jsonb, NOW(), 'admin')
    ON CONFLICT (school_id) DO UPDATE
    SET settings = $2::jsonb, updated_at = NOW(), updated_by = 'admin'
  `, [schoolId, JSON.stringify(merged)]);

  res.json({ ok: true, settings: merged });
});

/* ─── Payment Method Audit Log migration ─── */
pool.query(`
  CREATE TABLE IF NOT EXISTS payment_method_audit_log (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    changed_by TEXT NOT NULL DEFAULT 'superadmin',
    changes JSONB NOT NULL,
    previous_state JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );
`).catch(() => {});

/* ─── GET /admin/colegios/:id/payment-methods ─── */
router.get("/admin/colegios/:id/payment-methods", adminAuth, async (req, res) => {
  const schoolId = Number(req.params.id);

  await pool.query(`
    INSERT INTO school_settings (school_id, settings)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (school_id) DO NOTHING
  `, [schoolId, JSON.stringify(DEFAULT_SETTINGS)]);

  const r = await pool.query(
    "SELECT settings FROM school_settings WHERE school_id = $1",
    [schoolId]
  );
  const stored = r.rows[0]?.settings ?? {};
  const merged = deepMerge(DEFAULT_SETTINGS as unknown as Record<string, unknown>, stored) as typeof DEFAULT_SETTINGS;

  const metodos = merged.pagamento?.metodos_pagamento ?? DEFAULT_SETTINGS.pagamento.metodos_pagamento;
  const directDebit = merged.pagamento?.direct_debit ?? DEFAULT_SETTINGS.pagamento.direct_debit;

  const logs = await pool.query(
    "SELECT * FROM payment_method_audit_log WHERE school_id = $1 ORDER BY created_at DESC LIMIT 10",
    [schoolId]
  );

  res.json({ metodos_pagamento: metodos, direct_debit: directDebit, audit_log: logs.rows });
});

/* ─── PUT /admin/colegios/:id/payment-methods ─── */
router.put("/admin/colegios/:id/payment-methods", adminAuth, async (req, res) => {
  const schoolId = Number(req.params.id);
  const { metodos_pagamento, direct_debit } = req.body;

  if (!metodos_pagamento || typeof metodos_pagamento !== "object") {
    return res.status(400).json({ error: "Campo 'metodos_pagamento' obrigatório." });
  }

  const existing = await pool.query(
    "SELECT settings FROM school_settings WHERE school_id = $1",
    [schoolId]
  );
  const prevSettings = deepMerge(DEFAULT_SETTINGS as unknown as Record<string, unknown>, existing.rows[0]?.settings ?? {}) as typeof DEFAULT_SETTINGS;
  const previousMetodos = prevSettings.pagamento?.metodos_pagamento ?? DEFAULT_SETTINGS.pagamento.metodos_pagamento;

  const newPagamento = {
    ...prevSettings.pagamento,
    metodos_pagamento: {
      allow_reference: !!metodos_pagamento.allow_reference,
      allow_gpo_mcx: !!metodos_pagamento.allow_gpo_mcx,
      allow_direct_debit: !!metodos_pagamento.allow_direct_debit,
    },
    ...(direct_debit ? { direct_debit: {
      banco_parceiro: direct_debit.banco_parceiro ?? "",
      instrucoes: direct_debit.instrucoes ?? "",
    }} : {}),
  };

  const newSettings = { ...prevSettings, pagamento: newPagamento };

  await pool.query(`
    INSERT INTO school_settings (school_id, settings, updated_at, updated_by)
    VALUES ($1, $2::jsonb, NOW(), 'superadmin')
    ON CONFLICT (school_id) DO UPDATE
    SET settings = $2::jsonb, updated_at = NOW(), updated_by = 'superadmin'
  `, [schoolId, JSON.stringify(newSettings)]);

  const changes: Record<string, { de: unknown; para: unknown }> = {};
  const prevM = previousMetodos as Record<string, unknown>;
  const newM = newPagamento.metodos_pagamento as Record<string, unknown>;
  for (const key of Object.keys(metodos_pagamento)) {
    if (prevM[key] !== newM[key]) {
      changes[key] = { de: prevM[key], para: newM[key] };
    }
  }

  if (Object.keys(changes).length > 0) {
    await pool.query(
      "INSERT INTO payment_method_audit_log (school_id, changed_by, changes, previous_state) VALUES ($1, $2, $3, $4)",
      [schoolId, "superadmin", JSON.stringify(changes), JSON.stringify(previousMetodos)]
    );
  }

  res.json({ ok: true, metodos_pagamento: newPagamento.metodos_pagamento });
});

/* ─── GET /admin/colegios/:id/pacotes ─── */
router.get("/admin/colegios/:id/pacotes", adminAuth, async (req, res) => {
  const r = await pool.query(
    "SELECT * FROM pacotes_emolumentos WHERE school_id=$1 ORDER BY nome",
    [req.params.id]
  );
  res.json(r.rows);
});

/* ─── POST /admin/colegios/:id/pacotes — create package ─── */
router.post("/admin/colegios/:id/pacotes", adminAuth, async (req, res) => {
  const schoolId = Number(req.params.id);
  const { nome, itens, descricao } = req.body as {
    nome: string;
    itens: Array<{ nome: string; tipo: string; valor: number }>;
    descricao?: string;
  };
  if (!nome?.trim()) return res.status(400).json({ error: "Nome do pacote é obrigatório." });
  if (!Array.isArray(itens) || itens.length === 0) return res.status(400).json({ error: "Adicione pelo menos um item ao pacote." });

  // Auto-calculate total from items
  const total = itens.reduce((s, item) => s + Number(item.valor || 0), 0);
  const itensClean = itens.map(i => ({ nome: i.nome?.trim() || "", tipo: i.tipo || "outro", valor: Number(i.valor || 0) }));

  const r = await pool.query(
    `INSERT INTO pacotes_emolumentos (school_id, nome, itens, valor, descricao)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [schoolId, nome.trim(), JSON.stringify(itensClean), total, descricao?.trim() || null]
  );
  res.status(201).json(r.rows[0]);
});

/* ─── PUT /admin/pacotes/:id — update package ─── */
router.put("/admin/pacotes/:id", adminAuth, async (req, res) => {
  const { nome, itens, descricao, activo } = req.body as {
    nome: string;
    itens: Array<{ nome: string; tipo: string; valor: number }>;
    descricao?: string;
    activo?: boolean;
  };
  const itensClean = Array.isArray(itens)
    ? itens.map(i => ({ nome: i.nome?.trim() || "", tipo: i.tipo || "outro", valor: Number(i.valor || 0) }))
    : [];
  const total = itensClean.reduce((s, i) => s + i.valor, 0);
  const r = await pool.query(
    `UPDATE pacotes_emolumentos
     SET nome=$1, itens=$2, valor=$3, descricao=$4, activo=$5
     WHERE id=$6 RETURNING *`,
    [nome?.trim(), JSON.stringify(itensClean), total, descricao?.trim() || null, activo !== false, req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Pacote não encontrado." });
  res.json(r.rows[0]);
});

/* ─── DELETE /admin/pacotes/:id ─── */
router.delete("/admin/pacotes/:id", adminAuth, async (req, res) => {
  await pool.query("DELETE FROM pacotes_emolumentos WHERE id=$1", [req.params.id]);
  res.status(204).end();
});

/* ─── PUT /admin/colegios/:id/iban ─── */
router.put("/admin/colegios/:id/iban", adminAuth, async (req, res) => {
  const { iban } = req.body;
  if (!iban?.trim()) return res.status(400).json({ error: "IBAN é obrigatório." });
  const r = await pool.query(
    "UPDATE schools SET iban=$1 WHERE id=$2 RETURNING id, name, iban",
    [iban.trim(), req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Colégio não encontrado." });
  res.json(r.rows[0]);
});

/* ─── GET /admin/emolumentos/global — list all global emolumentos ─── */
router.get("/admin/emolumentos/global", adminAuth, async (req, res) => {
  const r = await pool.query(
    "SELECT * FROM emolumentos WHERE school_id IS NULL ORDER BY tipo, nome",
  );
  res.json(r.rows);
});

/* ─── POST /admin/emolumentos/global — create global emolumento ─── */
router.post("/admin/emolumentos/global", adminAuth, async (req, res) => {
  const { tipo, nome, montante, ano_lectivo, multa_ativo, multa_tipo, multa_valor_fixo, multa_percentagem, juros_mora, dias_carencia } = req.body;
  if (!tipo || !nome?.trim() || !montante) {
    return res.status(400).json({ error: "Tipo, nome e montante são obrigatórios." });
  }
  const r = await pool.query(
    `INSERT INTO emolumentos (school_id, tipo, nome, montante, ano_lectivo, activo, multa_ativo, multa_tipo, multa_valor_fixo, multa_percentagem, juros_mora, dias_carencia)
     VALUES (NULL,$1,$2,$3,$4,TRUE,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [tipo, nome.trim(), Number(montante), ano_lectivo || "2025/2026",
     !!multa_ativo, multa_tipo || "fixo",
     multa_valor_fixo != null ? Number(multa_valor_fixo) : null,
     multa_percentagem != null ? Number(multa_percentagem) : null,
     Number(juros_mora ?? 0), Number(dias_carencia ?? 0)]
  );
  res.status(201).json(r.rows[0]);
});

/* ─── PUT /admin/emolumentos/global/:id — update global emolumento ─── */
router.put("/admin/emolumentos/global/:id", adminAuth, async (req, res) => {
  const { nome, montante, ano_lectivo, multa_ativo, multa_tipo, multa_valor_fixo, multa_percentagem, juros_mora, dias_carencia } = req.body;
  if (!nome?.trim() || !montante) {
    return res.status(400).json({ error: "Nome e montante são obrigatórios." });
  }
  const r = await pool.query(
    `UPDATE emolumentos SET nome=$1, montante=$2, ano_lectivo=$3,
       multa_ativo=$4, multa_tipo=$5, multa_valor_fixo=$6, multa_percentagem=$7, juros_mora=$8, dias_carencia=$9
     WHERE id=$10 AND school_id IS NULL RETURNING *`,
    [nome.trim(), Number(montante), ano_lectivo || "2025/2026",
     !!multa_ativo, multa_tipo || "fixo",
     multa_valor_fixo != null ? Number(multa_valor_fixo) : null,
     multa_percentagem != null ? Number(multa_percentagem) : null,
     Number(juros_mora ?? 0), Number(dias_carencia ?? 0),
     req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Emolumento global não encontrado." });
  res.json(r.rows[0]);
});

/* ─── DELETE /admin/emolumentos/global/:id — delete global emolumento ─── */
router.delete("/admin/emolumentos/global/:id", adminAuth, async (req, res) => {
  await pool.query("DELETE FROM emolumentos WHERE id=$1 AND school_id IS NULL", [req.params.id]);
  res.status(204).end();
});

/* ─── PATCH /admin/emolumentos/:id/toggle — toggle activo ─── */
router.patch("/admin/emolumentos/:id/toggle", adminAuth, async (req, res) => {
  const r = await pool.query(
    "UPDATE emolumentos SET activo = NOT activo WHERE id=$1 RETURNING *",
    [req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Não encontrado." });
  res.json(r.rows[0]);
});

/* ─── GET /admin/colegios/:id/emolumentos ─── */
router.get("/admin/colegios/:id/emolumentos", adminAuth, async (req, res) => {
  const r = await pool.query(
    "SELECT * FROM emolumentos WHERE school_id=$1 ORDER BY tipo, ano_lectivo",
    [req.params.id]
  );
  res.json(r.rows);
});

/* ─── POST /admin/colegios/:id/emolumentos ─── */
router.post("/admin/colegios/:id/emolumentos", adminAuth, async (req, res) => {
  const { tipo, nome, montante, ano_lectivo, multa_ativo, multa_tipo, multa_valor_fixo, multa_percentagem, juros_mora, dias_carencia } = req.body;
  if (!tipo || !nome?.trim() || !montante) {
    return res.status(400).json({ error: "Tipo, nome e montante são obrigatórios." });
  }
  const r = await pool.query(
    `INSERT INTO emolumentos (school_id, tipo, nome, montante, ano_lectivo, multa_ativo, multa_tipo, multa_valor_fixo, multa_percentagem, juros_mora, dias_carencia)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [req.params.id, tipo, nome.trim(), Number(montante), ano_lectivo || "2025/2026",
     !!multa_ativo, multa_tipo || "fixo",
     multa_valor_fixo != null ? Number(multa_valor_fixo) : null,
     multa_percentagem != null ? Number(multa_percentagem) : null,
     Number(juros_mora ?? 0), Number(dias_carencia ?? 0)]
  );
  res.status(201).json(r.rows[0]);
});

/* ─── DELETE /admin/emolumentos/:id ─── */
router.delete("/admin/emolumentos/:id", adminAuth, async (req, res) => {
  await pool.query("DELETE FROM emolumentos WHERE id=$1", [req.params.id]);
  res.status(204).end();
});

/* ─── GET /admin/colegios/:id/multa-regra ─── */
router.get("/admin/colegios/:id/multa-regra", adminAuth, async (req, res) => {
  const r = await pool.query("SELECT * FROM multa_regras WHERE school_id=$1", [req.params.id]);
  res.json(r.rows[0] ?? null);
});

/* ─── PUT /admin/colegios/:id/multa-regra — supports 3 models ─── */
router.put("/admin/colegios/:id/multa-regra", adminAuth, async (req, res) => {
  const { modelo, dia_limite, aplica_automatico, percentagem, valor_fixo, brackets } = req.body;
  if (!modelo || ![1, 2, 3].includes(Number(modelo)) || !dia_limite) {
    return res.status(400).json({ error: "modelo (1-3) e dia_limite são obrigatórios." });
  }
  const m = Number(modelo);
  const tipoCal = m === 3 ? "fixa" : "percentual";
  const valor = m === 3 ? Number(valor_fixo ?? 0) : Number(percentagem ?? 0);
  const r = await pool.query(
    `INSERT INTO multa_regras
       (school_id, modelo, dia_limite, aplica_automatico, percentagem, valor_fixo, brackets, tipo_calculo, valor)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (school_id) DO UPDATE
       SET modelo=$2, dia_limite=$3, aplica_automatico=$4,
           percentagem=$5, valor_fixo=$6, brackets=$7,
           tipo_calculo=$8, valor=$9, updated_at=NOW()
     RETURNING *`,
    [
      req.params.id, m, Number(dia_limite), Boolean(aplica_automatico),
      Number(percentagem ?? 0), Number(valor_fixo ?? 0),
      JSON.stringify(brackets ?? []), tipoCal, valor,
    ]
  );
  res.json(r.rows[0]);
});

/* ─── GET /admin/colegios/:id/propinas ─── */
router.get("/admin/colegios/:id/propinas", adminAuth, async (req, res) => {
  const { student_id } = req.query;
  const extra = student_id ? "AND p.student_id = $2" : "";
  const params: any[] = [req.params.id];
  if (student_id) params.push(student_id);
  const r = await pool.query(
    `SELECT p.id, p.student_id, p.mes, p.ano, p.montante, p.multa,
            (p.montante + p.multa) AS total, p.status, p.data_vencimento,
            s.nome AS aluno_nome,
            COALESCE(t.nome,'Sem turma') AS turma,
            pg.entidade, pg.referencia AS ref_numero, pg.validade AS ref_validade
     FROM propinas p
     JOIN students s ON s.id = p.student_id
     LEFT JOIN turmas t ON t.id = s.turma_id
     LEFT JOIN pagamentos pg ON pg.propina_id = p.id
     WHERE p.school_id = $1 ${extra}
     ORDER BY p.ano DESC,
       CASE p.mes
         WHEN 'Janeiro' THEN 1 WHEN 'Fevereiro' THEN 2 WHEN 'Março' THEN 3
         WHEN 'Abril' THEN 4 WHEN 'Maio' THEN 5 WHEN 'Junho' THEN 6
         WHEN 'Julho' THEN 7 WHEN 'Agosto' THEN 8 WHEN 'Setembro' THEN 9
         WHEN 'Outubro' THEN 10 WHEN 'Novembro' THEN 11 WHEN 'Dezembro' THEN 12
       END DESC, s.nome`,
    params
  );
  res.json(r.rows);
});

/* ─── GET /admin/propinas/:id/ajustes ─── */
router.get("/admin/propinas/:id/ajustes", adminAuth, async (req, res) => {
  const r = await pool.query(
    "SELECT * FROM propina_ajustes WHERE propina_id=$1 ORDER BY created_at DESC",
    [req.params.id]
  );
  res.json(r.rows);
});

/* ─── POST /admin/propinas/:id/ajuste ─── */
router.post("/admin/propinas/:id/ajuste", adminAuth, async (req, res) => {
  const { tipo, multa_nova, valor_novo, nova_data_vencimento, motivo } = req.body;
  if (!tipo || !["perdao","ajuste_valor","reagendamento","justificacao"].includes(tipo)) {
    return res.status(400).json({ error: "tipo inválido." });
  }
  if (!motivo?.trim()) return res.status(400).json({ error: "Motivo é obrigatório." });

  const propina = await pool.query("SELECT * FROM propinas WHERE id=$1", [req.params.id]);
  if (!propina.rows.length) return res.status(404).json({ error: "Propina não encontrada." });
  const p = propina.rows[0];

  const log: any = {
    propina_id: p.id, tipo, motivo: motivo.trim(),
    multa_anterior: p.multa, valor_anterior: p.montante, created_by: "admin",
  };

  if (tipo === "perdao") {
    await pool.query("UPDATE propinas SET multa=0 WHERE id=$1", [p.id]);
    log.multa_nova = 0;
  } else if (tipo === "ajuste_valor") {
    if (multa_nova !== undefined) {
      await pool.query("UPDATE propinas SET multa=$1 WHERE id=$2", [Number(multa_nova), p.id]);
      log.multa_nova = Number(multa_nova);
    }
    if (valor_novo !== undefined) {
      await pool.query("UPDATE propinas SET montante=$1 WHERE id=$2", [Number(valor_novo), p.id]);
      log.valor_novo = Number(valor_novo);
    }
  } else if (tipo === "reagendamento") {
    if (!nova_data_vencimento) return res.status(400).json({ error: "Nova data é obrigatória." });
    await pool.query("UPDATE propinas SET data_vencimento=$1, status='pendente' WHERE id=$2",
      [nova_data_vencimento, p.id]);
    log.nova_data_vencimento = nova_data_vencimento;
  }

  await pool.query(
    `INSERT INTO propina_ajustes
       (propina_id, tipo, multa_anterior, multa_nova, valor_anterior, valor_novo, nova_data_vencimento, motivo, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [log.propina_id, log.tipo, log.multa_anterior, log.multa_nova ?? null,
     log.valor_anterior, log.valor_novo ?? null, log.nova_data_vencimento ?? null,
     log.motivo, log.created_by]
  );

  const updated = await pool.query("SELECT * FROM propinas WHERE id=$1", [p.id]);
  res.json(updated.rows[0]);
});

/* ─── GET /admin/colegios/:id/alunos — list students (optionally only with fines) ─── */
router.get("/admin/colegios/:id/alunos", adminAuth, async (req, res) => {
  const schoolId = Number(req.params.id);
  const somenteMultas = req.query.multas === "1";

  const result = await pool.query(
    `SELECT s.id, s.nome, s.bilhete, s.numero_processo, s.estado,
            s.turma_id, COALESCE(t.nome, 'Sem turma') AS turma, t.turno,
            COUNT(p.id) FILTER (WHERE p.status IN ('pendente','vencido')) AS propinas_pendentes,
            COALESCE(SUM(p.montante + p.multa) FILTER (WHERE p.status IN ('pendente','vencido')), 0) AS divida,
            COALESCE(SUM(p.multa) FILTER (WHERE p.status IN ('pendente','vencido')), 0) AS multa_total,
            COUNT(p.id) FILTER (WHERE p.status IN ('pendente','vencido') AND p.multa > 0) AS propinas_com_multa,
            m.pacote_id,
            pe.nome AS pacote_nome,
            pe.valor AS pacote_valor
     FROM students s
     LEFT JOIN turmas t ON t.id = s.turma_id
     LEFT JOIN propinas p ON p.student_id = s.id
     LEFT JOIN matriculas m ON m.student_id = s.id AND m.estado = 'activa'
     LEFT JOIN pacotes_emolumentos pe ON pe.id = m.pacote_id
     WHERE s.school_id = $1
     GROUP BY s.id, t.nome, t.turno, m.pacote_id, pe.nome, pe.valor
     ${somenteMultas ? "HAVING COALESCE(SUM(p.multa) FILTER (WHERE p.status IN ('pendente','vencido')), 0) > 0" : ""}
     ORDER BY multa_total DESC, s.nome`,
    [schoolId]
  );
  res.json(result.rows);
});

/* ─── PUT /admin/colegios/:schoolId/alunos/:studentId/pacote ─── */
router.put("/admin/colegios/:schoolId/alunos/:studentId/pacote", adminAuth, async (req, res) => {
  const schoolId = Number(req.params.schoolId);
  const studentId = Number(req.params.studentId);
  const { pacote_id } = req.body;

  const check = await pool.query(
    "SELECT id FROM students WHERE id=$1 AND school_id=$2", [studentId, schoolId]
  );
  if (!check.rows.length) return res.status(404).json({ error: "Aluno não encontrado." });

  if (pacote_id !== null && pacote_id !== undefined) {
    const pkCheck = await pool.query(
      "SELECT id FROM pacotes_emolumentos WHERE id=$1 AND school_id=$2", [pacote_id, schoolId]
    );
    if (!pkCheck.rows.length) return res.status(404).json({ error: "Pacote não encontrado." });
  }

  await pool.query(
    `INSERT INTO matriculas (student_id, turma_id, ano_lectivo, pacote_id)
     SELECT $1, s.turma_id, '2025/2026', $2 FROM students s WHERE s.id=$1
     ON CONFLICT (student_id, turma_id, ano_lectivo)
     DO UPDATE SET pacote_id = EXCLUDED.pacote_id`,
    [studentId, pacote_id ?? null]
  );
  res.json({ ok: true });
});

/* ─── POST /admin/colegios/:id/alunos/upload ─── */
// Accepts JSON array of student rows; creates turmas on-the-fly if needed
router.post("/admin/colegios/:id/alunos/upload", adminAuth, async (req, res) => {
  const schoolId = Number(req.params.id);
  const { alunos, ano_lectivo } = req.body as {
    alunos: Array<{
      nome: string;
      bilhete?: string;
      numero_processo?: string;
      data_nascimento?: string;
      sexo?: string;
      turma_nome?: string;
      turno?: string;
      nome_encarregado?: string;
      telefone_encarregado?: string;
      pacote_nome?: string;
    }>;
    ano_lectivo?: string;
  };

  if (!Array.isArray(alunos) || alunos.length === 0) {
    return res.status(400).json({ error: "Lista de alunos vazia." });
  }

  const anoLectivo = ano_lectivo || "2025/2026";
  const turmaCache: Record<string, number> = {};
  const pacoteCache: Record<string, number> = {};
  let inserted = 0;
  let skipped = 0;
  let encarregados_criados = 0;
  const errors: string[] = [];

  // Preload existing turmas and packages
  const [existingTurmas, existingPacotes] = await Promise.all([
    pool.query("SELECT id, nome FROM turmas WHERE school_id=$1", [schoolId]),
    pool.query("SELECT id, nome FROM pacotes_emolumentos WHERE school_id=$1 AND activo=TRUE", [schoolId]),
  ]);
  for (const t of existingTurmas.rows) turmaCache[t.nome.toLowerCase()] = t.id;
  for (const p of existingPacotes.rows) pacoteCache[p.nome.toLowerCase()] = p.id;

  for (const row of alunos) {
    if (!row.nome?.trim()) { skipped++; continue; }
    try {
      // Resolve or create turma
      let turmaId: number | null = null;
      if (row.turma_nome?.trim()) {
        const key = row.turma_nome.trim().toLowerCase();
        if (turmaCache[key]) {
          turmaId = turmaCache[key];
        } else {
          const nt = await pool.query(
            "INSERT INTO turmas (school_id, nome, ano, turno) VALUES ($1,$2,$3,$4) RETURNING id",
            [schoolId, row.turma_nome.trim(), anoLectivo, row.turno || "Manhã"]
          );
          turmaId = nt.rows[0].id;
          turmaCache[key] = turmaId!;
        }
      }

      // Insert student (skip duplicate by bilhete)
      const st = await pool.query(
        `INSERT INTO students
           (school_id, turma_id, nome, bilhete, numero_processo, data_nascimento,
            sexo, nome_encarregado, telefone_encarregado, estado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'activo')
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          schoolId, turmaId, row.nome.trim(),
          row.bilhete?.trim() || null,
          row.numero_processo?.trim() || null,
          row.data_nascimento || null,
          row.sexo || null,
          row.nome_encarregado?.trim() || null,
          row.telefone_encarregado?.trim() || null,
        ]
      );
      if (st.rows[0]) {
        const studentId = st.rows[0].id;
        // Resolve package (optional)
        let pacoteId: number | null = null;
        if (row.pacote_nome?.trim()) {
          pacoteId = pacoteCache[row.pacote_nome.trim().toLowerCase()] ?? null;
        }
        // Create matricula (link package if provided)
        if (turmaId) {
          await pool.query(
            `INSERT INTO matriculas (student_id, turma_id, ano_lectivo, pacote_id)
             VALUES ($1,$2,$3,$4) ON CONFLICT (student_id, turma_id, ano_lectivo)
             DO UPDATE SET pacote_id = EXCLUDED.pacote_id`,
            [studentId, turmaId, anoLectivo, pacoteId]
          );
        }
        // Create or find encarregado and link to student
        const telefoneEnc = row.telefone_encarregado?.toString().replace(/\D/g, "").trim();
        if (telefoneEnc && row.nome_encarregado?.trim()) {
          const existing = await pool.query(
            "SELECT id FROM encarregados WHERE telefone=$1", [telefoneEnc]
          );
          let encId: number;
          if (existing.rows[0]) {
            encId = existing.rows[0].id;
          } else {
            // Default PIN "1234" — encarregado must change on first login
            const bcrypt = await import("bcryptjs");
            const hash = await bcrypt.hash("1234", 10);
            const ne = await pool.query(
              `INSERT INTO encarregados (nome, telefone, password, first_login)
               VALUES ($1,$2,$3,TRUE) RETURNING id`,
              [row.nome_encarregado.trim(), telefoneEnc, hash]
            );
            encId = ne.rows[0].id;
            encarregados_criados++;
          }
          await pool.query(
            `INSERT INTO encarregado_aluno (encarregado_id, aluno_id)
             VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [encId, studentId]
          );
        }
        inserted++;
      } else {
        skipped++;
      }
    } catch (e: any) {
      errors.push(`${row.nome}: ${e.message}`);
    }
  }

  res.json({ inserted, skipped, errors, total: alunos.length, encarregados_criados });
});

/* ─── Helper: compute next numero_processo for a school (admin) ─── */
async function computeNextNumeroProcessoAdmin(schoolId: number): Promise<{ next: string; prefixo: string; nextNum: number }> {
  let prefixo = "";
  try {
    const r = await pool.query("SELECT numero_processo_prefixo, settings FROM schools WHERE id=$1", [schoolId]);
    const row = r.rows[0];
    prefixo = row?.numero_processo_prefixo ?? "";
    if (!prefixo) prefixo = row?.settings?.academico?.numero_processo_prefixo ?? "";
  } catch {
    try {
      const r = await pool.query("SELECT settings FROM schools WHERE id=$1", [schoolId]);
      prefixo = r.rows[0]?.settings?.academico?.numero_processo_prefixo ?? "";
    } catch { prefixo = ""; }
  }
  const existing = await pool.query(
    `SELECT numero_processo FROM students WHERE school_id=$1 AND numero_processo IS NOT NULL AND numero_processo != ''`,
    [schoolId]
  );
  let maxNum = 0;
  for (const row of existing.rows) {
    const np: string = row.numero_processo ?? "";
    const stripped = prefixo && np.startsWith(prefixo) ? np.slice(prefixo.length) : np;
    const num = parseInt(stripped.replace(/\D/g, ""), 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  }
  const nextNum = maxNum + 1;
  const padded = String(nextNum).padStart(4, "0");
  return { next: prefixo ? `${prefixo}${padded}` : padded, prefixo, nextNum };
}

/* ─── GET /admin/colegios/:id/alunos/next-numero-processo ─── */
router.get("/admin/colegios/:id/alunos/next-numero-processo", adminAuth, async (req: any, res) => {
  const schoolId = Number(req.params.id);
  try {
    const result = await computeNextNumeroProcessoAdmin(schoolId);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── POST /admin/colegios/:id/alunos — create single student (multipart) ─── */
const alunoUpload = upload.fields([
  { name: "bi_doc", maxCount: 1 },
  { name: "bi_encarregado_doc", maxCount: 1 },
  { name: "docs_transferencia", maxCount: 5 },
]);

router.post("/admin/colegios/:id/alunos", adminAuth, (req, res, next) => {
  alunoUpload(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req: Request, res: Response) => {
  const schoolId = Number(req.params.id);
  const b = req.body;
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;

  if (!b.nome?.trim()) return res.status(400).json({ error: "Nome do aluno é obrigatório." });

  const isTransferencia = b.is_transferencia === "true" || b.is_transferencia === "1";
  if (isTransferencia && !files?.docs_transferencia?.length) {
    return res.status(400).json({ error: "Para transferência, o documento da instituição anterior é obrigatório." });
  }

  const anoLectivo = b.ano_lectivo || "2025/2026";
  const biDocPath = files?.bi_doc?.[0]?.filename ?? null;
  const biEncDocPath = files?.bi_encarregado_doc?.[0]?.filename ?? null;
  const docsTransfPaths = files?.docs_transferencia?.map(f => f.filename).join(",") ?? null;

  try {
    // Resolve turma
    let turmaId: number | null = b.turma_id ? Number(b.turma_id) : null;
    if (!turmaId && b.turma_nome?.trim()) {
      const existing = await pool.query(
        "SELECT id FROM turmas WHERE school_id=$1 AND LOWER(nome)=LOWER($2)", [schoolId, b.turma_nome.trim()]
      );
      if (existing.rows[0]) {
        turmaId = existing.rows[0].id;
      } else {
        const nt = await pool.query(
          "INSERT INTO turmas (school_id, nome, ano, turno) VALUES ($1,$2,$3,$4) RETURNING id",
          [schoolId, b.turma_nome.trim(), anoLectivo, b.turno || "Manhã"]
        );
        turmaId = nt.rows[0].id;
      }
    }

    // Auto-generate numero_processo if not provided
    let numeroProcesso = b.numero_processo?.trim() || null;
    if (!numeroProcesso) {
      const gen = await computeNextNumeroProcessoAdmin(schoolId);
      numeroProcesso = gen.next;
    }

    // Insert student with all fields
    const st = await pool.query(
      `INSERT INTO students
         (school_id, turma_id, nome, bilhete, numero_processo, data_nascimento, sexo,
          nome_encarregado, telefone_encarregado, estado,
          bi_doc_path, bi_encarregado_doc_path,
          is_transferencia, escola_anterior, ano_classe_anterior, docs_transferencia_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'activo',$10,$11,$12,$13,$14,$15)
       RETURNING id, nome, bilhete, numero_processo, estado, created_at`,
      [
        schoolId, turmaId, b.nome.trim(),
        b.bilhete?.trim() || null, numeroProcesso,
        b.data_nascimento || null, b.sexo || null,
        b.nome_encarregado?.trim() || null, b.telefone_encarregado?.trim() || null,
        biDocPath, biEncDocPath,
        isTransferencia,
        b.escola_anterior?.trim() || null, b.ano_classe_anterior?.trim() || null,
        docsTransfPaths,
      ]
    );
    const student = st.rows[0];

    // Matricula + pacote
    if (turmaId) {
      await pool.query(
        `INSERT INTO matriculas (student_id, turma_id, ano_lectivo, pacote_id)
         VALUES ($1,$2,$3,$4) ON CONFLICT (student_id, turma_id, ano_lectivo)
         DO UPDATE SET pacote_id = EXCLUDED.pacote_id`,
        [student.id, turmaId, anoLectivo, b.pacote_id ? Number(b.pacote_id) : null]
      );
    }

    // Encarregado
    const telefoneEnc = b.telefone_encarregado?.toString().replace(/\D/g, "").trim();
    if (telefoneEnc && b.nome_encarregado?.trim()) {
      const existing = await pool.query("SELECT id FROM encarregados WHERE telefone=$1", [telefoneEnc]);
      let encId: number;
      if (existing.rows[0]) {
        encId = existing.rows[0].id;
      } else {
        const bcrypt = await import("bcryptjs");
        const hash = await bcrypt.hash("1234", 10);
        const ne = await pool.query(
          `INSERT INTO encarregados (nome, telefone, password, first_login) VALUES ($1,$2,$3,TRUE) RETURNING id`,
          [b.nome_encarregado.trim(), telefoneEnc, hash]
        );
        encId = ne.rows[0].id;
      }
      await pool.query(
        `INSERT INTO encarregado_aluno (encarregado_id, aluno_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [encId, student.id]
      );
    }

    res.status(201).json({ ...student, turma_id: turmaId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /admin/colegios/:schoolId/alunos/:studentId — ficha completa ─── */
router.get("/admin/colegios/:schoolId/alunos/:studentId", adminAuth, async (req, res) => {
  const schoolId = Number(req.params.schoolId);
  const studentId = Number(req.params.studentId);

  const sr = await pool.query(
    `SELECT s.id, s.nome, s.bilhete, s.numero_processo, s.data_nascimento, s.sexo, s.estado,
            s.nome_encarregado, s.telefone_encarregado, s.emolumento_propina_id,
            s.is_transferencia, s.escola_anterior, s.ano_classe_anterior,
            s.turma_id, COALESCE(t.nome,'Sem turma') AS turma_nome, t.turno,
            m.pacote_id, m.ano_lectivo
     FROM students s
     LEFT JOIN turmas t ON t.id = s.turma_id
     LEFT JOIN matriculas m ON m.student_id = s.id AND m.estado = 'activa'
     WHERE s.id=$1 AND s.school_id=$2`,
    [studentId, schoolId]
  );
  if (!sr.rows.length) return res.status(404).json({ error: "Aluno não encontrado." });
  const student = sr.rows[0];

  // Linked guardian via encarregado_aluno
  const er = await pool.query(
    `SELECT e.id, e.nome, e.telefone, e.email, e.first_login, e.created_at
     FROM encarregados e
     JOIN encarregado_aluno ea ON ea.encarregado_id = e.id
     WHERE ea.aluno_id = $1
     LIMIT 1`,
    [studentId]
  );

  // All turmas for this school (for dropdown)
  const tr = await pool.query(
    "SELECT id, nome, turno FROM turmas WHERE school_id=$1 ORDER BY nome",
    [schoolId]
  );

  return res.json({
    ...student,
    encarregado: er.rows[0] ?? null,
    turmas: tr.rows,
  });
});

/* ─── PUT /admin/colegios/:schoolId/alunos/:studentId — actualizar ficha ─── */
router.put("/admin/colegios/:schoolId/alunos/:studentId", adminAuth, async (req, res) => {
  const schoolId = Number(req.params.schoolId);
  const studentId = Number(req.params.studentId);
  const b = req.body;

  const check = await pool.query(
    "SELECT id FROM students WHERE id=$1 AND school_id=$2", [studentId, schoolId]
  );
  if (!check.rows.length) return res.status(404).json({ error: "Aluno não encontrado." });

  // Resolve turma
  let turmaId: number | null = b.turma_id ? Number(b.turma_id) : null;
  if (!turmaId && b.turma_nome?.trim()) {
    const existing = await pool.query(
      "SELECT id FROM turmas WHERE school_id=$1 AND LOWER(nome)=LOWER($2)", [schoolId, b.turma_nome.trim()]
    );
    if (existing.rows[0]) {
      turmaId = existing.rows[0].id;
    } else {
      const nt = await pool.query(
        "INSERT INTO turmas (school_id, nome, ano, turno) VALUES ($1,$2,'2025/2026',$3) RETURNING id",
        [schoolId, b.turma_nome.trim(), b.turno || "Manhã"]
      );
      turmaId = nt.rows[0].id;
    }
  }

  // Update student
  const adminEmolumentoPropinaId = b.emolumento_propina_id !== undefined
    ? (b.emolumento_propina_id ? Number(b.emolumento_propina_id) : null)
    : undefined;

  if (adminEmolumentoPropinaId !== undefined) {
    await pool.query(
      `UPDATE students SET
         nome=$1, bilhete=$2, numero_processo=$3, data_nascimento=$4, sexo=$5,
         nome_encarregado=$6, telefone_encarregado=$7, estado=$8, turma_id=$9,
         emolumento_propina_id=$10
       WHERE id=$11 AND school_id=$12`,
      [
        b.nome?.trim() || null,
        b.bilhete?.trim() || null,
        b.numero_processo?.trim() || null,
        b.data_nascimento || null,
        b.sexo || null,
        b.nome_encarregado?.trim() || null,
        b.telefone_encarregado?.toString().replace(/\D/g, "").trim() || null,
        b.estado || "activo",
        turmaId,
        adminEmolumentoPropinaId,
        studentId,
        schoolId,
      ]
    );
  } else {
    await pool.query(
      `UPDATE students SET
         nome=$1, bilhete=$2, numero_processo=$3, data_nascimento=$4, sexo=$5,
         nome_encarregado=$6, telefone_encarregado=$7, estado=$8, turma_id=$9
       WHERE id=$10 AND school_id=$11`,
      [
        b.nome?.trim() || null,
        b.bilhete?.trim() || null,
        b.numero_processo?.trim() || null,
        b.data_nascimento || null,
        b.sexo || null,
        b.nome_encarregado?.trim() || null,
        b.telefone_encarregado?.toString().replace(/\D/g, "").trim() || null,
        b.estado || "activo",
        turmaId,
        studentId,
        schoolId,
      ]
    );
  }

  // Upsert matricula with new turma
  if (turmaId) {
    await pool.query(
      `INSERT INTO matriculas (student_id, turma_id, ano_lectivo, estado)
       VALUES ($1, $2, '2025/2026', 'activa')
       ON CONFLICT (student_id, turma_id, ano_lectivo)
       DO UPDATE SET turma_id = EXCLUDED.turma_id`,
      [studentId, turmaId]
    );
  }

  // Guardian upsert
  const telefoneEnc = b.telefone_encarregado?.toString().replace(/\D/g, "").trim();
  if (telefoneEnc && b.nome_encarregado?.trim()) {
    // 1. Find guardian already linked to this student
    const linkedEnc = await pool.query(
      `SELECT e.id FROM encarregados e
       JOIN encarregado_aluno ea ON ea.encarregado_id = e.id
       WHERE ea.aluno_id = $1 LIMIT 1`,
      [studentId]
    );

    // 2. Or find any guardian with this phone (avoids unique constraint error)
    const phoneEnc = await pool.query(
      `SELECT id FROM encarregados WHERE telefone=$1 LIMIT 1`, [telefoneEnc]
    );

    const encId: number | null = linkedEnc.rows[0]?.id ?? phoneEnc.rows[0]?.id ?? null;

    const bcrypt = await import("bcryptjs");
    if (encId) {
      // Update existing guardian
      const updateFields: string[] = ["nome=$1", "telefone=$2"];
      const updateVals: any[] = [b.nome_encarregado.trim(), telefoneEnc];
      if (b.encarregado_email !== undefined) {
        updateFields.push(`email=$${updateVals.length + 1}`);
        updateVals.push(b.encarregado_email?.trim() || null);
      }
      if (b.nova_password?.trim()) {
        const hash = await bcrypt.hash(b.nova_password.trim(), 10);
        updateFields.push(`password=$${updateVals.length + 1}`, `first_login=FALSE`);
        updateVals.push(hash);
      }
      updateVals.push(encId);
      await pool.query(
        `UPDATE encarregados SET ${updateFields.join(",")} WHERE id=$${updateVals.length}`,
        updateVals
      );
      // Ensure the link exists
      await pool.query(
        `INSERT INTO encarregado_aluno (encarregado_id, aluno_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [encId, studentId]
      );
    } else {
      // Create brand-new guardian
      const pwHash = await bcrypt.hash(b.nova_password?.trim() || "1234", 10);
      const ne = await pool.query(
        `INSERT INTO encarregados (nome, telefone, email, password, first_login)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [b.nome_encarregado.trim(), telefoneEnc, b.encarregado_email?.trim() || null,
         pwHash, !b.nova_password?.trim()]
      );
      await pool.query(
        `INSERT INTO encarregado_aluno (encarregado_id, aluno_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [ne.rows[0].id, studentId]
      );
    }
  }

  // Return updated student
  const updated = await pool.query(
    `SELECT s.id, s.nome, s.bilhete, s.numero_processo, s.data_nascimento, s.sexo, s.estado,
            s.nome_encarregado, s.telefone_encarregado, s.turma_id,
            COALESCE(t.nome,'Sem turma') AS turma_nome, t.turno
     FROM students s LEFT JOIN turmas t ON t.id = s.turma_id
     WHERE s.id=$1`,
    [studentId]
  );
  return res.json(updated.rows[0]);
});

/* ─── DELETE /admin/colegios/:id ─── */
router.delete("/admin/colegios/:id", adminAuth, async (req, res) => {
  await pool.query("DELETE FROM schools WHERE id=$1", [req.params.id]);
  res.status(204).end();
});

/* ─── GET /admin/colegios/:id/comunicados ─── */
router.get("/admin/colegios/:id/comunicados", adminAuth, async (req, res) => {
  const r = await pool.query(
    `SELECT c.*,
            (SELECT COUNT(*)::int FROM comunicados_lidos cl WHERE cl.comunicado_id = c.id) AS total_lidos
     FROM comunicados c
     WHERE c.escola_id = $1
     ORDER BY c.created_at DESC`,
    [req.params.id]
  );
  return res.json(r.rows);
});

/* ─── POST /admin/colegios/:id/comunicados ─── */
router.post("/admin/colegios/:id/comunicados", adminAuth, async (req, res) => {
  const { titulo, conteudo, prioridade } = req.body;
  if (!titulo?.trim() || !conteudo?.trim()) {
    return res.status(400).json({ error: "Título e conteúdo são obrigatórios." });
  }
  const r = await pool.query(
    `INSERT INTO comunicados (escola_id, titulo, conteudo, prioridade)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.params.id, titulo.trim(), conteudo.trim(), prioridade ?? "normal"]
  );
  return res.status(201).json(r.rows[0]);
});

/* ─── DELETE /admin/comunicados/:id ─── */
router.delete("/admin/comunicados/:id", adminAuth, async (req, res) => {
  await pool.query("DELETE FROM comunicados WHERE id = $1", [req.params.id]);
  res.status(204).end();
});

/* ─── GET /admin/colegios/:id/comunicar/audiencia ─── */
router.get("/admin/colegios/:id/comunicar/audiencia", adminAuth, async (req, res) => {
  const schoolId = parseInt(req.params.id);
  const modo = (req.query.modo as string) ?? "todos";
  const turmaId = req.query.turma_id ? parseInt(req.query.turma_id as string) : null;

  const params: any[] = [schoolId];
  let extraWhere = "";
  if (modo === "turma" && turmaId) {
    extraWhere = ` AND s.turma_id = $2`;
    params.push(turmaId);
  } else if (modo === "devedores") {
    extraWhere = ` AND EXISTS (SELECT 1 FROM propinas p WHERE p.student_id = s.id AND p.status != 'pago')`;
  }

  const registados = await pool.query(
    `SELECT e.id, e.nome, e.telefone,
            array_agg(DISTINCT s.nome) FILTER (WHERE s.nome IS NOT NULL) AS alunos,
            array_agg(DISTINCT t.nome) FILTER (WHERE t.nome IS NOT NULL) AS turmas
     FROM encarregados e
     JOIN encarregado_aluno ea ON ea.encarregado_id = e.id
     JOIN students s ON s.id = ea.aluno_id
     LEFT JOIN turmas t ON t.id = s.turma_id
     WHERE s.school_id = $1 AND s.estado = 'activo'${extraWhere}
     GROUP BY e.id, e.nome, e.telefone ORDER BY e.nome`,
    params
  );

  const naoRegistados = await pool.query(
    `SELECT DISTINCT ON (s.telefone_encarregado)
            NULL::integer AS id, s.nome_encarregado AS nome,
            s.telefone_encarregado AS telefone,
            array_agg(DISTINCT s.nome) AS alunos,
            array_agg(DISTINCT t.nome) FILTER (WHERE t.nome IS NOT NULL) AS turmas
     FROM students s LEFT JOIN turmas t ON t.id = s.turma_id
     WHERE s.school_id = $1 AND s.estado = 'activo'
       AND s.telefone_encarregado IS NOT NULL AND s.telefone_encarregado != ''
       AND s.telefone_encarregado NOT IN (
           SELECT e.telefone FROM encarregados e
           JOIN encarregado_aluno ea ON ea.encarregado_id = e.id
           JOIN students st ON st.id = ea.aluno_id WHERE st.school_id = $1
       )${extraWhere}
     GROUP BY s.telefone_encarregado, s.nome_encarregado
     ORDER BY s.telefone_encarregado`,
    params
  );

  return res.json({
    registados: registados.rows,
    nao_registados: naoRegistados.rows,
    total: registados.rows.length + naoRegistados.rows.length,
  });
});

/* ─── POST /admin/colegios/:id/comunicar/publicar ─── */
router.post("/admin/colegios/:id/comunicar/publicar", adminAuth, async (req, res) => {
  const schoolId = parseInt(req.params.id);
  const { titulo, conteudo, prioridade, canal, phones } = req.body;
  if (!conteudo?.trim()) return res.status(400).json({ error: "Conteúdo obrigatório." });

  let comunicadoId: number | null = null;
  let smsSent = 0, smsFailed = 0;

  const settingsR = await pool.query("SELECT settings FROM school_settings WHERE school_id=$1", [schoolId]);
  const comm = settingsR.rows[0]?.settings?.comunicacao ?? {};
  const smsConfig = {
    provider: comm.sms_provider || "mock",
    api_url: comm.sms_api_url,
    api_key: comm.sms_api_key,
    sender_name: comm.sms_sender_name || "KiwaraEsc",
  };

  if (canal === "portal" || canal === "ambos") {
    if (!titulo?.trim()) return res.status(400).json({ error: "Título obrigatório para publicar no portal." });
    const r = await pool.query(
      `INSERT INTO comunicados (escola_id, titulo, conteudo, prioridade) VALUES ($1,$2,$3,$4) RETURNING id`,
      [schoolId, titulo.trim(), conteudo.trim(), prioridade ?? "normal"]
    );
    comunicadoId = r.rows[0].id;
  }

  if ((canal === "sms" || canal === "ambos") && Array.isArray(phones) && phones.length > 0) {
    const recipients = phones.map((p: string) => ({ phone: p, name: "" }));
    const smsResult = await sendBulkSMS(recipients, conteudo.trim(), smsConfig, schoolId);
    smsSent += smsResult.sent;
    smsFailed += smsResult.failed;
  }

  return res.json({ comunicado_id: comunicadoId, sms_sent: smsSent, sms_failed: smsFailed });
});

/* ─── GET /admin/pending-dd-cancellations ─── */
router.get("/admin/pending-dd-cancellations", adminAuth, async (_req, res) => {
  const r = await pool.query(
    `SELECT school_id, COUNT(*)::int AS pending_count
     FROM direct_debit_subscriptions
     WHERE status = 'cancellation_requested'
     GROUP BY school_id`
  );
  const map: Record<number, number> = {};
  for (const row of r.rows) map[row.school_id] = row.pending_count;
  return res.json(map);
});

/* ─── GET /admin/colegios/:id/direct-debit/subscriptions ─── */
router.get("/admin/colegios/:id/direct-debit/subscriptions", adminAuth, async (req, res) => {
  const { id } = req.params;
  const r = await pool.query(
    `SELECT dds.*, e.nome AS encarregado_nome, e.telefone AS encarregado_telefone
     FROM direct_debit_subscriptions dds
     JOIN encarregados e ON e.id = dds.encarregado_id
     WHERE dds.school_id = $1
     ORDER BY dds.created_at DESC`,
    [id]
  );
  return res.json(r.rows);
});

/* ─── PUT /admin/direct-debit/subscriptions/:id/approve-cancellation ─── */
router.put("/admin/direct-debit/subscriptions/:id/approve-cancellation", adminAuth, async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  await pool.query(
    `UPDATE direct_debit_subscriptions
     SET status='cancelled', cancelled_at=NOW(), cancellation_notes=$2
     WHERE id=$1`,
    [id, notes ?? null]
  );
  return res.json({ ok: true });
});

/* ═══════════════════════════════════════════════════════
   BOLSAS DE ESTUDO — Admin read routes
   ═══════════════════════════════════════════════════════ */

/* ─── GET /admin/colegios/:id/bolsas/tipos ─── */
router.get("/admin/colegios/:id/bolsas/tipos", adminAuth, async (req, res) => {
  const { id } = req.params;
  const r = await pool.query(
    `SELECT bt.*,
            COUNT(ba.id) FILTER (WHERE ba.estado='activa' AND (ba.data_fim IS NULL OR ba.data_fim >= CURRENT_DATE))::int AS total_activos
     FROM bolsa_tipos bt
     LEFT JOIN bolsa_atribuicoes ba ON ba.bolsa_tipo_id = bt.id
     WHERE bt.school_id = $1
     GROUP BY bt.id ORDER BY bt.nome`,
    [id]
  );
  res.json(r.rows);
});

/* ─── GET /admin/colegios/:id/bolsas/atribuicoes ─── */
router.get("/admin/colegios/:id/bolsas/atribuicoes", adminAuth, async (req, res) => {
  const { id } = req.params;
  const { estado } = req.query;
  const cond = estado ? "AND ba.estado=$2" : "";
  const params: any[] = [id];
  if (estado) params.push(estado);
  const r = await pool.query(
    `SELECT ba.*, s.nome AS aluno_nome, COALESCE(t.nome,'Sem turma') AS turma,
            bt.nome AS bolsa_nome, bt.tipo_desconto, bt.valor AS bolsa_valor, bt.abrangencia
     FROM bolsa_atribuicoes ba
     JOIN students s ON s.id = ba.student_id
     LEFT JOIN turmas t ON t.id = s.turma_id
     JOIN bolsa_tipos bt ON bt.id = ba.bolsa_tipo_id
     WHERE ba.school_id = $1 ${cond}
     ORDER BY ba.estado, s.nome`,
    params
  );
  res.json(r.rows);
});

/* ─── GET /admin/colegios/:id/bolsas/stats ─── */
router.get("/admin/colegios/:id/bolsas/stats", adminAuth, async (req, res) => {
  const { id } = req.params;
  const r = await pool.query(
    `SELECT
       COUNT(DISTINCT ba.id) FILTER (WHERE ba.estado='activa' AND (ba.data_fim IS NULL OR ba.data_fim >= CURRENT_DATE)) AS total_bolseiros,
       COUNT(DISTINCT bt.id) AS total_tipos,
       COALESCE(SUM(p.desconto) FILTER (WHERE p.desconto > 0), 0) AS total_desconto_historico,
       COUNT(DISTINCT p.id) FILTER (WHERE p.desconto > 0) AS propinas_com_desconto
     FROM bolsa_tipos bt
     LEFT JOIN bolsa_atribuicoes ba ON ba.bolsa_tipo_id = bt.id
     LEFT JOIN propinas p ON p.bolsa_atribuicao_id = ba.id
     WHERE bt.school_id = $1`,
    [id]
  );
  res.json(r.rows[0]);
});

/* ════════════════════════════════════════════════════════════════
   RELATÓRIOS FINANCEIROS — Volume consolidado por instituição
════════════════════════════════════════════════════════════════ */

router.get("/admin/relatorios-financeiros", adminAuth, async (req, res) => {
  /* Default: mês corrente */
  const now   = new Date();
  const dfrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const dto   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const start = req.query.start ? new Date(String(req.query.start)) : dfrom;
  const end   = req.query.end   ? new Date(new Date(String(req.query.end)).setDate(new Date(String(req.query.end)).getDate() + 1)) : dto;

  if (isNaN(start.getTime()) || isNaN(end.getTime()))
    return res.status(400).json({ error: "Datas inválidas." });

  try {
    const result = await pool.query(`
      WITH propinas_agg AS (
        SELECT
          school_id,
          COALESCE(SUM(montante - COALESCE(desconto,0) + COALESCE(multa,0)), 0) AS volume_propinas,
          COUNT(id)                                                               AS qtd_propinas
        FROM propinas
        WHERE status = 'pago'
          AND pago_em >= $1
          AND pago_em <  $2
        GROUP BY school_id
      ),
      cobrancas_agg AS (
        SELECT
          school_id::integer,
          COALESCE(SUM(montante * quantidade), 0) AS volume_cobrancas,
          COUNT(id)                                AS qtd_cobrancas
        FROM cobrancas
        WHERE status     = 'pago'
          AND created_at >= $1
          AND created_at <  $2
        GROUP BY school_id
      )
      SELECT
        s.id                                                                        AS school_id,
        s.name,
        s.email,
        COALESCE(s.commission_rate, 0)                                              AS commission_rate,
        ROUND(COALESCE(pa.volume_propinas,0) + COALESCE(ca.volume_cobrancas,0), 2) AS volume_bruto,
        ROUND(
          (COALESCE(pa.volume_propinas,0) + COALESCE(ca.volume_cobrancas,0))
          * COALESCE(s.commission_rate, 0) / 100
        , 2)                                                                        AS comissao_acumulada,
        ROUND(
          (COALESCE(pa.volume_propinas,0) + COALESCE(ca.volume_cobrancas,0))
          * (1 - COALESCE(s.commission_rate, 0) / 100)
        , 2)                                                                        AS valor_liquido,
        COALESCE(pa.qtd_propinas,0) + COALESCE(ca.qtd_cobrancas,0)                 AS qtd_transacoes
      FROM schools s
      LEFT JOIN propinas_agg pa  ON pa.school_id  = s.id
      LEFT JOIN cobrancas_agg ca ON ca.school_id  = s.id
      ORDER BY volume_bruto DESC NULLS LAST
    `, [start.toISOString(), end.toISOString()]);

    const rows = result.rows;
    const totais = {
      volume_global:    rows.reduce((a, r) => a + Number(r.volume_bruto),    0),
      comissoes_global: rows.reduce((a, r) => a + Number(r.comissao_acumulada), 0),
      liquido_global:   rows.reduce((a, r) => a + Number(r.valor_liquido),   0),
      qtd_global:       rows.reduce((a, r) => a + Number(r.qtd_transacoes),  0),
    };

    res.json({
      periodo: { start: start.toISOString().slice(0, 10), end: new Date(end.getTime() - 86400000).toISOString().slice(0, 10) },
      totais,
      por_colegio: rows,
    });
  } catch (err) {
    console.error("[relatorios-financeiros]", err);
    res.status(500).json({ error: "Erro ao calcular relatório financeiro." });
  }
});

/* ════════════════════════════════════════════════════════════════
   EMIS CONFIG — Configurações Técnicas & Parametrização
════════════════════════════════════════════════════════════════ */

/* ── Migration ──────────────────────────────────────────────── */
(async function runEmisConfigMigration() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS platform_config (
        key        TEXT PRIMARY KEY,
        value      JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by TEXT NOT NULL DEFAULT 'admin'
      );
    `);

    /* Seed default rows if missing */
    await pool.query(`
      INSERT INTO platform_config (key, value) VALUES
        ('emis_config', $1::jsonb),
        ('parametrizacao', $2::jsonb)
      ON CONFLICT (key) DO NOTHING
    `, [
      JSON.stringify({
        gpo: {
          merchant_id: "", terminal_id: "", secret_key: "",
          url_success: "", url_fail: "", url_cancel: "",
          api_url: "", environment: "sandbox",
        },
        mcx: {
          entity_code: "", api_key: "", api_url: "",
          range_start: null, range_end: null,
          expiry_value: 24, expiry_unit: "horas",
          environment: "sandbox",
        },
        debito_direto: {
          ws_url: "", ws_username: "", ws_password: "",
          mandate_creditor_id: "", mandate_creditor_name: "",
          environment: "sandbox",
        },
      }),
      JSON.stringify({
        endpoints: { gpo_rest_url: "", mcx_api_url: "", dd_soap_url: "" },
        ip_whitelist: [],
        auth: { basic_user: "", basic_pass: "", bearer_token: "" },
      }),
    ]);
  } catch (e) {
    console.error("[emis_config migration]", e);
  }
})();

/* ── Helper: mask sensitive fields for read responses ─────── */
const SENSITIVE = ["secret_key", "api_key", "ws_password", "basic_pass", "bearer_token", "private_key"];
function maskSecrets(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE.includes(k))
      out[k] = v ? "***" : "";
    else if (v && typeof v === "object" && !Array.isArray(v))
      out[k] = maskSecrets(v as Record<string, unknown>);
    else
      out[k] = v;
  }
  return out;
}

/* ── Helper: merge without overwriting existing secrets ────── */
function mergePreserveSecrets(existing: Record<string, unknown>, incoming: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (SENSITIVE.includes(k)) {
      out[k] = v === "***" ? existing[k] ?? "" : v;
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = mergePreserveSecrets(
        (existing[k] as Record<string, unknown>) ?? {},
        v as Record<string, unknown>
      );
    } else {
      out[k] = v;
    }
  }
  return out;
}

/* ─── GET /admin/emis-config ─── */
router.get("/admin/emis-config", adminAuth, async (_req, res) => {
  const r = await pool.query("SELECT value FROM platform_config WHERE key='emis_config'");
  const raw = (r.rows[0]?.value ?? {}) as Record<string, unknown>;
  res.json(maskSecrets(raw));
});

/* ─── PUT /admin/emis-config ─── */
router.put("/admin/emis-config", adminAuth, async (req, res) => {
  const incoming = req.body ?? {};
  const existing = await pool.query("SELECT value FROM platform_config WHERE key='emis_config'");
  const current = (existing.rows[0]?.value ?? {}) as Record<string, unknown>;
  const merged = mergePreserveSecrets(current, incoming);
  await pool.query(
    `UPDATE platform_config SET value=$1::jsonb, updated_at=NOW(), updated_by='admin'
     WHERE key='emis_config'`,
    [JSON.stringify(merged)]
  );
  res.json({ ok: true, config: maskSecrets(merged) });
});

/* ─── POST /admin/emis-config/test/:service ─── */
router.post("/admin/emis-config/test/:service", adminAuth, async (req, res) => {
  const { service } = req.params;
  const allowed = ["gpo", "mcx", "debito_direto", "split_payment"];
  if (!allowed.includes(service))
    return res.status(400).json({ error: `Serviço inválido. Use: ${allowed.join(", ")}.` });

  const r = await pool.query("SELECT value FROM platform_config WHERE key='emis_config'");
  const config = (r.rows[0]?.value ?? {}) as Record<string, Record<string, unknown>>;
  const svcConfig = config[service] ?? {};

  const { PaymentEngine } = await import("../services/payment-engine.js");
  const driverKey = service === "gpo" ? "GPO_EMIS" : service === "mcx" ? "MCX_REFERENCE" : "DIRECT_DEBIT";

  try {
    const result = await PaymentEngine.testConnectivity(driverKey, svcConfig);
    res.json(result);
  } catch (err: unknown) {
    res.json({ ok: false, message: (err as Error).message });
  }
});

/* ════════════════════════════════════════════════════════════════
   SPLIT PAYMENT — Parametrização por Comerciante
════════════════════════════════════════════════════════════════ */

/* ─── GET /admin/splitpay/comerciantes ─── */
router.get("/admin/splitpay/comerciantes", adminAuth, async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT s.id AS school_id, s.name, COALESCE(s.iban,'') AS school_iban,
             COALESCE(c.override_global, false)         AS override_global,
             COALESCE(c.taxa_comissao_pct, 5.00)        AS taxa_comissao_pct,
             COALESCE(c.irt_activo, true)                AS irt_activo,
             COALESCE(c.irt_taxa_pct, 6.50)             AS irt_taxa_pct,
             COALESCE(c.conta_comerciante_iban, s.iban) AS conta_comerciante_iban,
             COALESCE(c.agenda_liquidacao,'diario')      AS agenda_liquidacao,
             COALESCE(c.kyc_status,'pendente')           AS kyc_status,
             c.kyc_notas,
             c.atualizado_em
      FROM schools s
      LEFT JOIN splitpay_comerciante_config c ON c.school_id = s.id
      ORDER BY s.name
    `);
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: "Erro interno." }); }
});

/* ─── PUT /admin/splitpay/comerciantes/:school_id ─── */
router.put("/admin/splitpay/comerciantes/:school_id", adminAuth, async (req, res) => {
  try {
    const schoolId = Number(req.params.school_id);
    const { override_global, taxa_comissao_pct, irt_activo, irt_taxa_pct,
            conta_comerciante_iban, agenda_liquidacao, kyc_status, kyc_notas } = req.body;
    await pool.query(`
      INSERT INTO splitpay_comerciante_config
        (school_id, override_global, taxa_comissao_pct, irt_activo, irt_taxa_pct,
         conta_comerciante_iban, agenda_liquidacao, kyc_status, kyc_notas)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (school_id) DO UPDATE SET
        override_global       = EXCLUDED.override_global,
        taxa_comissao_pct     = EXCLUDED.taxa_comissao_pct,
        irt_activo            = EXCLUDED.irt_activo,
        irt_taxa_pct          = EXCLUDED.irt_taxa_pct,
        conta_comerciante_iban= EXCLUDED.conta_comerciante_iban,
        agenda_liquidacao     = EXCLUDED.agenda_liquidacao,
        kyc_status            = EXCLUDED.kyc_status,
        kyc_notas             = EXCLUDED.kyc_notas,
        atualizado_em         = NOW()
    `, [schoolId,
        override_global ?? false,
        taxa_comissao_pct ?? 5.00,
        irt_activo ?? true,
        irt_taxa_pct ?? 6.50,
        conta_comerciante_iban ?? null,
        agenda_liquidacao ?? "diario",
        kyc_status ?? "pendente",
        kyc_notas ?? null]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erro interno." }); }
});

/* ─── POST /admin/splitpay/simular/:school_id ─── */
router.post("/admin/splitpay/simular/:school_id", adminAuth, async (req, res) => {
  try {
    const schoolId = Number(req.params.school_id);
    const valorKz = Math.max(0.01, parseFloat(req.body?.valor_kz ?? "10000"));

    /* ── Regras globais ── */
    const globalR = await pool.query("SELECT value FROM platform_config WHERE key='emis_config'");
    const globalSP = ((globalR.rows[0]?.value ?? {}) as Record<string, Record<string, unknown>>).split_payment ?? {};

    /* ── Regras do comerciante ── */
    const mr = await pool.query(`
      SELECT s.id, s.name, s.iban,
             c.override_global, c.taxa_comissao_pct, c.irt_activo, c.irt_taxa_pct,
             c.conta_comerciante_iban, c.agenda_liquidacao, c.kyc_status
      FROM schools s
      LEFT JOIN splitpay_comerciante_config c ON c.school_id = s.id
      WHERE s.id = $1
    `, [schoolId]);
    if (!mr.rows.length) return res.status(404).json({ error: "Escola não encontrada." });
    const m = mr.rows[0];

    const useOverride = !!m.override_global;
    const taxaComissao = useOverride ? parseFloat(m.taxa_comissao_pct ?? 5) : parseFloat(String(globalSP.taxa_comissao_pct ?? 5));
    const irtActivo   = useOverride ? !!m.irt_activo                         : !!globalSP.irt_activo;
    const taxaIrt     = useOverride ? parseFloat(m.irt_taxa_pct ?? 6.5)     : parseFloat(String(globalSP.taxa_irt_pct ?? 6.5));

    const comissao = Math.round(valorKz * taxaComissao / 100 * 100) / 100;
    const irt      = irtActivo ? Math.round(comissao * taxaIrt / 100 * 100) / 100 : 0;
    const liquido  = Math.round((valorKz - comissao - irt) * 100) / 100;
    const integridadeOk = Math.abs(comissao + irt + liquido - valorKz) < 0.01;

    const kycStatus = m.kyc_status ?? "pendente";
    const kycBloqueado = kycStatus === "bloqueado";

    res.json({
      escola: { id: m.id, nome: m.name },
      kyc_status: kycStatus,
      kyc_bloqueado: kycBloqueado,
      agenda_liquidacao: m.agenda_liquidacao ?? "diario",
      conta_comerciante_iban: m.conta_comerciante_iban ?? m.iban ?? null,
      fonte_regras: useOverride ? "individual" : "global",
      regras_aplicadas: { taxa_comissao_pct: taxaComissao, irt_activo: irtActivo, irt_taxa_pct: taxaIrt },
      simulacao: {
        valor_total_kz: valorKz,
        comissao_plataforma_kz: comissao,
        retencao_irt_kz: irt,
        liquido_comerciante_kz: liquido,
        integridade_ok: integridadeOk,
      },
      aviso: kycBloqueado
        ? "⚠️ KYC bloqueado — valor líquido ficará retido em PENDING na conta de trânsito até aprovação do KYC."
        : kycStatus === "pendente"
          ? "ℹ️ KYC pendente — liquidação ficará em QUEUED até aprovação."
          : null,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erro interno." }); }
});

/* ─── GET /admin/parametrizacao ─── */
router.get("/admin/parametrizacao", adminAuth, async (_req, res) => {
  const r = await pool.query("SELECT value FROM platform_config WHERE key='parametrizacao'");
  const raw = (r.rows[0]?.value ?? {}) as Record<string, unknown>;
  res.json(maskSecrets(raw));
});

/* ─── PUT /admin/parametrizacao ─── */
router.put("/admin/parametrizacao", adminAuth, async (req, res) => {
  const incoming = req.body ?? {};
  const existing = await pool.query("SELECT value FROM platform_config WHERE key='parametrizacao'");
  const current = (existing.rows[0]?.value ?? {}) as Record<string, unknown>;
  const merged = mergePreserveSecrets(current, incoming);
  await pool.query(
    `UPDATE platform_config SET value=$1::jsonb, updated_at=NOW(), updated_by='admin'
     WHERE key='parametrizacao'`,
    [JSON.stringify(merged)]
  );
  res.json({ ok: true, config: maskSecrets(merged) });
});

/* ─── SSRF protection helper ─── */
function isPrivateIp(ip: string): boolean {
  // 🔒 SEGURANÇA: bloqueia IPs privados/internos — previne SSRF (CWE-918)
  const parts = ip.split(".").map(Number);
  if (parts.length === 4) {
    const [a, b] = parts;
    if (a === 127) return true;                         // 127.0.0.0/8 loopback
    if (a === 10) return true;                          // 10.0.0.0/8 private
    if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true;            // 192.168.0.0/16 private
    if (a === 169 && b === 254) return true;            // 169.254.0.0/16 link-local / IMDS AWS+GCP
    if (a === 0) return true;                           // 0.x.x.x reserved
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 shared address space
  }
  if (ip === "::1") return true;
  if (/^fe80:/i.test(ip)) return true;
  if (/^fc|^fd/i.test(ip)) return true;
  return false;
}

async function validateNoSSRF(rawUrl: string): Promise<void> {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { throw new Error("URL inválido."); }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Apenas HTTP/HTTPS são permitidos.");
  }

  const hostname = parsed.hostname.toLowerCase();
  const blockedHosts = [
    "localhost", "metadata.google.internal", "169.254.169.254", "instance-data",
  ];
  if (blockedHosts.includes(hostname)) throw new Error("Destino bloqueado por política de segurança.");

  // Resolve hostname → verificar IPs resolvidos contra blocklist
  try {
    const addrs = await dnsLookup(hostname, { all: true });
    for (const { address } of addrs) {
      if (isPrivateIp(address)) throw new Error("Destino bloqueado (rede interna).");
    }
  } catch (e: any) {
    if (e.message.includes("bloqueado")) throw e; // re-throw our own errors
    // DNS ENOTFOUND ou timeout — deixar o fetch falhar naturalmente
  }
}

/* ─── POST /admin/parametrizacao/test-request ─── */
router.post("/admin/parametrizacao/test-request", adminAuth, async (req, res) => {
  const { url, method = "GET", headers: extraHeaders = {}, body: bodyStr } = req.body ?? {};
  if (!url?.trim()) return res.status(400).json({ error: "URL é obrigatória." });

  // 🔒 SEGURANÇA: valida URL contra SSRF antes de qualquer fetch
  try {
    await validateNoSSRF(url.trim());
  } catch (e: any) {
    return res.status(400).json({ error: e.message ?? "URL não permitida." });
  }

  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const fetchInit: RequestInit = {
      method: (method as string).toUpperCase(),
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(extraHeaders as Record<string, string>) },
    };
    if (bodyStr && !["GET", "HEAD"].includes(fetchInit.method as string))
      (fetchInit as { body?: string }).body = bodyStr;

    const resp = await fetch(url, fetchInit);
    clearTimeout(timer);
    const ms = Date.now() - start;
    const text = await resp.text().catch(() => "");
    const truncated = text.length > 2000 ? text.slice(0, 2000) + "…" : text;

    res.json({
      ok: resp.status < 500,
      status: resp.status,
      status_text: resp.statusText,
      latency_ms: ms,
      body_preview: truncated,
      headers: Object.fromEntries(resp.headers.entries()),
    });
  } catch (err: unknown) {
    const ms = Date.now() - start;
    const e = err as { name?: string; message?: string };
    res.json({
      ok: false,
      status: 0,
      latency_ms: ms,
      message: e.name === "AbortError" ? "Timeout (10 s)" : (e.message ?? "Erro de rede"),
    });
  }
});

/* ─── POST /payments/gpo/initiate (escola → GPO payload) ─── */
router.post("/payments/gpo/initiate", adminAuth, async (req, res) => {
  const { reference, amount, student_name, school_id, description } = req.body ?? {};
  if (!reference || !amount || !school_id)
    return res.status(400).json({ error: "reference, amount e school_id são obrigatórios." });

  const cfgRow = await pool.query("SELECT value FROM platform_config WHERE key='emis_config'");
  const emisConfig = (cfgRow.rows[0]?.value ?? {}) as Record<string, unknown>;
  const gpoConfig = (emisConfig.gpo ?? {}) as Record<string, unknown>;

  const { PaymentEngine } = await import("../services/payment-engine.js");
  const result = await PaymentEngine.initiate("GPO_EMIS", {
    reference, amount: Number(amount), student_name, school_id: Number(school_id), description,
  }, gpoConfig);

  if (!result.ok) return res.status(422).json({ error: result.error });
  res.json(result.payload);
});

/* ════════════════════════════════════════════════════════════════
   DRILL-DOWN — KPI Cards Navigation Endpoints
════════════════════════════════════════════════════════════════ */

/* GET /admin/schools-list — lista minimalista para filtros dropdown */
router.get("/admin/schools-list", adminAuth, async (_req, res) => {
  try {
    const r = await pool.query("SELECT id, name FROM schools ORDER BY name");
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: "Erro interno." }); }
});

/* GET /admin/students — lista global de alunos */
router.get("/admin/students", adminAuth, async (req, res) => {
  const { search = "", school_id } = req.query;
  try {
    const params: unknown[] = [];
    let where = "WHERE 1=1";
    if (school_id && String(school_id) !== "") {
      params.push(Number(school_id));
      where += ` AND s.school_id = $${params.length}`;
    }
    if (String(search).trim()) {
      params.push(`%${String(search).trim()}%`);
      const idx = params.length;
      where += ` AND (s.nome ILIKE $${idx} OR COALESCE(s.numero_processo,'') ILIKE $${idx})`;
    }
    const r = await pool.query(`
      SELECT s.id, s.nome, s.numero_processo, s.estado, s.sexo, s.data_nascimento,
             s.nome_encarregado, s.telefone_encarregado, s.created_at,
             sc.id AS school_id, sc.name AS school_name,
             t.id AS turma_id, t.nome AS turma_nome, t.ano AS turma_ano
      FROM students s
      JOIN schools sc ON sc.id = s.school_id
      LEFT JOIN turmas t ON t.id = s.turma_id
      ${where}
      ORDER BY sc.name, s.nome
      LIMIT 500
    `, params);
    res.json({ total: r.rowCount, alunos: r.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erro interno." }); }
});

/* GET /admin/classes — distribuição de turmas por colégio */
router.get("/admin/classes", adminAuth, async (req, res) => {
  const { school_id } = req.query;
  try {
    const params: unknown[] = [];
    let where = "WHERE 1=1";
    if (school_id && String(school_id) !== "") {
      params.push(Number(school_id));
      where += ` AND t.school_id = $${params.length}`;
    }
    const r = await pool.query(`
      SELECT t.id, t.nome, t.ano, t.turno, t.created_at,
             sc.id AS school_id, sc.name AS school_name,
             COUNT(s.id)::int AS total_alunos,
             COUNT(s.id) FILTER (WHERE s.estado = 'activo')::int AS alunos_activos
      FROM turmas t
      JOIN schools sc ON sc.id = t.school_id
      LEFT JOIN students s ON s.turma_id = t.id
      ${where}
      GROUP BY t.id, sc.id, sc.name
      ORDER BY sc.name, t.nome
    `, params);
    res.json({ total: r.rowCount, turmas: r.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erro interno." }); }
});

/* GET /admin/finance/overdue — propinas vencidas (inadimplência global) */
router.get("/admin/finance/overdue", adminAuth, async (req, res) => {
  const { search = "", school_id } = req.query;
  try {
    const params: unknown[] = [];
    let where = "WHERE p.status = 'vencido'";
    if (school_id && String(school_id) !== "") {
      params.push(Number(school_id));
      where += ` AND p.school_id = $${params.length}`;
    }
    if (String(search).trim()) {
      params.push(`%${String(search).trim()}%`);
      where += ` AND s.nome ILIKE $${params.length}`;
    }
    const r = await pool.query(`
      SELECT p.id, p.mes, p.ano, p.montante, p.multa, p.desconto, p.data_vencimento, p.created_at,
             s.id AS student_id, s.nome AS aluno_nome, s.numero_processo,
             sc.id AS school_id, sc.name AS school_name,
             t.nome AS turma_nome
      FROM propinas p
      JOIN students s ON s.id = p.student_id
      JOIN schools sc ON sc.id = p.school_id
      LEFT JOIN turmas t ON t.id = s.turma_id
      ${where}
      ORDER BY p.data_vencimento ASC NULLS LAST, sc.name
      LIMIT 500
    `, params);
    const totais = {
      qtd:    r.rowCount ?? 0,
      divida: r.rows.reduce((a, row) => a + Number(row.montante) + Number(row.multa ?? 0) - Number(row.desconto ?? 0), 0),
      multas: r.rows.reduce((a, row) => a + Number(row.multa ?? 0), 0),
    };
    res.json({ totais, propinas: r.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erro interno." }); }
});

/* GET /admin/finance/receipts — histórico de recebimentos */
router.get("/admin/finance/receipts", adminAuth, async (req, res) => {
  const { search = "", school_id, start, end } = req.query;
  const now   = new Date();
  const dfrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const dto   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startDate = start ? new Date(String(start)) : dfrom;
  const endDate   = end
    ? new Date(new Date(String(end)).setDate(new Date(String(end)).getDate() + 1))
    : dto;
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()))
    return res.status(400).json({ error: "Datas inválidas." });
  try {
    const params: unknown[] = [startDate.toISOString(), endDate.toISOString()];
    let where = "WHERE p.status = 'pago' AND p.pago_em >= $1 AND p.pago_em < $2";
    if (school_id && String(school_id) !== "") {
      params.push(Number(school_id));
      where += ` AND p.school_id = $${params.length}`;
    }
    if (String(search).trim()) {
      params.push(`%${String(search).trim()}%`);
      where += ` AND s.nome ILIKE $${params.length}`;
    }
    const r = await pool.query(`
      SELECT p.id, p.mes, p.ano, p.montante, p.multa, p.desconto, p.pago_em,
             p.metodo_pagamento, p.payment_channel, p.referencia, p.internal_reference,
             p.baixa_manual, p.baixa_manual_por,
             s.id AS student_id, s.nome AS aluno_nome, s.numero_processo,
             sc.id AS school_id, sc.name AS school_name
      FROM propinas p
      JOIN students s ON s.id = p.student_id
      JOIN schools sc ON sc.id = p.school_id
      ${where}
      ORDER BY p.pago_em DESC
      LIMIT 500
    `, params);
    const totais = {
      qtd:    r.rowCount ?? 0,
      volume: r.rows.reduce((a, row) => a + Number(row.montante) - Number(row.desconto ?? 0) + Number(row.multa ?? 0), 0),
    };
    res.json({
      periodo: {
        start: startDate.toISOString().slice(0, 10),
        end:   new Date(endDate.getTime() - 86400000).toISOString().slice(0, 10),
      },
      totais,
      recibos: r.rows,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erro interno." }); }
});

/* GET /admin/finance/reconciliation — carteira de cobranças pendentes por escola */
router.get("/admin/finance/reconciliation", adminAuth, async (req, res) => {
  const { school_id } = req.query;
  try {
    const params: unknown[] = [];
    let where = "WHERE p.status = 'vencido'";
    if (school_id && String(school_id) !== "") {
      params.push(Number(school_id));
      where += ` AND p.school_id = $${params.length}`;
    }
    const [sumR, detailR] = await Promise.all([
      pool.query(`
        SELECT sc.id AS school_id, sc.name AS school_name, sc.commission_rate,
               COUNT(p.id)::int AS qtd_vencidas,
               ROUND(SUM(p.montante + COALESCE(p.multa,0) - COALESCE(p.desconto,0)), 2) AS divida_total,
               ROUND(SUM(COALESCE(p.multa,0)), 2) AS total_multas,
               MIN(p.data_vencimento) AS mais_antiga
        FROM propinas p
        JOIN schools sc ON sc.id = p.school_id
        ${where}
        GROUP BY sc.id, sc.name, sc.commission_rate
        ORDER BY divida_total DESC
      `, params),
      pool.query(`
        SELECT p.id, p.mes, p.ano, p.montante, p.multa, p.desconto, p.data_vencimento,
               s.nome AS aluno_nome, s.numero_processo,
               p.school_id, t.nome AS turma_nome
        FROM propinas p
        JOIN students s ON s.id = p.student_id
        LEFT JOIN turmas t ON t.id = s.turma_id
        ${where}
        ORDER BY p.school_id, p.data_vencimento ASC NULLS LAST
        LIMIT 500
      `, params),
    ]);
    const totais = {
      divida_global: sumR.rows.reduce((a, r) => a + Number(r.divida_total), 0),
      qtd_global:    sumR.rows.reduce((a, r) => a + r.qtd_vencidas, 0),
      multas_global: sumR.rows.reduce((a, r) => a + Number(r.total_multas), 0),
    };
    res.json({ totais, por_escola: sumR.rows, detalhe: detailR.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erro interno." }); }
});

/* ── Helpers FCM — cifra/decifra private_key antes de guardar/usar ─────────── */

/**
 * Cifra private_key em cada ambiente (test/production/staging/dev) do objecto
 * fcm_config antes de persistir na BD.
 * Retrocompatível: valores já cifrados (enc:...) ou "***" são preservados.
 */
function encryptFcmConfig(config: Record<string, any>): Record<string, any> {
  const ENV_KEYS = ["test", "production", "staging", "dev"];
  const out = { ...config };
  for (const env of ENV_KEYS) {
    const creds = out[env];
    if (!creds || typeof creds !== "object") continue;
    const pk = creds.private_key as string | undefined;
    if (pk && typeof pk === "string" && pk !== "***" && !pk.startsWith("enc:")) {
      out[env] = { ...creds, private_key: encodeSecret(pk) };
    }
  }
  return out;
}

/**
 * Decifra private_key em cada ambiente para uso em chamadas de API.
 * Retrocompatível: valores sem prefixo enc: são devolvidos tal como estão.
 */
function decryptFcmConfig(config: Record<string, any>): Record<string, any> {
  const ENV_KEYS = ["test", "production", "staging", "dev"];
  const out = { ...config };
  for (const env of ENV_KEYS) {
    const creds = out[env];
    if (!creds || typeof creds !== "object") continue;
    const pk = creds.private_key as string | undefined;
    if (pk && typeof pk === "string" && pk !== "***") {
      try { out[env] = { ...creds, private_key: decodeSecret(pk) }; } catch { /* mantém */ }
    }
  }
  return out;
}

/* ─── GET /admin/fcm-config ─── */
router.get("/admin/fcm-config", adminAuth, async (_req, res) => {
  const r = await pool.query("SELECT value FROM platform_config WHERE key='fcm_config'");
  const raw = (r.rows[0]?.value ?? {}) as Record<string, unknown>;
  res.json(maskSecrets(raw));
});

/* ─── PUT /admin/fcm-config ─── */
router.put("/admin/fcm-config", adminAuth, async (req, res) => {
  const incoming = req.body ?? {};
  const existing = await pool.query("SELECT value FROM platform_config WHERE key='fcm_config'");
  const current = (existing.rows[0]?.value ?? {}) as Record<string, unknown>;
  const merged = mergePreserveSecrets(current, incoming);
  const toStore = encryptFcmConfig(merged);
  await pool.query(
    `INSERT INTO platform_config (key, value, updated_at, updated_by)
     VALUES ('fcm_config', $1::jsonb, NOW(), 'admin')
     ON CONFLICT (key) DO UPDATE SET value=$1::jsonb, updated_at=NOW(), updated_by='admin'`,
    [JSON.stringify(toStore)]
  );
  res.json({ ok: true, config: maskSecrets(toStore) });
});

/* ─── POST /admin/fcm-config/test ─── */
router.post("/admin/fcm-config/test", adminAuth, async (req, res) => {
  const { fcm_token, env } = req.body;
  if (!fcm_token?.trim()) return res.status(400).json({ error: "fcm_token é obrigatório para testar." });

  const r = await pool.query("SELECT value FROM platform_config WHERE key='fcm_config'");
  const config = (r.rows[0]?.value ?? {}) as any;
  if (!config) return res.status(400).json({ error: "Configuração FCM não encontrada. Guarde as credenciais primeiro." });

  const activeEnv = env ?? config.active_env ?? "test";
  const decrypted = decryptFcmConfig(config);
  const creds = decrypted[activeEnv];
  if (!creds?.project_id || !creds?.client_email || !creds?.private_key || creds.private_key === "***")
    return res.status(400).json({ error: `Credenciais FCM do ambiente '${activeEnv}' estão incompletas ou não foram guardadas.` });

  try {
    const { sendFcmBatch } = await import("./fcm.js");
    const result = await sendFcmBatch(
      creds, [fcm_token.trim()],
      "🔔 Teste FCM — Kiwara Tech",
      "Push notification de teste enviada com sucesso! As credenciais estão funcionais.",
      { tipo: "teste" }
    );
    return res.json({ ok: result.sent > 0, ...result, environment: activeEnv });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message ?? "Erro ao enviar push de teste." });
  }
});

/* ─── POST /admin/school/email/test ───────────────────────────────────────
   Diagnóstico síncrono das credenciais SMTP/SendGrid de uma escola.
   Acesso exclusivo a administradores (adminAuth → admin_sessions).
   Devolve o veredicto imediatamente — não usa a fila assíncrona (setImmediate).
──────────────────────────────────────────────────────────────────────────── */
router.post("/admin/school/email/test", adminAuth, async (req, res) => {
  const { school_id, destination_email } = req.body;

  /* ── 1. Validação do payload ── */
  if (!school_id) {
    return res.status(400).json({
      success: false,
      error:   "school_id é obrigatório.",
    });
  }

  const schoolIdNum = parseInt(String(school_id), 10);
  if (isNaN(schoolIdNum) || schoolIdNum <= 0) {
    return res.status(400).json({
      success: false,
      error:   "school_id deve ser um número inteiro positivo.",
    });
  }

  if (!destination_email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination_email.trim())) {
    return res.status(400).json({
      success: false,
      error:   "destination_email inválido. Forneça um endereço de e-mail válido.",
    });
  }

  const destEmail = destination_email.trim();

  /* ── 2. Confirma que a escola existe e tem configuração de e-mail ── */
  const [schoolRow, cfgRow] = await Promise.all([
    pool.query("SELECT name FROM schools WHERE id=$1", [schoolIdNum]),
    pool.query(
      `SELECT provider_type, email_from, activo
       FROM school_email_config
       WHERE school_id=$1`,
      [schoolIdNum]
    ),
  ]);

  if (!schoolRow.rows[0]) {
    return res.status(404).json({
      success: false,
      error:   `Escola com id ${schoolIdNum} não encontrada.`,
    });
  }

  const escolaNome: string = schoolRow.rows[0].name;

  if (!cfgRow.rows[0]) {
    return res.status(400).json({
      success:   false,
      error:     `A escola "${escolaNome}" não tem configuração de e-mail. Configure as credenciais antes de testar.`,
      escola:    escolaNome,
      school_id: schoolIdNum,
    });
  }

  if (!cfgRow.rows[0].activo) {
    return res.status(400).json({
      success:   false,
      error:     `A configuração de e-mail da escola "${escolaNome}" está desactivada (activo=false).`,
      escola:    escolaNome,
      school_id: schoolIdNum,
      provider:  cfgRow.rows[0].provider_type,
    });
  }

  const provider: string  = cfgRow.rows[0].provider_type;
  const emailFrom: string = cfgRow.rows[0].email_from;
  const testedAt          = new Date().toLocaleString("pt-AO", { timeZone: "Africa/Luanda" });

  /* ── 3. Corpo HTML do e-mail de diagnóstico ── */
  const html = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#f8fafc;padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0"
               style="max-width:520px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background:#1a56db;padding:24px 32px;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.6);">
                Kiwara Tech · Backoffice Admin
              </p>
              <h1 style="margin:8px 0 0;font-size:18px;font-weight:700;color:#fff;">
                ✓ Diagnóstico de Configuração de E-mail
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
                Este e-mail confirma que as credenciais de <strong>${provider}</strong>
                configuradas para a escola <strong>${escolaNome}</strong>
                estão operacionais e o envio está funcional.
              </p>

              <!-- Detail grid -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:20px;">
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td style="font-size:12px;color:#6b7280;">Escola</td>
                      <td align="right" style="font-size:13px;font-weight:600;color:#111827;">${escolaNome}</td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;background:#f9fafb;border-bottom:1px solid #f3f4f6;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td style="font-size:12px;color:#6b7280;">Fornecedor</td>
                      <td align="right" style="font-size:13px;font-weight:600;color:#111827;">${provider}</td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td style="font-size:12px;color:#6b7280;">Remetente (email_from)</td>
                      <td align="right" style="font-size:13px;font-weight:600;color:#111827;">${emailFrom}</td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;background:#f9fafb;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td style="font-size:12px;color:#6b7280;">Data/Hora do Teste</td>
                      <td align="right" style="font-size:13px;font-weight:600;color:#111827;">${testedAt}</td>
                    </tr></table>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;
                        border-left:3px solid #dbeafe;padding-left:10px;">
                Teste iniciado pelo painel de administração do Kiwara Tech.
                Nenhuma acção é necessária por parte da escola.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                Kiwara Tech · Diagnóstico automático · ${testedAt}
              </p>
            </td>
          </tr>

        </table>
      </td></tr>
    </table>`;

  /* ── 4. Envio síncrono — veredicto imediato ── */
  const result = await sendSchoolEmail(
    schoolIdNum,
    destEmail,
    `[TESTE] Diagnóstico de Configuração — ${escolaNome}`,
    html
  );

  if (result.status === "SENT") {
    return res.json({
      success:    true,
      message:    `E-mail de diagnóstico enviado com sucesso para ${destEmail}.`,
      escola:     escolaNome,
      school_id:  schoolIdNum,
      provider,
      email_from: emailFrom,
      message_id: result.messageId ?? null,
      log_id:     result.logId,
      tested_at:  testedAt,
    });
  }

  /* ── Falha: devolve o erro do MTA tal como chegou ── */
  const rawError = result.erro ?? "Erro desconhecido.";

  /*
   * Classifica o código HTTP de retorno consoante a causa:
   *   400 — problema de configuração ou credenciais (admin deve corrigir)
   *   502 — credenciais válidas mas rejeição pelo fornecedor remoto
   *   500 — erro inesperado no servidor
   */
  let httpStatus = 500;
  if (rawError.includes("AUTH_CREDENTIALS") || rawError.includes("CONFIG")) httpStatus = 400;
  else if (rawError.includes("SPF_DKIM") || rawError.includes("SPAM"))       httpStatus = 502;

  return res.status(httpStatus).json({
    success:         false,
    error:           "Falha no envio do e-mail de teste. Verifique as credenciais e tente novamente.",
    detalhe:         rawError,
    escola:          escolaNome,
    school_id:       schoolIdNum,
    provider,
    email_from:      emailFrom,
    log_id:          result.logId,
    tested_at:       testedAt,
    accoes_sugeridas: httpStatus === 400
      ? "Verifique smtp_host, smtp_user e smtp_password (ou sendgrid_api_key). Guarde novamente e repita o teste."
      : httpStatus === 502
        ? "As credenciais foram aceites mas o domínio foi rejeitado. Verifique os registos SPF/DKIM do domínio email_from."
        : "Erro de conectividade. Verifique se o host SMTP está acessível a partir do servidor.",
  });
});

/* ═══════════════════════════════════════════════════════════════════
   LOGS & ALERTAS — Monitorização e registos de actividade
═══════════════════════════════════════════════════════════════════ */

/* ─── GET /admin/db-health ─── */
router.get("/admin/db-health", adminAuth, async (_req, res) => {
  try {
    const [connRes, sizesRes, deadRes, sessRes, countsRes] = await Promise.all([
      pool.query(`
        SELECT state, count(*)::int AS count
        FROM pg_stat_activity
        WHERE datname = current_database()
        GROUP BY state ORDER BY count DESC
      `),
      pool.query(`
        SELECT c.relname AS table_name,
               pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
               pg_total_relation_size(c.oid)::bigint AS size_bytes
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY size_bytes DESC LIMIT 10
      `),
      pool.query(`
        SELECT relname AS table_name,
               n_dead_tup::int AS dead_tup,
               n_live_tup::int AS live_tup,
               CASE WHEN n_live_tup > 0
                    THEN round((n_dead_tup::numeric / n_live_tup) * 100, 1)
                    ELSE 0 END AS dead_ratio,
               to_char(last_vacuum,     'DD/MM/YYYY HH24:MI') AS last_vacuum,
               to_char(last_autovacuum, 'DD/MM/YYYY HH24:MI') AS last_autovacuum
        FROM pg_stat_user_tables
        WHERE n_live_tup > 0
        ORDER BY n_dead_tup DESC LIMIT 10
      `),
      pool.query(`
        SELECT
          (SELECT count(*)::int FROM sessions       WHERE expires_at < NOW()) AS expired_admin,
          (SELECT count(*)::int FROM guardian_sessions WHERE expires_at < NOW()) AS expired_guardian,
          (SELECT count(*)::int FROM staff_sessions WHERE expires_at < NOW()) AS expired_staff
      `),
      pool.query(`
        SELECT
          (SELECT count(*)::bigint FROM sms_logs)                                         AS sms_total,
          (SELECT count(*)::bigint FROM sms_logs WHERE data_envio > NOW() - interval '30 days') AS sms_30d,
          (SELECT count(*)::bigint FROM access_audit_log)                                 AS audit_total,
          (SELECT count(*)::bigint FROM access_audit_log WHERE created_at > NOW() - interval '30 days') AS audit_30d,
          (SELECT count(*)::bigint FROM manual_payment_logs)                              AS payments_total,
          (SELECT count(*)::bigint FROM dd_audit_log)                                     AS dd_audit_total,
          (SELECT count(*)::bigint FROM sms_logs WHERE status='failed' AND data_envio > NOW() - interval '24 hours') AS sms_failed_24h
      `),
    ]);

    let slowQueries: any[] = [];
    try {
      const sqRes = await pool.query(`
        SELECT substring(query, 1, 120) AS query_short,
               calls::int,
               round(mean_exec_time::numeric, 1) AS mean_ms,
               round(total_exec_time::numeric, 1) AS total_ms
        FROM pg_stat_statements
        WHERE mean_exec_time > 500 AND query NOT ILIKE '%pg_stat%'
        ORDER BY total_exec_time DESC LIMIT 10
      `);
      slowQueries = sqRes.rows;
    } catch (_) { /* extensão não instalada — ignorar */ }

    res.json({
      connections:      connRes.rows,
      table_sizes:      sizesRes.rows,
      dead_tuples:      deadRes.rows,
      expired_sessions: sessRes.rows[0] ?? null,
      log_counts:       countsRes.rows[0] ?? null,
      slow_queries:     slowQueries,
      fetched_at:       new Date().toISOString(),
    });
  } catch (e) {
    console.error("[db-health]", e);
    res.status(500).json({ error: "Erro ao obter métricas da base de dados." });
  }
});

/* ─── GET /admin/logs/access ─── */
router.get("/admin/logs/access", adminAuth, async (req, res) => {
  try {
    const page   = Math.max(1, Number(req.query.page) || 1);
    const limit  = 50;
    const offset = (page - 1) * limit;
    const search = (req.query.search as string ?? "").trim();

    const params: any[] = [];
    let where = "WHERE 1=1";
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (actor ILIKE $${params.length} OR acao ILIKE $${params.length} OR alvo ILIKE $${params.length} OR ip ILIKE $${params.length})`;
    }

    const [logsRes, countRes] = await Promise.all([
      pool.query(
        `SELECT id, school_id, actor, actor_tipo, acao, alvo, ip, created_at,
                detalhe::text AS detalhe_json
         FROM access_audit_log ${where}
         ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
      pool.query(`SELECT count(*)::int AS total FROM access_audit_log ${where}`, params),
    ]);

    res.json({ logs: logsRes.rows, total: countRes.rows[0].total, page, limit });
  } catch (e) {
    console.error("[logs/access]", e);
    res.status(500).json({ error: "Erro ao carregar logs de auditoria." });
  }
});

/* ─── GET /admin/logs/sms ─── */
router.get("/admin/logs/sms", adminAuth, async (req, res) => {
  try {
    const page   = Math.max(1, Number(req.query.page) || 1);
    const limit  = 50;
    const offset = (page - 1) * limit;
    const search = (req.query.search as string ?? "").trim();

    const params: any[] = [];
    let where = "WHERE 1=1";
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (telefone ILIKE $${params.length} OR mensagem ILIKE $${params.length} OR evento ILIKE $${params.length})`;
    }

    const [logsRes, countRes] = await Promise.all([
      pool.query(
        `SELECT id, school_id, telefone, mensagem, status, evento, data_envio
         FROM sms_logs ${where}
         ORDER BY data_envio DESC LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
      pool.query(`SELECT count(*)::int AS total FROM sms_logs ${where}`, params),
    ]);

    res.json({ logs: logsRes.rows, total: countRes.rows[0].total, page, limit });
  } catch (e) {
    console.error("[logs/sms]", e);
    res.status(500).json({ error: "Erro ao carregar logs de SMS." });
  }
});

/* ─── GET /admin/logs/payments ─── */
router.get("/admin/logs/payments", adminAuth, async (req, res) => {
  try {
    const page   = Math.max(1, Number(req.query.page) || 1);
    const limit  = 50;
    const offset = (page - 1) * limit;

    const [logsRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ml.id, ml.propina_id, ml.created_at,
                ml.metadata::text AS metadata_json,
                p.mes, p.ano, p.montante, p.status AS propina_status,
                s.nome AS aluno_nome,
                sc.name AS escola_nome
         FROM manual_payment_logs ml
         LEFT JOIN propinas p  ON p.id = ml.propina_id
         LEFT JOIN students s  ON s.id = p.student_id
         LEFT JOIN schools sc  ON sc.id = p.school_id
         ORDER BY ml.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
        []
      ),
      pool.query(`SELECT count(*)::int AS total FROM manual_payment_logs`),
    ]);

    res.json({ logs: logsRes.rows, total: countRes.rows[0].total, page, limit });
  } catch (e) {
    console.error("[logs/payments]", e);
    res.status(500).json({ error: "Erro ao carregar logs de pagamentos." });
  }
});

export default router;


