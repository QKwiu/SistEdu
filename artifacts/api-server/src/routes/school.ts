import { Router } from "express";
import { pool } from "@workspace/db";
import { randomBytes } from "crypto";
import { generateInternalReference } from "./reconciliation";
import { sendEventSMS, sendBulkSMS } from "../services/sms.service";
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

/* ─── Cobranças avulsas (emolumentos): DB migration ─── */
pool.query(`
  CREATE TABLE IF NOT EXISTS cobrancas (
    id SERIAL PRIMARY KEY,
    school_id TEXT NOT NULL,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    emolumento_id INTEGER REFERENCES emolumentos(id),
    descricao TEXT NOT NULL,
    montante NUMERIC(12,2) NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago')),
    referencia TEXT,
    entidade TEXT,
    validade DATE,
    created_at TIMESTAMPTZ DEFAULT now()
  )
`).catch(console.error);

/* ─── Bolsas de estudo: DB migration ─── */
pool.query(`
  CREATE TABLE IF NOT EXISTS bolsa_tipos (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    tipo_desconto VARCHAR(20) NOT NULL DEFAULT 'percentagem' CHECK (tipo_desconto IN ('percentagem','fixo')),
    valor NUMERIC(10,2) NOT NULL DEFAULT 0,
    abrangencia VARCHAR(20) NOT NULL DEFAULT 'propina' CHECK (abrangencia IN ('propina','tudo')),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS bolsa_atribuicoes (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    bolsa_tipo_id INTEGER REFERENCES bolsa_tipos(id),
    school_id INTEGER REFERENCES schools(id),
    data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    data_fim DATE,
    comprovativo_url TEXT,
    estado VARCHAR(20) DEFAULT 'activa' CHECK (estado IN ('activa','revogada','expirada')),
    notas TEXT,
    revogada_em TIMESTAMPTZ,
    revogada_por TEXT,
    motivo_revogacao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE propinas ADD COLUMN IF NOT EXISTS desconto NUMERIC(10,2) DEFAULT 0;
  ALTER TABLE propinas ADD COLUMN IF NOT EXISTS bolsa_atribuicao_id INTEGER REFERENCES bolsa_atribuicoes(id);
`).catch(() => {});

/* ─── Número de processo: DB migration ─── */
pool.query(`
  ALTER TABLE schools ADD COLUMN IF NOT EXISTS numero_processo_prefixo TEXT DEFAULT '';
`).catch(() => {});

/* ─── Comunicados: tipo + foto_base64 ─── */
pool.query(`
  ALTER TABLE comunicados ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'normal';
  ALTER TABLE comunicados ADD COLUMN IF NOT EXISTS foto_base64 TEXT;
`).catch(() => {});

/* ─── Caixa Faturas: POS sequential invoicing ─── */
pool.query(`
  CREATE TABLE IF NOT EXISTS caixa_faturas (
    id SERIAL PRIMARY KEY,
    escola_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    numero_seq INTEGER NOT NULL,
    numero_fatura TEXT NOT NULL,
    student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
    aluno_nome TEXT NOT NULL,
    aluno_numero_processo TEXT,
    aluno_turma TEXT,
    emolumento_id INTEGER REFERENCES emolumentos(id) ON DELETE SET NULL,
    propina_id INTEGER REFERENCES propinas(id) ON DELETE SET NULL,
    descricao TEXT NOT NULL,
    montante NUMERIC(12,2) NOT NULL,
    metodo_pagamento TEXT NOT NULL DEFAULT 'CASH',
    operador_nome TEXT DEFAULT 'Administrador',
    status TEXT NOT NULL DEFAULT 'liquidado',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS caixa_faturas_escola_seq ON caixa_faturas(escola_id, numero_seq);
`).catch(e => console.error("caixa_faturas migration error:", e));
pool.query(`
  ALTER TABLE students ADD CONSTRAINT IF NOT EXISTS uniq_student_school_num_proc UNIQUE (school_id, numero_processo);
`).catch(() => {});

/* Helper: fetch active bolsa discount for a student */
async function getActiveBolsaDiscount(studentId: number): Promise<{ id: number; tipo_desconto: string; bolsa_valor: number } | null> {
  const r = await pool.query(
    `SELECT ba.id, bt.tipo_desconto, bt.valor AS bolsa_valor
     FROM bolsa_atribuicoes ba
     JOIN bolsa_tipos bt ON bt.id = ba.bolsa_tipo_id
     WHERE ba.student_id = $1 AND ba.estado = 'activa'
       AND (ba.data_fim IS NULL OR ba.data_fim >= CURRENT_DATE) LIMIT 1`,
    [studentId]
  );
  return r.rows[0] ?? null;
}

function applyBolsaDiscount(montante: number, bolsa: { tipo_desconto: string; bolsa_valor: number } | null): { finalMontante: number; desconto: number } {
  if (!bolsa) return { finalMontante: montante, desconto: 0 };
  let desconto = 0;
  if (bolsa.tipo_desconto === 'percentagem') {
    desconto = Math.round(montante * Number(bolsa.bolsa_valor) / 100 * 100) / 100;
  } else {
    desconto = Math.min(montante, Number(bolsa.bolsa_valor));
  }
  return { finalMontante: Math.max(0, montante - desconto), desconto };
}

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
    `SELECT p.id, p.montante, p.multa, p.data_vencimento, p.mes,
            s.nome AS nome_aluno, s.telefone_encarregado, s.nome_encarregado,
            p.internal_reference
     FROM propinas p
     JOIN students s ON s.id = p.student_id
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

    const multaAnterior = Number(p.multa);
    await pool.query(
      "UPDATE propinas SET status = 'vencido', multa = $1 WHERE id = $2",
      [multa, p.id]
    );

    if (p.telefone_encarregado) {
      if (multa > multaAnterior && multa > 0) {
        sendEventSMS("multa_aplicada", schoolId, {
          telefone: p.telefone_encarregado,
          nome_encarregado: p.nome_encarregado ?? undefined,
          nome_aluno: p.nome_aluno,
          mes: p.mes,
          valor_multa: Math.round(multa),
        }).catch(() => {});
      } else {
        sendEventSMS("atraso_pagamento", schoolId, {
          telefone: p.telefone_encarregado,
          nome_encarregado: p.nome_encarregado ?? undefined,
          nome_aluno: p.nome_aluno,
          mes: p.mes,
          reference: p.internal_reference ?? undefined,
          is_emis_reference: false,
        }).catch(() => {});
      }
    }
  }
}

/* ─── Auth helpers ─── */
async function getSchoolFromToken(token: string) {
  const res = await pool.query(
    `SELECT sc.id AS school_id, sc.name AS school_name,
            sc.institution_type, sc.portal_nomenclatura, sc.usa_pacotes
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

/* ─── School Profile ─── */
router.get("/school/profile", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  res.json({ usa_pacotes: school.usa_pacotes ?? false });
});

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

/* ─── POST /school/pacotes ─── */
router.post("/school/pacotes", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { nome, descricao, itens } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: "Nome do pacote é obrigatório." });
  const itemsArr = Array.isArray(itens) ? itens : [];
  const valor = itemsArr.reduce((s: number, i: any) => s + (Number(i.valor) || 0), 0);
  const r = await pool.query(
    `INSERT INTO pacotes_emolumentos (school_id, nome, descricao, itens, valor, activo)
     VALUES ($1,$2,$3,$4,$5,TRUE) RETURNING *`,
    [school.school_id, nome.trim(), descricao?.trim() || null, JSON.stringify(itemsArr), valor]
  );
  return res.status(201).json(r.rows[0]);
});

/* ─── PUT /school/pacotes/:id ─── */
router.put("/school/pacotes/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { nome, descricao, itens, activo } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: "Nome do pacote é obrigatório." });
  const itemsArr = Array.isArray(itens) ? itens : [];
  const valor = itemsArr.reduce((s: number, i: any) => s + (Number(i.valor) || 0), 0);
  const r = await pool.query(
    `UPDATE pacotes_emolumentos SET nome=$1, descricao=$2, itens=$3, valor=$4, activo=COALESCE($5,activo)
     WHERE id=$6 AND school_id=$7 RETURNING *`,
    [nome.trim(), descricao?.trim() || null, JSON.stringify(itemsArr), valor, activo ?? null, req.params.id, school.school_id]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Pacote não encontrado." });
  return res.json(r.rows[0]);
});

/* ─── DELETE /school/pacotes/:id ─── */
router.delete("/school/pacotes/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  await pool.query(
    "DELETE FROM pacotes_emolumentos WHERE id=$1 AND school_id=$2",
    [req.params.id, school.school_id]
  );
  return res.status(204).end();
});

