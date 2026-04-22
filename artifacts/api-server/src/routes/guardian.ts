import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { pool } from "@workspace/db";

const router = Router();

async function getGuardianFromToken(token: string) {
  const res = await pool.query(
    `SELECT e.* FROM encarregados e
     JOIN guardian_sessions gs ON gs.encarregado_id = e.id
     WHERE gs.token = $1 AND gs.expires_at > NOW()`,
    [token]
  );
  return res.rows[0] ?? null;
}

function authMiddleware(req: any, res: any, next: any) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado." });
  req.guardianToken = header.slice(7);
  next();
}

// POST /guardian/login — phone + password
router.post("/guardian/login", async (req, res) => {
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
router.post("/guardian/recuperar-pin", async (req, res) => {
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

  const hash = await bcrypt.hash("1234", 10);
  await pool.query(
    "UPDATE encarregados SET password = $1, first_login = TRUE WHERE id = $2",
    [hash, result.rows[0].id]
  );

  return res.json({ success: true, nome: result.rows[0].nome });
});

// POST /guardian/change-password — obrigatório no primeiro login
router.post("/guardian/change-password", authMiddleware, async (req: any, res) => {
  const guardian = await getGuardianFromToken(req.guardianToken);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const { nova_senha, confirmar_senha } = req.body;
  if (!nova_senha || nova_senha.length < 6) {
    return res.status(400).json({ error: "A nova palavra-passe deve ter pelo menos 6 caracteres." });
  }
  if (nova_senha !== confirmar_senha) {
    return res.status(400).json({ error: "As palavras-passe não coincidem." });
  }

  const hash = await bcrypt.hash(nova_senha, 10);
  await pool.query(
    "UPDATE encarregados SET password = $1, first_login = FALSE WHERE id = $2",
    [hash, guardian.id]
  );

  return res.json({ success: true, message: "Palavra-passe atualizada com sucesso." });
});

// GET /guardian/me
router.get("/guardian/me", authMiddleware, async (req: any, res) => {
  const guardian = await getGuardianFromToken(req.guardianToken);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });
  return res.json({
    id: guardian.id,
    nome: guardian.nome,
    telefone: guardian.telefone,
    first_login: guardian.first_login,
  });
});

// GET /guardian/alunos — lista alunos com resumo financeiro
router.get("/guardian/alunos", authMiddleware, async (req: any, res) => {
  const guardian = await getGuardianFromToken(req.guardianToken);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const result = await pool.query(`
    SELECT
      s.id,
      s.nome,
      s.bilhete,
      t.nome AS turma,
      t.turno,
      COALESCE(SUM(CASE WHEN p.status != 'pago' THEN (p.montante + p.multa) ELSE 0 END), 0) AS divida_total,
      COALESCE(SUM(CASE WHEN p.status != 'pago' THEN p.multa ELSE 0 END), 0) AS total_multas,
      COUNT(CASE WHEN p.status = 'vencido' THEN 1 END) AS propinas_vencidas,
      COUNT(CASE WHEN p.status = 'pendente' THEN 1 END) AS propinas_pendentes
    FROM encarregado_aluno ea
    JOIN students s ON s.id = ea.aluno_id
    LEFT JOIN turmas t ON t.id = s.turma_id
    LEFT JOIN propinas p ON p.student_id = s.id
    WHERE ea.encarregado_id = $1
    GROUP BY s.id, s.nome, s.bilhete, t.nome, t.turno
    ORDER BY s.nome
  `, [guardian.id]);

  return res.json(result.rows);
});

