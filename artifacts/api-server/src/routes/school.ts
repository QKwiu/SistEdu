import { Router } from "express";
import { pool } from "@workspace/db";
import { randomBytes } from "crypto";
import { generateInternalReference } from "./reconciliation";
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
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});
const alunoUpload = upload.fields([
  { name: "bi_doc", maxCount: 1 },
  { name: "bi_encarregado_doc", maxCount: 1 },
  { name: "docs_transferencia", maxCount: 5 },
]);

const router = Router();

/* ─────────────────────────────────────────────
   Fine computation helper
   ─────────────────────────────────────────────
   Calculates and persists the automatic fine
   for overdue propinas based on the school's
   configured multa_regra.

   Rules:
   - Uses multa_regras.aplica_automatico flag
   - For propinas from PREVIOUS months: always
     applies the fine (they are fully overdue)
   - For propinas from the CURRENT month: only
     applies if today's day > dia_limite
   - Marks all overdue pendente propinas as
     status='vencido'
   ───────────────────────────────────────────── */
async function applyFinesForSchool(schoolId: number): Promise<void> {
  const now = new Date();
  const today = now.getDate();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth(); // 0-indexed

  const overdueRes = await pool.query(
    `SELECT p.id, p.montante, p.multa, p.data_vencimento
     FROM propinas p
     WHERE p.school_id = $1 AND p.status = 'pendente' AND p.data_vencimento < NOW()`,
    [schoolId]
  );

  if (!overdueRes.rows.length) return;

  const regraRes = await pool.query(
    "SELECT * FROM multa_regras WHERE school_id = $1", [schoolId]
  );
  const regra = regraRes.rows[0] ?? null;

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
      "UPDATE propinas SET status = 'vencido', multa = $1 WHERE id = $2",
      [multa, p.id]
    );
  }
}

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

/* ─── GET /school/pacotes ─── */
router.get("/school/pacotes", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    "SELECT id, nome, valor, descricao, itens, activo FROM pacotes_emolumentos WHERE school_id=$1 ORDER BY nome",
    [school.school_id]
  );
  res.json(r.rows);
});

/* ─── Alunos ─── */
router.get("/school/alunos", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const result = await pool.query(
    `SELECT s.id, s.nome, s.bilhete, s.telefone_encarregado, s.nome_encarregado,
            s.data_nascimento, s.sexo, s.numero_processo, s.estado,
            s.turma_id, COALESCE(t.nome, 'Sem turma') AS turma, t.turno, s.created_at,
            COUNT(p.id) FILTER (WHERE p.status IN ('pendente','vencido')) AS propinas_pendentes,
            COALESCE(SUM(p.montante + p.multa) FILTER (WHERE p.status IN ('pendente','vencido')), 0) AS divida,
            COALESCE(SUM(p.multa) FILTER (WHERE p.status IN ('pendente','vencido')), 0) AS multa_total,
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
     ORDER BY s.nome`,
    [school.school_id]
  );
  res.json(result.rows);
});

/* ─── PUT /school/alunos/:id/pacote ─── */
router.put("/school/alunos/:id/pacote", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const studentId = Number(req.params.id);
  const { pacote_id } = req.body; // null to remove package

  const check = await pool.query(
    "SELECT id FROM students WHERE id=$1 AND school_id=$2", [studentId, school.school_id]
  );
  if (!check.rows.length) return res.status(404).json({ error: "Aluno não encontrado." });

  if (pacote_id !== null && pacote_id !== undefined) {
    const pkCheck = await pool.query(
      "SELECT id FROM pacotes_emolumentos WHERE id=$1 AND school_id=$2", [pacote_id, school.school_id]
    );
    if (!pkCheck.rows.length) return res.status(404).json({ error: "Pacote não encontrado." });
  }

  // Upsert into matriculas
  await pool.query(
    `INSERT INTO matriculas (student_id, turma_id, ano_lectivo, pacote_id)
     SELECT $1, s.turma_id, '2025/2026', $2 FROM students s WHERE s.id=$1
     ON CONFLICT (student_id, turma_id, ano_lectivo)
     DO UPDATE SET pacote_id = EXCLUDED.pacote_id`,
    [studentId, pacote_id ?? null]
  );

  res.json({ ok: true });
});