/* ─── PATCH /school/pacotes/:id/toggle — toggle activo ─── */
router.patch("/school/pacotes/:id/toggle", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    "UPDATE pacotes_emolumentos SET activo = NOT activo WHERE id=$1 AND school_id=$2 RETURNING *",
    [req.params.id, school.school_id]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Pacote não encontrado." });
  return res.json(r.rows[0]);
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

    // Auto-generate numero_processo if not provided
    let numeroProcesso = b.numero_processo?.trim() || null;
    if (!numeroProcesso) {
      const gen = await computeNextNumeroProcesso(school.school_id);
      numeroProcesso = gen.next;
    }

    const st = await pool.query(
      `INSERT INTO students
         (school_id, turma_id, nome, bilhete, numero_processo, data_nascimento, sexo,
          nome_encarregado, telefone_encarregado, estado,
          bi_doc_path, bi_encarregado_doc_path,
          is_transferencia, escola_anterior, ano_classe_anterior, docs_transferencia_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'activo',$10,$11,$12,$13,$14,$15)
       RETURNING id, nome, bilhete, numero_processo, estado, created_at`,
      [
        school.school_id, turmaId, b.nome.trim(),
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

    // Individual emolumento assignment (when school uses individual emolumentos instead of pacotes)
    if (b.emolumento_propina_id) {
      await pool.query(
        "UPDATE students SET emolumento_propina_id=$1 WHERE id=$2",
        [Number(b.emolumento_propina_id), student.id]
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

/* ─── Helper: get numero_processo prefix for a school ─── */
async function getNumeroProcessoPrefixo(schoolId: number): Promise<string> {
  // Try the dedicated column first (may not exist yet on first deploy), then fall back to settings JSONB
  try {
    const r = await pool.query(
      "SELECT numero_processo_prefixo, settings FROM schools WHERE id=$1", [schoolId]
    );
    const row = r.rows[0];
    if (!row) return "";
    let prefixo = row.numero_processo_prefixo ?? "";
    if (!prefixo) prefixo = row.settings?.academico?.numero_processo_prefixo ?? "";
    return prefixo;
  } catch {
    // Column may not exist yet – fall back to settings only
    try {
      const r = await pool.query("SELECT settings FROM schools WHERE id=$1", [schoolId]);
      return r.rows[0]?.settings?.academico?.numero_processo_prefixo ?? "";
    } catch {
      return "";
    }
  }
}

/* ─── Helper: compute next numero_processo for a school ─── */
async function computeNextNumeroProcesso(schoolId: number): Promise<{ next: string; prefixo: string; nextNum: number }> {
  const prefixo = await getNumeroProcessoPrefixo(schoolId);
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
  const next = prefixo ? `${prefixo}${padded}` : padded;
  return { next, prefixo, nextNum };
}

/* ─── GET /school/alunos/next-numero-processo ─── */
router.get("/school/alunos/next-numero-processo", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  try {
    const result = await computeNextNumeroProcesso(school.school_id);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /school/alunos/:id — ficha completa do aluno ─── */
router.get("/school/alunos/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const studentId = Number(req.params.id);
  const sr = await pool.query(
    `SELECT s.id, s.nome, s.bilhete, s.numero_processo, s.data_nascimento, s.sexo, s.estado,
            s.nome_encarregado, s.telefone_encarregado, s.emolumento_propina_id,
            s.turma_id, COALESCE(t.nome,'Sem turma') AS turma_nome, t.turno,
            m.pacote_id, m.ano_lectivo
     FROM students s
     LEFT JOIN turmas t ON t.id = s.turma_id
     LEFT JOIN matriculas m ON m.student_id = s.id AND m.estado = 'activa'
     WHERE s.id=$1 AND s.school_id=$2`,
    [studentId, school.school_id]
  );
  if (!sr.rows.length) return res.status(404).json({ error: "Aluno não encontrado." });

  const er = await pool.query(
    `SELECT e.id, e.nome, e.telefone, e.email, e.first_login, e.created_at
     FROM encarregados e
     JOIN encarregado_aluno ea ON ea.encarregado_id = e.id
     WHERE ea.aluno_id = $1 LIMIT 1`,
    [studentId]
  );

  const tr = await pool.query(
    "SELECT id, nome, turno FROM turmas WHERE school_id=$1 ORDER BY nome",
    [school.school_id]
  );

  return res.json({ ...sr.rows[0], encarregado: er.rows[0] ?? null, turmas: tr.rows, school_usa_pacotes: school.usa_pacotes ?? false });
});

/* ─── PUT /school/alunos/:id — actualizar ficha do aluno ─── */
router.put("/school/alunos/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const studentId = Number(req.params.id);
  const b = req.body;

  const check = await pool.query(
    "SELECT id FROM students WHERE id=$1 AND school_id=$2", [studentId, school.school_id]
  );
  if (!check.rows.length) return res.status(404).json({ error: "Aluno não encontrado." });

  let turmaId: number | null = b.turma_id ? Number(b.turma_id) : null;

  const emolumentoPropinaId = b.emolumento_propina_id !== undefined
    ? (b.emolumento_propina_id ? Number(b.emolumento_propina_id) : null)
    : undefined;

  if (emolumentoPropinaId !== undefined) {
    await pool.query(
      `UPDATE students SET
         nome=$1, bilhete=$2, numero_processo=$3, data_nascimento=$4, sexo=$5,
         nome_encarregado=$6, telefone_encarregado=$7, estado=$8, turma_id=$9,
         emolumento_propina_id=$10
       WHERE id=$11 AND school_id=$12`,
      [
        b.nome?.trim() || null, b.bilhete?.trim() || null,
        b.numero_processo?.trim() || null, b.data_nascimento || null, b.sexo || null,
        b.nome_encarregado?.trim() || null,
        b.telefone_encarregado?.toString().replace(/\D/g, "").trim() || null,
        b.estado || "activo", turmaId, emolumentoPropinaId, studentId, school.school_id,
      ]
    );
  } else {
    await pool.query(
      `UPDATE students SET
         nome=$1, bilhete=$2, numero_processo=$3, data_nascimento=$4, sexo=$5,
         nome_encarregado=$6, telefone_encarregado=$7, estado=$8, turma_id=$9
       WHERE id=$10 AND school_id=$11`,
      [
        b.nome?.trim() || null, b.bilhete?.trim() || null,
        b.numero_processo?.trim() || null, b.data_nascimento || null, b.sexo || null,
        b.nome_encarregado?.trim() || null,
        b.telefone_encarregado?.toString().replace(/\D/g, "").trim() || null,
        b.estado || "activo", turmaId, studentId, school.school_id,
      ]
    );
  }

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

    // 2. Or find any guardian with this phone
    const phoneEnc = await pool.query(
      `SELECT id FROM encarregados WHERE telefone=$1 LIMIT 1`, [telefoneEnc]
    );

    const encId: number | null = linkedEnc.rows[0]?.id ?? phoneEnc.rows[0]?.id ?? null;

    const bcrypt = await import("bcryptjs");
    if (encId) {
      // Update existing guardian
      const upFields: string[] = ["nome=$1", "telefone=$2"];
      const upVals: any[] = [b.nome_encarregado.trim(), telefoneEnc];
      if (b.encarregado_email !== undefined) {
        upFields.push(`email=$${upVals.length + 1}`);
        upVals.push(b.encarregado_email?.trim() || null);
      }
      if (b.nova_password?.trim()) {
        const hash = await bcrypt.hash(b.nova_password.trim(), 10);
        upFields.push(`password=$${upVals.length + 1}`, `first_login=FALSE`);
        upVals.push(hash);
      }
      upVals.push(encId);
      await pool.query(`UPDATE encarregados SET ${upFields.join(",")} WHERE id=$${upVals.length}`, upVals);
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

  const updated = await pool.query(
    `SELECT s.id, s.nome, s.bilhete, s.numero_processo, s.data_nascimento, s.sexo, s.estado,
            s.nome_encarregado, s.telefone_encarregado, s.turma_id,
            COALESCE(t.nome,'Sem turma') AS turma_nome, t.turno
     FROM students s LEFT JOIN turmas t ON t.id = s.turma_id WHERE s.id=$1`,
    [studentId]
  );
  return res.json(updated.rows[0]);
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
    "SELECT id, nome, telefone_encarregado, nome_encarregado FROM students WHERE id = $1 AND school_id = $2",
    [student_id, school.school_id]
  );
  if (!stRes.rows.length) return res.status(404).json({ error: "Aluno não encontrado." });
  const studentInfo = stRes.rows[0];

  // Apply active bolsa discount
  const activeBolsa = await getActiveBolsaDiscount(student_id);
  const { finalMontante, desconto } = applyBolsaDiscount(Number(montante), activeBolsa);
  const bolsaAtribuicaoId = activeBolsa?.id ?? null;

  const created = [];
  for (const mes of meses) {
    const vencimento = lastDayOfMonth(mes, String(ano));
    try {
      const r = await pool.query(
        `INSERT INTO propinas (school_id, student_id, mes, ano, montante, data_vencimento, multa, status, desconto, bolsa_atribuicao_id)
         VALUES ($1, $2, $3, $4, $5, $6, 0, 'pendente', $7, $8)
         ON CONFLICT (student_id, mes, ano) DO NOTHING
         RETURNING *`,
        [school.school_id, student_id, mes, String(ano), finalMontante, vencimento, desconto, bolsaAtribuicaoId]
      );
      if (r.rows[0]) {
        const propina = r.rows[0];
        const ref = await generateInternalReference(propina.id);
        await pool.query("UPDATE propinas SET internal_reference=$1 WHERE id=$2", [ref, propina.id]);
        created.push({ ...propina, internal_reference: ref });
        if (studentInfo.telefone_encarregado) {
          sendEventSMS("nova_fatura", school.school_id, {
            telefone: studentInfo.telefone_encarregado,
            nome_encarregado: studentInfo.nome_encarregado ?? undefined,
            nome_aluno: studentInfo.nome,
            mes,
            valor: finalMontante,
            reference: ref,
            is_emis_reference: false,
          }).catch(() => {});
        }
      }
    } catch {}
  }

  res.status(201).json({ created, total: created.length });
});

/* ─── POST /school/propinas/gerar-lote ─── */
router.post("/school/propinas/gerar-lote", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const { mes_inicio, ano_inicio, mes_fim, ano_fim, montante_fallback, auto_referencia, auto_sms } = req.body;
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

  // Fetch all active students with their active enrolment package (or assigned individual emolumento)
  const studentsRes = await pool.query(
    `SELECT s.id AS student_id, s.nome, s.telefone_encarregado, s.nome_encarregado,
            s.emolumento_propina_id,
            pe.valor AS pacote_valor,
            pe.itens AS pacote_itens,
            pe.nome  AS pacote_nome,
            em.montante AS emolumento_montante,
            em.nome AS emolumento_nome
     FROM students s
     LEFT JOIN matriculas m             ON m.student_id = s.id AND m.estado = 'activa'
     LEFT JOIN pacotes_emolumentos pe   ON pe.id = m.pacote_id
     LEFT JOIN emolumentos em           ON em.id = s.emolumento_propina_id
     WHERE s.school_id = $1 AND s.estado = 'activo'
     ORDER BY s.nome`,
    [school.school_id]
  );

  const students = studentsRes.rows;
  if (!students.length) return res.status(400).json({ error: "Nenhum aluno activo encontrado." });

  let totalGeradas = 0, totalSkipped = 0, totalReferencias = 0, totalSMS = 0;
  const detalhes: any[] = [];

  for (const st of students) {
    // Determine montante: prefer propina item in package, fallback to whole package,
    // then student's assigned emolumento, then request fallback
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
    } else if (st.emolumento_montante) {
      montante = Number(st.emolumento_montante);
    }

    if (!montante) {
      detalhes.push({ student_id: st.student_id, nome: st.nome, skipped: periodos.length, reason: "sem_montante" });
      totalSkipped += periodos.length;
      continue;
    }

    // Apply bolsa discount for this student
    const stBolsa = await getActiveBolsaDiscount(st.student_id);
    const { finalMontante: stFinalMontante, desconto: stDesconto } = applyBolsaDiscount(montante, stBolsa);
    const stBolsaId = stBolsa?.id ?? null;

    let criadosParaAluno = 0;
    for (const { mes, ano } of periodos) {
      const vencimento = lastDayOfMonth(mes, ano);
      try {
        const r = await pool.query(
          `INSERT INTO propinas (school_id, student_id, mes, ano, montante, data_vencimento, multa, status, desconto, bolsa_atribuicao_id)
           VALUES ($1, $2, $3, $4, $5, $6, 0, 'pendente', $7, $8)
           ON CONFLICT (student_id, mes, ano) DO NOTHING
           RETURNING *`,
          [school.school_id, st.student_id, mes, ano, stFinalMontante, vencimento, stDesconto, stBolsaId]
        );
        if (r.rows[0]) {
          const propina = r.rows[0];
          const ref = await generateInternalReference(propina.id);
          await pool.query("UPDATE propinas SET internal_reference=$1 WHERE id=$2", [ref, propina.id]);
          criadosParaAluno++;
          totalGeradas++;

          // Auto-generate Multicaixa (EMIS) reference for this propina
          let emisRef: string | null = null;
          if (auto_referencia) {
            try {
              const emisReferencia = generateRef();
              const validade = lastDayOfMonth(mes, ano);
              await pool.query(
                `INSERT INTO pagamentos (propina_id, entidade, referencia, valor, estado, validade)
                 VALUES ($1, $2, $3, $4, 'PENDENTE', $5)
                 ON CONFLICT (propina_id) DO UPDATE SET referencia=$3, valor=$4, validade=$5, estado='PENDENTE'`,
                [propina.id, "00112", emisReferencia, stFinalMontante, validade]
              );
              emisRef = emisReferencia;
              totalReferencias++;
            } catch {}
          }

          // Send SMS notification to guardian
          if (auto_sms && st.telefone_encarregado) {
            sendEventSMS("nova_fatura", school.school_id, {
              telefone: st.telefone_encarregado,
              nome_encarregado: st.nome_encarregado ?? undefined,
              nome_aluno: st.nome,
              mes,
              valor: stFinalMontante,
              reference: emisRef ?? ref,
              is_emis_reference: !!emisRef,
            }).catch(() => {});
            totalSMS++;
          }
        } else {
          totalSkipped++;
        }
      } catch { totalSkipped++; }
    }
    detalhes.push({ student_id: st.student_id, nome: st.nome, criados: criadosParaAluno, montante: stFinalMontante, montante_original: montante, desconto: stDesconto, pacote_nome: st.pacote_nome ?? null, bolsa: stBolsa ? true : false });
  }

  res.status(201).json({
    total_geradas: totalGeradas,
    total_skipped: totalSkipped,
    total_alunos: students.length,
    periodos: periodos.length,
    total_referencias: totalReferencias,
    total_sms: totalSMS,
    detalhes,
  });
});

/* ─── GET /school/propinas/:id/fatura — structured invoice data ─── */
router.get("/school/propinas/:id/fatura", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const r = await pool.query(`
    SELECT p.id, p.mes, p.ano, p.montante, p.multa, p.desconto, p.status,
           p.data_vencimento, p.internal_reference, p.created_at, p.pago_em,
           p.metodo_pagamento, p.pagamento_origem,
           s.nome AS aluno_nome, s.numero_processo, s.nome_encarregado,
           s.telefone_encarregado,
           COALESCE(t.nome, 'Sem turma') AS turma_nome,
           pg.entidade, pg.referencia AS ref_numero, pg.valor AS ref_valor,
           pg.validade AS ref_validade,
           sc.name AS escola_nome, sc.nif AS escola_nif, sc.phone AS escola_phone,
           sc.institution_type, sc.iban, sc.logo_url
    FROM propinas p
    JOIN students s ON s.id = p.student_id
    JOIN schools sc ON sc.id = p.school_id
    LEFT JOIN turmas t ON t.id = s.turma_id
    LEFT JOIN pagamentos pg ON pg.propina_id = p.id
    WHERE p.id = $1 AND p.school_id = $2
  `, [req.params.id, school.school_id]);

  if (!r.rows.length) return res.status(404).json({ error: "Propina não encontrada." });
  const row = r.rows[0];

  const institutionLabel = row.institution_type === "university" ? "Universidade"
    : row.institution_type === "instituto" ? "Instituto"
    : row.institution_type === "colegio" ? "Colégio"
    : "Escola";

  res.json({
    propina: {
      id: row.id, mes: row.mes, ano: row.ano,
      montante: row.montante, multa: row.multa, desconto: row.desconto,
      status: row.status, data_vencimento: row.data_vencimento,
      internal_reference: row.internal_reference, created_at: row.created_at,
      pago_em: row.pago_em, metodo_pagamento: row.metodo_pagamento,
      pagamento_origem: row.pagamento_origem,
    },
    aluno: {
      nome: row.aluno_nome, numero_processo: row.numero_processo, turma: row.turma_nome,
      nome_encarregado: row.nome_encarregado, telefone_encarregado: row.telefone_encarregado,
    },
    escola: {
      nome: row.escola_nome, nif: row.escola_nif, phone: row.escola_phone,
      institution_type: institutionLabel, iban: row.iban, logo_url: row.logo_url,
    },
    referencia: row.ref_numero ? {
      entidade: row.entidade, numero: row.ref_numero,
      valor: row.ref_valor, validade: row.ref_validade,
    } : null,
    descricao: `Propina Mensal — ${row.mes} ${row.ano}`,
    numero_fatura: `FT${String(row.id).padStart(6, "0")}`,
  });
});

router.post("/school/propinas/referencia", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const { propina_ids = [], emolumento_items = [] } = req.body;
  if (!propina_ids?.length && !emolumento_items?.length)
    return res.status(400).json({ error: "Selecione pelo menos uma propina ou emolumento." });

  let freshPropinas: any[] = [];

  if (propina_ids.length) {
    const pRes = await pool.query(
      `SELECT p.id, p.mes, p.ano, p.montante, p.multa, p.student_id, p.status
       FROM propinas p
       JOIN students s ON s.id = p.student_id
       WHERE p.id = ANY($1) AND s.school_id = $2`,
      [propina_ids, school.school_id]
    );
    if (!pRes.rows.length) return res.status(404).json({ error: "Propinas não encontradas." });
    const alreadyPaid = pRes.rows.filter((p: any) => p.status === "pago");
    if (alreadyPaid.length) return res.status(400).json({ error: "Uma ou mais propinas já estão pagas." });

    await applyFinesForSchool(school.school_id);

    const freshRes = await pool.query(
      `SELECT p.id, p.mes, p.ano, p.montante, p.multa, p.student_id, p.status
       FROM propinas p
       JOIN students s ON s.id = p.student_id
       WHERE p.id = ANY($1) AND s.school_id = $2`,
      [propina_ids, school.school_id]
    );
    freshPropinas = freshRes.rows;
  }

  // Validate emolumento_items
  const validItems: any[] = [];
  for (const item of emolumento_items) {
    const { emolumento_id, student_id, descricao, montante, quantidade = 1 } = item;
    if (!descricao || !montante) continue;
    // Verify emolumento belongs to this school (or is global)
    if (emolumento_id) {
      const emCheck = await pool.query(
        `SELECT id FROM emolumentos WHERE id=$1 AND (school_id=$2 OR school_id IS NULL)`,
        [emolumento_id, school.school_id]
      );
      if (!emCheck.rows.length) continue;
    }
    validItems.push({ emolumento_id: emolumento_id ?? null, student_id: student_id ?? null, descricao, montante: Number(montante), quantidade: Number(quantidade) || 1 });
  }

  const totalPropinas = freshPropinas.reduce((s: number, p: any) => s + Number(p.montante) + Number(p.multa), 0);
  const totalEmolumentos = validItems.reduce((s, i) => s + i.montante * i.quantidade, 0);
  const total = totalPropinas + totalEmolumentos;

  // Compute validade: last day of latest propina month OR 30 days from now if only emolumentos
  let validade: Date;
  if (freshPropinas.length) {
    const latestMes = freshPropinas[freshPropinas.length - 1];
    validade = lastDayOfMonth(latestMes.mes, latestMes.ano);
  } else {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    validade = d;
  }

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

  // Insert cobrancas for each emolumento item
  const cobrancasCreated: any[] = [];
  for (const item of validItems) {
    const r = await pool.query(
      `INSERT INTO cobrancas (school_id, student_id, emolumento_id, descricao, montante, quantidade, status, referencia, entidade, validade)
       VALUES ($1,$2,$3,$4,$5,$6,'pendente',$7,$8,$9) RETURNING *`,
      [school.school_id, item.student_id, item.emolumento_id, item.descricao, item.montante, item.quantidade, referencia, entidade, validade]
    );
    cobrancasCreated.push(r.rows[0]);
  }

  const totalMulta = freshPropinas.reduce((s: number, p: any) => s + Number(p.multa), 0);
  const totalBase  = freshPropinas.reduce((s: number, p: any) => s + Number(p.montante), 0);

  res.json({
    entidade,
    referencia,
    valor: total,
    total_base: totalBase,
    total_multa: totalMulta,
    total_emolumentos: totalEmolumentos,
    validade: validade.toISOString(),
    propinas: freshPropinas,
    cobrancas: cobrancasCreated,
  });
});

/* ─── GET /school/cobrancas — list pending charges ─── */
router.get("/school/cobrancas", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `SELECT c.*, s.nome AS aluno_nome, e.nome AS emolumento_nome, e.tipo AS emolumento_tipo
     FROM cobrancas c
     LEFT JOIN students s ON s.id = c.student_id
     LEFT JOIN emolumentos e ON e.id = c.emolumento_id
     WHERE c.school_id = $1
     ORDER BY c.created_at DESC`,
    [school.school_id]
  );
  res.json(r.rows);
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

/* ─── GET /school/comunicados ─── */
router.get("/school/comunicados", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `SELECT c.*,
            (SELECT COUNT(*)::int FROM comunicados_lidos cl WHERE cl.comunicado_id = c.id) AS total_lidos
     FROM comunicados c
     WHERE c.escola_id = $1
     ORDER BY c.created_at DESC`,
    [school.school_id]
  );
  return res.json(r.rows);
});

