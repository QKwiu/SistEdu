import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import * as crypto from "crypto";

const router = Router();

/* ─── Migration ─── */
export async function runRBACMigration() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS staff_roles (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      nome TEXT NOT NULL,
      descricao TEXT DEFAULT '',
      cor TEXT DEFAULT '#6366f1',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      id SERIAL PRIMARY KEY,
      role_id INTEGER NOT NULL REFERENCES staff_roles(id) ON DELETE CASCADE,
      modulo TEXT NOT NULL,
      pode_criar BOOLEAN DEFAULT false,
      pode_ler BOOLEAN DEFAULT true,
      pode_editar BOOLEAN DEFAULT false,
      pode_apagar BOOLEAN DEFAULT false,
      UNIQUE(role_id, modulo)
    );

    CREATE TABLE IF NOT EXISTS staff_users (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      role_id INTEGER REFERENCES staff_roles(id) ON DELETE SET NULL,
      nome TEXT NOT NULL,
      email TEXT NOT NULL,
      telefone TEXT DEFAULT '',
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'activo',
      ultimo_acesso TIMESTAMPTZ,
      mfa_activado BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(school_id, email)
    );

    CREATE TABLE IF NOT EXISTS access_audit_log (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      actor TEXT NOT NULL,
      actor_tipo TEXT NOT NULL DEFAULT 'admin',
      acao TEXT NOT NULL,
      alvo TEXT,
      detalhe JSONB DEFAULT '{}',
      ip TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}

/* ─── Auth middleware (school session) ─── */
async function schoolAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autorizado" });
  const token = auth.slice(7);
  const rows = await db.execute(sql`
    SELECT s.id AS school_id, s.name AS school_name, s.email AS school_email
    FROM sessions sess
    JOIN schools s ON s.id = sess.school_id
    WHERE sess.token = ${token} AND sess.expires_at > now()
    LIMIT 1
  `);
  if (!rows.rows.length) return res.status(401).json({ error: "Sessão inválida" });
  req.schoolId = rows.rows[0].school_id as number;
  req.schoolName = rows.rows[0].school_name as string;
  req.actorEmail = rows.rows[0].school_email as string;
  next();
}

/* ─── Audit log helper ─── */
async function logAudit(
  schoolId: number,
  actor: string,
  acao: string,
  alvo: string | null,
  detalhe: Record<string, any>,
  ip?: string
) {
  await db.execute(sql`
    INSERT INTO access_audit_log (school_id, actor, actor_tipo, acao, alvo, detalhe, ip)
    VALUES (${schoolId}, ${actor}, 'admin', ${acao}, ${alvo ?? null}, ${JSON.stringify(detalhe)}, ${ip ?? null})
  `);
}

function hashPassword(plain: string): string {
  return crypto.createHash("sha256").update(plain + "kiwara_salt").digest("hex");
}