/* ─── POST /school/alunos — create single student (multipart + files) ─── */
router.post("/school/alunos", schoolAuth, (req: any, res: any, next: any) => {
  alunoUpload(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req: any, res: any) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const b = req.body;
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;

  if (!b.nome?.trim()) return res.status(400).json({ error: "O nome do aluno é obrigatório." });

  const isTransferencia = b.is_transferencia === "true" || b.is_transferencia === "1";
  if (isTransferencia && !files?.docs_transferencia?.length) {
    return res.status(400).json({ error: "Para transferência, o documento da instituição anterior é obrigatório." });
  }

  const anoLectivo = b.ano_lectivo || "2025/2026";
  const biDocPath = files?.bi_doc?.[0]?.filename ?? null;
  const biEncDocPath = files?.bi_encarregado_doc?.[0]?.filename ?? null;
  const docsTransfPaths = files?.docs_transferencia?.map((f: any) => f.filename).join(",") ?? null;

  try {
    // Resolve or create turma
    let turmaId: number | null = b.turma_id ? Number(b.turma_id) : null;
    if (!turmaId && b.turma_nome?.trim()) {
      const existing = await pool.query(
        "SELECT id FROM turmas WHERE school_id=$1 AND LOWER(nome)=LOWER($2)",
        [school.school_id, b.turma_nome.trim()]
      );
      if (existing.rows[0]) {
        turmaId = existing.rows[0].id;
      } else {
        const nt = await pool.query(
          "INSERT INTO turmas (school_id, nome, ano, turno) VALUES ($1,$2,$3,$4) RETURNING id",
          [school.school_id, b.turma_nome.trim(), anoLectivo, b.turno || "Manhã"]
        );
        turmaId = nt.rows[0].id;
      }
    }

    const st = await pool.query(
      `INSERT INTO students
         (school_id, turma_id, nome, bilhete, numero_processo, data_nascimento, sexo,
          nome_encarregado, telefone_encarregado, estado,
          bi_doc_path, bi_encarregado_doc_path,
          is_transferencia, escola_anterior, ano_classe_anterior, docs_transferencia_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'activo',$10,$11,$12,$13,$14,$15)
       RETURNING id, nome, bilhete, estado, created_at`,
      [
        school.school_id, turmaId, b.nome.trim(),
        b.bilhete?.trim() || null, b.numero_processo?.trim() || null,
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

/* ─── POST /school/alunos/upload — bulk CSV import ─── */
router.post("/school/alunos/upload", schoolAuth, async (req: any, res: any) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const { alunos, ano_lectivo } = req.body as {
    alunos: Array<{
      nome: string; bilhete?: string; numero_processo?: string;
      data_nascimento?: string; sexo?: string;
      turma_nome?: string; turno?: string;
      nome_encarregado?: string; telefone_encarregado?: string;
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
  let inserted = 0, skipped = 0, encarregados_criados = 0;
  const errors: string[] = [];

  const [existingTurmas, existingPacotes] = await Promise.all([
    pool.query("SELECT id, nome FROM turmas WHERE school_id=$1", [school.school_id]),
    pool.query("SELECT id, nome FROM pacotes_emolumentos WHERE school_id=$1 AND activo=TRUE", [school.school_id]),
  ]);
  for (const t of existingTurmas.rows) turmaCache[t.nome.toLowerCase()] = t.id;
  for (const p of existingPacotes.rows) pacoteCache[p.nome.toLowerCase()] = p.id;

  for (const row of alunos) {
    if (!row.nome?.trim()) { skipped++; continue; }
    try {
      let turmaId: number | null = null;
      if (row.turma_nome?.trim()) {
        const key = row.turma_nome.trim().toLowerCase();
        if (turmaCache[key]) {
          turmaId = turmaCache[key];
        } else {
          const nt = await pool.query(
            "INSERT INTO turmas (school_id, nome, ano, turno) VALUES ($1,$2,$3,$4) RETURNING id",
            [school.school_id, row.turma_nome.trim(), anoLectivo, row.turno || "Manhã"]
          );
          turmaId = nt.rows[0].id;
          turmaCache[key] = turmaId!;
        }
      }

      const st = await pool.query(
        `INSERT INTO students
           (school_id, turma_id, nome, bilhete, numero_processo, data_nascimento,
            sexo, nome_encarregado, telefone_encarregado, estado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'activo')
         ON CONFLICT DO NOTHING RETURNING id`,
        [
          school.school_id, turmaId, row.nome.trim(),
          row.bilhete?.trim() || null, row.numero_processo?.trim() || null,
          row.data_nascimento || null, row.sexo || null,
          row.nome_encarregado?.trim() || null, row.telefone_encarregado?.trim() || null,
        ]
      );

      if (st.rows[0]) {
        const studentId = st.rows[0].id;
        let pacoteId: number | null = null;
        if (row.pacote_nome?.trim()) {
          pacoteId = pacoteCache[row.pacote_nome.trim().toLowerCase()] ?? null;
        }
        if (turmaId) {
          await pool.query(
            `INSERT INTO matriculas (student_id, turma_id, ano_lectivo, pacote_id)
             VALUES ($1,$2,$3,$4) ON CONFLICT (student_id, turma_id, ano_lectivo)
             DO UPDATE SET pacote_id = EXCLUDED.pacote_id`,
            [studentId, turmaId, anoLectivo, pacoteId]
          );
        }
        const telefoneEnc = row.telefone_encarregado?.toString().replace(/\D/g, "").trim();
        if (telefoneEnc && row.nome_encarregado?.trim()) {
          const existing = await pool.query("SELECT id FROM encarregados WHERE telefone=$1", [telefoneEnc]);
          let encId: number;
          if (existing.rows[0]) {
            encId = existing.rows[0].id;
          } else {
            const bcrypt = await import("bcryptjs");
            const hash = await bcrypt.hash("1234", 10);
            const ne = await pool.query(
              `INSERT INTO encarregados (nome, telefone, password, first_login) VALUES ($1,$2,$3,TRUE) RETURNING id`,
              [row.nome_encarregado.trim(), telefoneEnc, hash]
            );
            encId = ne.rows[0].id;
            encarregados_criados++;
          }
          await pool.query(
            `INSERT INTO encarregado_aluno (encarregado_id, aluno_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
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

  /* Auto-apply fines for overdue propinas before returning */
  await applyFinesForSchool(school.school_id);

  const { student_id } = req.query;
  const extra = student_id ? "AND p.student_id = $2" : "";
  const params: any[] = [school.school_id];
  if (student_id) params.push(student_id);

  const result = await pool.query(
    `SELECT p.id, p.student_id, p.mes, p.ano, p.montante, p.multa, p.status,
            p.data_vencimento, p.referencia, p.pago_em, p.created_at,
            p.internal_reference,
            p.baixa_manual, p.baixa_manual_por, p.baixa_manual_em,
            p.baixa_manual_obs, p.comprovante_url, p.data_recebimento,
            p.transaction_id, p.metodo_pagamento,
            COALESCE(p.pagamento_origem, 'manual') AS pagamento_origem,
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
         ON CONFLICT (student_id, mes, ano) DO NOTHING
         RETURNING *`,
        [school.school_id, student_id, mes, String(ano), montante, vencimento]
      );
      if (r.rows[0]) {
        const propina = r.rows[0];
        const ref = await generateInternalReference(propina.id);
        await pool.query("UPDATE propinas SET internal_reference=$1 WHERE id=$2", [ref, propina.id]);
        created.push({ ...propina, internal_reference: ref });
      }
    } catch {}
  }

  res.status(201).json({ created, total: created.length });
});

/* ─── POST /school/propinas/gerar-lote ─── */
router.post("/school/propinas/gerar-lote", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const { mes_inicio, ano_inicio, mes_fim, ano_fim, montante_fallback } = req.body;
  if (!mes_inicio || !ano_inicio) return res.status(400).json({ error: "Período inicial é obrigatório." });

  // Build month range
  const mStart = MESES.findIndex(m => m.toLowerCase() === String(mes_inicio).toLowerCase());
  const mEnd   = MESES.findIndex(m => m.toLowerCase() === String(mes_fim || mes_inicio).toLowerCase());
  if (mStart === -1 || mEnd === -1) return res.status(400).json({ error: "Mês inválido." });

  const yStart = Number(ano_inicio);
  const yEnd   = Number(ano_fim || ano_inicio);
  if (isNaN(yStart) || isNaN(yEnd) || yStart > yEnd || (yStart === yEnd && mStart > mEnd)) {
    return res.status(400).json({ error: "Intervalo de datas inválido." });
  }

  const periodos: { mes: string; ano: string }[] = [];
  let cy = yStart, cm = mStart;
  while (cy < yEnd || (cy === yEnd && cm <= mEnd)) {
    periodos.push({ mes: MESES[cm], ano: String(cy) });
    cm++;
    if (cm >= 12) { cm = 0; cy++; }
  }

  // Fetch all active students with their active enrolment package
  const studentsRes = await pool.query(
    `SELECT s.id AS student_id, s.nome,
            pe.valor AS pacote_valor,
            pe.itens AS pacote_itens,
            pe.nome  AS pacote_nome
     FROM students s
     LEFT JOIN matriculas m             ON m.student_id = s.id AND m.estado = 'activa'
     LEFT JOIN pacotes_emolumentos pe   ON pe.id = m.pacote_id
     WHERE s.school_id = $1 AND s.estado = 'activo'
     ORDER BY s.nome`,
    [school.school_id]
  );

  const students = studentsRes.rows;
  if (!students.length) return res.status(400).json({ error: "Nenhum aluno activo encontrado." });

  let totalGeradas = 0, totalSkipped = 0;
  const detalhes: any[] = [];

  for (const st of students) {
    // Determine montante: prefer propina item in package, fallback to whole package, then request fallback
    let montante: number = Number(montante_fallback) || 0;
    if (st.pacote_itens) {
      const itens: { tipo: string; valor: number }[] = typeof st.pacote_itens === "string"
        ? JSON.parse(st.pacote_itens)
        : st.pacote_itens;
      const propinaItem = itens.find((i: any) => i.tipo === "propina");
      if (propinaItem) montante = Number(propinaItem.valor);
      else if (st.pacote_valor) montante = Number(st.pacote_valor);
    } else if (st.pacote_valor) {
      montante = Number(st.pacote_valor);
    }

    if (!montante) {
      detalhes.push({ student_id: st.student_id, nome: st.nome, skipped: periodos.length, reason: "sem_montante" });
      totalSkipped += periodos.length;
      continue;
    }

    let criadosParaAluno = 0;
    for (const { mes, ano } of periodos) {
      const vencimento = lastDayOfMonth(mes, ano);
      try {
        const r = await pool.query(
          `INSERT INTO propinas (school_id, student_id, mes, ano, montante, data_vencimento, multa, status)
           VALUES ($1, $2, $3, $4, $5, $6, 0, 'pendente')
           ON CONFLICT (student_id, mes, ano) DO NOTHING
           RETURNING *`,
          [school.school_id, st.student_id, mes, ano, montante, vencimento]
        );
        if (r.rows[0]) {
          const propina = r.rows[0];
          const ref = await generateInternalReference(propina.id);
          await pool.query("UPDATE propinas SET internal_reference=$1 WHERE id=$2", [ref, propina.id]);
          criadosParaAluno++;
          totalGeradas++;
        } else {
          totalSkipped++;
        }
      } catch { totalSkipped++; }
    }
    detalhes.push({ student_id: st.student_id, nome: st.nome, criados: criadosParaAluno, montante, pacote_nome: st.pacote_nome ?? null });
  }

  res.status(201).json({
    total_geradas: totalGeradas,
    total_skipped: totalSkipped,
    total_alunos: students.length,
    periodos: periodos.length,
    detalhes,
  });
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

  /* Apply fines before computing reference total */
  await applyFinesForSchool(school.school_id);

  /* Re-fetch propinas with fresh multa values */
  const freshRes = await pool.query(
    `SELECT p.id, p.mes, p.ano, p.montante, p.multa, p.student_id, p.status
     FROM propinas p
     JOIN students s ON s.id = p.student_id
     WHERE p.id = ANY($1) AND s.school_id = $2`,
    [propina_ids, school.school_id]
  );
  const freshPropinas = freshRes.rows;

  const total = freshPropinas.reduce((s: number, p: any) => s + Number(p.montante) + Number(p.multa), 0);
  const latestMes = freshPropinas[freshPropinas.length - 1];
  const validade = lastDayOfMonth(latestMes.mes, latestMes.ano);
  const referencia = generateRef();
  const entidade = "00112";

  // Insert reference for each propina (upsert)
  for (const p of freshPropinas) {
    await pool.query(
      `INSERT INTO pagamentos (propina_id, entidade, referencia, valor, estado, validade)
       VALUES ($1, $2, $3, $4, 'PENDENTE', $5)
       ON CONFLICT (propina_id) DO UPDATE
       SET referencia = $3, valor = $4, validade = $5, estado = 'PENDENTE'`,
      [p.id, entidade, referencia, total, validade]
    );
  }

  const totalMulta = freshPropinas.reduce((s: number, p: any) => s + Number(p.multa), 0);
  const totalBase  = freshPropinas.reduce((s: number, p: any) => s + Number(p.montante), 0);

  res.json({
    entidade,
    referencia,
    valor: total,
    total_base: totalBase,
    total_multa: totalMulta,
    validade: validade.toISOString(),
    propinas: freshPropinas,
  });
});

/* ─── GET /school/propinas/:id/ajustes ─── */
router.get("/school/propinas/:id/ajustes", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const check = await pool.query(
    "SELECT id FROM propinas WHERE id=$1 AND school_id=$2", [req.params.id, school.school_id]
  );
  if (!check.rows.length) return res.status(404).json({ error: "Propina não encontrada." });
  const r = await pool.query(
    "SELECT * FROM propina_ajustes WHERE propina_id=$1 ORDER BY created_at DESC",
    [req.params.id]
  );
  res.json(r.rows);
});

/* ─── POST /school/propinas/:id/ajuste ─── */
router.post("/school/propinas/:id/ajuste", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const { tipo, multa_nova, valor_novo, nova_data_vencimento, motivo } = req.body;
  if (!tipo || !["perdao","ajuste_valor","reagendamento","justificacao"].includes(tipo)) {
    return res.status(400).json({ error: "tipo inválido." });
  }
  if (!motivo?.trim()) return res.status(400).json({ error: "Motivo é obrigatório." });

  const propina = await pool.query(
    "SELECT * FROM propinas WHERE id=$1 AND school_id=$2",
    [req.params.id, school.school_id]
  );
  if (!propina.rows.length) return res.status(404).json({ error: "Propina não encontrada." });
  const p = propina.rows[0];

  const log: any = {
    propina_id: p.id, tipo, motivo: motivo.trim(),
    multa_anterior: p.multa, valor_anterior: p.montante,
    created_by: `escola:${school.school_id}`,
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
    await pool.query(
      "UPDATE propinas SET data_vencimento=$1, status='pendente', multa=0 WHERE id=$2",
      [nova_data_vencimento, p.id]
    );
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

export default router;
