import { Router, type Request, type Response, type NextFunction } from "express";
import { toError } from "../lib/errors";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { pool } from "@workspace/db";
import { loginRateLimiter, pinResetLimiter } from "../lib/rate-limiters";

const router = Router();

async function getGuardianFromToken(token: string) {
  // 🔒 SEGURANÇA: selecção explícita — exclui campo 'password' (bcrypt hash) da resposta
  const res = await pool.query(
    `SELECT e.id, e.nome, e.telefone, e.email, e.first_login, e.created_at
     FROM encarregados e
     JOIN guardian_sessions gs ON gs.encarregado_id = e.id
     WHERE gs.token = $1 AND gs.expires_at > NOW()`,
    [token]
  );
  return res.rows[0] ?? null;
}

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado." });
  req.guardianToken = header.slice(7);
  next();
}

// POST /guardian/login — phone + password
router.post("/guardian/login", loginRateLimiter, async (req, res) => {
  const { telefone, password } = req.body;
  if (!telefone || !password) {
    return res.status(400).json({ error: "Telemóvel e palavra-passe obrigatórios." });
  }

  const clean = telefone.replace(/\D/g, "");
  const result = await pool.query(
    "SELECT id, nome, telefone, password, first_login FROM encarregados WHERE telefone = $1",
    [clean]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Número não encontrado. Contacte o secretariado." });
  }

  const guardian = result.rows[0];

  if (!guardian.password) {
    return res.status(403).json({ error: "Conta não configurada. Contacte o secretariado." });
  }

  const valid = await bcrypt.compare(password, guardian.password);
  if (!valid) {
    return res.status(401).json({ error: "Palavra-passe incorreta." });
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await pool.query(
    "INSERT INTO guardian_sessions (encarregado_id, token, expires_at) VALUES ($1,$2,$3)",
    [guardian.id, token, expiresAt]
  );

  return res.json({
    token,
    first_login: guardian.first_login,
    guardian: { id: guardian.id, nome: guardian.nome, telefone: guardian.telefone },
  });
});

// POST /guardian/recuperar-pin — reset PIN to "1234" and force first_login
router.post("/guardian/recuperar-pin", pinResetLimiter, async (req, res) => {
  const { telefone } = req.body;
  if (!telefone) return res.status(400).json({ error: "Número de telemóvel obrigatório." });

  const clean = String(telefone).replace(/\D/g, "");
  const result = await pool.query(
    "SELECT id, nome FROM encarregados WHERE telefone = $1",
    [clean]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Número não encontrado. Verifique se está registado no sistema." });
  }

  // 🔒 SEGURANÇA: bcrypt cost 12
  const hash = await bcrypt.hash("1234", 12);
  await pool.query(
    "UPDATE encarregados SET password = $1, first_login = TRUE WHERE id = $2",
    [hash, result.rows[0].id]
  );

  return res.json({ success: true, nome: result.rows[0].nome });
});

// POST /guardian/change-password — obrigatório no primeiro login
router.post("/guardian/change-password", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const { nova_senha, confirmar_senha } = req.body;
  if (!nova_senha || nova_senha.length < 6) {
    return res.status(400).json({ error: "A nova palavra-passe deve ter pelo menos 6 caracteres." });
  }
  if (nova_senha !== confirmar_senha) {
    return res.status(400).json({ error: "As palavras-passe não coincidem." });
  }

  // 🔒 SEGURANÇA: bcrypt cost 12
  const hash = await bcrypt.hash(nova_senha, 12);
  await pool.query(
    "UPDATE encarregados SET password = $1, first_login = FALSE WHERE id = $2",
    [hash, guardian.id]
  );

  return res.json({ success: true, message: "Palavra-passe atualizada com sucesso." });
});

// GET /guardian/me
router.get("/guardian/me", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });
  return res.json({
    id: guardian.id,
    nome: guardian.nome,
    telefone: guardian.telefone,
    first_login: guardian.first_login,
  });
});

// GET /guardian/alunos — lista alunos com resumo financeiro + nome e logo da escola
router.get("/guardian/alunos", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const result = await pool.query(`
    SELECT
      s.id,
      s.nome,
      s.bilhete,
      s.school_id,
      sc.name AS school_name,
      sc.logo_url AS school_logo_url,
      sc.institution_type,
      sc.portal_nomenclatura,
      COALESCE(sc.commission_model, 'EMBEDDED') AS commission_model,
      COALESCE(sc.commission_value, 0) AS commission_value,
      COALESCE(sc.commission_value_type, 'PERCENTAGE') AS commission_value_type,
      t.nome AS turma,
      t.turno,
      COALESCE(SUM(CASE WHEN p.status != 'pago' THEN (p.montante + p.multa) ELSE 0 END), 0) AS divida_total,
      COALESCE(SUM(CASE WHEN p.status != 'pago' THEN p.multa ELSE 0 END), 0) AS total_multas,
      COUNT(CASE WHEN p.status = 'vencido' THEN 1 END) AS propinas_vencidas,
      COUNT(CASE WHEN p.status = 'pendente' THEN 1 END) AS propinas_pendentes
    FROM encarregado_aluno ea
    JOIN students s ON s.id = ea.aluno_id
    JOIN schools sc ON sc.id = s.school_id
    LEFT JOIN turmas t ON t.id = s.turma_id
    LEFT JOIN propinas p ON p.student_id = s.id
    WHERE ea.encarregado_id = $1
    GROUP BY s.id, s.nome, s.bilhete, s.school_id, sc.name, sc.logo_url, sc.institution_type, sc.portal_nomenclatura, sc.commission_model, sc.commission_value, sc.commission_value_type, t.nome, t.turno
    ORDER BY sc.name, s.nome
  `, [guardian.id]);

  return res.json(result.rows);
});

