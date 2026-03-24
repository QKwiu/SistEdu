import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

export const TIPOS_OCORRENCIA = [
  "Comportamento Inadequado",
  "Medida Disciplinar",
  "Ausência Injustificada",
  "Atraso Repetido",
  "Incidente Académico",
  "Elogio / Mérito",
  "Comunicação aos Pais",
  "Outro",
];

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

// GET /ocorrencias/tipos
router.get("/ocorrencias/tipos", (_req, res) => {
  res.json(TIPOS_OCORRENCIA);
});

// GET /ocorrencias/alunos — students for the school (for selector)
router.get("/ocorrencias/alunos", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const result = await pool.query(
    `SELECT s.id, s.nome, s.bilhete,
            COALESCE(t.nome, 'Sem turma') AS turma
     FROM students s
     LEFT JOIN turmas t ON t.id = s.turma_id
     WHERE s.school_id = $1
     ORDER BY s.nome`,
    [school.school_id]
  );
  res.json(result.rows);
});

// GET /ocorrencias — list occurrences for the school
router.get("/ocorrencias", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const { student_id } = req.query;
  const whereExtra = student_id ? `AND o.student_id = $2` : "";
  const params: any[] = [school.school_id];
  if (student_id) params.push(student_id);

  const result = await pool.query(
    `SELECT o.id, o.tipo, o.descricao, o.registado_por,
            o.data_ocorrencia, o.created_at,
            s.nome AS aluno_nome, s.bilhete,
            COALESCE(t.nome, 'Sem turma') AS turma
     FROM ocorrencias o
     JOIN students s ON s.id = o.student_id
     LEFT JOIN turmas t ON t.id = s.turma_id
     WHERE s.school_id = $1 ${whereExtra}
     ORDER BY o.data_ocorrencia DESC, o.created_at DESC
     LIMIT 100`,
    params
  );
  res.json(result.rows);
});

// POST /ocorrencias — create occurrence
router.post("/ocorrencias", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const { student_id, tipo, descricao, registado_por, data_ocorrencia } = req.body;
  if (!student_id || !tipo || !descricao?.trim()) {
    return res.status(400).json({ error: "Aluno, tipo e descrição são obrigatórios." });
  }

  // Verify student belongs to this school
  const check = await pool.query(
    "SELECT id FROM students WHERE id = $1 AND school_id = $2",
    [student_id, school.school_id]
  );
  if (check.rows.length === 0) return res.status(403).json({ error: "Aluno não encontrado." });

  const result = await pool.query(
    `INSERT INTO ocorrencias (student_id, tipo, descricao, registado_por, data_ocorrencia)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, tipo, descricao, registado_por, data_ocorrencia, created_at`,
    [
      student_id,
      tipo,
      descricao.trim(),
      registado_por?.trim() || school.school_name,
      data_ocorrencia || new Date().toISOString().slice(0, 10),
    ]
  );
  res.status(201).json(result.rows[0]);
});

// DELETE /ocorrencias/:id
router.delete("/ocorrencias/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const result = await pool.query(
    `DELETE FROM ocorrencias o
     USING students s
     WHERE o.id = $1 AND o.student_id = s.id AND s.school_id = $2`,
    [req.params.id, school.school_id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: "Ocorrência não encontrada." });
  res.json({ success: true });
});

export default router;
