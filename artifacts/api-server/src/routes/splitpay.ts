import { Router } from "express";
import { pool } from "@workspace/db";
import { randomUUID } from "crypto";

const router = Router();

/* ─── DB Migration ─── */
export async function runSplitPayMigration(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS splitpay_config (
      id                    SERIAL PRIMARY KEY,
      school_id             INTEGER REFERENCES schools(id) ON DELETE CASCADE UNIQUE,
      taxa_comissao_pct     DECIMAL(5,2) NOT NULL DEFAULT 5.00,
      taxa_irt_pct          DECIMAL(5,2) NOT NULL DEFAULT 6.50,
      conta_transito        TEXT,
      conta_plataforma_iban TEXT,
      ativo                 BOOLEAN NOT NULL DEFAULT true,
      criado_em             TIMESTAMP NOT NULL DEFAULT NOW(),
      atualizado_em         TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS splitpay_transacoes (
      id                        SERIAL PRIMARY KEY,
      school_id                 INTEGER REFERENCES schools(id) ON DELETE CASCADE,
      idempotency_key           TEXT UNIQUE NOT NULL,
      valor_total               BIGINT NOT NULL,
      taxa_comissao_pct         DECIMAL(5,2) NOT NULL,
      taxa_irt_pct              DECIMAL(5,2) NOT NULL,
      comissao_plataforma       BIGINT NOT NULL,
      retencao_irt              BIGINT NOT NULL,
      valor_liquido_comerciante BIGINT NOT NULL,
      conta_destino             TEXT NOT NULL,
      estado                    TEXT NOT NULL DEFAULT 'PENDING',
      referencia_emis           TEXT,
      descricao                 TEXT,
      aluno_nome                TEXT,
      propina_id                INTEGER,
      tentativas                INTEGER NOT NULL DEFAULT 0,
      erro_descricao            TEXT,
      criado_em                 TIMESTAMP NOT NULL DEFAULT NOW(),
      atualizado_em             TIMESTAMP NOT NULL DEFAULT NOW(),
      liquidado_em              TIMESTAMP,
      CONSTRAINT chk_estado CHECK (estado IN ('PENDING','CLEARING','SETTLED','FAILED')),
      CONSTRAINT chk_integridade CHECK (comissao_plataforma + retencao_irt + valor_liquido_comerciante = valor_total)
    );

    CREATE INDEX IF NOT EXISTS idx_splitpay_transacoes_school ON splitpay_transacoes(school_id);
    CREATE INDEX IF NOT EXISTS idx_splitpay_transacoes_estado ON splitpay_transacoes(estado);
  `);
  console.log("[splitpay] migration ok");
}

/* ─── Auth helpers ─── */
async function getSchoolFromToken(token: string) {
  const r = await pool.query(
    `SELECT sc.id AS school_id, sc.name AS school_name
     FROM sessions s
     JOIN schools sc ON sc.id = s.school_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );
  return r.rows[0] ?? null;
}
function schoolAuth(req: any, res: any, next: any) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado." });
  req.schoolToken = h.slice(7);
  next();
}

/* ─── Split engine ─── */
function calcularSplit(valorTotal: bigint, taxaComissaoPct: number, taxaIrtPct: number) {
  const comissao = BigInt(Math.floor(Number(valorTotal) * taxaComissaoPct / 100));
  const retencaoIrt = BigInt(Math.floor(Number(comissao) * taxaIrtPct / 100));
  const valorLiquido = valorTotal - comissao - retencaoIrt;
  const integridadeOk = comissao + retencaoIrt + valorLiquido === valorTotal;
  return { comissao, retencaoIrt, valorLiquido, integridadeOk };
}

/* ─── Helpers ─── */
async function getOrCreateConfig(schoolId: number) {
  let r = await pool.query("SELECT * FROM splitpay_config WHERE school_id=$1", [schoolId]);
  if (!r.rows.length) {
    r = await pool.query(
      `INSERT INTO splitpay_config (school_id) VALUES ($1) RETURNING *`,
      [schoolId]
    );
  }
  return r.rows[0];
}