// GET /guardian/alunos/:id/propinas
router.get("/guardian/alunos/:id/propinas", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const { id } = req.params;
  const check = await pool.query(
    "SELECT 1 FROM encarregado_aluno WHERE encarregado_id=$1 AND aluno_id=$2",
    [guardian.id, id]
  );
  if (check.rows.length === 0) return res.status(403).json({ error: "Acesso negado." });

  // Auto-update vencido status and apply multa based on school rule
  // Process both 'pendente' (not yet marked overdue) and 'vencido' with multa=0 (already overdue but fine not yet calculated)
  const overdueRes = await pool.query(
    `SELECT p.id, p.montante, p.multa, p.school_id, p.data_vencimento, p.status
     FROM propinas p
     WHERE p.student_id=$1
       AND p.data_vencimento < NOW()
       AND p.status IN ('pendente','vencido')
       AND (p.baixa_manual IS NULL OR p.baixa_manual = false)`,
    [id]
  );

  if (overdueRes.rows.length > 0) {
    // Load school multa rule once (all propinas belong to same school)
    const schoolId = overdueRes.rows[0].school_id;
    const regraRes = await pool.query(
      "SELECT * FROM multa_regras WHERE school_id=$1", [schoolId]
    );
    const regra = regraRes.rows[0] ?? null;
    const now = new Date();
    const today = now.getDate();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();

    for (const p of overdueRes.rows) {
      const venc = new Date(p.data_vencimento);
      const isPreviousMonth =
        venc.getFullYear() < thisYear ||
        (venc.getFullYear() === thisYear && venc.getMonth() < thisMonth);

      let multa = Number(p.multa);
      if (regra && regra.aplica_automatico) {
        const modelo = Number(regra.modelo ?? 1);
        if (modelo === 1) {
          if (isPreviousMonth || today > Number(regra.dia_limite)) {
            multa = Number(p.montante) * (Number(regra.percentagem) / 100);
          }
        } else if (modelo === 2) {
          const brackets = Array.isArray(regra.brackets) ? regra.brackets : [];
          if (isPreviousMonth && brackets.length > 0) {
            // Past month: apply highest bracket
            multa = Number(p.montante) * (Number(brackets[brackets.length - 1].percentagem) / 100);
          } else {
            for (const b of brackets) {
              if (today >= Number(b.dia_inicio) && today <= Number(b.dia_fim)) {
                multa = Number(p.montante) * (Number(b.percentagem) / 100);
                break;
              }
            }
            if (multa === Number(p.multa) && brackets.length > 0 && today > Number(brackets[brackets.length - 1].dia_fim)) {
              multa = Number(p.montante) * (Number(brackets[brackets.length - 1].percentagem) / 100);
            }
          }
        } else if (modelo === 3) {
          if (isPreviousMonth || today > Number(regra.dia_limite)) {
            multa = Number(regra.valor_fixo);
          }
        }
      }
      await pool.query(
        "UPDATE propinas SET status='vencido', multa=$1 WHERE id=$2",
        [multa, p.id]
      );
    }
  } else {
    // Mark remaining overdue pendente as vencido even without fine rule
    await pool.query(
      "UPDATE propinas SET status='vencido' WHERE student_id=$1 AND status='pendente' AND data_vencimento < NOW()",
      [id]
    );
  }

  const result = await pool.query(`
    SELECT
      p.id, p.mes, p.ano,
      p.montante AS valor_base,
      p.multa,
      COALESCE(p.desconto, 0) AS desconto,
      (p.montante + p.multa - COALESCE(p.desconto,0)) AS total,
      CASE
        WHEN p.status = 'pendente'       AND pg.estado = 'PENDENTE' THEN 'ACTIVA'
        WHEN p.status = 'pendente'                                   THEN 'FUTURA'
        WHEN p.status = 'vencido'                                    THEN 'VENCIDA'
        WHEN p.status = 'contingencia'                               THEN 'CONTINGENCIA'
        WHEN p.status IN ('pago','pago_com_atraso')                  THEN 'PAGO'
        WHEN p.status = 'pre_pago'                                   THEN 'PRE_PAGO'
        WHEN p.status = 'pago_anulado'                               THEN 'PAGO_ANULADO'
        WHEN p.status = 'isento'                                     THEN 'ISENTO'
        WHEN p.status = 'pago_manual_pendente'                       THEN 'PAGO_MANUAL_PENDENTE'
        WHEN p.status = 'pago_manual'                                THEN 'PAGO_MANUAL'
        ELSE UPPER(p.status)
      END AS estado,
      p.data_vencimento,
      p.bolsa_atribuicao_id,
      p.pago_em,
      p.metodo_pagamento,
      p.comprovante_url,
      pg.id AS pagamento_id,
      pg.entidade,
      pg.referencia,
      pg.valor AS ref_valor,
      UPPER(pg.estado) AS ref_estado,
      pg.validade
    FROM propinas p
    LEFT JOIN pagamentos pg ON pg.propina_id = p.id AND pg.estado = 'PENDENTE'
    WHERE p.student_id = $1
    ORDER BY p.ano DESC,
      CASE p.mes
        WHEN 'Janeiro' THEN 1 WHEN 'Fevereiro' THEN 2 WHEN 'Março' THEN 3
        WHEN 'Abril' THEN 4 WHEN 'Maio' THEN 5 WHEN 'Junho' THEN 6
        WHEN 'Julho' THEN 7 WHEN 'Agosto' THEN 8 WHEN 'Setembro' THEN 9
        WHEN 'Outubro' THEN 10 WHEN 'Novembro' THEN 11 WHEN 'Dezembro' THEN 12
      END
  `, [id]);

  return res.json(result.rows);
});

// GET /guardian/payments/available-methods — métodos de pagamento disponíveis (suporta ?school_id=N para multi-escola)
router.get("/guardian/payments/available-methods", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  // school_id_int = schools.id (integer PK), used in school_settings
  let school_id_int: number | null = null;

  if (req.query.school_id) {
    const explicit = await pool.query(
      `SELECT sc.id FROM schools sc
       JOIN students s ON s.school_id = sc.id
       JOIN encarregado_aluno ea ON ea.aluno_id = s.id
       WHERE sc.id = $1 AND ea.encarregado_id = $2 LIMIT 1`,
      [req.query.school_id, guardian.id]
    );
    school_id_int = explicit.rows[0]?.id ?? null;
  }

  if (!school_id_int) {
    const schoolRes = await pool.query(
      `SELECT DISTINCT s.school_id FROM students s
       JOIN encarregado_aluno ea ON ea.aluno_id = s.id
       WHERE ea.encarregado_id = $1 LIMIT 1`,
      [guardian.id]
    );
    school_id_int = schoolRes.rows[0]?.school_id ?? null;
  }

  if (!school_id_int) {
    return res.json({ allow_reference: true, allow_gpo_mcx: false, allow_direct_debit: false, direct_debit: null });
  }

  const r = await pool.query(
    "SELECT settings FROM school_settings WHERE school_id = $1",
    [school_id_int]
  );
  const settings = r.rows[0]?.settings ?? {};
  const metodos = settings?.pagamento?.metodos_pagamento ?? { allow_reference: true, allow_gpo_mcx: false, allow_direct_debit: false };
  const directDebit = settings?.pagamento?.direct_debit ?? null;

  return res.json({ ...metodos, direct_debit: directDebit });
});

// Generate random 9-digit Multicaixa reference
function generateRef(): string {
  const digits = randomBytes(5).readUInt32BE(0) % 900000000 + 100000000;
  return String(digits);
}

