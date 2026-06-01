import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { pool } from "@workspace/db";

const router = Router();

/* ── School auth helper (same sessions table as rbac.ts) ── */
async function getSchoolFromToken(token: string) {
  const r = await pool.query(
    `SELECT s.id, s.school_id AS slug, s.name, s.logo_url
     FROM sessions sess
     JOIN schools s ON s.id = sess.school_id
     WHERE sess.token = $1 AND sess.expires_at > now()
     LIMIT 1`,
    [token]
  );
  return r.rows[0] ?? null;
}

/* GET /api/school/portal-info — authenticated: returns slug + branding */
router.get("/school/portal-info", async (req: any, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autorizado." });
    const school = await getSchoolFromToken(auth.slice(7));
    if (!school) return res.status(401).json({ error: "Sessão inválida." });
    return res.json({ slug: school.slug, name: school.name, logo_url: school.logo_url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro interno." });
  }
});

/* GET /api/portal/:slug — public school info */
router.get("/portal/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const r = await pool.query(
      `SELECT name, logo_url, institution_type, portal_nomenclatura FROM schools WHERE school_id = $1`,
      [slug]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Portal não encontrado. Verifique o link ou contacte a secretaria." });
    const s = r.rows[0];
    return res.json({
      name: s.name,
      logo_url: s.logo_url,
      institution_type: s.institution_type,
      portal_nomenclatura: s.portal_nomenclatura,
      slug,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro interno." });
  }
});

/* POST /api/portal/:slug/check — validate contact belongs to this school */
router.post("/portal/:slug/check", async (req, res) => {
  try {
    const { slug } = req.params;
    const { contact } = req.body;
    if (!contact?.trim()) return res.status(400).json({ error: "Introduza o seu telemóvel ou email." });

    const clean = contact.trim();
    const r = await pool.query(
      `SELECT DISTINCT e.id, e.nome, e.first_login,
              CASE WHEN e.password IS NOT NULL AND length(e.password) > 0 THEN true ELSE false END AS has_password
       FROM encarregados e
       JOIN encarregado_aluno ea ON ea.encarregado_id = e.id
       JOIN students s ON s.id = ea.aluno_id
       JOIN schools sc ON sc.id = s.school_id
       WHERE sc.school_id = $1
         AND (e.telefone = $2 OR e.email = $2)
       LIMIT 1`,
      [slug, clean]
    );

    if (!r.rows.length) {
      return res.status(404).json({ error: "Contacto não encontrado. Verifique se está registado nesta escola ou contacte o secretariado." });
    }

    const enc = r.rows[0];
    const needs_password = !enc.has_password || enc.first_login;
    return res.json({ found: true, nome: enc.nome, needs_password });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro interno." });
  }
});

/* POST /api/portal/:slug/login — contact + password → guardian session */
router.post("/portal/:slug/login", async (req, res) => {
  try {
    const { slug } = req.params;
    const { contact, password } = req.body;
    if (!contact?.trim() || !password) return res.status(400).json({ error: "Contacto e palavra-passe obrigatórios." });

    const clean = contact.trim();
    const r = await pool.query(
      `SELECT DISTINCT e.id, e.nome, e.telefone, e.password, e.first_login
       FROM encarregados e
       JOIN encarregado_aluno ea ON ea.encarregado_id = e.id
       JOIN students s ON s.id = ea.aluno_id
       JOIN schools sc ON sc.id = s.school_id
       WHERE sc.school_id = $1
         AND (e.telefone = $2 OR e.email = $2)
       LIMIT 1`,
      [slug, clean]
    );

    if (!r.rows.length) return res.status(404).json({ error: "Contacto não encontrado." });
    const enc = r.rows[0];
    if (!enc.password) return res.status(403).json({ error: "Conta sem palavra-passe definida. Contacte o secretariado." });

    const valid = await bcrypt.compare(password, enc.password);
    if (!valid) return res.status(401).json({ error: "Palavra-passe incorreta." });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await pool.query(
      "INSERT INTO guardian_sessions (encarregado_id, token, expires_at) VALUES ($1,$2,$3)",
      [enc.id, token, expiresAt]
    );

    return res.json({ token, first_login: enc.first_login, guardian: { id: enc.id, nome: enc.nome, telefone: enc.telefone } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro interno." });
  }
});

/* POST /api/portal/:slug/set-password — first access: define password + create session */
router.post("/portal/:slug/set-password", async (req, res) => {
  try {
    const { slug } = req.params;
    const { contact, password } = req.body;
    if (!contact?.trim() || !password?.trim()) return res.status(400).json({ error: "Contacto e palavra-passe obrigatórios." });
    if (password.trim().length < 6) return res.status(400).json({ error: "A palavra-passe deve ter pelo menos 6 caracteres." });

    const clean = contact.trim();
    const r = await pool.query(
      `SELECT DISTINCT e.id, e.nome, e.telefone
       FROM encarregados e
       JOIN encarregado_aluno ea ON ea.encarregado_id = e.id
       JOIN students s ON s.id = ea.aluno_id
       JOIN schools sc ON sc.id = s.school_id
       WHERE sc.school_id = $1
         AND (e.telefone = $2 OR e.email = $2)
       LIMIT 1`,
      [slug, clean]
    );

    if (!r.rows.length) return res.status(404).json({ error: "Contacto não encontrado." });
    const enc = r.rows[0];

    const hash = await bcrypt.hash(password.trim(), 12);
    await pool.query("UPDATE encarregados SET password = $1, first_login = FALSE WHERE id = $2", [hash, enc.id]);

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await pool.query("INSERT INTO guardian_sessions (encarregado_id, token, expires_at) VALUES ($1,$2,$3)", [enc.id, token, expiresAt]);

    return res.json({ token, first_login: false, guardian: { id: enc.id, nome: enc.nome, telefone: enc.telefone } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro interno." });
  }
});

export default router;