/* ─── POST /school/comunicados ─── */
router.post("/school/comunicados", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { titulo, conteudo, prioridade } = req.body;
  if (!titulo?.trim() || !conteudo?.trim()) {
    return res.status(400).json({ error: "Título e conteúdo são obrigatórios." });
  }
  const r = await pool.query(
    `INSERT INTO comunicados (escola_id, titulo, conteudo, prioridade)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [school.school_id, titulo.trim(), conteudo.trim(), prioridade ?? "normal"]
  );
  return res.status(201).json(r.rows[0]);
});

/* ─── DELETE /school/comunicados/:id ─── */
router.delete("/school/comunicados/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  await pool.query("DELETE FROM comunicados WHERE id = $1 AND escola_id = $2", [req.params.id, school.school_id]);
  res.status(204).end();
});

/* ─── GET /school/comunicar/aniversarios-hoje ─── */
router.get("/school/comunicar/aniversarios-hoje", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `SELECT id, nome, data_nascimento, turma_id
     FROM students
     WHERE school_id = $1
       AND estado = 'activo'
       AND data_nascimento IS NOT NULL
       AND EXTRACT(MONTH FROM data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(DAY   FROM data_nascimento) = EXTRACT(DAY   FROM CURRENT_DATE)
     ORDER BY nome`,
    [school.school_id]
  );
  return res.json(r.rows);
});

/* ─── POST /school/comunicar/aniversario ─── */
router.post("/school/comunicar/aniversario", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { titulo, conteudo, foto_base64, student_id } = req.body;
  if (!titulo?.trim() || !conteudo?.trim())
    return res.status(400).json({ error: "Título e conteúdo são obrigatórios." });
  const r = await pool.query(
    `INSERT INTO comunicados (escola_id, titulo, conteudo, prioridade, tipo, foto_base64)
     VALUES ($1, $2, $3, 'normal', 'aniversario', $4) RETURNING id`,
    [school.school_id, titulo.trim(), conteudo.trim(), foto_base64 ?? null]
  );
  return res.status(201).json({ comunicado_id: r.rows[0].id });
});

/* ════════════════════════════════════════════════════════════════
   CAIXA — Faturação Presencial (POS)
   ════════════════════════════════════════════════════════════════ */

/* ─── GET /school/caixa/alunos-search ─── */
router.get("/school/caixa/alunos-search", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const q = (req.query.q as string ?? "").trim();
  const limit = Math.min(Number(req.query.limit ?? 10), 20);
  if (q.length < 2) return res.json([]);
  const r = await pool.query(
    `SELECT s.id, s.nome, s.numero_processo, COALESCE(t.nome,'Sem turma') AS turma
     FROM students s LEFT JOIN turmas t ON t.id = s.turma_id
     WHERE s.school_id = $1
       AND s.estado = 'activo'
       AND (s.nome ILIKE $2 OR s.numero_processo ILIKE $2)
     ORDER BY s.nome LIMIT $3`,
    [school.school_id, `%${q}%`, limit]
  );
  return res.json(r.rows);
});

/* ─── GET /school/caixa/emolumentos ─── */
router.get("/school/caixa/emolumentos", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `SELECT id, nome, montante, tipo FROM emolumentos
     WHERE school_id = $1 AND activo = true
     ORDER BY tipo, nome`,
    [school.school_id]
  );
  return res.json(r.rows);
});

/* ─── GET /school/caixa/aluno-propinas/:student_id ─── */
router.get("/school/caixa/aluno-propinas/:student_id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `SELECT p.id, p.mes, p.ano, p.montante, COALESCE(p.multa,0) AS multa,
            COALESCE(p.desconto,0) AS desconto, p.status, p.data_vencimento
     FROM propinas p
     WHERE p.student_id = $1 AND p.school_id = $2
       AND p.status IN ('pendente','vencido')
     ORDER BY p.ano DESC, p.mes`,
    [req.params.student_id, school.school_id]
  );
  return res.json(r.rows);
});

/* ─── POST /school/caixa/emitir ─── */
router.post("/school/caixa/emitir", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const { student_id, emolumento_id, propina_id, descricao, montante, metodo_pagamento, operador_nome } = req.body;
  if (!student_id || !descricao?.trim() || !montante || Number(montante) <= 0)
    return res.status(400).json({ error: "Aluno, descrição e montante são obrigatórios." });

  const studentR = await pool.query(
    `SELECT s.nome, s.numero_processo, COALESCE(t.nome,'Sem turma') AS turma,
            s.nome_encarregado, e.name AS escola_nome, e.nif AS escola_nif,
            e.phone AS escola_phone, e.logo_url, e.institution_type
     FROM students s
     JOIN schools e ON e.id = s.school_id
     LEFT JOIN turmas t ON t.id = s.turma_id
     WHERE s.id = $1 AND s.school_id = $2`,
    [student_id, school.school_id]
  );
  if (!studentR.rows.length) return res.status(404).json({ error: "Aluno não encontrado." });
  const st = studentR.rows[0];
  const year = new Date().getFullYear();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [school.school_id]);
    const seqR = await client.query(
      `SELECT COALESCE(MAX(numero_seq),0)+1 AS seq FROM caixa_faturas WHERE escola_id=$1`,
      [school.school_id]
    );
    const seq = seqR.rows[0].seq;
    const numero_fatura = `FC-${year}-${String(seq).padStart(5,"0")}`;

    const faturaR = await client.query(
      `INSERT INTO caixa_faturas
        (escola_id,numero_seq,numero_fatura,student_id,aluno_nome,aluno_numero_processo,aluno_turma,
         emolumento_id,propina_id,descricao,montante,metodo_pagamento,operador_nome,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'liquidado') RETURNING *`,
      [school.school_id, seq, numero_fatura, student_id, st.nome,
       st.numero_processo ?? null, st.turma,
       emolumento_id ?? null, propina_id ?? null,
       descricao.trim(), Number(montante),
       metodo_pagamento || "CASH",
       (operador_nome?.trim()) || "Administrador"]
    );

    if (propina_id) {
      await client.query(
        `UPDATE propinas SET status='pago', pago_em=NOW(),
           metodo_pagamento=$1, pagamento_origem='caixa',
           baixa_manual=true, baixa_manual_por=$2, baixa_manual_em=NOW()
         WHERE id=$3 AND school_id=$4 AND status IN ('pendente','vencido')`,
        [metodo_pagamento || "CASH",
         (operador_nome?.trim()) || "Administrador",
         propina_id, school.school_id]
      );
    }

    await client.query("COMMIT");
    return res.status(201).json({
      fatura: faturaR.rows[0],
      escola: {
        nome: st.escola_nome, nif: st.escola_nif,
        phone: st.escola_phone, institution_type: st.institution_type,
      },
      aluno: {
        nome: st.nome, numero_processo: st.numero_processo,
        turma: st.turma, nome_encarregado: st.nome_encarregado,
      },
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("caixa/emitir:", e);
    return res.status(500).json({ error: "Erro ao emitir fatura de caixa." });
  } finally {
    client.release();
  }
});

/* ─── GET /school/caixa/faturas ─── */
router.get("/school/caixa/faturas", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const limit = Math.min(Number(req.query.limit ?? 50), 100);
  const r = await pool.query(
    `SELECT * FROM caixa_faturas WHERE escola_id=$1 ORDER BY created_at DESC LIMIT $2`,
    [school.school_id, limit]
  );
  const hoje = new Date().toISOString().split("T")[0];
  const totais = r.rows.reduce((acc: any, f: any) => {
    const dia = new Date(f.created_at).toISOString().split("T")[0];
    if (dia === hoje) { acc.qtd_hoje++; acc.volume_hoje += Number(f.montante); }
    acc.qtd_total++;
    acc.volume_total += Number(f.montante);
    return acc;
  }, { qtd_hoje: 0, volume_hoje: 0, qtd_total: 0, volume_total: 0 });
  return res.json({ faturas: r.rows, totais });
});

/* ─── POST /school/comunicar/publicar — unified: portal + SMS ─── */
router.post("/school/comunicar/publicar", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const { titulo, conteudo, prioridade, canal, phones } = req.body;
  if (!conteudo?.trim()) return res.status(400).json({ error: "Conteúdo obrigatório." });

  let comunicadoId: number | null = null;
  let smsSent = 0, smsFailed = 0;

  // Fetch school SMS settings once for both portal fallback and explicit SMS send
  const settingsR = await pool.query("SELECT settings FROM school_settings WHERE school_id=$1", [school.school_id]);
  const comm = settingsR.rows[0]?.settings?.comunicacao ?? {};
  const smsConfig = {
    provider: comm.sms_provider || "mock",
    api_url: comm.sms_api_url,
    api_key: comm.sms_api_key,
    sender_name: comm.sms_sender_name || "KiwaraEsc",
  };

  // Publish to guardian portal
  if (canal === "portal" || canal === "ambos") {
    if (!titulo?.trim()) return res.status(400).json({ error: "Título obrigatório para publicar no portal." });
    const r = await pool.query(
      `INSERT INTO comunicados (escola_id, titulo, conteudo, prioridade) VALUES ($1,$2,$3,$4) RETURNING id`,
      [school.school_id, titulo.trim(), conteudo.trim(), prioridade ?? "normal"]
    );
    comunicadoId = r.rows[0].id;

    // SMS Fallback: auto-send to guardians without a portal account
    if (canal === "portal" && comm.sms_fallback && comm.sms_activo) {
      const naoReg = await pool.query(
        `SELECT DISTINCT ON (s.telefone_encarregado) s.telefone_encarregado AS phone
         FROM students s
         WHERE s.school_id = $1 AND s.estado = 'activo'
           AND s.telefone_encarregado IS NOT NULL AND s.telefone_encarregado != ''
           AND s.telefone_encarregado NOT IN (
               SELECT e.telefone FROM encarregados e
               JOIN encarregado_aluno ea ON ea.encarregado_id = e.id
               JOIN students st ON st.id = ea.aluno_id WHERE st.school_id = $1
           )`,
        [school.school_id]
      );
      if (naoReg.rows.length > 0) {
        const fallbackMsg = titulo ? `${titulo.trim()}: ${conteudo.trim().substring(0, 130)}` : conteudo.trim().substring(0, 160);
        const recipients = naoReg.rows.map((r: any) => ({ phone: r.phone, name: "" }));
        const fbResult = await sendBulkSMS(recipients, fallbackMsg, smsConfig, school.school_id);
        smsSent += fbResult.sent; smsFailed += fbResult.failed;
      }
    }
  }

  // Explicit SMS send (sms or ambos with selected phones)
  if ((canal === "sms" || canal === "ambos") && Array.isArray(phones) && phones.length > 0) {
    const recipients = phones.map((p: string) => ({ phone: p, name: "" }));
    const smsResult = await sendBulkSMS(recipients, conteudo.trim(), smsConfig, school.school_id);
    smsSent += smsResult.sent;
    smsFailed += smsResult.failed;
  }

  return res.json({ comunicado_id: comunicadoId, sms_sent: smsSent, sms_failed: smsFailed });
});

/* ─────────────────────────────────────────────
   Multa Regra — school self-management
   ───────────────────────────────────────────── */

/* ─── GET /school/multa-regra ─── */
router.get("/school/multa-regra", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query("SELECT * FROM multa_regras WHERE school_id=$1", [school.school_id]);
  res.json(r.rows[0] ?? null);
});

/* ─── PUT /school/multa-regra — supports 3 models ─── */
router.put("/school/multa-regra", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
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
      school.school_id, m, Number(dia_limite), Boolean(aplica_automatico),
      Number(percentagem ?? 0), Number(valor_fixo ?? 0),
      JSON.stringify(brackets ?? []), tipoCal, valor,
    ]
  );
  res.json(r.rows[0]);
});

/* ─────────────────────────────────────────────
   Emolumentos — school self-management
   ───────────────────────────────────────────── */

/* ─── GET /school/emolumentos — returns global (read-only) + school-local ─── */
router.get("/school/emolumentos", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `SELECT *, (school_id IS NULL) AS is_global
     FROM emolumentos
     WHERE school_id = $1 OR school_id IS NULL
     ORDER BY (school_id IS NULL) DESC, tipo, nome`,
    [school.school_id]
  );
  return res.json(r.rows);
});

/* ─── POST /school/emolumentos ─── */
router.post("/school/emolumentos", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { tipo, nome, montante, ano_lectivo, multa_ativo, multa_tipo, multa_valor_fixo, multa_percentagem, juros_mora, dias_carencia } = req.body;
  if (!tipo || !nome?.trim() || !montante) {
    return res.status(400).json({ error: "Tipo, nome e montante são obrigatórios." });
  }
  const r = await pool.query(
    `INSERT INTO emolumentos (school_id, tipo, nome, montante, ano_lectivo, multa_ativo, multa_tipo, multa_valor_fixo, multa_percentagem, juros_mora, dias_carencia)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [school.school_id, tipo, nome.trim(), Number(montante), ano_lectivo || "2025/2026",
     !!multa_ativo, multa_tipo || "fixo",
     multa_valor_fixo != null ? Number(multa_valor_fixo) : null,
     multa_percentagem != null ? Number(multa_percentagem) : null,
     Number(juros_mora ?? 0), Number(dias_carencia ?? 0)]
  );
  return res.status(201).json(r.rows[0]);
});