// POST /guardian/pagamentos/gerar — gera referência combinada para propinas e/ou emolumentos
router.post("/guardian/pagamentos/gerar", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const { propina_ids = [], method, emolumento_items = [] } = req.body as {
    propina_ids: number[]; method?: string; emolumento_items?: any[];
  };
  if (!propina_ids?.length && !emolumento_items?.length)
    return res.status(400).json({ error: "Selecione pelo menos uma propina ou emolumento." });

  // Validate that the requested payment method is enabled for this school
  const schoolLookup = await pool.query(
    `SELECT DISTINCT s.school_id FROM students s
     JOIN encarregado_aluno ea ON ea.aluno_id = s.id
     WHERE ea.encarregado_id = $1 LIMIT 1`,
    [guardian.id]
  );
  if (schoolLookup.rows.length > 0) {
    const sid = schoolLookup.rows[0].school_id;
    const settingsRow = await pool.query("SELECT settings FROM school_settings WHERE school_id = $1", [sid]);
    const m = settingsRow.rows[0]?.settings?.pagamento?.metodos_pagamento ?? { allow_reference: true, allow_gpo_mcx: false, allow_direct_debit: false };
    const requestedMethod = method ?? "reference";
    if (requestedMethod === "reference" && !m.allow_reference)
      return res.status(403).json({ error: "Pagamento por referência não está disponível nesta escola." });
    if (requestedMethod === "gpo_mcx" && !m.allow_gpo_mcx)
      return res.status(403).json({ error: "Pagamento via Multicaixa Express não está disponível nesta escola." });
    if (requestedMethod === "direct_debit" && !m.allow_direct_debit)
      return res.status(403).json({ error: "Débito direto não está disponível nesta escola." });
  }

  const schoolId = schoolLookup.rows[0]?.school_id ?? null;

  // Verify all propinas belong to guardian's students
  let checkRows: any[] = [];
  if (propina_ids.length) {
    const placeholders = propina_ids.map((_,i) => `$${i+2}`).join(",");
    const checkRes = await pool.query(`
      SELECT p.id, p.student_id, p.mes, p.ano, p.montante, p.multa, p.status
      FROM propinas p
      JOIN encarregado_aluno ea ON ea.aluno_id = p.student_id
      WHERE ea.encarregado_id = $1 AND p.id IN (${placeholders}) AND p.status != 'pago'
    `, [guardian.id, ...propina_ids]);
    if (checkRes.rows.length !== propina_ids.length)
      return res.status(403).json({ error: "Propinas inválidas ou já pagas." });
    checkRows = checkRes.rows;
  }

  // Validate emolumento_items against school's emolumentos
  const validItems: any[] = [];
  for (const item of emolumento_items) {
    const { emolumento_id, student_id, descricao, montante, quantidade = 1 } = item;
    if (!descricao || !montante) continue;
    if (emolumento_id && schoolId !== null) {
      const emCheck = await pool.query(
        `SELECT id FROM emolumentos WHERE id=$1 AND (school_id=$2 OR school_id IS NULL)`,
        [emolumento_id, schoolId]
      );
      if (!emCheck.rows.length) continue;
    }
    validItems.push({ emolumento_id: emolumento_id ?? null, student_id: student_id ?? null, descricao, montante: Number(montante), quantidade: Number(quantidade) || 1 });
  }

  // Reference number: deterministic from propina IDs, or random if only emolumentos
  let refNum: string;
  if (propina_ids.length) {
    const sorted = [...propina_ids].sort((a,b) => a-b);
    const seed = sorted.join("-");
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    refNum = String(Math.abs(hash) % 900000000 + 100000000);
  } else {
    refNum = generateRef();
  }

  const ENTIDADE = "00456";
  const totalPropinas = checkRows.reduce((s: number, r: any) => s + Number(r.montante) + Number(r.multa), 0);
  const totalEmolumentos = validItems.reduce((s, i) => s + i.montante * i.quantidade, 0);
  const totalValor = totalPropinas + totalEmolumentos;

  // Validade: last day of latest month (propinas) or 30 days from now (emolumentos-only)
  let validade: string;
  if (checkRows.length) {
    const MES_NUM: Record<string, number> = {
      'Janeiro':1,'Fevereiro':2,'Março':3,'Abril':4,'Maio':5,'Junho':6,
      'Julho':7,'Agosto':8,'Setembro':9,'Outubro':10,'Novembro':11,'Dezembro':12
    };
    const latest = checkRows.reduce((acc: any, r: any) => {
      const rYear = parseInt(r.ano), rMonth = MES_NUM[r.mes] ?? 1;
      if (!acc || rYear > acc.year || (rYear === acc.year && rMonth > acc.month)) return { year: rYear, month: rMonth };
      return acc;
    }, null);
    const lastDay = new Date(latest.year, latest.month, 0);
    lastDay.setHours(23, 59, 59, 0);
    validade = lastDay.toISOString();
  } else {
    const d = new Date(); d.setDate(d.getDate() + 30);
    validade = d.toISOString();
  }

  // Upsert pagamentos for each propina
  for (const row of checkRows) {
    await pool.query(`
      INSERT INTO pagamentos (propina_id, entidade, referencia, valor, validade, estado)
      VALUES ($1, $2, $3, $4, $5, 'PENDENTE')
      ON CONFLICT (propina_id) DO UPDATE
        SET entidade = $2, referencia = $3, valor = $4, validade = $5, estado = 'PENDENTE'
    `, [row.id, ENTIDADE, refNum, totalValor, validade]);
  }

  // Insert cobrancas for each emolumento item
  const cobrancasCreated: any[] = [];
  for (const item of validItems) {
    const r = await pool.query(
      `INSERT INTO cobrancas (school_id, student_id, emolumento_id, descricao, montante, quantidade, status, referencia, entidade, validade)
       VALUES ($1,$2,$3,$4,$5,$6,'pendente',$7,$8,$9) RETURNING *`,
      [String(schoolId), item.student_id, item.emolumento_id, item.descricao, item.montante, item.quantidade, refNum, ENTIDADE, validade]
    );
    cobrancasCreated.push(r.rows[0]);
  }

  const propinaDetails = checkRows.map((r: any) => ({
    id: r.id, mes: r.mes, ano: r.ano,
    valor_base: Number(r.montante),
    multa: Number(r.multa),
    total: Number(r.montante) + Number(r.multa),
  }));

  return res.json({
    entidade: ENTIDADE,
    referencia: refNum,
    valor: totalValor,
    total_base: totalPropinas,
    total_emolumentos: totalEmolumentos,
    validade,
    propinas: propinaDetails,
    cobrancas: cobrancasCreated,
  });
});

// GET /guardian/emolumentos — available non-propina emolumentos for the guardian's school
router.get("/guardian/emolumentos", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const schoolLookup = await pool.query(
    `SELECT DISTINCT s.school_id FROM students s
     JOIN encarregado_aluno ea ON ea.aluno_id = s.id
     WHERE ea.encarregado_id = $1 LIMIT 1`,
    [guardian.id]
  );
  if (!schoolLookup.rows.length) return res.json([]);
  const sid = schoolLookup.rows[0].school_id;

  const r = await pool.query(
    `SELECT id, tipo, nome, montante, ano_lectivo
     FROM emolumentos
     WHERE (school_id = $1 OR school_id IS NULL) AND tipo != 'propina' AND activo = TRUE
     ORDER BY tipo, nome`,
    [sid]
  );
  return res.json(r.rows);
});

// POST /guardian/pagamentos/gpo-checkout — audit + EMIS GPO initiation
router.post("/guardian/pagamentos/gpo-checkout", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const { propina_ids } = req.body as { propina_ids: number[] };
  if (!Array.isArray(propina_ids) || propina_ids.length === 0)
    return res.status(400).json({ error: "Selecione pelo menos uma propina." });

  // Resolve school_id and validate GPO is enabled
  const schoolLookup = await pool.query(
    `SELECT DISTINCT s.school_id FROM students s
     JOIN encarregado_aluno ea ON ea.aluno_id = s.id
     WHERE ea.encarregado_id = $1 LIMIT 1`,
    [guardian.id]
  );
  if (schoolLookup.rows.length === 0)
    return res.status(400).json({ error: "Sem educandos associados." });

  const school_id = schoolLookup.rows[0].school_id;
  const settingsRow = await pool.query("SELECT settings FROM school_settings WHERE school_id = $1", [school_id]);
  const m = settingsRow.rows[0]?.settings?.pagamento?.metodos_pagamento ?? {};
  if (!m.allow_gpo_mcx)
    return res.status(403).json({ error: "Pagamento via Multicaixa Express não está disponível nesta escola." });

  // Verify all propinas belong to guardian's students and are unpaid
  const placeholders = propina_ids.map((_,i) => `$${i+2}`).join(",");
  const checkRes = await pool.query(`
    SELECT p.id, p.student_id, p.mes, p.ano, p.montante, p.multa
    FROM propinas p
    JOIN encarregado_aluno ea ON ea.aluno_id = p.student_id
    WHERE ea.encarregado_id = $1 AND p.id IN (${placeholders}) AND p.status != 'pago'
  `, [guardian.id, ...propina_ids]);

  if (checkRes.rows.length !== propina_ids.length)
    return res.status(403).json({ error: "Propinas inválidas ou já pagas." });

  const totalValor = checkRes.rows.reduce((s: number, r: any) => s + Number(r.montante) + Number(r.multa), 0);

  // Generate unique transaction ID
  const txnSuffix = randomBytes(4).toString("hex").toUpperCase();
  const transaction_id = `GPO-${Date.now()}-${txnSuffix}`;

  // Simulated EMIS GPO redirect URL (production would call real EMIS GPO API)
  const redirect_url = `https://gpo.emis.ao/checkout?txn=${transaction_id}&valor=${totalValor.toFixed(2)}&origem=propinaplus&escola=${school_id}`;

  // Persist audit record BEFORE any redirect — ensures traceability
  await pool.query(
    `INSERT INTO gpo_checkout_attempts
       (encarregado_id, school_id, propina_ids, valor, transaction_id, status, redirect_url)
     VALUES ($1, $2, $3, $4, $5, 'INITIATED', $6)`,
    [guardian.id, school_id, JSON.stringify(propina_ids), totalValor, transaction_id, redirect_url]
  );

  console.log(`[GPO] Checkout iniciado — txn=${transaction_id} encarregado=${guardian.id} valor=${totalValor} propinas=${propina_ids.join(",")}`);

  const propinas_detail = checkRes.rows.map((r: any) => ({
    id: r.id, mes: r.mes, ano: r.ano,
    valor_base: Number(r.montante),
    multa: Number(r.multa),
    total: Number(r.montante) + Number(r.multa),
  }));

  return res.json({
    transaction_id,
    redirect_url,
    valor: totalValor,
    propinas: propinas_detail,
  });
});

