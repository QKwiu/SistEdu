import { Router } from "express";
import { randomBytes } from "crypto";
import { pool } from "@workspace/db";

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
  const { name, nif, phone, email, password, iban } = req.body;
  if (!name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: "Nome e email são obrigatórios." });
  }

  const { default: bcrypt } = await import("bcryptjs");
  const hash = await bcrypt.hash(password || "Kiwara@2025", 10);
  const schoolId = `SCH-${Date.now()}`;

  const r = await pool.query(
    `INSERT INTO schools (school_id, name, nif, phone, email, password_hash, iban)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, school_id, name, email, iban, created_at`,
    [schoolId, name.trim(), nif?.trim() || null, phone?.trim() || null, email.trim(), hash, iban?.trim() || null]
  );
  res.status(201).json(r.rows[0]);
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

  const turmas = await pool.query("SELECT * FROM turmas WHERE school_id=$1 ORDER BY nome", [req.params.id]);
  const emolumentos = await pool.query(
    "SELECT * FROM emolumentos WHERE school_id=$1 ORDER BY tipo, ano_lectivo",
    [req.params.id]
  );
  const mregra = await pool.query(
    "SELECT * FROM multa_regras WHERE school_id=$1",
    [req.params.id]
  );
  res.json({
    ...r.rows[0],
    turmas: turmas.rows,
    emolumentos: emolumentos.rows,
    multa_regra: mregra.rows[0] ?? null,
  });
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
  const { tipo, nome, montante, ano_lectivo } = req.body;
  if (!tipo || !nome?.trim() || !montante) {
    return res.status(400).json({ error: "Tipo, nome e montante são obrigatórios." });
  }
  const r = await pool.query(
    `INSERT INTO emolumentos (school_id, tipo, nome, montante, ano_lectivo)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.params.id, tipo, nome.trim(), Number(montante), ano_lectivo || "2025/2026"]
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
    }>;
    ano_lectivo?: string;
  };

  if (!Array.isArray(alunos) || alunos.length === 0) {
    return res.status(400).json({ error: "Lista de alunos vazia." });
  }

  const anoLectivo = ano_lectivo || "2025/2026";
  const turmaCache: Record<string, number> = {};
  let inserted = 0;
  let skipped = 0;
  let encarregados_criados = 0;
  const errors: string[] = [];

  // Preload existing turmas
  const existingTurmas = await pool.query(
    "SELECT id, nome FROM turmas WHERE school_id=$1", [schoolId]
  );
  for (const t of existingTurmas.rows) turmaCache[t.nome.toLowerCase()] = t.id;

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
        // Create matricula
        if (turmaId) {
          await pool.query(
            `INSERT INTO matriculas (student_id, turma_id, ano_lectivo)
             VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [studentId, turmaId, anoLectivo]
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

/* ─── DELETE /admin/colegios/:id ─── */
router.delete("/admin/colegios/:id", adminAuth, async (req, res) => {
  await pool.query("DELETE FROM schools WHERE id=$1", [req.params.id]);
  res.status(204).end();
});

export default router;