/* ─── PUT /school/emolumentos/:id ─── */
router.put("/school/emolumentos/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { nome, montante, ano_lectivo, multa_ativo, multa_tipo, multa_valor_fixo, multa_percentagem, juros_mora, dias_carencia } = req.body;
  if (!nome?.trim() || !montante) {
    return res.status(400).json({ error: "Nome e montante são obrigatórios." });
  }
  const r = await pool.query(
    `UPDATE emolumentos SET nome=$1, montante=$2, ano_lectivo=$3,
       multa_ativo=$4, multa_tipo=$5, multa_valor_fixo=$6, multa_percentagem=$7, juros_mora=$8, dias_carencia=$9
     WHERE id=$10 AND school_id=$11 RETURNING *`,
    [nome.trim(), Number(montante), ano_lectivo || "2025/2026",
     !!multa_ativo, multa_tipo || "fixo",
     multa_valor_fixo != null ? Number(multa_valor_fixo) : null,
     multa_percentagem != null ? Number(multa_percentagem) : null,
     Number(juros_mora ?? 0), Number(dias_carencia ?? 0),
     req.params.id, school.school_id]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Emolumento não encontrado." });
  return res.json(r.rows[0]);
});

/* ─── DELETE /school/emolumentos/:id ─── */
router.delete("/school/emolumentos/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  await pool.query(
    "DELETE FROM emolumentos WHERE id=$1 AND school_id=$2",
    [req.params.id, school.school_id]
  );
  return res.status(204).end();
});