// POST /guardian/pagamentos/mcx-express — iniciar pagamento MCX Express (QR Code ou Push)
router.post("/guardian/pagamentos/mcx-express", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const { propina_ids, notif_type = "QR", telefone } = req.body as {
    propina_ids: number[];
    notif_type?: "QR" | "PUSH";
    telefone?: string;
  };

  if (!Array.isArray(propina_ids) || propina_ids.length === 0)
    return res.status(400).json({ error: "Selecione pelo menos uma propina." });

  if (notif_type === "PUSH" && !telefone?.trim())
    return res.status(400).json({ error: "Modo PUSH requer o campo telefone." });

  /* Resolver escola */
  const schoolLookup = await pool.query(
    `SELECT DISTINCT s.school_id FROM students s
     JOIN encarregado_aluno ea ON ea.aluno_id = s.id
     WHERE ea.encarregado_id = $1 LIMIT 1`,
    [guardian.id]
  );
  if (!schoolLookup.rows.length)
    return res.status(400).json({ error: "Sem educandos associados." });

  const school_id = schoolLookup.rows[0].school_id;

  /* Verificar se MCX Express está habilitado nesta escola */
  const settingsRow = await pool.query("SELECT settings FROM school_settings WHERE school_id=$1", [school_id]);
  const m = settingsRow.rows[0]?.settings?.pagamento?.metodos_pagamento ?? {};
  if (!m.allow_gpo_mcx)
    return res.status(403).json({ error: "Multicaixa Express não está disponível nesta escola." });

  /* Verificar que as propinas pertencem ao encarregado e estão por pagar */
  const placeholders = propina_ids.map((_, i) => `$${i + 2}`).join(",");
  const checkRes = await pool.query(`
    SELECT p.id, p.student_id, p.mes, p.ano, p.montante, p.multa, p.internal_reference,
           st.nome AS nome_aluno
    FROM propinas p
    JOIN encarregado_aluno ea ON ea.aluno_id = p.student_id
    LEFT JOIN students st ON st.id = p.student_id
    WHERE ea.encarregado_id = $1 AND p.id IN (${placeholders}) AND p.status != 'pago'
  `, [guardian.id, ...propina_ids]);

  if (checkRes.rows.length !== propina_ids.length)
    return res.status(403).json({ error: "Propinas inválidas ou já pagas." });

  const totalValor = checkRes.rows.reduce((s: number, r: any) => s + Number(r.montante) + Number(r.multa), 0);

  /* Buscar config MCX Express da escola (guardada em emis_config) */
  const emisRow = await pool.query("SELECT config FROM emis_config WHERE school_id=$1", [school_id]);
  const emisCfg = emisRow.rows[0]?.config ?? {};
  const mcxCfg = emisCfg.mcx ?? {};

  const merchant_id = mcxCfg.merchant_id ?? `MCX-SCHOOL-${school_id}`;
  const api_key     = mcxCfg.api_key ?? "";
  const api_url     = mcxCfg.api_url ?? "";

  /* Gerar transactionId */
  const transactionId = `MCXE-${school_id}-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const timestamp     = new Date().toISOString();
  const currency      = "AOA";
  const amount_str    = totalValor.toFixed(2);

  /* HMAC-SHA256 igual ao GPO (merchant_id + transactionId + amount + currency) */
  const { createHmac } = await import("crypto");
  const raw       = `${merchant_id}${transactionId}${amount_str}${currency}`;
  const signature = api_key
    ? createHmac("sha256", api_key).update(raw).digest("hex").toUpperCase()
    : "NO_KEY_CONFIGURED";

  /* Guardar tentativa para auditoria */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mcx_express_attempts (
      id              SERIAL PRIMARY KEY,
      encarregado_id  INTEGER NOT NULL,
      school_id       INTEGER NOT NULL,
      propina_ids     JSONB NOT NULL,
      valor           NUMERIC(14,2) NOT NULL,
      transaction_id  TEXT NOT NULL,
      notif_type      TEXT NOT NULL DEFAULT 'QR',
      telefone        TEXT,
      status          TEXT NOT NULL DEFAULT 'INITIATED',
      signature       TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  await pool.query(
    `INSERT INTO mcx_express_attempts
       (encarregado_id, school_id, propina_ids, valor, transaction_id, notif_type, telefone, status, signature)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'INITIATED',$8)`,
    [guardian.id, school_id, JSON.stringify(propina_ids), totalValor,
     transactionId, notif_type, telefone ?? null, signature]
  );

  console.log(`[MCX Express] Iniciado — txn=${transactionId} type=${notif_type} escola=${school_id} valor=${totalValor}`);

  const propinas_detail = checkRes.rows.map((r: any) => ({
    id: r.id, mes: r.mes, ano: r.ano,
    nome_aluno: r.nome_aluno,
    valor_base: Number(r.montante),
    multa: Number(r.multa),
    total: Number(r.montante) + Number(r.multa),
    internal_reference: r.internal_reference,
  }));

  const response: Record<string, unknown> = {
    ok: true,
    transaction_id: transactionId,
    notif_type,
    valor: totalValor,
    currency,
    merchant_id,
    signature,
    propinas: propinas_detail,
  };

  if (notif_type === "PUSH") {
    response.telefone      = telefone;
    response.push_url      = `${api_url}/push-notification`.replace("//push", "/push");
    response.pending_timeout = 120;
    response.mensagem      = `Pedido de autorização enviado para ${telefone}. Aceite na App Multicaixa Express em ${response.pending_timeout}s.`;
  } else {
    /* QR payload codificado conforme standard Multicaixa Express */
    response.qr_payload = `MCX:${transactionId}:${amount_str}:${currency}:${merchant_id}:${signature}`;
    response.qr_url     = `${api_url}/qrcode/${transactionId}`.replace("//qrcode", "/qrcode");
    response.mensagem   = "Mostre o QR Code ao cliente para pagamento via App Multicaixa Express.";
  }

  return res.status(201).json(response);
});

// POST /guardian/propinas/:id/gerar-referencia — re-gerar referência EMIS expirada (portal encarregado)
router.post("/guardian/propinas/:id/gerar-referencia", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const propId = Number(req.params.id);

  /* Verificar que a propina pertence a um educando deste encarregado */
  const check = await pool.query(`
    SELECT p.*, s.nome AS aluno_nome, s.school_id,
           pg.estado AS ref_estado
    FROM propinas p
    JOIN students s ON s.id = p.student_id
    JOIN encarregado_aluno ea ON ea.aluno_id = p.student_id
    LEFT JOIN pagamentos pg ON pg.propina_id = p.id
    WHERE p.id=$1 AND ea.encarregado_id=$2
  `, [propId, guardian.id]);

  if (!check.rows.length)
    return res.status(403).json({ error: "Propina não encontrada ou sem permissão." });

  const p = check.rows[0];

  if (p.status === "pago" || p.status === "pago_com_atraso")
    return res.status(400).json({ error: "Propina já paga — não é possível re-gerar referência." });

  if (p.ref_estado === "PENDENTE")
    return res.status(400).json({ error: "Referência ainda activa. Aguarde que expire para re-gerar." });

  const { requestEMISReference, getDiaVencimento } = await import("../services/emis.service");
  const diaVenc = await getDiaVencimento(p.school_id);
  const emisResp = await requestEMISReference({
    school_id:     p.school_id,
    propina_id:    propId,
    montante:      Number(p.montante) + Number(p.multa),
    aluno_nome:    p.aluno_nome,
    mes:           p.mes,
    ano:           p.ano,
    diaVencimento: diaVenc,
  });

  await pool.query(
    `INSERT INTO pagamentos (propina_id, entidade, referencia, valor, estado, validade)
     VALUES ($1,$2,$3,$4,'PENDENTE',$5)
     ON CONFLICT (propina_id) DO UPDATE SET referencia=$3, valor=$4, validade=$5, estado='PENDENTE'`,
    [propId, emisResp.entidade, emisResp.referencia, Number(p.montante) + Number(p.multa), emisResp.validade]
  );
  await pool.query(
    "UPDATE propinas SET internal_reference=$1, data_vencimento=$2, status='pendente' WHERE id=$3",
    [emisResp.referencia, emisResp.validade, propId]
  );

  console.log(`[EMIS guardian] Referência re-gerada — propina=${propId} ref=${emisResp.referencia}`);
  res.json({
    ok:         true,
    entidade:   emisResp.entidade,
    referencia: emisResp.referencia,
    validade:   emisResp.validade,
    simulado:   emisResp.simulado,
  });
});

// POST /guardian/propinas/checkout-isolado — GPO para propina ACTIVA ou VENCIDA
router.post("/guardian/propinas/checkout-isolado", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const { propina_id } = req.body as { propina_id: number };
  if (!propina_id) return res.status(400).json({ error: "propina_id obrigatório." });

  const schoolLookup = await pool.query(
    `SELECT DISTINCT s.school_id FROM students s
     JOIN encarregado_aluno ea ON ea.aluno_id = s.id
     WHERE ea.encarregado_id = $1 LIMIT 1`,
    [guardian.id]
  );
  if (!schoolLookup.rows.length) return res.status(400).json({ error: "Sem educandos associados." });
  const school_id = schoolLookup.rows[0].school_id;

  const settingsRow = await pool.query("SELECT settings FROM school_settings WHERE school_id=$1", [school_id]);
  const m = settingsRow.rows[0]?.settings?.pagamento?.metodos_pagamento ?? {};
  if (!m.allow_gpo_mcx)
    return res.status(403).json({ error: "Pagamento via Multicaixa Express não está disponível nesta escola." });

  const pRes = await pool.query(`
    SELECT p.id, p.student_id, p.mes, p.ano, p.montante, p.multa, COALESCE(p.desconto,0) AS desconto, p.status,
           pg.entidade, pg.referencia, pg.valor AS ref_valor, pg.validade
    FROM propinas p
    JOIN encarregado_aluno ea ON ea.aluno_id = p.student_id
    LEFT JOIN pagamentos pg ON pg.propina_id = p.id AND pg.estado = 'PENDENTE'
    WHERE ea.encarregado_id = $1 AND p.id = $2
      AND p.status IN ('pendente', 'vencido', 'contingencia')
  `, [guardian.id, propina_id]);

  if (!pRes.rows.length) return res.status(404).json({ error: "Propina não encontrada ou já paga." });

  const p = pRes.rows[0];
  const totalValor = Number(p.montante) - Number(p.desconto) + Number(p.multa);
  const txnSuffix = randomBytes(4).toString("hex").toUpperCase();
  const transaction_id = `GPO-ISOL-${Date.now()}-${txnSuffix}`;
  const redirect_url = `https://gpo.emis.ao/checkout?txn=${transaction_id}&valor=${totalValor.toFixed(2)}&origem=propinaplus&escola=${school_id}`;

  await pool.query(
    `INSERT INTO gpo_checkout_attempts
       (encarregado_id, school_id, propina_ids, valor, transaction_id, status, redirect_url, tipo)
     VALUES ($1,$2,$3,$4,$5,'INITIATED',$6,'ISOLADO')`,
    [guardian.id, school_id, JSON.stringify([propina_id]), totalValor, transaction_id, redirect_url]
  );

  return res.json({
    transaction_id, redirect_url, valor: totalValor,
    entidade: p.entidade ?? "00456",
    referencia: p.referencia ?? null,
    propina: { id: p.id, mes: p.mes, ano: p.ano, valor_base: Number(p.montante) - Number(p.desconto), multa: Number(p.multa), total: totalValor },
  });
});

