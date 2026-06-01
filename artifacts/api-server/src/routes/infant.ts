import { Router } from "express";
import { pool } from "@workspace/db";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";

const router = Router();

/* ─── Storage for infant media ─── */
const infantDir = path.join(process.cwd(), "uploads", "infantil");
if (!fs.existsSync(infantDir)) fs.mkdirSync(infantDir, { recursive: true });

const infantStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, infantDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `inf-${Date.now()}-${randomBytes(4).toString("hex")}${ext}`);
  },
});

const infantUpload = multer({
  storage: infantStorage,
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".mov", ".webm"];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error("Formato não suportado."));
  },
});

/* ─── Auth helpers ─── */
async function getSchoolFromToken(token: string) {
  const res = await pool.query(
    `SELECT sc.id AS school_id, sc.name AS school_name, sc.modulo_infantil
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

async function getGuardianFromToken(token: string) {
  const res = await pool.query(
    `SELECT e.id, e.nome FROM guardian_sessions gs
     JOIN encarregados e ON e.id = gs.encarregado_id
     WHERE gs.token = $1 AND gs.expires_at > NOW()`,
    [token]
  );
  return res.rows[0] ?? null;
}

function guardianAuth(req: any, res: any, next: any) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado." });
  req.guardianToken = header.slice(7);
  next();
}

/* ─── DB Migration ─── */
export async function runInfantMigration() {
  await pool.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS modulo_infantil BOOLEAN DEFAULT FALSE`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS infant_rotinas (
      id          SERIAL PRIMARY KEY,
      school_id   INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      turma_id    INTEGER REFERENCES turmas(id) ON DELETE SET NULL,
      dia_semana  INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
      hora_inicio TIME NOT NULL,
      hora_fim    TIME NOT NULL,
      atividade   TEXT NOT NULL,
      descricao   TEXT,
      cor         TEXT DEFAULT '#3B82F6',
      created_at  TIMESTAMP DEFAULT NOW(),
      updated_at  TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS infant_ementas (
      id            SERIAL PRIMARY KEY,
      school_id     INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      semana_inicio DATE NOT NULL,
      dia_semana    INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 5),
      refeicao      TEXT NOT NULL CHECK (refeicao IN ('pequeno_almoco','almoco','lanche')),
      descricao     TEXT NOT NULL,
      alergenios    TEXT,
      created_at    TIMESTAMP DEFAULT NOW(),
      UNIQUE (school_id, semana_inicio, dia_semana, refeicao)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS infant_galeria (
      id            SERIAL PRIMARY KEY,
      school_id     INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      turma_id      INTEGER REFERENCES turmas(id) ON DELETE SET NULL,
      tipo          TEXT NOT NULL CHECK (tipo IN ('imagem','video')),
      filename      TEXT NOT NULL,
      titulo        TEXT,
      descricao     TEXT,
      tamanho_bytes INTEGER,
      uploaded_by   TEXT,
      created_at    TIMESTAMP DEFAULT NOW()
    )
  `);
}

/* ════════════════════════════════════════════════════
   SCHOOL ROUTES  /school/infant/*
════════════════════════════════════════════════════ */

router.get("/school/infant/status", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  res.json({ modulo_infantil: !!school.modulo_infantil });
});

/* ── Turmas list (needed for filtering) ── */
router.get("/school/infant/turmas", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `SELECT id, nome, ano FROM turmas WHERE school_id=$1 ORDER BY nome`,
    [school.school_id]
  );
  res.json(r.rows);
});

/* ── Rotinas ── */
router.get("/school/infant/rotinas", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const turmaId = req.query.turma_id;
  let q = `SELECT r.*, t.nome AS turma_nome FROM infant_rotinas r LEFT JOIN turmas t ON t.id = r.turma_id WHERE r.school_id=$1`;
  const params: any[] = [school.school_id];
  if (turmaId) { q += ` AND r.turma_id=$2`; params.push(Number(turmaId)); }
  q += ` ORDER BY r.dia_semana, r.hora_inicio`;
  const result = await pool.query(q, params);
  res.json(result.rows);
});

router.post("/school/infant/rotinas", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { turma_id, dia_semana, hora_inicio, hora_fim, atividade, descricao, cor } = req.body;
  if (dia_semana === undefined) return res.status(400).json({ error: "Dia da semana obrigatório." });
  if (!hora_inicio || !hora_fim) return res.status(400).json({ error: "Horário obrigatório." });
  if (!atividade?.trim()) return res.status(400).json({ error: "Actividade obrigatória." });
  const r = await pool.query(
    `INSERT INTO infant_rotinas (school_id, turma_id, dia_semana, hora_inicio, hora_fim, atividade, descricao, cor)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [school.school_id, turma_id || null, dia_semana, hora_inicio, hora_fim, atividade.trim(), descricao?.trim() || null, cor || "#3B82F6"]
  );
  res.status(201).json(r.rows[0]);
});