/* ─── PATCH /school/emolumentos/:id/toggle — toggle activo (local only) ─── */
router.patch("/school/emolumentos/:id/toggle", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    "UPDATE emolumentos SET activo = NOT activo WHERE id=$1 AND school_id=$2 RETURNING *",
    [req.params.id, school.school_id]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Emolumento não encontrado ou é global." });
  return res.json(r.rows[0]);
});

/* ─── GET /school/direct-debit/subscriptions ─── */
router.get("/school/direct-debit/subscriptions", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `SELECT dds.*, e.nome AS encarregado_nome, e.telefone AS encarregado_telefone
     FROM direct_debit_subscriptions dds
     JOIN encarregados e ON e.id = dds.encarregado_id
     WHERE dds.school_id = $1
     ORDER BY dds.created_at DESC`,
    [school.school_id]
  );
  return res.json(r.rows);
});

/* ─── PUT /school/direct-debit/subscriptions/:id/approve-cancellation ─── */
router.put("/school/direct-debit/subscriptions/:id/approve-cancellation", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  await pool.query(
    `UPDATE direct_debit_subscriptions SET status='cancelled', cancelled_at=NOW()
     WHERE id=$1 AND school_id=$2`,
    [req.params.id, school.school_id]
  );
  return res.json({ ok: true });
});

