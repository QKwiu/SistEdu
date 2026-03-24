import { Router } from "express";
import { randomBytes } from "crypto";
import { pool } from "@workspace/db";

const router = Router();

const ADMIN_USER = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD ?? "admin";

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
  res.json({ ...r.rows[0], turmas: turmas.rows, emolumentos: emolumentos.rows });
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
        // Create matricula
        if (turmaId) {
          await pool.query(
            `INSERT INTO matriculas (student_id, turma_id, ano_lectivo)
             VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [st.rows[0].id, turmaId, anoLectivo]
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

  res.json({ inserted, skipped, errors, total: alunos.length });
});

/* ─── DELETE /admin/colegios/:id ─── */
router.delete("/admin/colegios/:id", adminAuth, async (req, res) => {
  await pool.query("DELETE FROM schools WHERE id=$1", [req.params.id]);
  res.status(204).end();
});

export default router;