router.put("/school/infant/rotinas/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { turma_id, dia_semana, hora_inicio, hora_fim, atividade, descricao, cor } = req.body;
  const r = await pool.query(
    `UPDATE infant_rotinas SET turma_id=$1,dia_semana=$2,hora_inicio=$3,hora_fim=$4,atividade=$5,descricao=$6,cor=$7,updated_at=NOW()
     WHERE id=$8 AND school_id=$9 RETURNING *`,
    [turma_id || null, dia_semana, hora_inicio, hora_fim, atividade, descricao || null, cor || "#3B82F6", req.params.id, school.school_id]
  );
  if (!r.rowCount) return res.status(404).json({ error: "Rotina não encontrada." });
  res.json(r.rows[0]);
});

router.delete("/school/infant/rotinas/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  await pool.query("DELETE FROM infant_rotinas WHERE id=$1 AND school_id=$2", [req.params.id, school.school_id]);
  res.json({ ok: true });
});

/* ── Ementas ── */
router.get("/school/infant/ementas", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const semana = req.query.semana;
  let q = `SELECT * FROM infant_ementas WHERE school_id=$1`;
  const params: any[] = [school.school_id];
  if (semana) { q += ` AND semana_inicio=$2`; params.push(semana); }
  q += ` ORDER BY semana_inicio DESC, dia_semana, refeicao`;
  const result = await pool.query(q, params);
  res.json(result.rows);
});

router.post("/school/infant/ementas", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { semana_inicio, dia_semana, refeicao, descricao, alergenios } = req.body;
  if (!semana_inicio || !dia_semana || !refeicao || !descricao?.trim()) {
    return res.status(400).json({ error: "Campos obrigatórios em falta." });
  }
  const r = await pool.query(
    `INSERT INTO infant_ementas (school_id, semana_inicio, dia_semana, refeicao, descricao, alergenios)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (school_id, semana_inicio, dia_semana, refeicao)
     DO UPDATE SET descricao=EXCLUDED.descricao, alergenios=EXCLUDED.alergenios
     RETURNING *`,
    [school.school_id, semana_inicio, dia_semana, refeicao, descricao.trim(), alergenios?.trim() || null]
  );
  res.status(201).json(r.rows[0]);
});

router.delete("/school/infant/ementas/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  await pool.query("DELETE FROM infant_ementas WHERE id=$1 AND school_id=$2", [req.params.id, school.school_id]);
  res.json({ ok: true });
});

/* ── Galeria ── */
router.get("/school/infant/galeria", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const turmaId = req.query.turma_id;
  let q = `SELECT g.*, t.nome AS turma_nome FROM infant_galeria g LEFT JOIN turmas t ON t.id = g.turma_id WHERE g.school_id=$1`;
  const params: any[] = [school.school_id];
  if (turmaId) { q += ` AND g.turma_id=$2`; params.push(Number(turmaId)); }
  q += ` ORDER BY g.created_at DESC LIMIT 120`;
  const result = await pool.query(q, params);
  res.json(result.rows);
});