/* ─── PUT /school/direct-debit/subscriptions/:id/reject-cancellation ─── */
router.put("/school/direct-debit/subscriptions/:id/reject-cancellation", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  await pool.query(
    `UPDATE direct_debit_subscriptions SET status='active', cancellation_requested_at=NULL
     WHERE id=$1 AND school_id=$2`,
    [req.params.id, school.school_id]
  );
  return res.json({ ok: true });
});

/* ═══════════════════════════════════════════════════════
   BOLSAS DE ESTUDO — School routes
   ═══════════════════════════════════════════════════════ */

/* ─── GET /school/bolsas/tipos ─── */
router.get("/school/bolsas/tipos", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `SELECT bt.*,
            COUNT(ba.id) FILTER (WHERE ba.estado='activa' AND (ba.data_fim IS NULL OR ba.data_fim >= CURRENT_DATE))::int AS total_activos
     FROM bolsa_tipos bt
     LEFT JOIN bolsa_atribuicoes ba ON ba.bolsa_tipo_id = bt.id
     WHERE bt.school_id = $1
     GROUP BY bt.id ORDER BY bt.nome`,
    [school.school_id]
  );
  res.json(r.rows);
});

/* ─── POST /school/bolsas/tipos ─── */
router.post("/school/bolsas/tipos", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { nome, descricao, tipo_desconto, valor, abrangencia } = req.body;
  if (!nome || !tipo_desconto || valor === undefined) return res.status(400).json({ error: "Nome, tipo e valor são obrigatórios." });
  if (tipo_desconto === 'percentagem' && (Number(valor) < 0 || Number(valor) > 100)) return res.status(400).json({ error: "Percentagem deve estar entre 0% e 100%." });
  const r = await pool.query(
    `INSERT INTO bolsa_tipos (school_id, nome, descricao, tipo_desconto, valor, abrangencia)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [school.school_id, nome.trim(), descricao?.trim() || null, tipo_desconto, Number(valor), abrangencia || 'propina']
  );
  res.status(201).json(r.rows[0]);
});

/* ─── PUT /school/bolsas/tipos/:id ─── */
router.put("/school/bolsas/tipos/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { nome, descricao, tipo_desconto, valor, abrangencia, activo } = req.body;
  const r = await pool.query(
    `UPDATE bolsa_tipos
     SET nome=COALESCE($1,nome), descricao=COALESCE($2,descricao),
         tipo_desconto=COALESCE($3,tipo_desconto), valor=COALESCE($4,valor),
         abrangencia=COALESCE($5,abrangencia), activo=COALESCE($6,activo)
     WHERE id=$7 AND school_id=$8 RETURNING *`,
    [nome?.trim() || null, descricao !== undefined ? (descricao?.trim() || null) : undefined,
     tipo_desconto || null, valor !== undefined ? Number(valor) : null,
     abrangencia || null, activo !== undefined ? activo : null,
     req.params.id, school.school_id]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Tipo de bolsa não encontrado." });
  res.json(r.rows[0]);
});

/* ─── DELETE /school/bolsas/tipos/:id ─── */
router.delete("/school/bolsas/tipos/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const check = await pool.query(
    "SELECT id FROM bolsa_atribuicoes WHERE bolsa_tipo_id=$1 AND estado='activa' LIMIT 1",
    [req.params.id]
  );
  if (check.rows.length) return res.status(409).json({ error: "Tipo em uso por bolseiros activos. Revogue primeiro." });
  await pool.query("DELETE FROM bolsa_tipos WHERE id=$1 AND school_id=$2", [req.params.id, school.school_id]);
  res.json({ ok: true });
});

/* ─── GET /school/bolsas/atribuicoes ─── */
router.get("/school/bolsas/atribuicoes", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { student_id, estado, turma_id } = req.query;
  const conds: string[] = ["ba.school_id=$1"];
  const params: any[] = [school.school_id];
  if (student_id) { conds.push(`ba.student_id=$${params.length+1}`); params.push(student_id); }
  if (estado) { conds.push(`ba.estado=$${params.length+1}`); params.push(estado); }
  if (turma_id) { conds.push(`s.turma_id=$${params.length+1}`); params.push(turma_id); }
  const r = await pool.query(
    `SELECT ba.*, s.nome AS aluno_nome, COALESCE(t.nome,'Sem turma') AS turma,
            bt.nome AS bolsa_nome, bt.tipo_desconto, bt.valor AS bolsa_valor, bt.abrangencia
     FROM bolsa_atribuicoes ba
     JOIN students s ON s.id = ba.student_id
     LEFT JOIN turmas t ON t.id = s.turma_id
     JOIN bolsa_tipos bt ON bt.id = ba.bolsa_tipo_id
     WHERE ${conds.join(" AND ")}
     ORDER BY ba.estado, s.nome`,
    params
  );
  res.json(r.rows);
});

/* ─── POST /school/bolsas/atribuicoes ─── */
router.post("/school/bolsas/atribuicoes", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { student_id, bolsa_tipo_id, data_inicio, data_fim, notas } = req.body;
  if (!student_id || !bolsa_tipo_id) return res.status(400).json({ error: "Aluno e tipo de bolsa são obrigatórios." });
  const st = await pool.query("SELECT id FROM students WHERE id=$1 AND school_id=$2", [student_id, school.school_id]);
  if (!st.rows.length) return res.status(404).json({ error: "Aluno não encontrado." });
  const bt = await pool.query("SELECT id FROM bolsa_tipos WHERE id=$1 AND school_id=$2 AND activo=TRUE", [bolsa_tipo_id, school.school_id]);
  if (!bt.rows.length) return res.status(404).json({ error: "Tipo de bolsa não encontrado ou inactivo." });
  await pool.query(
    `UPDATE bolsa_atribuicoes SET estado='revogada', revogada_em=NOW(), revogada_por='escola', motivo_revogacao='Substituída por nova bolsa'
     WHERE student_id=$1 AND estado='activa'`,
    [student_id]
  );
  const r = await pool.query(
    `INSERT INTO bolsa_atribuicoes (student_id, bolsa_tipo_id, school_id, data_inicio, data_fim, notas, estado)
     VALUES ($1,$2,$3,$4,$5,$6,'activa') RETURNING *`,
    [student_id, bolsa_tipo_id, school.school_id,
     data_inicio || new Date().toISOString().slice(0,10), data_fim || null, notas?.trim() || null]
  );
  res.status(201).json(r.rows[0]);
});

/* ─── PUT /school/bolsas/atribuicoes/:id ─── */
router.put("/school/bolsas/atribuicoes/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { data_fim, notas, estado, motivo_revogacao } = req.body;
  const extra = estado === 'revogada' ? ", revogada_em=NOW(), revogada_por='escola'" : "";
  const r = await pool.query(
    `UPDATE bolsa_atribuicoes
     SET data_fim=COALESCE($1,data_fim), notas=COALESCE($2,notas),
         estado=COALESCE($3,estado), motivo_revogacao=COALESCE($4,motivo_revogacao)${extra}
     WHERE id=$5 AND school_id=$6 RETURNING *`,
    [data_fim || null, notas?.trim() || null, estado || null, motivo_revogacao?.trim() || null,
     req.params.id, school.school_id]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Bolsa não encontrada." });
  res.json(r.rows[0]);
});

/* ─── DELETE /school/bolsas/atribuicoes/:id ─── */
router.delete("/school/bolsas/atribuicoes/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  await pool.query("DELETE FROM bolsa_atribuicoes WHERE id=$1 AND school_id=$2", [req.params.id, school.school_id]);
  res.json({ ok: true });
});

/* ─── GET /school/bolsas/stats ─── */
router.get("/school/bolsas/stats", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
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
    [school.school_id]
  );
  res.json(r.rows[0]);
});

/* ─── GET /school/alunos/:id/bolsa ─── */
router.get("/school/alunos/:id/bolsa", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `SELECT ba.*, bt.nome AS bolsa_nome, bt.tipo_desconto, bt.valor AS bolsa_valor,
            bt.abrangencia, bt.descricao AS bolsa_descricao
     FROM bolsa_atribuicoes ba
     JOIN bolsa_tipos bt ON bt.id = ba.bolsa_tipo_id
     WHERE ba.student_id = $1 AND ba.school_id = $2
     ORDER BY CASE ba.estado WHEN 'activa' THEN 0 WHEN 'expirada' THEN 1 ELSE 2 END, ba.created_at DESC
     LIMIT 5`,
    [req.params.id, school.school_id]
  );
  res.json(r.rows);
});

/* ══════════════════════════════════════════════════════════
   MÓDULO: LOJA & EMOLUMENTOS (INVENTÁRIO + ENCOMENDAS)
   ══════════════════════════════════════════════════════════ */

pool.query(`
  CREATE TABLE IF NOT EXISTS store_items (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT,
    preco NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock INTEGER DEFAULT NULL,
    visivel_portal BOOLEAN DEFAULT true,
    ativo BOOLEAN DEFAULT true,
    categoria TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS store_orders (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    guardian_id INTEGER NOT NULL,
    student_id INTEGER,
    student_nome TEXT,
    guardian_nome TEXT,
    estado TEXT DEFAULT 'pendente_pagamento',
    total NUMERIC(12,2) NOT NULL,
    voucher_code TEXT UNIQUE NOT NULL,
    entidade TEXT,
    referencia TEXT,
    metodo_pagamento TEXT DEFAULT 'reference',
    gpo_redirect_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS store_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    item_nome TEXT NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 1,
    preco_unit NUMERIC(12,2) NOT NULL
  );
  CREATE TABLE IF NOT EXISTS store_deliveries (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    operador TEXT NOT NULL,
    notas TEXT,
    delivered_at TIMESTAMPTZ DEFAULT NOW()
  );
`).catch(e => console.error("store tables migration error:", e));

/* ─── GET /school/store/items ─── */
router.get("/school/store/items", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `SELECT * FROM store_items WHERE school_id=$1 ORDER BY ativo DESC, nome ASC`,
    [school.school_id]
  );
  res.json(r.rows);
});

/* ─── POST /school/store/items ─── */
router.post("/school/store/items", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { nome, descricao, preco, stock, visivel_portal, categoria } = req.body;
  if (!nome?.trim() || preco === undefined) return res.status(400).json({ error: "Nome e preço são obrigatórios." });
  const r = await pool.query(
    `INSERT INTO store_items (school_id, nome, descricao, preco, stock, visivel_portal, categoria)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [school.school_id, nome.trim(), descricao || null, Number(preco),
     (stock !== undefined && stock !== null && stock !== "") ? Number(stock) : null,
     visivel_portal !== false, categoria || null]
  );
  res.json(r.rows[0]);
});

