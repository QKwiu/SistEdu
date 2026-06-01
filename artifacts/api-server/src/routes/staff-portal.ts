import { Router } from "express";
import { pool } from "@workspace/db";
import { randomBytes } from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import { staffAuth } from "./rbac";

const router = Router();

/* ─── Multer setup ─── */
const uploadsDir = path.join(process.cwd(), "uploads", "comprovantes");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const comprovanteStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `comp-${Date.now()}-${randomBytes(4).toString("hex")}${ext}`);
  },
});
const comprovanteUpload = multer({
  storage: comprovanteStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

function metodoToChannel(metodo: string): string {
  const m = (metodo ?? "").toLowerCase();
  if (m.includes("numerário") || m.includes("cash")) return "CASH";
  if (m.includes("transferência") || m.includes("transfer")) return "BANK_TRANSFER";
  if (m.includes("multicaixa") || m.includes("express")) return "MULTICAIXA_EXPRESS";
  if (m.includes("cheque")) return "CHEQUE";
  if (m.includes("pos") || m.includes("tpa")) return "POS_TPA";
  return "CASH";
}

/* ─── GET /school/staff/propinas ─── */
router.get("/school/staff/propinas", staffAuth, async (req: any, res) => {
  try {
    const { status, q } = req.query;
    const schoolId = req.schoolId;

    const result = await pool.query(
      `SELECT p.id, p.student_id, p.mes, p.ano, p.montante, p.multa, p.status,
              p.data_vencimento, p.pago_em, p.created_at,
              p.baixa_manual, p.baixa_manual_por, p.baixa_manual_em,
              p.comprovante_url, p.data_recebimento, p.metodo_pagamento,
              COALESCE(p.pagamento_origem, 'manual') AS pagamento_origem,
              s.nome AS aluno_nome, s.numero_processo,
              COALESCE(t.nome, 'Sem turma') AS turma
       FROM propinas p
       JOIN students s ON s.id = p.student_id
       LEFT JOIN turmas t ON t.id = s.turma_id
       WHERE s.school_id = $1
         AND ($2::text IS NULL OR p.status = $2)
         AND ($3::text IS NULL OR s.nome ILIKE $3 OR s.numero_processo ILIKE $3)
       ORDER BY p.data_vencimento ASC NULLS LAST, s.nome`,
      [schoolId, status || null, q ? `%${q}%` : null]
    );

    res.json(result.rows);
  } catch (e: any) {
    req.log?.error(e);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

/* ─── POST /school/staff/baixa-manual ─── */
router.post(
  "/school/staff/baixa-manual",
  staffAuth,
  comprovanteUpload.single("comprovante"),
  async (req: any, res) => {
    try {
      const schoolId = req.schoolId;
      const { propina_id, valor_pago, metodo, data_recebimento, observacoes, referencia_doc } = req.body;

      if (!propina_id) return res.status(400).json({ error: "ID da propina obrigatório." });
      if (!valor_pago || Number(valor_pago) <= 0) return res.status(400).json({ error: "Valor pago deve ser maior que zero." });
      if (!data_recebimento) return res.status(400).json({ error: "Data de recebimento obrigatória." });

      const earlyChannel = metodoToChannel(metodo ?? "Numerário");
      const ruleChk = await pool.query("SELECT * FROM payment_channel_rules WHERE canal=$1", [earlyChannel]);
      const rule = ruleChk.rows[0];
      if (rule?.requer_comprovante && !req.file) {
        return res.status(400).json({ error: "Comprovante de pagamento obrigatório para este meio de pagamento." });
      }
      if (rule?.requer_referencia_doc && !referencia_doc) {
        return res.status(400).json({
          error: earlyChannel === "POS_TPA"
            ? "Nº do talão / ID de transação TPA obrigatório."
            : "Referência da transferência obrigatória.",
        });
      }

      const pRow = await pool.query(
        `SELECT p.*, sc.commission_rate,
                sc.name AS escola_nome, sc.nif AS escola_nif, sc.phone AS escola_phone,
                s.nome AS aluno_nome_db, s.numero_processo AS aluno_processo
         FROM propinas p
         JOIN schools sc ON sc.id = p.school_id
         LEFT JOIN students s ON s.id = p.student_id
         WHERE p.id = $1 AND p.school_id = $2`,
        [propina_id, schoolId]
      );

      if (!pRow.rows.length) return res.status(404).json({ error: "Fatura não encontrada ou não pertence a este colégio." });

      const p = pRow.rows[0];
      if (p.status === "pago") {
        const reason = p.baixa_manual ? "Fatura já registada com baixa manual." : "Fatura já marcada como paga pelo sistema.";
        return res.status(409).json({ error: reason });
      }

      const paid = Number(valor_pago);
      const total = Number(p.montante) + Number(p.multa);
      const newStatus = paid >= total ? "pago" : "pendente";
      const comprovanteUrl = req.file ? `/api/uploads/comprovantes/${req.file.filename}` : null;
      const payChannel = metodoToChannel(metodo ?? "Numerário");
      const staffOperador = req.staffNome ? `${req.staffNome} (${req.staffEmail})` : req.staffEmail;

      await pool.query(
        `UPDATE propinas
         SET status = $1,
             pago_em = NOW(),
             partially_paid_amount = CASE WHEN $1 = 'pago' THEN 0 ELSE $2 END,
             baixa_manual = TRUE,
             baixa_manual_por = $3,
             baixa_manual_em = NOW(),
             baixa_manual_obs = $4,
             comprovante_url = $5,
             data_recebimento = $6,
             payment_channel = $8,
             referencia_doc = $9
         WHERE id = $7`,
        [newStatus, paid < total ? paid : 0, staffOperador, observacoes ?? null,
         comprovanteUrl, data_recebimento, p.id, payChannel, referencia_doc ?? null]
      );

      await pool.query("UPDATE pagamentos SET estado='PAGO' WHERE propina_id=$1", [p.id]);

      const commissionRate = Number(p.commission_rate ?? 0);
      const comissaoPlataforma = paid * (commissionRate / 100);
      const valorEscola = paid - comissaoPlataforma;
      const payRef = `MAN-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;

      await pool.query("DELETE FROM payment_splits WHERE propina_id=$1", [p.id]);
      await pool.query(
        `INSERT INTO payment_splits (propina_id, payment_ref, destino, valor, tipo)
         VALUES ($1,$2,'school',$3,'propina'), ($1,$2,'platform',$4,'comissao')`,
        [p.id, payRef, valorEscola, comissaoPlataforma]
      );

      await pool.query(
        `INSERT INTO manual_payment_logs
           (propina_id, tipo, admin_user, valor, metodo, data_recebimento, observacoes, comprovante_url, payment_ref)
         VALUES ($1,'baixa_manual',$2,$3,$4,$5,$6,$7,$8)`,
        [p.id, staffOperador, paid, metodo ?? "Numerário", data_recebimento, observacoes ?? null, comprovanteUrl, payRef]
      );

      res.json({
        ok: true,
        payment_ref: payRef,
        status: newStatus,
        valor_pago: paid,
        total_fatura: total,
        comprovante_url: comprovanteUrl,
        baixa_manual_por: staffOperador,
        split: { escola: valorEscola, plataforma: comissaoPlataforma, comissao_rate: commissionRate },
        escola: { nome: p.escola_nome ?? null, nif: p.escola_nif ?? null, phone: p.escola_phone ?? null },
        propina: { aluno_nome: p.aluno_nome_db ?? null, aluno_processo: p.aluno_processo ?? null, mes: p.mes, ano: p.ano },
      });
    } catch (e: any) {
      req.log?.error(e);
      res.status(500).json({ error: "Erro interno do servidor." });
    }
  }
);

export default router;