// POST /guardian/propinas/antecipadas/checkout — GPO para meses FUTURA (sem referência EMIS)
router.post("/guardian/propinas/antecipadas/checkout", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const { propina_ids } = req.body as { propina_ids: number[] };
  if (!Array.isArray(propina_ids) || propina_ids.length === 0)
    return res.status(400).json({ error: "Selecione pelo menos uma propina." });

  const schoolLookup = await pool.query(
    `SELECT DISTINCT s.school_id FROM students s
     JOIN encarregado_aluno ea ON ea.aluno_id = s.id
     WHERE ea.encarregado_id = $1 LIMIT 1`,
    [guardian.id]
  );
  if (!schoolLookup.rows.length) return res.status(400).json({ error: "Sem educandos associados." });
  const school_id = schoolLookup.rows[0].school_id;

  const settingsRow = await pool.query("SELECT settings FROM school_settings WHERE school_id=$1", [school_id]);
  const m = settingsRow.rows[0]?.settings?.pagamento?.metodos_pagamento ?? {};
  if (!m.allow_gpo_mcx)
    return res.status(403).json({ error: "Pagamentos antecipados requerem Multicaixa Express/GPO." });

  const placeholders = propina_ids.map((_,i) => `$${i+2}`).join(",");
  const checkRes = await pool.query(`
    SELECT p.id, p.student_id, p.mes, p.ano, p.montante, p.multa,
           COALESCE(p.desconto,0) AS desconto, p.status,
           pg.id AS pagamento_id, pg.estado AS pg_estado
    FROM propinas p
    JOIN encarregado_aluno ea ON ea.aluno_id = p.student_id
    LEFT JOIN pagamentos pg ON pg.propina_id = p.id AND pg.estado = 'PENDENTE'
    WHERE ea.encarregado_id = $1 AND p.id IN (${placeholders})
  `, [guardian.id, ...propina_ids]);

  if (checkRes.rows.length !== propina_ids.length)
    return res.status(403).json({ error: "Propinas inválidas ou não encontradas." });

  const withRef = checkRes.rows.filter((r: any) => r.pg_estado === "PENDENTE");
  if (withRef.length > 0)
    return res.status(422).json({
      error: "Uma ou mais propinas já têm referência EMIS activa. Use o pagamento isolado.",
      propinas_com_ref: withRef.map((r: any) => r.id),
    });

  const alreadyPaid = checkRes.rows.filter((r: any) =>
    ["pago","pago_com_atraso","pre_pago","pago_anulado","isento"].includes(r.status)
  );
  if (alreadyPaid.length > 0)
    return res.status(422).json({
      error: "Uma ou mais propinas já estão pagas ou pré-pagas.",
      propinas_invalidas: alreadyPaid.map((r: any) => r.id),
    });

  const totalValor = checkRes.rows.reduce(
    (s: number, r: any) => s + (Number(r.montante) - Number(r.desconto)) + Number(r.multa), 0
  );

  const txnSuffix = randomBytes(4).toString("hex").toUpperCase();
  const transaction_id = `GPO-ANT-${Date.now()}-${txnSuffix}`;
  const redirect_url = `https://gpo.emis.ao/checkout?txn=${transaction_id}&valor=${totalValor.toFixed(2)}&origem=propinaplus&escola=${school_id}`;

  await pool.query(
    `INSERT INTO gpo_checkout_attempts
       (encarregado_id, school_id, propina_ids, valor, transaction_id, status, redirect_url, tipo)
     VALUES ($1,$2,$3,$4,$5,'INITIATED',$6,'ANTECIPADO')`,
    [guardian.id, school_id, JSON.stringify(propina_ids), totalValor, transaction_id, redirect_url]
  );

  const propinaDetails = checkRes.rows.map((r: any) => ({
    id: r.id, mes: r.mes, ano: r.ano,
    valor_base: Number(r.montante) - Number(r.desconto),
    multa: Number(r.multa),
    desconto: Number(r.desconto),
    total: (Number(r.montante) - Number(r.desconto)) + Number(r.multa),
  }));

  return res.json({ transaction_id, redirect_url, valor: totalValor, propinas: propinaDetails });
});