/* ─── PUT /school/store/items/:id ─── */
router.put("/school/store/items/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { nome, descricao, preco, stock, visivel_portal, ativo, categoria } = req.body;
  const r = await pool.query(
    `UPDATE store_items SET nome=$1,descricao=$2,preco=$3,stock=$4,visivel_portal=$5,ativo=$6,categoria=$7,updated_at=NOW()
     WHERE id=$8 AND school_id=$9 RETURNING *`,
    [nome, descricao || null, Number(preco),
     (stock !== undefined && stock !== null && stock !== "") ? Number(stock) : null,
     visivel_portal !== false, ativo !== false, categoria || null,
     req.params.id, school.school_id]
  );
  if (!r.rowCount) return res.status(404).json({ error: "Artigo não encontrado." });
  res.json(r.rows[0]);
});

/* ─── DELETE /school/store/items/:id ─── */
router.delete("/school/store/items/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  await pool.query(`DELETE FROM store_items WHERE id=$1 AND school_id=$2`, [req.params.id, school.school_id]);
  res.json({ ok: true });
});

/* ─── PATCH /school/store/items/:id/toggle-portal ─── */
router.patch("/school/store/items/:id/toggle-portal", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `UPDATE store_items SET visivel_portal=NOT visivel_portal,updated_at=NOW() WHERE id=$1 AND school_id=$2 RETURNING *`,
    [req.params.id, school.school_id]
  );
  if (!r.rowCount) return res.status(404).json({ error: "Artigo não encontrado." });
  res.json(r.rows[0]);
});

/* ─── PATCH /school/store/items/:id/toggle-ativo ─── */
router.patch("/school/store/items/:id/toggle-ativo", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `UPDATE store_items SET ativo=NOT ativo,updated_at=NOW() WHERE id=$1 AND school_id=$2 RETURNING *`,
    [req.params.id, school.school_id]
  );
  if (!r.rowCount) return res.status(404).json({ error: "Artigo não encontrado." });
  res.json(r.rows[0]);
});

/* ─── GET /school/store/orders ─── */
router.get("/school/store/orders", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { estado } = req.query as { estado?: string };
  const conds = ["so.school_id=$1"]; const params: any[] = [school.school_id];
  if (estado) { params.push(estado); conds.push(`so.estado=$${params.length}`); }
  const r = await pool.query(
    `SELECT so.*,
       COALESCE(json_agg(json_build_object('item_nome',soi.item_nome,'quantidade',soi.quantidade,'preco_unit',soi.preco_unit)) FILTER (WHERE soi.id IS NOT NULL), '[]') AS items
     FROM store_orders so
     LEFT JOIN store_order_items soi ON soi.order_id = so.id
     WHERE ${conds.join(" AND ")}
     GROUP BY so.id ORDER BY so.created_at DESC`,
    params
  );
  res.json(r.rows);
});

/* ─── POST /school/store/orders/:id/entregar ─── */
router.post("/school/store/orders/:id/entregar", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { operador, notas } = req.body;
  const order = await pool.query(`SELECT * FROM store_orders WHERE id=$1 AND school_id=$2`, [req.params.id, school.school_id]);
  if (!order.rowCount) return res.status(404).json({ error: "Encomenda não encontrada." });
  if (!["pago","pendente_pagamento"].includes(order.rows[0].estado))
    return res.status(400).json({ error: "Esta encomenda já foi entregue ou cancelada." });
  await pool.query(`UPDATE store_orders SET estado='entregue',updated_at=NOW() WHERE id=$1`, [req.params.id]);
  await pool.query(`INSERT INTO store_deliveries (order_id,operador,notas) VALUES ($1,$2,$3)`, [req.params.id, operador || "Operador", notas || null]);
  const itemsR = await pool.query(`SELECT item_id,quantidade FROM store_order_items WHERE order_id=$1`, [req.params.id]);
  for (const item of itemsR.rows) {
    await pool.query(`UPDATE store_items SET stock=GREATEST(0,stock-$1),updated_at=NOW() WHERE id=$2 AND stock IS NOT NULL`, [item.quantidade, item.item_id]);
  }
  res.json({ ok: true });
});

/* ─── POST /school/store/orders/:id/marcar-pago ─── */
router.post("/school/store/orders/:id/marcar-pago", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `UPDATE store_orders SET estado='pago',updated_at=NOW() WHERE id=$1 AND school_id=$2 AND estado='pendente_pagamento' RETURNING *`,
    [req.params.id, school.school_id]
  );
  if (!r.rowCount) return res.status(404).json({ error: "Encomenda não encontrada ou já processada." });
  res.json(r.rows[0]);
});

/* ══════════════════════════════════════════════════════════
   MÓDULO: CALENDÁRIO ESCOLAR
   ══════════════════════════════════════════════════════════ */

/* ─── DB Migration ─── */
pool.query(`
  CREATE TABLE IF NOT EXISTS cal_tipos_prova (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    cor TEXT DEFAULT '#3B82F6',
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS calendarios (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    tipo TEXT DEFAULT 'provas' CHECK (tipo IN ('aulas','provas')),
    descricao TEXT,
    vigencia_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    vigencia_fim DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '3 months'),
    alertas_horas INTEGER DEFAULT 48,
    publicado BOOLEAN DEFAULT false,
    gerar_notificacoes BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE calendarios ADD COLUMN IF NOT EXISTS gerar_notificacoes BOOLEAN DEFAULT true;
  CREATE TABLE IF NOT EXISTS calendario_eventos (
    id SERIAL PRIMARY KEY,
    calendario_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL,
    turma_id INTEGER,
    turma_nome TEXT,
    titulo TEXT NOT NULL,
    tipo_prova_id INTEGER,
    tipo_prova_nome TEXT,
    tipo_prova_cor TEXT DEFAULT '#3B82F6',
    professor TEXT,
    sala TEXT,
    data_inicio TIMESTAMPTZ,
    data_fim TIMESTAMPTZ,
    dia_semana INTEGER,
    hora_inicio_aula TIME,
    hora_fim_aula TIME,
    descricao TEXT,
    publicado BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`).catch(e => console.error("calendario migration error:", e));

/* ─── GET /school/calendario/tipos-prova ─── */
router.get("/school/calendario/tipos-prova", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(`SELECT * FROM cal_tipos_prova WHERE school_id=$1 ORDER BY nome`, [school.school_id]);
  res.json(r.rows);
});

/* ─── POST /school/calendario/tipos-prova ─── */
router.post("/school/calendario/tipos-prova", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { nome, cor, descricao } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: "Nome é obrigatório." });
  const r = await pool.query(
    `INSERT INTO cal_tipos_prova (school_id, nome, cor, descricao) VALUES ($1,$2,$3,$4) RETURNING *`,
    [school.school_id, nome.trim(), cor || '#3B82F6', descricao || null]
  );
  res.json(r.rows[0]);
});