function generateTempPassword(): string {
  return "Kiwara@" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

/* ══════════════════════════════════════════
   ROLES
══════════════════════════════════════════ */

/* GET /school/rbac/roles */
router.get("/school/rbac/roles", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const roles = await db.execute(sql`
      SELECT r.id, r.nome, r.descricao, r.cor, r.created_at,
        COUNT(DISTINCT su.id)::int AS total_utilizadores
      FROM staff_roles r
      LEFT JOIN staff_users su ON su.role_id = r.id AND su.school_id = ${sid}
      WHERE r.school_id = ${sid}
      GROUP BY r.id
      ORDER BY r.created_at ASC
    `);

    const perms = await db.execute(sql`
      SELECT rp.*
      FROM role_permissions rp
      JOIN staff_roles r ON r.id = rp.role_id
      WHERE r.school_id = ${sid}
    `);

    const permsByRole: Record<number, any[]> = {};
    for (const p of perms.rows as any[]) {
      if (!permsByRole[p.role_id]) permsByRole[p.role_id] = [];
      permsByRole[p.role_id].push(p);
    }

    const result = (roles.rows as any[]).map(r => ({
      ...r,
      permissions: permsByRole[r.id] ?? [],
    }));

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* POST /school/rbac/roles */
router.post("/school/rbac/roles", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const { nome, descricao, cor, permissions } = req.body;
    if (!nome?.trim()) return res.status(400).json({ error: "Nome obrigatório" });

    const roleRes = await db.execute(sql`
      INSERT INTO staff_roles (school_id, nome, descricao, cor)
      VALUES (${sid}, ${nome.trim()}, ${descricao ?? ""}, ${cor ?? "#6366f1"})
      RETURNING *
    `);
    const role = roleRes.rows[0] as any;

    if (Array.isArray(permissions) && permissions.length > 0) {
      for (const p of permissions) {
        await db.execute(sql`
          INSERT INTO role_permissions (role_id, modulo, pode_criar, pode_ler, pode_editar, pode_apagar)
          VALUES (${role.id}, ${p.modulo}, ${!!p.pode_criar}, ${!!p.pode_ler}, ${!!p.pode_editar}, ${!!p.pode_apagar})
          ON CONFLICT (role_id, modulo) DO UPDATE SET
            pode_criar = EXCLUDED.pode_criar, pode_ler = EXCLUDED.pode_ler,
            pode_editar = EXCLUDED.pode_editar, pode_apagar = EXCLUDED.pode_apagar
        `);
      }
    }

    await logAudit(sid, req.actorEmail, "criar_role", nome, { role_id: role.id }, req.ip);
    res.status(201).json(role);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* PUT /school/rbac/roles/:id */
router.put("/school/rbac/roles/:id", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const roleId = Number(req.params.id);
    const { nome, descricao, cor, permissions } = req.body;

    const check = await db.execute(sql`SELECT id FROM staff_roles WHERE id=${roleId} AND school_id=${sid}`);
    if (!check.rows.length) return res.status(404).json({ error: "Perfil não encontrado" });

    await db.execute(sql`
      UPDATE staff_roles SET nome=${nome}, descricao=${descricao ?? ""}, cor=${cor ?? "#6366f1"}, updated_at=now()
      WHERE id=${roleId} AND school_id=${sid}
    `);

    if (Array.isArray(permissions)) {
      await db.execute(sql`DELETE FROM role_permissions WHERE role_id=${roleId}`);
      for (const p of permissions) {
        await db.execute(sql`
          INSERT INTO role_permissions (role_id, modulo, pode_criar, pode_ler, pode_editar, pode_apagar)
          VALUES (${roleId}, ${p.modulo}, ${!!p.pode_criar}, ${!!p.pode_ler}, ${!!p.pode_editar}, ${!!p.pode_apagar})
        `);
      }
    }

    await logAudit(sid, req.actorEmail, "editar_role", nome, { role_id: roleId }, req.ip);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* DELETE /school/rbac/roles/:id */
router.delete("/school/rbac/roles/:id", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const roleId = Number(req.params.id);

    const check = await db.execute(sql`SELECT nome FROM staff_roles WHERE id=${roleId} AND school_id=${sid}`);
    if (!check.rows.length) return res.status(404).json({ error: "Perfil não encontrado" });

    const inUse = await db.execute(sql`SELECT COUNT(*) AS n FROM staff_users WHERE role_id=${roleId} AND school_id=${sid}`);
    if (Number((inUse.rows[0] as any).n) > 0) {
      return res.status(400).json({ error: "Este perfil está atribuído a utilizadores activos. Remova as atribuições primeiro." });
    }

    await db.execute(sql`DELETE FROM staff_roles WHERE id=${roleId} AND school_id=${sid}`);
    await logAudit(sid, req.actorEmail, "eliminar_role", (check.rows[0] as any).nome, { role_id: roleId }, req.ip);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════
   STAFF USERS
══════════════════════════════════════════ */

/* GET /school/rbac/staff */
router.get("/school/rbac/staff", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const { role_id, status, q } = req.query;

    const users = await db.execute(sql`
      SELECT su.id, su.nome, su.email, su.telefone, su.status,
        su.mfa_activado, su.ultimo_acesso, su.created_at, su.role_id,
        sr.nome AS role_nome, sr.cor AS role_cor
      FROM staff_users su
      LEFT JOIN staff_roles sr ON sr.id = su.role_id
      WHERE su.school_id = ${sid}
        AND (${role_id ? sql`su.role_id = ${Number(role_id)}` : sql`true`})
        AND (${status ? sql`su.status = ${status}` : sql`true`})
        AND (${q ? sql`(su.nome ILIKE ${"%" + q + "%"} OR su.email ILIKE ${"%" + q + "%"})` : sql`true`})
      ORDER BY su.created_at DESC
    `);

    res.json(users.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* POST /school/rbac/staff */
router.post("/school/rbac/staff", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const { nome, email, telefone, role_id } = req.body;
    if (!nome?.trim() || !email?.trim()) return res.status(400).json({ error: "Nome e email são obrigatórios" });

    const tempPass = generateTempPassword();
    const hash = hashPassword(tempPass);

    const userRes = await db.execute(sql`
      INSERT INTO staff_users (school_id, role_id, nome, email, telefone, password_hash, status)
      VALUES (${sid}, ${role_id ? Number(role_id) : null}, ${nome.trim()}, ${email.trim().toLowerCase()},
              ${telefone ?? ""}, ${hash}, 'activo')
      RETURNING id, nome, email, status, created_at
    `);

    const user = userRes.rows[0] as any;
    await logAudit(sid, req.actorEmail, "criar_staff", email, { staff_id: user.id, role_id }, req.ip);
    res.status(201).json({ ...user, temp_password: tempPass });
  } catch (e: any) {
    if (e.message?.includes("unique")) return res.status(400).json({ error: "Já existe um utilizador com este email nesta escola" });
    res.status(500).json({ error: e.message });
  }
});

/* PUT /school/rbac/staff/:id */
router.put("/school/rbac/staff/:id", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const userId = Number(req.params.id);
    const { nome, email, telefone, role_id } = req.body;

    const check = await db.execute(sql`SELECT id, email FROM staff_users WHERE id=${userId} AND school_id=${sid}`);
    if (!check.rows.length) return res.status(404).json({ error: "Utilizador não encontrado" });

    await db.execute(sql`
      UPDATE staff_users
      SET nome=${nome}, email=${email?.toLowerCase()}, telefone=${telefone ?? ""},
          role_id=${role_id ? Number(role_id) : null}, updated_at=now()
      WHERE id=${userId} AND school_id=${sid}
    `);

    await logAudit(sid, req.actorEmail, "editar_staff", email, { staff_id: userId }, req.ip);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* POST /school/rbac/staff/:id/toggle-status — Kill Switch */
router.post("/school/rbac/staff/:id/toggle-status", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const userId = Number(req.params.id);
    const { status } = req.body; // 'activo' | 'bloqueado' | 'inactivo'

    if (!["activo", "bloqueado", "inactivo"].includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }

    const check = await db.execute(sql`SELECT email, status FROM staff_users WHERE id=${userId} AND school_id=${sid}`);
    if (!check.rows.length) return res.status(404).json({ error: "Utilizador não encontrado" });

    await db.execute(sql`
      UPDATE staff_users SET status=${status}, updated_at=now() WHERE id=${userId} AND school_id=${sid}
    `);

    const acao = status === "bloqueado" ? "bloquear_staff" : status === "inactivo" ? "desactivar_staff" : "activar_staff";
    await logAudit(sid, req.actorEmail, acao, (check.rows[0] as any).email, { staff_id: userId, novo_status: status }, req.ip);
    res.json({ ok: true, novo_status: status });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* POST /school/rbac/staff/:id/reset-password */
router.post("/school/rbac/staff/:id/reset-password", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const userId = Number(req.params.id);

    const check = await db.execute(sql`SELECT email FROM staff_users WHERE id=${userId} AND school_id=${sid}`);
    if (!check.rows.length) return res.status(404).json({ error: "Utilizador não encontrado" });

    const tempPass = generateTempPassword();
    const hash = hashPassword(tempPass);

    await db.execute(sql`
      UPDATE staff_users SET password_hash=${hash}, updated_at=now() WHERE id=${userId} AND school_id=${sid}
    `);

    await logAudit(sid, req.actorEmail, "reset_password", (check.rows[0] as any).email, { staff_id: userId }, req.ip);
    res.json({ ok: true, temp_password: tempPass });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* DELETE /school/rbac/staff/:id */
router.delete("/school/rbac/staff/:id", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const userId = Number(req.params.id);

    const check = await db.execute(sql`SELECT email FROM staff_users WHERE id=${userId} AND school_id=${sid}`);
    if (!check.rows.length) return res.status(404).json({ error: "Utilizador não encontrado" });

    await db.execute(sql`DELETE FROM staff_users WHERE id=${userId} AND school_id=${sid}`);
    await logAudit(sid, req.actorEmail, "eliminar_staff", (check.rows[0] as any).email, { staff_id: userId }, req.ip);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════
   AUDIT LOG
══════════════════════════════════════════ */

/* GET /school/rbac/audit-log */
router.get("/school/rbac/audit-log", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const limit = Math.min(Number(req.query.limit ?? 30), 100);
    const offset = Number(req.query.offset ?? 0);
    const acao = req.query.acao as string | undefined;

    const [rows, total] = await Promise.all([
      db.execute(sql`
        SELECT id, actor, actor_tipo, acao, alvo, detalhe, ip, created_at
        FROM access_audit_log
        WHERE school_id = ${sid}
          AND (${acao ? sql`acao = ${acao}` : sql`true`})
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS n FROM access_audit_log
        WHERE school_id = ${sid}
          AND (${acao ? sql`acao = ${acao}` : sql`true`})
      `),
    ]);

    res.json({ rows: rows.rows, total: (total.rows[0] as any).n });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* GET /school/rbac/summary — dashboard stats */
router.get("/school/rbac/summary", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const [users, roles, audit] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status='activo')::int AS activos,
          COUNT(*) FILTER (WHERE status='bloqueado')::int AS bloqueados,
          COUNT(*) FILTER (WHERE status='inactivo')::int AS inactivos
        FROM staff_users WHERE school_id=${sid}
      `),
      db.execute(sql`SELECT COUNT(*)::int AS total FROM staff_roles WHERE school_id=${sid}`),
      db.execute(sql`
        SELECT id, actor, acao, alvo, created_at
        FROM access_audit_log WHERE school_id=${sid}
        ORDER BY created_at DESC LIMIT 5
      `),
    ]);
    res.json({
      utilizadores: users.rows[0],
      total_roles: (roles.rows[0] as any).total,
      actividade_recente: audit.rows,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════
   ADMIN-SCOPED RBAC ENDPOINTS
   Uses admin session token; schoolId via URL param
══════════════════════════════════════════ */

async function adminAuthMiddleware(req: any, res: any, next: any) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado." });
  const token = header.slice(7);
  const r = await db.execute(sql`
    SELECT id FROM admin_sessions WHERE token=${token} AND expires_at > NOW()
  `);
  if (!r.rows.length) return res.status(401).json({ error: "Sessão inválida." });
  req.actorEmail = "superadmin";
  next();
}

/* GET /admin/rbac/:schoolId/summary */
router.get("/admin/rbac/:schoolId/summary", adminAuthMiddleware, async (req: any, res) => {
  try {
    const sid = Number(req.params.schoolId);
    const [users, roles, audit] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status='activo')::int AS activos,
          COUNT(*) FILTER (WHERE status='bloqueado')::int AS bloqueados,
          COUNT(*) FILTER (WHERE status='inactivo')::int AS inactivos
        FROM staff_users WHERE school_id=${sid}
      `),
      db.execute(sql`SELECT COUNT(*)::int AS total FROM staff_roles WHERE school_id=${sid}`),
      db.execute(sql`
        SELECT id, actor, acao, alvo, created_at FROM access_audit_log
        WHERE school_id=${sid} ORDER BY created_at DESC LIMIT 5
      `),
    ]);
    res.json({ utilizadores: users.rows[0], total_roles: (roles.rows[0] as any).total, actividade_recente: audit.rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /admin/rbac/:schoolId/roles */
router.get("/admin/rbac/:schoolId/roles", adminAuthMiddleware, async (req: any, res) => {
  try {
    const sid = Number(req.params.schoolId);
    const roles = await db.execute(sql`
      SELECT r.id, r.nome, r.descricao, r.cor, r.created_at,
        COUNT(DISTINCT su.id)::int AS total_utilizadores
      FROM staff_roles r LEFT JOIN staff_users su ON su.role_id = r.id AND su.school_id=${sid}
      WHERE r.school_id=${sid} GROUP BY r.id ORDER BY r.created_at ASC
    `);
    const perms = await db.execute(sql`
      SELECT rp.* FROM role_permissions rp
      JOIN staff_roles r ON r.id = rp.role_id WHERE r.school_id=${sid}
    `);
    const permsByRole: Record<number, any[]> = {};
    for (const p of perms.rows as any[]) {
      if (!permsByRole[p.role_id]) permsByRole[p.role_id] = [];
      permsByRole[p.role_id].push(p);
    }
    res.json((roles.rows as any[]).map(r => ({ ...r, permissions: permsByRole[r.id] ?? [] })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /admin/rbac/:schoolId/roles */
router.post("/admin/rbac/:schoolId/roles", adminAuthMiddleware, async (req: any, res) => {
  try {
    const sid = Number(req.params.schoolId);
    const { nome, descricao, cor, permissions } = req.body;
    if (!nome?.trim()) return res.status(400).json({ error: "Nome obrigatório" });
    const roleRes = await db.execute(sql`
      INSERT INTO staff_roles (school_id, nome, descricao, cor)
      VALUES (${sid}, ${nome.trim()}, ${descricao ?? ""}, ${cor ?? "#6366f1"}) RETURNING *
    `);
    const role = roleRes.rows[0] as any;
    if (Array.isArray(permissions)) {
      for (const p of permissions) {
        await db.execute(sql`
          INSERT INTO role_permissions (role_id, modulo, pode_criar, pode_ler, pode_editar, pode_apagar)
          VALUES (${role.id}, ${p.modulo}, ${!!p.pode_criar}, ${!!p.pode_ler}, ${!!p.pode_editar}, ${!!p.pode_apagar})
          ON CONFLICT (role_id, modulo) DO UPDATE SET
            pode_criar=EXCLUDED.pode_criar, pode_ler=EXCLUDED.pode_ler,
            pode_editar=EXCLUDED.pode_editar, pode_apagar=EXCLUDED.pode_apagar
        `);
      }
    }
    await logAudit(sid, "superadmin", "criar_role", nome, { role_id: role.id }, req.ip);
    res.status(201).json(role);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PUT /admin/rbac/:schoolId/roles/:roleId */
router.put("/admin/rbac/:schoolId/roles/:roleId", adminAuthMiddleware, async (req: any, res) => {
  try {
    const sid = Number(req.params.schoolId);
    const roleId = Number(req.params.roleId);
    const { nome, descricao, cor, permissions } = req.body;
    await db.execute(sql`
      UPDATE staff_roles SET nome=${nome}, descricao=${descricao ?? ""}, cor=${cor ?? "#6366f1"}, updated_at=now()
      WHERE id=${roleId} AND school_id=${sid}
    `);
    if (Array.isArray(permissions)) {
      await db.execute(sql`DELETE FROM role_permissions WHERE role_id=${roleId}`);
      for (const p of permissions) {
        await db.execute(sql`
          INSERT INTO role_permissions (role_id, modulo, pode_criar, pode_ler, pode_editar, pode_apagar)
          VALUES (${roleId}, ${p.modulo}, ${!!p.pode_criar}, ${!!p.pode_ler}, ${!!p.pode_editar}, ${!!p.pode_apagar})
        `);
      }
    }
    await logAudit(sid, "superadmin", "editar_role", nome, { role_id: roleId }, req.ip);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* DELETE /admin/rbac/:schoolId/roles/:roleId */
router.delete("/admin/rbac/:schoolId/roles/:roleId", adminAuthMiddleware, async (req: any, res) => {
  try {
    const sid = Number(req.params.schoolId);
    const roleId = Number(req.params.roleId);
    const check = await db.execute(sql`SELECT nome FROM staff_roles WHERE id=${roleId} AND school_id=${sid}`);
    if (!check.rows.length) return res.status(404).json({ error: "Perfil não encontrado" });
    const inUse = await db.execute(sql`SELECT COUNT(*)::int AS n FROM staff_users WHERE role_id=${roleId} AND school_id=${sid}`);
    if (Number((inUse.rows[0] as any).n) > 0)
      return res.status(400).json({ error: "Perfil atribuído a utilizadores activos." });
    await db.execute(sql`DELETE FROM staff_roles WHERE id=${roleId} AND school_id=${sid}`);
    await logAudit(sid, "superadmin", "eliminar_role", (check.rows[0] as any).nome, { role_id: roleId }, req.ip);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /admin/rbac/:schoolId/staff */
router.get("/admin/rbac/:schoolId/staff", adminAuthMiddleware, async (req: any, res) => {
  try {
    const sid = Number(req.params.schoolId);
    const { role_id, status, q } = req.query;
    const users = await db.execute(sql`
      SELECT su.id, su.nome, su.email, su.telefone, su.status,
        su.mfa_activado, su.ultimo_acesso, su.created_at, su.role_id,
        sr.nome AS role_nome, sr.cor AS role_cor
      FROM staff_users su LEFT JOIN staff_roles sr ON sr.id = su.role_id
      WHERE su.school_id=${sid}
        AND (${role_id ? sql`su.role_id=${Number(role_id)}` : sql`true`})
        AND (${status ? sql`su.status=${status}` : sql`true`})
        AND (${q ? sql`(su.nome ILIKE ${"%" + q + "%"} OR su.email ILIKE ${"%" + q + "%"})` : sql`true`})
      ORDER BY su.created_at DESC
    `);
    res.json(users.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /admin/rbac/:schoolId/staff */
router.post("/admin/rbac/:schoolId/staff", adminAuthMiddleware, async (req: any, res) => {
  try {
    const sid = Number(req.params.schoolId);
    const { nome, email, telefone, role_id } = req.body;
    if (!nome?.trim() || !email?.trim()) return res.status(400).json({ error: "Nome e email obrigatórios" });
    const tempPass = generateTempPassword();
    const hash = hashPassword(tempPass);
    const userRes = await db.execute(sql`
      INSERT INTO staff_users (school_id, role_id, nome, email, telefone, password_hash, status)
      VALUES (${sid}, ${role_id ? Number(role_id) : null}, ${nome.trim()}, ${email.trim().toLowerCase()},
              ${telefone ?? ""}, ${hash}, 'activo')
      RETURNING id, nome, email, status, created_at
    `);
    const user = userRes.rows[0] as any;
    await logAudit(sid, "superadmin", "criar_staff", email, { staff_id: user.id }, req.ip);
    res.status(201).json({ ...user, temp_password: tempPass });
  } catch (e: any) {
    if (e.message?.includes("unique")) return res.status(400).json({ error: "Já existe um utilizador com este email nesta escola" });
    res.status(500).json({ error: e.message });
  }
});

/* PUT /admin/rbac/:schoolId/staff/:userId */
router.put("/admin/rbac/:schoolId/staff/:userId", adminAuthMiddleware, async (req: any, res) => {
  try {
    const sid = Number(req.params.schoolId);
    const userId = Number(req.params.userId);
    const { nome, email, telefone, role_id } = req.body;
    await db.execute(sql`
      UPDATE staff_users SET nome=${nome}, email=${email?.toLowerCase()}, telefone=${telefone ?? ""},
        role_id=${role_id ? Number(role_id) : null}, updated_at=now()
      WHERE id=${userId} AND school_id=${sid}
    `);
    await logAudit(sid, "superadmin", "editar_staff", email, { staff_id: userId }, req.ip);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /admin/rbac/:schoolId/staff/:userId/toggle-status */
router.post("/admin/rbac/:schoolId/staff/:userId/toggle-status", adminAuthMiddleware, async (req: any, res) => {
  try {
    const sid = Number(req.params.schoolId);
    const userId = Number(req.params.userId);
    const { status } = req.body;
    if (!["activo", "bloqueado", "inactivo"].includes(status))
      return res.status(400).json({ error: "Status inválido" });
    const check = await db.execute(sql`SELECT email FROM staff_users WHERE id=${userId} AND school_id=${sid}`);
    if (!check.rows.length) return res.status(404).json({ error: "Utilizador não encontrado" });
    await db.execute(sql`UPDATE staff_users SET status=${status}, updated_at=now() WHERE id=${userId} AND school_id=${sid}`);
    const acao = status === "bloqueado" ? "bloquear_staff" : status === "inactivo" ? "desactivar_staff" : "activar_staff";
    await logAudit(sid, "superadmin", acao, (check.rows[0] as any).email, { staff_id: userId, novo_status: status }, req.ip);
    res.json({ ok: true, novo_status: status });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /admin/rbac/:schoolId/staff/:userId/reset-password */
router.post("/admin/rbac/:schoolId/staff/:userId/reset-password", adminAuthMiddleware, async (req: any, res) => {
  try {
    const sid = Number(req.params.schoolId);
    const userId = Number(req.params.userId);
    const check = await db.execute(sql`SELECT email FROM staff_users WHERE id=${userId} AND school_id=${sid}`);
    if (!check.rows.length) return res.status(404).json({ error: "Utilizador não encontrado" });
    const tempPass = generateTempPassword();
    await db.execute(sql`UPDATE staff_users SET password_hash=${hashPassword(tempPass)}, updated_at=now() WHERE id=${userId} AND school_id=${sid}`);
    await logAudit(sid, "superadmin", "reset_password", (check.rows[0] as any).email, { staff_id: userId }, req.ip);
    res.json({ ok: true, temp_password: tempPass });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* DELETE /admin/rbac/:schoolId/staff/:userId */
router.delete("/admin/rbac/:schoolId/staff/:userId", adminAuthMiddleware, async (req: any, res) => {
  try {
    const sid = Number(req.params.schoolId);
    const userId = Number(req.params.userId);
    const check = await db.execute(sql`SELECT email FROM staff_users WHERE id=${userId} AND school_id=${sid}`);
    if (!check.rows.length) return res.status(404).json({ error: "Utilizador não encontrado" });
    await db.execute(sql`DELETE FROM staff_users WHERE id=${userId} AND school_id=${sid}`);
    await logAudit(sid, "superadmin", "eliminar_staff", (check.rows[0] as any).email, { staff_id: userId }, req.ip);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /admin/rbac/:schoolId/audit-log */
router.get("/admin/rbac/:schoolId/audit-log", adminAuthMiddleware, async (req: any, res) => {
  try {
    const sid = Number(req.params.schoolId);
    const limit = Math.min(Number(req.query.limit ?? 30), 100);
    const offset = Number(req.query.offset ?? 0);
    const acao = req.query.acao as string | undefined;
    const [rows, total] = await Promise.all([
      db.execute(sql`
        SELECT id, actor, actor_tipo, acao, alvo, detalhe, ip, created_at
        FROM access_audit_log WHERE school_id=${sid}
          AND (${acao ? sql`acao=${acao}` : sql`true`})
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS n FROM access_audit_log
        WHERE school_id=${sid} AND (${acao ? sql`acao=${acao}` : sql`true`})
      `),
    ]);
    res.json({ rows: rows.rows, total: (total.rows[0] as any).n });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
