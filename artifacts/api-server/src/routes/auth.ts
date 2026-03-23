import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db, schoolsTable, sessionsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

const router = Router();

function generateSchoolId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "SCH-";
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

router.post("/auth/signup", async (req, res) => {
  try {
    const { schoolName, nif, phone, email, password } = req.body;
    if (!schoolName || !nif || !phone || !email || !password) {
      return res.status(400).json({ error: "Todos os campos são obrigatórios." });
    }

    const existing = await db.select().from(schoolsTable).where(eq(schoolsTable.email, email)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Já existe uma conta com este email." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const schoolId = generateSchoolId();

    const [school] = await db.insert(schoolsTable).values({
      schoolId,
      name: schoolName,
      nif,
      phone,
      email,
      passwordHash,
    }).returning();

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.insert(sessionsTable).values({
      schoolId: school.id,
      token,
      expiresAt,
    });

    return res.status(201).json({
      token,
      school: {
        schoolId: school.schoolId,
        schoolName: school.name,
        adminEmail: school.email,
        isNew: true,
      },
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email e palavra-passe são obrigatórios." });
    }

    const [school] = await db.select().from(schoolsTable).where(eq(schoolsTable.email, email)).limit(1);
    if (!school) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const valid = await bcrypt.compare(password, school.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.insert(sessionsTable).values({
      schoolId: school.id,
      token,
      expiresAt,
    });

    return res.json({
      token,
      school: {
        schoolId: school.schoolId,
        schoolName: school.name,
        adminEmail: school.email,
        isNew: false,
      },
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
});

router.get("/auth/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Não autenticado." });
    }
    const token = authHeader.slice(7);

    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(and(eq(sessionsTable.token, token), gt(sessionsTable.expiresAt, new Date())))
      .limit(1);

    if (!session) {
      return res.status(401).json({ error: "Sessão inválida ou expirada." });
    }

    const [school] = await db.select().from(schoolsTable).where(eq(schoolsTable.id, session.schoolId)).limit(1);
    if (!school) {
      return res.status(401).json({ error: "Escola não encontrada." });
    }

    return res.json({
      school: {
        schoolId: school.schoolId,
        schoolName: school.name,
        adminEmail: school.email,
        isNew: false,
      },
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
});

router.post("/auth/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
    }
    return res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
});

export default router;