/* ═══════════════════════════════════════════
   GET /school/splitpay/config
   ═══════════════════════════════════════════ */
router.get("/school/splitpay/config", schoolAuth, async (req: any, res) => {
  try {
    const school = await getSchoolFromToken(req.schoolToken);
    if (!school) return res.status(401).json({ error: "Sessão inválida." });
    const cfg = await getOrCreateConfig(school.school_id);
    res.json(cfg);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════
   PUT /school/splitpay/config
   ═══════════════════════════════════════════ */
router.put("/school/splitpay/config", schoolAuth, async (req: any, res) => {
  try {
    const school = await getSchoolFromToken(req.schoolToken);
    if (!school) return res.status(401).json({ error: "Sessão inválida." });

    const { taxa_comissao_pct, taxa_irt_pct, conta_transito, conta_plataforma_iban, ativo } = req.body;

    if (taxa_comissao_pct !== undefined && (taxa_comissao_pct < 0 || taxa_comissao_pct > 50))
      return res.status(400).json({ error: "taxa_comissao_pct deve estar entre 0 e 50." });
    if (taxa_irt_pct !== undefined && (taxa_irt_pct < 0 || taxa_irt_pct > 100))
      return res.status(400).json({ error: "taxa_irt_pct deve estar entre 0 e 100." });

    await getOrCreateConfig(school.school_id);
    const r = await pool.query(
      `UPDATE splitpay_config SET
        taxa_comissao_pct     = COALESCE($2, taxa_comissao_pct),
        taxa_irt_pct          = COALESCE($3, taxa_irt_pct),
        conta_transito        = COALESCE($4, conta_transito),
        conta_plataforma_iban = COALESCE($5, conta_plataforma_iban),
        ativo                 = COALESCE($6, ativo),
        atualizado_em         = NOW()
       WHERE school_id=$1 RETURNING *`,
      [school.school_id, taxa_comissao_pct ?? null, taxa_irt_pct ?? null,
       conta_transito ?? null, conta_plataforma_iban ?? null, ativo ?? null]
    );
    res.json(r.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════
   POST /school/splitpay/simular
   ═══════════════════════════════════════════ */
router.post("/school/splitpay/simular", schoolAuth, async (req: any, res) => {
  try {
    const school = await getSchoolFromToken(req.schoolToken);
    if (!school) return res.status(401).json({ error: "Sessão inválida." });

    const { valor_total, taxa_comissao_pct, taxa_irt_pct } = req.body;
    if (!valor_total || valor_total <= 0)
      return res.status(400).json({ error: "valor_total inválido." });

    const cfg = await getOrCreateConfig(school.school_id);
    const comissaoPct = Number(taxa_comissao_pct ?? cfg.taxa_comissao_pct);
    const irtPct = Number(taxa_irt_pct ?? cfg.taxa_irt_pct);

    const vTotal = BigInt(Math.round(valor_total));
    const { comissao, retencaoIrt, valorLiquido, integridadeOk } = calcularSplit(vTotal, comissaoPct, irtPct);

    res.json({
      valor_total: Number(vTotal),
      taxa_comissao_pct: comissaoPct,
      taxa_irt_pct: irtPct,
      comissao_plataforma: Number(comissao),
      retencao_irt: Number(retencaoIrt),
      valor_liquido_comerciante: Number(valorLiquido),
      integridade_ok: integridadeOk,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════
   POST /school/splitpay/transacoes
   ═══════════════════════════════════════════ */
router.post("/school/splitpay/transacoes", schoolAuth, async (req: any, res) => {
  try {
    const school = await getSchoolFromToken(req.schoolToken);
    if (!school) return res.status(401).json({ error: "Sessão inválida." });

    const { valor_total, conta_destino, descricao, aluno_nome, propina_id, referencia_emis, idempotency_key } = req.body;

    if (!valor_total || valor_total <= 0) return res.status(400).json({ error: "valor_total inválido." });
    if (!conta_destino?.trim()) return res.status(400).json({ error: "conta_destino (IBAN comerciante) é obrigatório." });

    const cfg = await getOrCreateConfig(school.school_id);
    const comissaoPct = Number(cfg.taxa_comissao_pct);
    const irtPct = Number(cfg.taxa_irt_pct);

    const vTotal = BigInt(Math.round(valor_total));
    const { comissao, retencaoIrt, valorLiquido, integridadeOk } = calcularSplit(vTotal, comissaoPct, irtPct);

    if (!integridadeOk) {
      return res.status(422).json({ error: "Falha na validação de integridade: soma dos créditos não é igual ao débito." });
    }

    const ikey = idempotency_key ?? randomUUID();

    const existing = await pool.query("SELECT * FROM splitpay_transacoes WHERE idempotency_key=$1", [ikey]);
    if (existing.rows.length) return res.json(existing.rows[0]);

    const r = await pool.query(
      `INSERT INTO splitpay_transacoes
         (school_id, idempotency_key, valor_total, taxa_comissao_pct, taxa_irt_pct,
          comissao_plataforma, retencao_irt, valor_liquido_comerciante,
          conta_destino, descricao, aluno_nome, propina_id, referencia_emis)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [school.school_id, ikey, Number(vTotal), comissaoPct, irtPct,
       Number(comissao), Number(retencaoIrt), Number(valorLiquido),
       conta_destino.trim(), descricao ?? null, aluno_nome ?? null,
       propina_id ?? null, referencia_emis ?? null]
    );

    res.status(201).json(r.rows[0]);
  } catch (e: any) {
    if (e.code === "23505") return res.status(409).json({ error: "Transacção duplicada (idempotency_key já existe)." });
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════
   GET /school/splitpay/transacoes
   ═══════════════════════════════════════════ */
router.get("/school/splitpay/transacoes", schoolAuth, async (req: any, res) => {
  try {
    const school = await getSchoolFromToken(req.schoolToken);
    if (!school) return res.status(401).json({ error: "Sessão inválida." });

    const { estado, limit = "50", offset = "0" } = req.query as any;
    const params: any[] = [school.school_id, parseInt(limit), parseInt(offset)];
    let where = "WHERE school_id=$1";
    if (estado) { where += ` AND estado=$${params.length + 1}`; params.push(estado); }

    const r = await pool.query(
      `SELECT * FROM splitpay_transacoes ${where} ORDER BY criado_em DESC LIMIT $2 OFFSET $3`,
      params
    );
    const total = await pool.query(
      `SELECT COUNT(*) FROM splitpay_transacoes ${where}`,
      params.slice(0, estado ? 4 : 1).concat(estado ? [] : [])
    );
    res.json({ transacoes: r.rows, total: parseInt((total.rows[0] as any).count) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════
   GET /school/splitpay/transacoes/:id
   ═══════════════════════════════════════════ */
router.get("/school/splitpay/transacoes/:id", schoolAuth, async (req: any, res) => {
  try {
    const school = await getSchoolFromToken(req.schoolToken);
    if (!school) return res.status(401).json({ error: "Sessão inválida." });
    const r = await pool.query(
      "SELECT * FROM splitpay_transacoes WHERE id=$1 AND school_id=$2",
      [req.params.id, school.school_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Transacção não encontrada." });
    res.json(r.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════
   POST /school/splitpay/transacoes/:id/liquidar
   Advance: PENDING → CLEARING → SETTLED
   ═══════════════════════════════════════════ */
router.post("/school/splitpay/transacoes/:id/liquidar", schoolAuth, async (req: any, res) => {
  try {
    const school = await getSchoolFromToken(req.schoolToken);
    if (!school) return res.status(401).json({ error: "Sessão inválida." });

    const r = await pool.query(
      "SELECT * FROM splitpay_transacoes WHERE id=$1 AND school_id=$2",
      [req.params.id, school.school_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Transacção não encontrada." });
    const tx = r.rows[0];

    const transitions: Record<string, string> = { PENDING: "CLEARING", CLEARING: "SETTLED" };
    const next = transitions[tx.estado];
    if (!next) return res.status(400).json({ error: `Não é possível avançar do estado ${tx.estado}.` });

    const updated = await pool.query(
      `UPDATE splitpay_transacoes SET estado=$1, atualizado_em=NOW(),
        liquidado_em = CASE WHEN $1='SETTLED' THEN NOW() ELSE liquidado_em END,
        tentativas = tentativas + 1
       WHERE id=$2 RETURNING *`,
      [next, tx.id]
    );
    res.json(updated.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════
   POST /school/splitpay/transacoes/:id/falhar
   Mark as FAILED with reason
   ═══════════════════════════════════════════ */
router.post("/school/splitpay/transacoes/:id/falhar", schoolAuth, async (req: any, res) => {
  try {
    const school = await getSchoolFromToken(req.schoolToken);
    if (!school) return res.status(401).json({ error: "Sessão inválida." });

    const { motivo } = req.body;
    const r = await pool.query(
      "SELECT * FROM splitpay_transacoes WHERE id=$1 AND school_id=$2",
      [req.params.id, school.school_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Transacção não encontrada." });
    const tx = r.rows[0];
    if (tx.estado === "SETTLED") return res.status(400).json({ error: "Não é possível falhar uma transacção já liquidada." });

    const updated = await pool.query(
      `UPDATE splitpay_transacoes SET estado='FAILED', erro_descricao=$1, atualizado_em=NOW()
       WHERE id=$2 RETURNING *`,
      [motivo ?? "Falha manual", tx.id]
    );
    res.json(updated.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════
   POST /school/splitpay/transacoes/:id/reprocessar
   FAILED → PENDING (retry)
   ═══════════════════════════════════════════ */
router.post("/school/splitpay/transacoes/:id/reprocessar", schoolAuth, async (req: any, res) => {
  try {
    const school = await getSchoolFromToken(req.schoolToken);
    if (!school) return res.status(401).json({ error: "Sessão inválida." });

    const r = await pool.query(
      "SELECT * FROM splitpay_transacoes WHERE id=$1 AND school_id=$2",
      [req.params.id, school.school_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Transacção não encontrada." });
    const tx = r.rows[0];
    if (tx.estado !== "FAILED") return res.status(400).json({ error: "Só transacções FAILED podem ser reprocessadas." });
    if (tx.tentativas >= 5) return res.status(400).json({ error: "Limite de 5 tentativas atingido. Requer intervenção manual." });

    const updated = await pool.query(
      `UPDATE splitpay_transacoes SET estado='PENDING', erro_descricao=NULL, atualizado_em=NOW()
       WHERE id=$2 RETURNING *`,
      [tx.id]
    );
    res.json(updated.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════
   GET /school/splitpay/ledger
   Aggregated stats per state
   ═══════════════════════════════════════════ */
router.get("/school/splitpay/ledger", schoolAuth, async (req: any, res) => {
  try {
    const school = await getSchoolFromToken(req.schoolToken);
    if (!school) return res.status(401).json({ error: "Sessão inválida." });

    const r = await pool.query(
      `SELECT
         estado,
         COUNT(*)                         AS num_transacoes,
         COALESCE(SUM(valor_total),0)     AS total_captado,
         COALESCE(SUM(comissao_plataforma),0) AS total_comissao,
         COALESCE(SUM(retencao_irt),0)    AS total_irt,
         COALESCE(SUM(valor_liquido_comerciante),0) AS total_liquido
       FROM splitpay_transacoes
       WHERE school_id=$1
       GROUP BY estado`,
      [school.school_id]
    );

    const global = await pool.query(
      `SELECT
         COUNT(*)                         AS num_transacoes,
         COALESCE(SUM(valor_total),0)     AS total_captado,
         COALESCE(SUM(comissao_plataforma),0) AS total_comissao,
         COALESCE(SUM(retencao_irt),0)    AS total_irt,
         COALESCE(SUM(valor_liquido_comerciante),0) AS total_liquido
       FROM splitpay_transacoes WHERE school_id=$1`,
      [school.school_id]
    );

    res.json({ por_estado: r.rows, global: global.rows[0] });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
