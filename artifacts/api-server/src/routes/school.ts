import { Router } from "express";
import { pool } from "@workspace/db";
import { randomBytes } from "crypto";

const router = Router();

/* ─── Auth helpers ─── */
async function getSchoolFromToken(token: string) {
  const res = await pool.query(
    `SELECT sc.id AS school_id, sc.name AS school_name
     FROM sessions s
     JOIN schools sc ON sc.id = s.school_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );
  return res.rows[0] ?? null;
}

function schoolAuth(req: any, res: any, next: any) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado." });
  req.schoolToken = header.slice(7);
  next();
}

/* ─── Turmas ─── */
router.get("/school/turmas", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const result = await pool.query(
    `SELECT t.id, t.nome, t.ano, t.turno, t.created_at,
            COUNT(s.id)::int AS total_alunos
     FROM turmas t
     LEFT JOIN students s ON s.turma_id = t.id
     WHERE t.school_id = $1
     GROUP BY t.id
     ORDER BY t.nome`,
    [school.school_id]
  );
  res.json(result.rows);
});

router.post("/school/turmas", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const { nome, ano, turno } = req.body;
  if (!nome?.trim() || !ano?.trim()) {
    return res.status(400).json({ error: "Nome e ano lectivo são obrigatórios." });
  }

  const result = await pool.query(
    `INSERT INTO turmas (school_id, nome, ano, turno)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [school.school_id, nome.trim(), ano.trim(), turno || "Manhã"]
  );
  res.status(201).json(result.rows[0]);
});

router.delete("/school/turmas/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  await pool.query(
    `DELETE FROM turmas WHERE id = $1 AND school_id = $2`,
    [req.params.id, school.school_id]
  );
  res.status(204).end();
});

/* ─── Alunos ─── */
router.get("/school/alunos", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const result = await pool.query(
    `SELECT s.id, s.nome, s.bilhete, s.telefone_encarregado, s.nome_encarregado,
            s.turma_id, COALESCE(t.nome, 'Sem turma') AS turma, s.created_at,
            COUNT(p.id) FILTER (WHERE p.status = 'pendente') AS propinas_pendentes,
            COALESCE(SUM(p.montante + p.multa) FILTER (WHERE p.status = 'pendente'), 0) AS divida
     FROM students s
     LEFT JOIN turmas t ON t.id = s.turma_id
     LEFT JOIN propinas p ON p.student_id = s.id
     WHERE s.school_id = $1
     GROUP BY s.id, t.nome
     ORDER BY s.nome`,
    [school.school_id]
  );
  res.json(result.rows);
});

router.post("/school/alunos", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const { nome, bilhete, turma_id, nome_encarregado, telefone_encarregado } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: "O nome do aluno é obrigatório." });

  const result = await pool.query(
    `INSERT INTO students (school_id, turma_id, nome, bilhete, nome_encarregado, telefone_encarregado)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      school.school_id,
      turma_id || null,
      nome.trim(),
      bilhete?.trim() || null,
      nome_encarregado?.trim() || null,
      telefone_encarregado?.trim() || null,
    ]
  );
  res.status(201).json(result.rows[0]);
});

router.delete("/school/alunos/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  await pool.query(
    `DELETE FROM students WHERE id = $1 AND school_id = $2`,
    [req.params.id, school.school_id]
  );
  res.status(204).end();
});

/* ─── Propinas ─── */
router.get("/school/propinas", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const { student_id } = req.query;
  const extra = student_id ? "AND p.student_id = $2" : "";
  const params: any[] = [school.school_id];
  if (student_id) params.push(student_id);

  const result = await pool.query(
    `SELECT p.id, p.student_id, p.mes, p.ano, p.montante, p.multa, p.status,
            p.data_vencimento, p.referencia, p.pago_em, p.created_at,
            s.nome AS aluno_nome,
            COALESCE(t.nome, 'Sem turma') AS turma,
            pg.entidade, pg.referencia AS ref_numero, pg.valor AS ref_valor,
            pg.estado AS ref_estado, pg.validade AS ref_validade
     FROM propinas p
     JOIN students s ON s.id = p.student_id
     LEFT JOIN turmas t ON t.id = s.turma_id
     LEFT JOIN pagamentos pg ON pg.propina_id = p.id
     WHERE s.school_id = $1 ${extra}
     ORDER BY p.ano DESC, p.mes DESC, s.nome`,
    params
  );
  res.json(result.rows);
});

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function lastDayOfMonth(month: string, year: string): Date {
  const mIdx = MESES.findIndex(m => m.toLowerCase() === month.toLowerCase());
  if (mIdx === -1) return new Date();
  const d = new Date(Number(year), mIdx + 1, 0, 23, 59, 59, 999);
  return d;
}

function generateRef(): string {
  const digits = randomBytes(5).readUInt32BE(0) % 900000000 + 100000000;
  return String(digits);
}

router.post("/school/propinas/gerar", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const { student_id, meses, ano, montante } = req.body;
  if (!student_id || !meses?.length || !ano || !montante) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
  }

  // Verify student belongs to this school
  const stRes = await pool.query(
    "SELECT id FROM students WHERE id = $1 AND school_id = $2",
    [student_id, school.school_id]
  );
  if (!stRes.rows.length) return res.status(404).json({ error: "Aluno não encontrado." });

  const created = [];
  for (const mes of meses) {
    const vencimento = lastDayOfMonth(mes, String(ano));
    try {
      const r = await pool.query(
        `INSERT INTO propinas (school_id, student_id, mes, ano, montante, data_vencimento, multa, status)
         VALUES ($1, $2, $3, $4, $5, $6, 0, 'pendente')
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [school.school_id, student_id, mes, String(ano), montante, vencimento]
      );
      if (r.rows[0]) created.push(r.rows[0]);
    } catch {}
  }

  res.status(201).json({ created, total: created.length });
});

router.post("/school/propinas/referencia", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const { propina_ids } = req.body;
  if (!propina_ids?.length) return res.status(400).json({ error: "Selecione pelo menos uma propina." });

  // Verify all propinas belong to this school
  const pRes = await pool.query(
    `SELECT p.id, p.mes, p.ano, p.montante, p.multa, p.student_id, p.status
     FROM propinas p
     JOIN students s ON s.id = p.student_id
     WHERE p.id = ANY($1) AND s.school_id = $2`,
    [propina_ids, school.school_id]
  );

  if (!pRes.rows.length) return res.status(404).json({ error: "Propinas não encontradas." });
  const alreadyPaid = pRes.rows.filter(p => p.status === "pago");
  if (alreadyPaid.length) return res.status(400).json({ error: "Uma ou mais propinas já estão pagas." });

  const total = pRes.rows.reduce((s: number, p: any) => s + Number(p.montante) + Number(p.multa), 0);
  const latestMes = pRes.rows[pRes.rows.length - 1];
  const validade = lastDayOfMonth(latestMes.mes, latestMes.ano);
  const referencia = generateRef();
  const entidade = "00112";

  // Insert reference for each propina (upsert)
  for (const p of pRes.rows) {
    await pool.query(
      `INSERT INTO pagamentos (propina_id, entidade, referencia, valor, estado, validade)
       VALUES ($1, $2, $3, $4, 'PENDENTE', $5)
       ON CONFLICT (propina_id) DO UPDATE
       SET referencia = $3, valor = $4, validade = $5, estado = 'PENDENTE'`,
      [p.id, entidade, referencia, total, validade]
    );
  }

  res.json({
    entidade,
    referencia,
    valor: total,
    validade: validade.toISOString(),
    propinas: pRes.rows,
  });
});

export default router;