// POST /guardian/propinas/:id/anular-prepago — anular pré-pagamento, gerar crédito
router.post("/guardian/propinas/:id/anular-prepago", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const { motivo } = req.body ?? {};
  const check = await pool.query(`
    SELECT p.id, p.mes, p.ano, p.montante, p.multa, COALESCE(p.desconto,0) AS desconto,
           p.student_id, p.school_id
    FROM propinas p
    JOIN encarregado_aluno ea ON ea.aluno_id = p.student_id
    WHERE ea.encarregado_id = $1 AND p.id = $2 AND p.status = 'pre_pago'
  `, [guardian.id, req.params.id]);

  if (!check.rows.length)
    return res.status(404).json({ error: "Propina não encontrada ou não está em estado PRE_PAGO." });

  const p = check.rows[0];
  const valorCredito = Number(p.montante) - Number(p.desconto) + Number(p.multa);

  await pool.query("UPDATE propinas SET status='pago_anulado' WHERE id=$1", [p.id]);
  await pool.query(`
    INSERT INTO aluno_creditos (student_id, school_id, propina_id, valor, motivo, estado)
    VALUES ($1,$2,$3,$4,$5,'PENDENTE')
  `, [p.student_id, p.school_id, p.id, valorCredito, motivo ?? "Anulação de pré-pagamento"]);

  console.log(`[PRE_PAGO:anulado] propina=${p.id} aluno=${p.student_id} valor=${valorCredito}`);
  return res.json({ success: true, credito_gerado: valorCredito, propina_id: p.id });
});

// GET /guardian/alunos/:id/ocorrencias
router.get("/guardian/alunos/:id/ocorrencias", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const { id } = req.params;
  const check = await pool.query(
    "SELECT 1 FROM encarregado_aluno WHERE encarregado_id=$1 AND aluno_id=$2",
    [guardian.id, id]
  );
  if (check.rows.length === 0) return res.status(403).json({ error: "Acesso negado." });

  const result = await pool.query(
    `SELECT o.id, o.tipo, o.descricao, o.registado_por, o.data_ocorrencia, o.created_at
     FROM ocorrencias o
     WHERE o.student_id = $1
     ORDER BY o.data_ocorrencia DESC, o.created_at DESC`,
    [id]
  );
  res.json(result.rows);
});

/* ── Comunicados ── */

// Ensure tables exist
pool.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo_url TEXT`).catch(() => {});

pool.query(`
  CREATE TABLE IF NOT EXISTS gpo_checkout_attempts (
    id SERIAL PRIMARY KEY,
    encarregado_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL,
    propina_ids JSONB NOT NULL,
    valor NUMERIC NOT NULL,
    transaction_id VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'INITIATED',
    redirect_url TEXT,
    tipo VARCHAR(20) NOT NULL DEFAULT 'ISOLADO',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
`).catch(() => {});

pool.query(`ALTER TABLE gpo_checkout_attempts ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'ISOLADO'`).catch(() => {});

pool.query(`
  CREATE TABLE IF NOT EXISTS aluno_creditos (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL,
    propina_id INTEGER REFERENCES propinas(id),
    valor NUMERIC NOT NULL,
    motivo TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    resolvido_em TIMESTAMPTZ
  );
`).catch(() => {});

pool.query(`
  CREATE TABLE IF NOT EXISTS comunicados (
    id SERIAL PRIMARY KEY,
    escola_id INTEGER NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    conteudo TEXT NOT NULL,
    prioridade VARCHAR(20) DEFAULT 'normal',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS comunicados_lidos (
    comunicado_id INTEGER NOT NULL REFERENCES comunicados(id) ON DELETE CASCADE,
    encarregado_id INTEGER NOT NULL,
    lido_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (comunicado_id, encarregado_id)
  );
  CREATE TABLE IF NOT EXISTS direct_debit_subscriptions (
    id SERIAL PRIMARY KEY,
    encarregado_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    iban VARCHAR(60) NOT NULL,
    emolumentos JSONB NOT NULL DEFAULT '["propina"]',
    debit_day INTEGER NOT NULL DEFAULT 5,
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    cancellation_requested_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_notes TEXT
  );
`).catch(() => {});

router.get("/guardian/comunicados", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
  const guardian = await getGuardianFromToken(token);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  let escola_id: number | null = null;

  // If school_id provided, validate guardian has a student there
  if (req.query.school_id) {
    const schoolRes = await pool.query(
      `SELECT sc.id FROM schools sc
       JOIN students s ON s.school_id = sc.id
       JOIN encarregado_aluno ea ON ea.aluno_id = s.id
       WHERE sc.id = $1 AND ea.encarregado_id = $2 LIMIT 1`,
      [Number(req.query.school_id), guardian.id]
    );
    if (schoolRes.rows.length > 0) escola_id = schoolRes.rows[0].id;
  }

  // Fallback: first school by lowest id (deterministic)
  if (!escola_id) {
    const schoolRes = await pool.query(
      `SELECT sc.id FROM schools sc
       JOIN students s ON s.school_id = sc.id
       JOIN encarregado_aluno ea ON ea.aluno_id = s.id
       WHERE ea.encarregado_id = $1
       ORDER BY sc.id ASC LIMIT 1`,
      [guardian.id]
    );
    if (schoolRes.rows.length === 0) return res.json([]);
    escola_id = schoolRes.rows[0].id;
  }

  const result = await pool.query(
    `SELECT c.id, c.titulo, c.conteudo, c.prioridade, c.created_at,
            (cl.encarregado_id IS NOT NULL) AS lido
     FROM comunicados c
     LEFT JOIN comunicados_lidos cl ON cl.comunicado_id = c.id AND cl.encarregado_id = $2
     WHERE c.escola_id = $1
     ORDER BY c.created_at DESC`,
    [escola_id, guardian.id]
  );
  res.json(result.rows);
});

router.post("/guardian/comunicados/:id/marcar-lido", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
  const guardian = await getGuardianFromToken(token);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  await pool.query(
    `INSERT INTO comunicados_lidos (comunicado_id, encarregado_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.params.id, guardian.id]
  );
  res.json({ ok: true });
});

/* ── Débito Direto ── */