// GET /guardian/alunos/:id/propinas
router.get("/guardian/alunos/:id/propinas", authMiddleware, async (req: any, res) => {
  const guardian = await getGuardianFromToken(req.guardianToken);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const { id } = req.params;
  const check = await pool.query(
    "SELECT 1 FROM encarregado_aluno WHERE encarregado_id=$1 AND aluno_id=$2",
    [guardian.id, id]
  );
  if (check.rows.length === 0) return res.status(403).json({ error: "Acesso negado." });

  // Auto-update vencido status and apply multa based on school rule
  const overdueRes = await pool.query(
    `SELECT p.id, p.montante, p.multa, p.school_id, p.data_vencimento
     FROM propinas p
     WHERE p.student_id=$1 AND p.status='pendente' AND p.data_vencimento < NOW()`,
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
      (p.montante + p.multa) AS total,
      UPPER(p.status) AS estado,
      p.data_vencimento,
      pg.id AS pagamento_id,
      pg.entidade,
      pg.referencia,
      pg.valor AS ref_valor,
      UPPER(pg.estado) AS ref_estado,
      pg.validade
    FROM propinas p
    LEFT JOIN pagamentos pg ON pg.propina_id = p.id
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

// POST /guardian/pagamentos/gerar — gera referência combinada para vários meses
router.post("/guardian/pagamentos/gerar", authMiddleware, async (req: any, res) => {
  const guardian = await getGuardianFromToken(req.guardianToken);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const { propina_ids } = req.body as { propina_ids: number[] };
  if (!Array.isArray(propina_ids) || propina_ids.length === 0)
    return res.status(400).json({ error: "Selecione pelo menos uma propina." });

  // Verify all propinas belong to guardian's students
  const placeholders = propina_ids.map((_,i) => `$${i+2}`).join(",");
  const checkRes = await pool.query(`
    SELECT p.id, p.student_id, p.mes, p.ano, p.montante, p.multa, p.status
    FROM propinas p
    JOIN encarregado_aluno ea ON ea.aluno_id = p.student_id
    WHERE ea.encarregado_id = $1 AND p.id IN (${placeholders}) AND p.status != 'pago'
  `, [guardian.id, ...propina_ids]);

  if (checkRes.rows.length !== propina_ids.length)
    return res.status(403).json({ error: "Propinas inválidas ou já pagas." });

  // Deterministic reference from sorted IDs
  const sorted = [...propina_ids].sort((a,b) => a-b);
  const seed = sorted.join("-");
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const refNum = String(Math.abs(hash) % 900000000 + 100000000);

  const ENTIDADE = "00456";
  const totalValor = checkRes.rows.reduce((s: number, r: any) => s + Number(r.montante) + Number(r.multa), 0);

  // Validade = last day (23:59:59) of the LATEST month selected
  const MES_NUM: Record<string, number> = {
    'Janeiro':1,'Fevereiro':2,'Março':3,'Abril':4,'Maio':5,'Junho':6,
    'Julho':7,'Agosto':8,'Setembro':9,'Outubro':10,'Novembro':11,'Dezembro':12
  };
  const latest = checkRes.rows.reduce((acc: any, r: any) => {
    const rYear = parseInt(r.ano);
    const rMonth = MES_NUM[r.mes] ?? 1;
    if (!acc || rYear > acc.year || (rYear === acc.year && rMonth > acc.month)) {
      return { year: rYear, month: rMonth };
    }
    return acc;
  }, null);
  const lastDay = new Date(latest.year, latest.month, 0); // day 0 = last day of previous month
  lastDay.setHours(23, 59, 59, 0);
  const validade = lastDay.toISOString();

  // Upsert pagamentos record for each propina with combined reference
  for (const row of checkRes.rows) {
    await pool.query(`
      INSERT INTO pagamentos (propina_id, entidade, referencia, valor, validade, estado)
      VALUES ($1, $2, $3, $4, $5, 'PENDENTE')
      ON CONFLICT (propina_id) DO UPDATE
        SET entidade = $2, referencia = $3, valor = $4, validade = $5, estado = 'PENDENTE'
    `, [row.id, ENTIDADE, refNum, totalValor, validade]);
  }

  const propinaDetails = checkRes.rows.map((r: any) => ({
    id: r.id, mes: r.mes, ano: r.ano,
    valor_base: Number(r.montante),
    multa: Number(r.multa),
    total: Number(r.montante) + Number(r.multa),
  }));

  return res.json({
    entidade: ENTIDADE,
    referencia: refNum,
    valor: totalValor,
    validade,
    propinas: propinaDetails,
  });
});

// GET /guardian/alunos/:id/ocorrencias
router.get("/guardian/alunos/:id/ocorrencias", authMiddleware, async (req: any, res) => {
  const guardian = await getGuardianFromToken(req.guardianToken);
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
`).catch(() => {});

router.get("/guardian/comunicados", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
  const guardian = await getGuardianFromToken(token);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  // Get the school_id from the guardian's students
  const schoolRes = await pool.query(
    `SELECT DISTINCT s.school_id FROM students s
     JOIN encarregado_aluno ea ON ea.aluno_id = s.id
     WHERE ea.encarregado_id = $1 LIMIT 1`,
    [guardian.id]
  );
  if (schoolRes.rows.length === 0) return res.json([]);
  const escola_id = schoolRes.rows[0].school_id;

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

export default router;
