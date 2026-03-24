import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { pool } from "@workspace/db";

const router = Router();

async function getGuardianFromToken(token: string) {
  const res = await pool.query(
    `SELECT e.* FROM encarregados e
     JOIN guardian_sessions gs ON gs.encarregado_id = e.id
     WHERE gs.token = $1 AND gs.expires_at > NOW()`,
    [token]
  );
  return res.rows[0] ?? null;
}

function authMiddleware(req: any, res: any, next: any) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado." });
  req.guardianToken = header.slice(7);
  next();
}

// POST /guardian/login — phone + password
router.post("/guardian/login", async (req, res) => {
  const { telefone, password } = req.body;
  if (!telefone || !password) {
    return res.status(400).json({ error: "Telemóvel e palavra-passe obrigatórios." });
  }

  const clean = telefone.replace(/\D/g, "");
  const result = await pool.query(
    "SELECT id, nome, telefone, password, first_login FROM encarregados WHERE telefone = $1",
    [clean]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Número não encontrado. Contacte o secretariado." });
  }

  const guardian = result.rows[0];

  if (!guardian.password) {
    return res.status(403).json({ error: "Conta não configurada. Contacte o secretariado." });
  }

  const valid = await bcrypt.compare(password, guardian.password);
  if (!valid) {
    return res.status(401).json({ error: "Palavra-passe incorreta." });
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await pool.query(
    "INSERT INTO guardian_sessions (encarregado_id, token, expires_at) VALUES ($1,$2,$3)",
    [guardian.id, token, expiresAt]
  );

  return res.json({
    token,
    first_login: guardian.first_login,
    guardian: { id: guardian.id, nome: guardian.nome, telefone: guardian.telefone },
  });
});

// POST /guardian/change-password — obrigatório no primeiro login
router.post("/guardian/change-password", authMiddleware, async (req: any, res) => {
  const guardian = await getGuardianFromToken(req.guardianToken);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const { nova_senha, confirmar_senha } = req.body;
  if (!nova_senha || nova_senha.length < 6) {
    return res.status(400).json({ error: "A nova palavra-passe deve ter pelo menos 6 caracteres." });
  }
  if (nova_senha !== confirmar_senha) {
    return res.status(400).json({ error: "As palavras-passe não coincidem." });
  }

  const hash = await bcrypt.hash(nova_senha, 10);
  await pool.query(
    "UPDATE encarregados SET password = $1, first_login = FALSE WHERE id = $2",
    [hash, guardian.id]
  );

  return res.json({ success: true, message: "Palavra-passe atualizada com sucesso." });
});

// GET /guardian/me
router.get("/guardian/me", authMiddleware, async (req: any, res) => {
  const guardian = await getGuardianFromToken(req.guardianToken);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });
  return res.json({
    id: guardian.id,
    nome: guardian.nome,
    telefone: guardian.telefone,
    first_login: guardian.first_login,
  });
});

// GET /guardian/alunos — lista alunos com resumo financeiro
router.get("/guardian/alunos", authMiddleware, async (req: any, res) => {
  const guardian = await getGuardianFromToken(req.guardianToken);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const result = await pool.query(`
    SELECT
      s.id,
      s.nome,
      s.bilhete,
      t.nome AS turma,
      t.turno,
      COALESCE(SUM(CASE WHEN p.status != 'pago' THEN (p.montante + p.multa) ELSE 0 END), 0) AS divida_total,
      COALESCE(SUM(CASE WHEN p.status != 'pago' THEN p.multa ELSE 0 END), 0) AS total_multas,
      COUNT(CASE WHEN p.status = 'vencido' THEN 1 END) AS propinas_vencidas,
      COUNT(CASE WHEN p.status = 'pendente' THEN 1 END) AS propinas_pendentes
    FROM encarregado_aluno ea
    JOIN students s ON s.id = ea.aluno_id
    LEFT JOIN turmas t ON t.id = s.turma_id
    LEFT JOIN propinas p ON p.student_id = s.id
    WHERE ea.encarregado_id = $1
    GROUP BY s.id, s.nome, s.bilhete, t.nome, t.turno
    ORDER BY s.nome
  `, [guardian.id]);

  return res.json(result.rows);
});

// GET /guardian/alunos/:id/propinas
router.get("/guardian/alunos/:id/propinas", authMiddleware, async (req: any, res) => {
  const guardian = await getGuardianFromToken(req.guardianToken);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const { id } = req.params;
  const check = await pool.query(
    "SELECT 1 FROM encarregado_aluno WHERE encarregado_id=$1 AND aluno_id=$2",
    [guardian.id, id]
  );
  if (check.rows.length === 0) return res.status(403).json({ error: "Acesso negado." });

  // Auto-update vencido status for past-due propinas
  await pool.query(`
    UPDATE propinas
    SET status = 'vencido', multa = CASE WHEN multa = 0 THEN 5000 ELSE multa END
    WHERE student_id = $1 AND status = 'pendente' AND data_vencimento < NOW()
  `, [id]);

  const result = await pool.query(`
    SELECT
      p.id, p.mes, p.ano,
      p.montante AS valor_base,
      p.multa,
      (p.montante + p.multa) AS total,
      UPPER(p.status) AS estado,
      p.data_vencimento,
      pg.id AS pagamento_id,
      pg.entidade,
      pg.referencia,
      pg.valor AS ref_valor,
      UPPER(pg.estado) AS ref_estado,
      pg.validade
    FROM propinas p
    LEFT JOIN pagamentos pg ON pg.propina_id = p.id
    WHERE p.student_id = $1
    ORDER BY p.ano DESC,
      CASE p.mes
        WHEN 'Janeiro' THEN 1 WHEN 'Fevereiro' THEN 2 WHEN 'Março' THEN 3
        WHEN 'Abril' THEN 4 WHEN 'Maio' THEN 5 WHEN 'Junho' THEN 6
        WHEN 'Julho' THEN 7 WHEN 'Agosto' THEN 8 WHEN 'Setembro' THEN 9
        WHEN 'Outubro' THEN 10 WHEN 'Novembro' THEN 11 WHEN 'Dezembro' THEN 12
      END
  `, [id]);

  return res.json(result.rows);
});

export default router;