// GET /guardian/direct-debit/subscription — estado actual da subscrição (suporta ?school_id=N)
router.get("/guardian/direct-debit/subscription", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  // school_id_int = schools.id (integer PK) = direct_debit_subscriptions.school_id
  let school_id_int: number | null = null;

  if (req.query.school_id) {
    const explicit = await pool.query(
      `SELECT sc.id FROM schools sc
       JOIN students s ON s.school_id = sc.id
       JOIN encarregado_aluno ea ON ea.aluno_id = s.id
       WHERE sc.id = $1 AND ea.encarregado_id = $2 LIMIT 1`,
      [req.query.school_id, guardian.id]
    );
    school_id_int = explicit.rows[0]?.id ?? null;
  }

  if (!school_id_int) {
    const schoolRes = await pool.query(
      `SELECT DISTINCT s.school_id FROM students s
       JOIN encarregado_aluno ea ON ea.aluno_id = s.id
       WHERE ea.encarregado_id = $1 LIMIT 1`,
      [guardian.id]
    );
    school_id_int = schoolRes.rows[0]?.school_id ?? null;
  }

  if (!school_id_int) return res.json(null);

  const r = await pool.query(
    `SELECT * FROM direct_debit_subscriptions
     WHERE encarregado_id = $1 AND school_id = $2 AND status != 'cancelled'
     ORDER BY created_at DESC LIMIT 1`,
    [guardian.id, school_id_int]
  );
  return res.json(r.rows[0] ?? null);
});

// POST /guardian/direct-debit/subscribe — adesão (única vez)
router.post("/guardian/direct-debit/subscribe", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const schoolRes = await pool.query(
    `SELECT DISTINCT s.school_id FROM students s
     JOIN encarregado_aluno ea ON ea.aluno_id = s.id
     WHERE ea.encarregado_id = $1 LIMIT 1`,
    [guardian.id]
  );
  if (schoolRes.rows.length === 0)
    return res.status(400).json({ error: "Nenhum educando associado." });
  const school_id = schoolRes.rows[0].school_id;

  const existing = await pool.query(
    `SELECT id, status FROM direct_debit_subscriptions
     WHERE encarregado_id = $1 AND school_id = $2 AND status != 'cancelled' LIMIT 1`,
    [guardian.id, school_id]
  );
  if (existing.rows.length > 0)
    return res.status(409).json({ error: "Já possui uma subscrição de débito direto activa.", status: existing.rows[0].status });

  const { iban, emolumentos, debit_day, email } = req.body;
  if (!iban?.trim()) return res.status(400).json({ error: "IBAN obrigatório." });
  if (!Array.isArray(emolumentos) || emolumentos.length === 0)
    return res.status(400).json({ error: "Selecione pelo menos um emolumento." });
  const day = Math.min(28, Math.max(1, parseInt(debit_day) || 5));

  const r = await pool.query(
    `INSERT INTO direct_debit_subscriptions
       (encarregado_id, school_id, iban, emolumentos, debit_day, email, status, activated_at)
     VALUES ($1,$2,$3,$4,$5,$6,'active',NOW()) RETURNING *`,
    [guardian.id, school_id, iban.trim().toUpperCase(), JSON.stringify(emolumentos), day, email || null]
  );

  console.log(`[DD] Nova subscrição #${r.rows[0].id} — contrato enviado para: ${email ?? guardian.telefone}`);
  return res.json({ ok: true, subscription: r.rows[0] });
});

// POST /guardian/direct-debit/cancel-request — pedido de cancelamento (requer aprovação do colégio)
router.post("/guardian/direct-debit/cancel-request", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const { subscription_id } = req.body;
  const check = await pool.query(
    `SELECT id, status FROM direct_debit_subscriptions WHERE id=$1 AND encarregado_id=$2`,
    [subscription_id, guardian.id]
  );
  if (check.rows.length === 0) return res.status(404).json({ error: "Subscrição não encontrada." });
  const { status } = check.rows[0];
  if (status === "cancellation_requested")
    return res.status(409).json({ error: "Pedido de cancelamento já submetido. Aguarda validação do colégio." });
  if (status === "cancelled")
    return res.status(409).json({ error: "Subscrição já cancelada." });

  await pool.query(
    `UPDATE direct_debit_subscriptions
     SET status='cancellation_requested', cancellation_requested_at=NOW()
     WHERE id=$1`,
    [subscription_id]
  );
  return res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════════
   MÓDULO: LOJA (GUARDIAN)
   ══════════════════════════════════════════════════════════ */

/* ─── GET /guardian/store/items ─── */
router.get("/guardian/store/items", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });
  const { school_id } = req.query as { school_id?: string };
  let schoolIds: number[] = [];
  if (school_id) {
    schoolIds = [Number(school_id)];
  } else {
    const studs = await pool.query(
      `SELECT DISTINCT s.school_id FROM students s
       JOIN encarregado_aluno ea ON ea.aluno_id = s.id
       WHERE ea.encarregado_id=$1`,
      [guardian.id]
    );
    schoolIds = studs.rows.map((r: any) => r.school_id);
  }
  if (!schoolIds.length) return res.json([]);
  const r = await pool.query(
    `SELECT si.*, sc.name AS escola_nome
     FROM store_items si
     JOIN schools sc ON sc.id = si.school_id
     WHERE si.school_id = ANY($1) AND si.visivel_portal=true AND si.ativo=true
       AND (si.stock IS NULL OR si.stock > 0)
     ORDER BY sc.name, si.categoria NULLS LAST, si.nome`,
    [schoolIds]
  );
  res.json(r.rows);
});