router.post("/school/infant/galeria", schoolAuth, infantUpload.single("file"), async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  if (!req.file) return res.status(400).json({ error: "Ficheiro obrigatório." });
  if (!req.body.turma_id) return res.status(400).json({ error: "Sala/Turma obrigatória." });
  const videoExts = [".mp4", ".mov", ".webm", ".avi"];
  const ext = path.extname(req.file.filename).toLowerCase();
  const tipo = videoExts.includes(ext) ? "video" : "imagem";
  const r = await pool.query(
    `INSERT INTO infant_galeria (school_id,turma_id,tipo,filename,titulo,descricao,tamanho_bytes,uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [school.school_id, req.body.turma_id, tipo, req.file.filename, req.body.titulo?.trim() || null, req.body.descricao?.trim() || null, req.file.size, school.school_name]
  );
  res.status(201).json(r.rows[0]);
});

router.delete("/school/infant/galeria/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const item = await pool.query("SELECT filename FROM infant_galeria WHERE id=$1 AND school_id=$2", [req.params.id, school.school_id]);
  if (!item.rowCount) return res.status(404).json({ error: "Item não encontrado." });
  const safeFilename = path.basename(item.rows[0].filename as string);
  const fp = path.join(infantDir, safeFilename);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  await pool.query("DELETE FROM infant_galeria WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

/* Secure media serving — inline, blocks download */
router.get("/school/infant/media/:filename", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const safeFilename = path.basename(req.params.filename);
  if (!/^inf-\d+-[0-9a-f]+\.[a-z0-9]{2,5}$/.test(safeFilename)) {
    return res.status(400).send("Nome de ficheiro inválido.");
  }

  const item = await pool.query("SELECT id FROM infant_galeria WHERE filename=$1 AND school_id=$2", [safeFilename, school.school_id]);
  if (!item.rowCount) return res.status(404).send("Not found");
  const fp = path.join(infantDir, safeFilename);
  if (!fs.existsSync(fp)) return res.status(404).send("Not found");
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.sendFile(fp);
});

/* ════════════════════════════════════════════════════
   GUARDIAN ROUTES  /guardian/infant/*
════════════════════════════════════════════════════ */

async function getGuardianStudents(guardianId: number) {
  const r = await pool.query(
    `SELECT DISTINCT s.school_id, s.turma_id FROM students s
     JOIN encarregado_aluno ea ON ea.aluno_id = s.id
     WHERE ea.encarregado_id = $1`,
    [guardianId]
  );
  return r.rows;
}

router.get("/guardian/infant/rotinas", guardianAuth, async (req: any, res) => {
  const guardian = await getGuardianFromToken(req.guardianToken);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });
  const studs = await getGuardianStudents(guardian.id);
  if (!studs.length) return res.json([]);
  const schoolIds = studs.map((r: any) => r.school_id);
  const turmaIds = studs.map((r: any) => r.turma_id).filter(Boolean);
  const result = await pool.query(
    `SELECT r.*, t.nome AS turma_nome
     FROM infant_rotinas r
     LEFT JOIN turmas t ON t.id = r.turma_id
     JOIN schools sc ON sc.id = r.school_id
     WHERE r.school_id = ANY($1) AND sc.modulo_infantil = TRUE
       AND (r.turma_id IS NULL OR r.turma_id = ANY($2))
     ORDER BY r.dia_semana, r.hora_inicio`,
    [schoolIds, turmaIds.length ? turmaIds : [-1]]
  );
  res.json(result.rows);
});

router.get("/guardian/infant/ementa", guardianAuth, async (req: any, res) => {
  const guardian = await getGuardianFromToken(req.guardianToken);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });
  const studs = await getGuardianStudents(guardian.id);
  if (!studs.length) return res.json([]);
  const schoolIds = studs.map((r: any) => r.school_id);
  const semana = req.query.semana || new Date().toISOString().slice(0, 10);
  const result = await pool.query(
    `SELECT e.* FROM infant_ementas e
     JOIN schools sc ON sc.id = e.school_id
     WHERE e.school_id = ANY($1) AND sc.modulo_infantil = TRUE
       AND e.semana_inicio <= $2
     ORDER BY e.semana_inicio DESC, e.dia_semana, e.refeicao
     LIMIT 50`,
    [schoolIds, semana]
  );
  res.json(result.rows);
});

router.get("/guardian/infant/galeria", guardianAuth, async (req: any, res) => {
  const guardian = await getGuardianFromToken(req.guardianToken);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });
  const studs = await getGuardianStudents(guardian.id);
  if (!studs.length) return res.json([]);
  const schoolIds = studs.map((r: any) => r.school_id);
  const turmaIds = studs.map((r: any) => r.turma_id).filter(Boolean);
  const result = await pool.query(
    `SELECT g.id, g.turma_id, g.tipo, g.filename, g.titulo, g.descricao, g.created_at, t.nome AS turma_nome
     FROM infant_galeria g
     LEFT JOIN turmas t ON t.id = g.turma_id
     JOIN schools sc ON sc.id = g.school_id
     WHERE g.school_id = ANY($1) AND sc.modulo_infantil = TRUE
       AND (g.turma_id IS NULL OR g.turma_id = ANY($2))
     ORDER BY g.created_at DESC LIMIT 80`,
    [schoolIds, turmaIds.length ? turmaIds : [-1]]
  );
  res.json(result.rows);
});

/* Status: does the guardian's school have the infant module? */
router.get("/guardian/infant/status", guardianAuth, async (req: any, res) => {
  const guardian = await getGuardianFromToken(req.guardianToken);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `SELECT sc.modulo_infantil FROM students s
     JOIN encarregado_aluno ea ON ea.aluno_id = s.id
     JOIN schools sc ON sc.id = s.school_id
     WHERE ea.encarregado_id = $1 AND sc.modulo_infantil = TRUE
     LIMIT 1`,
    [guardian.id]
  );
  res.json({ modulo_infantil: r.rowCount ? true : false });
});

/* Secure guardian media */
router.get("/guardian/infant/media/:filename", guardianAuth, async (req: any, res) => {
  const guardian = await getGuardianFromToken(req.guardianToken);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });
  const access = await pool.query(
    `SELECT g.id FROM infant_galeria g
     JOIN schools sc ON sc.id = g.school_id
     JOIN students s ON s.school_id = g.school_id
     JOIN encarregado_aluno ea ON ea.aluno_id = s.id
     WHERE g.filename=$1 AND ea.encarregado_id=$2 AND sc.modulo_infantil = TRUE
     LIMIT 1`,
    [req.params.filename, guardian.id]
  );
  if (!access.rowCount) return res.status(403).send("Acesso negado.");
  const fp = path.join(infantDir, req.params.filename);
  if (!fs.existsSync(fp)) return res.status(404).send("Not found");
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.sendFile(fp);
});

export default router;
