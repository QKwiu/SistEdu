import { Router } from "express";
import { randomBytes } from "crypto";
import { pool } from "@workspace/db";
import { sendBulkSMS } from "../services/sms.service";
import multer from "multer";
import path from "path";
import fs from "fs";

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

const ADMIN_USER = process.env.ADMIN_USERNAME ?? "Superaadmin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD ?? "Superaadmin";

/* ─── Auth helpers ─── */
async function adminAuth(req: any, res: any, next: any) {
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
router.post("/admin/login", async (req, res) => {
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

  const { default: bcrypt } = await import("bcryptjs");
  const hash = await bcrypt.hash(password || "Kiwara@2025", 10);
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
    function deepMerge(target: any, source: any): any {
      const out = { ...target };
      for (const key of Object.keys(source ?? {})) {
        if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key]))
          out[key] = deepMerge(target[key] ?? {}, source[key]);
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
    `SELECT s.*, COUNT(DISTINCT st.id)::int AS total_alunos, COUNT(DISTINCT t.id)::int AS total_turmas
     FROM schools s
     LEFT JOIN students st ON st.school_id = s.id
     LEFT JOIN turmas t    ON t.school_id  = s.id
     WHERE s.id=$1 GROUP BY s.id`,
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
  const hash = await bcrypt.hash(new_password, 10);
  await pool.query("UPDATE schools SET password_hash=$1 WHERE id=$2", [hash, req.params.id]);
  res.json({ ok: true });
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
function deepMerge(base: any, override: any): any {
  const result = { ...base };
  for (const key of Object.keys(override ?? {})) {
    if (override[key] !== null && typeof override[key] === "object" && !Array.isArray(override[key])
        && base[key] !== null && typeof base[key] === "object" && !Array.isArray(base[key])) {
      result[key] = deepMerge(base[key], override[key]);
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
  const merged = deepMerge(DEFAULT_SETTINGS, stored);

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
  const prevSettings = deepMerge(DEFAULT_SETTINGS, existing.rows[0]?.settings ?? {});
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

  const changes: Record<string, { de: any; para: any }> = {};
  for (const key of Object.keys(metodos_pagamento)) {
    if (previousMetodos[key] !== newPagamento.metodos_pagamento[key]) {
      changes[key] = { de: previousMetodos[key], para: newPagamento.metodos_pagamento[key] };
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
}, async (req: any, res: any) => {
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

export default router;