/* ─── POST /guardian/store/checkout ─── */
router.post("/guardian/store/checkout", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });
  const { school_id, student_id, items, method = "reference" } = req.body as {
    school_id: number; student_id?: number;
    items: { item_id: number; quantidade: number }[];
    method?: string;
  };
  if (!items?.length) return res.status(400).json({ error: "Carrinho vazio." });

  // Validate school and payment settings
  const schoolRow = await pool.query(
    `SELECT sc.id, sc.name, ss.settings FROM schools sc
     LEFT JOIN school_settings ss ON ss.school_id = sc.id WHERE sc.id=$1`,
    [school_id]
  );
  if (!schoolRow.rowCount) return res.status(404).json({ error: "Escola não encontrada." });
  const metodos = schoolRow.rows[0].settings?.pagamento?.metodos_pagamento ?? { allow_reference: true, allow_gpo_mcx: false };
  if (method === "reference" && !metodos.allow_reference) return res.status(403).json({ error: "Pagamento por referência não disponível." });
  if (method === "gpo_mcx" && !metodos.allow_gpo_mcx) return res.status(403).json({ error: "Multicaixa Express não disponível." });

  // Validate guardian access to school
  const access = await pool.query(
    `SELECT COUNT(*)::int AS c FROM students s
     JOIN encarregado_aluno ea ON ea.aluno_id = s.id
     WHERE ea.encarregado_id=$1 AND s.school_id=$2`,
    [guardian.id, school_id]
  );
  if (access.rows[0].c === 0) return res.status(403).json({ error: "Sem acesso a esta escola." });

  // Validate and fetch items
  const itemIds = items.map(i => i.item_id);
  const dbItemsR = await pool.query(
    `SELECT * FROM store_items WHERE id=ANY($1) AND school_id=$2 AND visivel_portal=true AND ativo=true`,
    [itemIds, school_id]
  );
  if (dbItemsR.rows.length !== itemIds.length) return res.status(400).json({ error: "Um ou mais artigos inválidos ou indisponíveis." });

  // Validate stock
  for (const ordered of items) {
    const dbItem = dbItemsR.rows.find((i: any) => i.id === ordered.item_id);
    if (dbItem.stock !== null && dbItem.stock < ordered.quantidade)
      return res.status(400).json({ error: `Stock insuficiente para "${dbItem.nome}". Disponível: ${dbItem.stock}.` });
  }

  // Calculate total
  let total = 0;
  const lines: { item: any; qty: number }[] = [];
  for (const ordered of items) {
    const dbItem = dbItemsR.rows.find((i: any) => i.id === ordered.item_id);
    total += Number(dbItem.preco) * ordered.quantidade;
    lines.push({ item: dbItem, qty: ordered.quantidade });
  }

  // Student name
  let studentNome: string | null = null;
  if (student_id) {
    const st = await pool.query(`SELECT nome FROM students WHERE id=$1`, [student_id]);
    studentNome = st.rows[0]?.nome ?? null;
  }

  // Generate voucher code (8 chars, no ambiguous)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let voucherCode = "";
  for (let i = 0; i < 8; i++) voucherCode += chars.charAt(Math.floor(Math.random() * chars.length));

  // Payment reference
  const refNum = String(Math.floor(Math.random() * 900000000) + 100000000);
  const ENTIDADE = "00456";
  const exp = new Date(); exp.setDate(exp.getDate() + 30);

  let gpoUrl: string | null = null;
  if (method === "gpo_mcx") {
    const txId = `STORE-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    gpoUrl = `https://gpo.emis.ao/checkout?txId=${txId}&amount=${total}&currency=AOA&merchantId=PROPINAPLUS001`;
  }

  // Create order
  const orderR = await pool.query(
    `INSERT INTO store_orders (school_id,guardian_id,student_id,student_nome,guardian_nome,total,voucher_code,entidade,referencia,metodo_pagamento,gpo_redirect_url,estado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pendente_pagamento') RETURNING *`,
    [school_id, guardian.id, student_id || null, studentNome, guardian.nome, total, voucherCode, ENTIDADE, refNum, method, gpoUrl]
  );
  const orderId = orderR.rows[0].id;

  for (const line of lines) {
    await pool.query(
      `INSERT INTO store_order_items (order_id,item_id,item_nome,quantidade,preco_unit) VALUES ($1,$2,$3,$4,$5)`,
      [orderId, line.item.id, line.item.nome, line.qty, line.item.preco]
    );
  }

  res.json({
    order_id: orderId, voucher_code: voucherCode,
    entidade: ENTIDADE, referencia: refNum,
    montante: total, validade: exp.toISOString(),
    escola_nome: schoolRow.rows[0].name,
    metodo_pagamento: method, gpo_redirect_url: gpoUrl,
  });
});

/* ─── GET /guardian/store/orders ─── */
router.get("/guardian/store/orders", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `SELECT so.*, sc.name AS escola_nome,
       COALESCE(json_agg(json_build_object('item_nome',soi.item_nome,'quantidade',soi.quantidade,'preco_unit',soi.preco_unit)) FILTER (WHERE soi.id IS NOT NULL),'[]') AS items
     FROM store_orders so
     JOIN schools sc ON sc.id = so.school_id
     LEFT JOIN store_order_items soi ON soi.order_id = so.id
     WHERE so.guardian_id=$1
     GROUP BY so.id, sc.name ORDER BY so.created_at DESC`,
    [guardian.id]
  );
  res.json(r.rows);
});

/* ─── GET /guardian/horario ─── */
router.get("/guardian/horario", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });
  const studs = await pool.query(
    `SELECT DISTINCT s.school_id, s.turma_id FROM students s
     JOIN encarregado_aluno ea ON ea.aluno_id = s.id
     WHERE ea.encarregado_id=$1`,
    [guardian.id]
  );
  if (!studs.rowCount) return res.json([]);
  const schoolIds = studs.rows.map((r: any) => r.school_id);
  const turmaIds = studs.rows.map((r: any) => r.turma_id).filter(Boolean);
  const r = await pool.query(
    `SELECT ce.*, c.nome AS calendario_nome, c.alertas_horas, sc.name AS escola_nome
     FROM calendario_eventos ce
     JOIN calendarios c ON c.id = ce.calendario_id
     JOIN schools sc ON sc.id = ce.school_id
     WHERE ce.school_id = ANY($1)
       AND c.tipo = 'aulas'
       AND c.publicado = true
       AND c.vigencia_fim >= CURRENT_DATE
       AND (
         ce.turma_id IS NULL
         OR ce.turma_id = ANY($2)
         OR NOT EXISTS (
           SELECT 1 FROM calendario_eventos ce2
           JOIN calendarios c2 ON c2.id = ce2.calendario_id
           WHERE ce2.school_id = ANY($1)
             AND c2.tipo = 'aulas'
             AND c2.publicado = true
             AND c2.vigencia_fim >= CURRENT_DATE
             AND ce2.turma_id = ANY($2)
         )
       )
     ORDER BY ce.dia_semana ASC NULLS LAST, ce.hora_inicio_aula ASC NULLS LAST`,
    [schoolIds, turmaIds.length ? turmaIds : [-1]]
  );
  res.json(r.rows);
});

/* ─── POST /guardian/fcm/subscribe — registo de token FCM do dispositivo ─── */
router.post("/guardian/fcm/subscribe", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const { token, platform = "web" } = req.body as { token?: string; platform?: string };
  if (!token || typeof token !== "string" || token.trim().length < 10) {
    return res.status(400).json({ error: "Token FCM inválido." });
  }

  const allowedPlatforms = ["web", "android", "ios"];
  const safePlatform = allowedPlatforms.includes(platform) ? platform : "web";

  await pool.query(
    `INSERT INTO fcm_device_tokens (school_id, user_type, user_id, token, platform, updated_at)
     VALUES ($1, 'guardian', $2, $3, $4, NOW())
     ON CONFLICT (user_type, user_id, token)
     DO UPDATE SET platform=$4, updated_at=NOW()`,
    [guardian.school_id, guardian.id, token.trim(), safePlatform]
  );

  return res.json({ ok: true, message: "Dispositivo registado para notificações." });
});

/* ─── DELETE /guardian/fcm/subscribe — remoção de token (logout / opt-out) ─── */
router.delete("/guardian/fcm/subscribe", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Token FCM inválido." });
  }

  await pool.query(
    `DELETE FROM fcm_device_tokens
     WHERE user_type='guardian' AND user_id=$1 AND token=$2`,
    [guardian.id, token.trim()]
  );

  return res.json({ ok: true, message: "Dispositivo removido." });
});

/* ─── GET /guardian/provas ─── */
router.get("/guardian/provas", authMiddleware, async (req: Request, res: Response) => {
  const guardian = await getGuardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });
  const studs = await pool.query(
    `SELECT DISTINCT s.school_id, s.turma_id FROM students s
     JOIN encarregado_aluno ea ON ea.aluno_id = s.id
     WHERE ea.encarregado_id=$1`,
    [guardian.id]
  );
  if (!studs.rowCount) return res.json([]);
  const schoolIds = studs.rows.map((r: any) => r.school_id);
  const turmaIds = studs.rows.map((r: any) => r.turma_id).filter(Boolean);
  const r = await pool.query(
    `SELECT ce.*, c.nome AS calendario_nome, c.alertas_horas, sc.name AS escola_nome
     FROM calendario_eventos ce
     JOIN calendarios c ON c.id = ce.calendario_id
     JOIN schools sc ON sc.id = ce.school_id
     WHERE ce.school_id = ANY($1)
       AND (ce.turma_id IS NULL OR ce.turma_id = ANY($2))
       AND c.tipo = 'provas'
       AND c.publicado = true
       AND c.vigencia_fim >= CURRENT_DATE
     ORDER BY ce.data_inicio ASC`,
    [schoolIds, turmaIds.length ? turmaIds : [-1]]
  );
  res.json(r.rows);
});

export default router;