/* ─── PUT /school/calendario/tipos-prova/:id ─── */
router.put("/school/calendario/tipos-prova/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { nome, cor, descricao } = req.body;
  const r = await pool.query(
    `UPDATE cal_tipos_prova SET nome=$1, cor=$2, descricao=$3 WHERE id=$4 AND school_id=$5 RETURNING *`,
    [nome, cor || '#3B82F6', descricao || null, req.params.id, school.school_id]
  );
  if (!r.rowCount) return res.status(404).json({ error: "Tipo não encontrado." });
  res.json(r.rows[0]);
});

/* ─── DELETE /school/calendario/tipos-prova/:id ─── */
router.delete("/school/calendario/tipos-prova/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  await pool.query(`DELETE FROM cal_tipos_prova WHERE id=$1 AND school_id=$2`, [req.params.id, school.school_id]);
  res.json({ ok: true });
});

/* ─── GET /school/calendarios ─── */
router.get("/school/calendarios", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `SELECT *,
      CASE WHEN vigencia_inicio > CURRENT_DATE THEN 'programado'
           WHEN vigencia_fim < CURRENT_DATE THEN 'historico'
           ELSE 'activo' END AS status,
      (SELECT COUNT(*)::int FROM calendario_eventos WHERE calendario_id=calendarios.id) AS total_eventos
     FROM calendarios WHERE school_id=$1 ORDER BY vigencia_inicio DESC`,
    [school.school_id]
  );
  res.json(r.rows);
});

/* ─── POST /school/calendarios ─── */
router.post("/school/calendarios", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { nome, tipo, descricao, vigencia_inicio, vigencia_fim, alertas_horas, gerar_notificacoes } = req.body;
  if (!nome?.trim() || !vigencia_inicio || !vigencia_fim) return res.status(400).json({ error: "Nome e datas de vigência são obrigatórios." });
  if (new Date(vigencia_fim) <= new Date(vigencia_inicio)) return res.status(400).json({ error: "Data de fim deve ser posterior à de início." });
  const r = await pool.query(
    `INSERT INTO calendarios (school_id, nome, tipo, descricao, vigencia_inicio, vigencia_fim, alertas_horas, gerar_notificacoes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [school.school_id, nome.trim(), tipo || 'provas', descricao || null, vigencia_inicio, vigencia_fim, alertas_horas ?? 48, gerar_notificacoes !== false]
  );
  res.json(r.rows[0]);
});

/* ─── PUT /school/calendarios/:id ─── */
router.put("/school/calendarios/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { nome, tipo, descricao, vigencia_inicio, vigencia_fim, alertas_horas, gerar_notificacoes } = req.body;
  const r = await pool.query(
    `UPDATE calendarios SET nome=$1, tipo=$2, descricao=$3, vigencia_inicio=$4, vigencia_fim=$5, alertas_horas=$6, gerar_notificacoes=$7, updated_at=NOW()
     WHERE id=$8 AND school_id=$9 RETURNING *`,
    [nome, tipo || 'provas', descricao || null, vigencia_inicio, vigencia_fim, alertas_horas ?? 48, gerar_notificacoes !== false, req.params.id, school.school_id]
  );
  if (!r.rowCount) return res.status(404).json({ error: "Calendário não encontrado." });
  res.json(r.rows[0]);
});

/* ─── DELETE /school/calendarios/:id ─── */
router.delete("/school/calendarios/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  await pool.query(`DELETE FROM calendarios WHERE id=$1 AND school_id=$2`, [req.params.id, school.school_id]);
  res.json({ ok: true });
});

/* ─── PATCH /school/calendarios/:id/publicar ─── */
router.patch("/school/calendarios/:id/publicar", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `UPDATE calendarios SET publicado=NOT publicado, updated_at=NOW() WHERE id=$1 AND school_id=$2 RETURNING *`,
    [req.params.id, school.school_id]
  );
  if (!r.rowCount) return res.status(404).json({ error: "Calendário não encontrado." });
  res.json(r.rows[0]);
});

/* ─── GET /school/calendarios/:id/eventos ─── */
router.get("/school/calendarios/:id/eventos", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `SELECT * FROM calendario_eventos WHERE calendario_id=$1 AND school_id=$2
     ORDER BY data_inicio ASC NULLS LAST, dia_semana ASC NULLS LAST, hora_inicio_aula ASC NULLS LAST`,
    [req.params.id, school.school_id]
  );
  res.json(r.rows);
});

/* ─── POST /school/calendarios/:id/eventos ─── */
router.post("/school/calendarios/:id/eventos", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const calR = await pool.query(`SELECT * FROM calendarios WHERE id=$1 AND school_id=$2`, [req.params.id, school.school_id]);
  if (!calR.rowCount) return res.status(404).json({ error: "Calendário não encontrado." });
  const cal = calR.rows[0];
  const { turma_id, turma_nome, titulo, tipo_prova_id, tipo_prova_nome, tipo_prova_cor, professor, sala, data_inicio, data_fim, dia_semana, hora_inicio_aula, hora_fim_aula, descricao } = req.body;
  if (!titulo?.trim()) return res.status(400).json({ error: "Título é obrigatório." });
  // Conflict detection — provas
  if (cal.tipo === 'provas' && data_inicio && data_fim && (professor || sala)) {
    const conds: string[] = []; const params: any[] = [school.school_id, data_inicio, data_fim];
    if (professor) { params.push(professor); conds.push(`professor=$${params.length}`); }
    if (sala) { params.push(sala); conds.push(`sala=$${params.length}`); }
    const cc = await pool.query(
      `SELECT titulo FROM calendario_eventos WHERE school_id=$1 AND publicado=true AND data_inicio < $3 AND data_fim > $2 AND (${conds.join(' OR ')})`,
      params
    );
    if (cc.rowCount) return res.status(409).json({ error: `Conflito: "${cc.rows[0].titulo}" ocupa o mesmo ${sala ? 'sala' : 'professor'} nesse período.` });
  }
  // Conflict detection — aulas
  if (cal.tipo === 'aulas' && dia_semana !== undefined && hora_inicio_aula && hora_fim_aula && (professor || sala)) {
    const conds: string[] = []; const params: any[] = [school.school_id, Number(dia_semana), hora_inicio_aula, hora_fim_aula];
    if (professor) { params.push(professor); conds.push(`professor=$${params.length}`); }
    if (sala) { params.push(sala); conds.push(`sala=$${params.length}`); }
    const cc = await pool.query(
      `SELECT titulo FROM calendario_eventos WHERE school_id=$1 AND dia_semana=$2 AND publicado=true AND hora_inicio_aula < $4 AND hora_fim_aula > $3 AND (${conds.join(' OR ')})`,
      params
    );
    if (cc.rowCount) return res.status(409).json({ error: `Conflito: "${cc.rows[0].titulo}" ocupa o mesmo ${sala ? 'sala' : 'professor'} nesse horário.` });
  }
  const r = await pool.query(
    `INSERT INTO calendario_eventos
     (calendario_id, school_id, turma_id, turma_nome, titulo, tipo_prova_id, tipo_prova_nome, tipo_prova_cor, professor, sala, data_inicio, data_fim, dia_semana, hora_inicio_aula, hora_fim_aula, descricao)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
    [req.params.id, school.school_id, turma_id || null, turma_nome || null, titulo.trim(), tipo_prova_id || null, tipo_prova_nome || null, tipo_prova_cor || '#3B82F6', professor || null, sala || null, data_inicio || null, data_fim || null, (dia_semana !== undefined && dia_semana !== '') ? Number(dia_semana) : null, hora_inicio_aula || null, hora_fim_aula || null, descricao || null]
  );
  res.json(r.rows[0]);
});

/* ─── PUT /school/calendarios/:id/eventos/:eid ─── */
router.put("/school/calendarios/:id/eventos/:eid", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { turma_id, turma_nome, titulo, tipo_prova_id, tipo_prova_nome, tipo_prova_cor, professor, sala, data_inicio, data_fim, dia_semana, hora_inicio_aula, hora_fim_aula, descricao, publicado } = req.body;
  const r = await pool.query(
    `UPDATE calendario_eventos SET turma_id=$1, turma_nome=$2, titulo=$3, tipo_prova_id=$4, tipo_prova_nome=$5, tipo_prova_cor=$6,
     professor=$7, sala=$8, data_inicio=$9, data_fim=$10, dia_semana=$11, hora_inicio_aula=$12, hora_fim_aula=$13, descricao=$14, publicado=$15
     WHERE id=$16 AND calendario_id=$17 AND school_id=$18 RETURNING *`,
    [turma_id || null, turma_nome || null, titulo, tipo_prova_id || null, tipo_prova_nome || null, tipo_prova_cor || '#3B82F6', professor || null, sala || null, data_inicio || null, data_fim || null, (dia_semana !== undefined && dia_semana !== '') ? Number(dia_semana) : null, hora_inicio_aula || null, hora_fim_aula || null, descricao || null, publicado !== false, req.params.eid, req.params.id, school.school_id]
  );
  if (!r.rowCount) return res.status(404).json({ error: "Evento não encontrado." });
  res.json(r.rows[0]);
});

/* ─── DELETE /school/calendarios/:id/eventos/:eid ─── */
router.delete("/school/calendarios/:id/eventos/:eid", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  await pool.query(`DELETE FROM calendario_eventos WHERE id=$1 AND calendario_id=$2 AND school_id=$3`, [req.params.eid, req.params.id, school.school_id]);
  res.json({ ok: true });
});

export default router;
