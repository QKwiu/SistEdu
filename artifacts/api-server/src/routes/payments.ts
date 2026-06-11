import { Router } from "express";
import { pool } from "@workspace/db";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { sendEventSMS } from "../services/sms.service";

const router = Router();

/* Shared webhook secret — set WEBHOOK_SECRET in env vars.
   If not set in production the webhook is DISABLED for safety. */
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

/* ─────────────────────────────────────────────────────────────────
   POST /payments/webhook
   
   Receives payment confirmation from middleware (EMIS / MCX Express).
   Idempotent: ignores duplicate transaction_id.
   Requires header: X-Webhook-Signature: sha256=<hmac>
   
   Payload:
   {
     "reference": "internal_reference",     // chave de reconciliação
     "amount_paid": 50000,
     "status": "paid",
     "transaction_id": "TX12345",
     "payment_method": "MCX_EXPRESS",        // MCX_EXPRESS | MULTICAIXA | TPA | OTHER
     "timestamp": "2026-04-08T10:00:00Z"
   }
───────────────────────────────────────────────────────────────────── */

/* Tolerance: accept payments within 1% of the invoice total */
const AMOUNT_TOLERANCE_PERCENT = 1;

router.post("/payments/webhook", async (req, res) => {
  /* ── 0. HMAC signature verification ── */
  if (WEBHOOK_SECRET) {
    const sigHeader = req.headers["x-webhook-signature"] as string | undefined;
    if (!sigHeader?.startsWith("sha256=")) {
      return res.status(401).json({ error: "Assinatura de webhook em falta." });
    }
    const provided = sigHeader.slice(7);
    const expected = createHmac("sha256", WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");
    try {
      if (!timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"))) {
        return res.status(401).json({ error: "Assinatura de webhook inválida." });
      }
    } catch {
      return res.status(401).json({ error: "Assinatura de webhook malformada." });
    }
  }

  const { reference, amount_paid, status, transaction_id, payment_method, timestamp } = req.body ?? {};

  /* ── 1. Validate payload ── */
  if (!reference?.trim())      return res.status(400).json({ error: "Campo 'reference' obrigatório." });
  if (!transaction_id?.trim()) return res.status(400).json({ error: "Campo 'transaction_id' obrigatório." });
  if (!amount_paid || Number(amount_paid) <= 0)
    return res.status(400).json({ error: "Campo 'amount_paid' deve ser maior que zero." });
  if (!status)                 return res.status(400).json({ error: "Campo 'status' obrigatório." });

  const paid      = Number(amount_paid);
  const method    = (payment_method ?? "UNKNOWN").toUpperCase();
  const ts        = timestamp ? new Date(timestamp) : new Date();
  const txId      = transaction_id.trim();
  const ref       = reference.trim();

  /* ── 2. Idempotency: reject duplicate transaction_id ── */
  const dupCheck = await pool.query(
    `SELECT id FROM manual_payment_logs WHERE metadata->>'transaction_id' = $1 LIMIT 1`,
    [txId]
  );
  if (dupCheck.rows.length) {
    return res.json({
      ok: true,
      ignored: true,
      reason: "transaction_id já processado. Evento ignorado (idempotência).",
      transaction_id: txId,
    });
  }

  /* ── 3. Locate invoice by internal_reference ── */
  const pRow = await pool.query(`
    SELECT p.*, sc.commission_rate, sc.id AS school_db_id,
           st.nome AS nome_aluno, st.telefone_encarregado, st.nome_encarregado
    FROM propinas p
    JOIN schools sc ON sc.id = p.school_id
    LEFT JOIN students st ON st.id = p.student_id
    WHERE p.internal_reference = $1
  `, [ref]);

  if (!pRow.rows.length) {
    /* Log unmatched webhook for visibility */
    await pool.query(`
      INSERT INTO manual_payment_logs (tipo, admin_user, valor, metodo, payment_ref, metadata)
      VALUES ('webhook_ignorado','gateway_webhook',$1,$2,$3,$4::jsonb)
    `, [
      paid, method,
      `WHK-NOMATCH-${Date.now()}`,
      JSON.stringify({ transaction_id: txId, reference: ref, reason: "Referência não encontrada" }),
    ]);
    return res.status(404).json({ error: "Referência não encontrada.", transaction_id: txId });
  }

  const p     = pRow.rows[0];
  const total = Number(p.montante) + Number(p.multa);

  /* ── 4. If already paid, log and ignore ── */
  if (p.status === "pago") {
    const reason = p.baixa_manual
      ? "Fatura já baixada manualmente — evento online registado no log."
      : "Fatura já marcada como paga online — transaction_id duplicado.";

    await pool.query(`
      INSERT INTO manual_payment_logs (propina_id, tipo, admin_user, valor, metodo, payment_ref, metadata)
      VALUES ($1,'webhook_ignorado','gateway_webhook',$2,$3,$4,$5::jsonb)
    `, [
      p.id, paid, method,
      `WHK-DUP-${Date.now()}`,
      JSON.stringify({ transaction_id: txId, reference: ref, reason }),
    ]);

    return res.json({
      ok: true,
      ignored: true,
      reason,
      transaction_id: txId,
      internal_reference: ref,
    });
  }

  /* ── 5. Validate amount with tolerance ── */
  const minAcceptable = total * (1 - AMOUNT_TOLERANCE_PERCENT / 100);
  if (paid < minAcceptable) {
    const reason = `Valor insuficiente: recebido ${paid} Kz, esperado ${total} Kz (tolerância ${AMOUNT_TOLERANCE_PERCENT}%).`;
    await pool.query(`
      INSERT INTO manual_payment_logs (propina_id, tipo, admin_user, valor, metodo, payment_ref, metadata)
      VALUES ($1,'webhook_ignorado','gateway_webhook',$2,$3,$4,$5::jsonb)
    `, [
      p.id, paid, method,
      `WHK-INSUF-${Date.now()}`,
      JSON.stringify({ transaction_id: txId, reference: ref, reason }),
    ]);
    return res.status(422).json({ error: reason, transaction_id: txId });
  }

  /* ── 6. Update propina: mark paid, save transaction_id & method ── */
  const newStatus = status === "paid" ? "pago" : "pendente";

  await pool.query(`
    UPDATE propinas
    SET status           = $1,
        pago_em          = $2,
        metodo_pagamento = $3,
        pagamento_origem = 'online',
        transaction_id   = $4,
        partially_paid_amount = CASE WHEN $1 = 'pago' THEN 0 ELSE $5 END
    WHERE id = $6
  `, [newStatus, ts, method, txId, paid < total ? paid : 0, p.id]);

  /* Update pagamentos reference */
  await pool.query("UPDATE pagamentos SET estado='PAGO' WHERE propina_id=$1", [p.id]);

  /* ── SMS: pagamento_confirmado ── */
  if (newStatus === "pago" && p.telefone_encarregado) {
    sendEventSMS("pagamento_confirmado", p.school_id, {
      telefone: p.telefone_encarregado,
      nome_encarregado: p.nome_encarregado ?? undefined,
      nome_aluno: p.nome_aluno ?? undefined,
      mes: p.mes,
      valor: paid,
    }).catch(() => {});
  }

  /* ── 6b. Advance linked splitpay_transacoes to CLEARING / SETTLED ── */
  try {
    const splitTx = await pool.query(
      `SELECT id, canal_pagamento, estado FROM splitpay_transacoes
       WHERE propina_id=$1 AND estado IN ('PENDING','CLEARING')
       LIMIT 1`,
      [p.id]
    );
    if (splitTx.rows.length) {
      const stx = splitTx.rows[0];
      /* GPO / MCX_EXPRESS: captura imediata → PENDING→SETTLED; outros: PENDING→CLEARING */
      const nextSplitState =
        stx.estado === "CLEARING" ||
        stx.canal_pagamento === "GPO" ||
        stx.canal_pagamento === "MCX_EXPRESS"
          ? "SETTLED"
          : "CLEARING";
      await pool.query(
        `UPDATE splitpay_transacoes
         SET estado=$1, atualizado_em=NOW(),
             liquidado_em = CASE WHEN $1='SETTLED' THEN NOW() ELSE liquidado_em END,
             tentativas = tentativas + 1
         WHERE id=$2`,
        [nextSplitState, stx.id]
      );
    }
  } catch (ledgerErr) {
    /* Ledger transition failure must NOT block the main webhook response */
    console.error("[webhook:ledger]", ledgerErr);
  }

  /* ── 7. Split payment ── */
  const commissionRate    = Number(p.commission_rate ?? 0);
  const comissaoPlataforma = paid * (commissionRate / 100);
  const valorEscola        = paid - comissaoPlataforma;
  const payRef = `WHK-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;

  await pool.query("DELETE FROM payment_splits WHERE propina_id=$1", [p.id]);
  await pool.query(`
    INSERT INTO payment_splits (propina_id, payment_ref, destino, valor, tipo)
    VALUES ($1,$2,'school',$3,'propina'), ($1,$2,'platform',$4,'comissao')
  `, [p.id, payRef, valorEscola, comissaoPlataforma]);

  /* ── 8. Audit log ── */
  await pool.query(`
    INSERT INTO manual_payment_logs
      (propina_id, tipo, admin_user, valor, metodo, data_recebimento, payment_ref, metadata)
    VALUES ($1,'webhook_processado','gateway_webhook',$2,$3,$4,$5,$6::jsonb)
  `, [
    p.id, paid, method,
    ts.toISOString().slice(0, 10),
    payRef,
    JSON.stringify({
      transaction_id: txId,
      reference:      ref,
      payment_method: method,
      timestamp:      ts.toISOString(),
      split:          { escola: valorEscola, plataforma: comissaoPlataforma },
    }),
  ]);

  return res.json({
    ok:                 true,
    processed:          true,
    transaction_id:     txId,
    internal_reference: ref,
    status:             newStatus,
    valor_pago:         paid,
    total_fatura:       total,
    payment_method:     method,
    payment_ref:        payRef,
    split: {
      escola:        valorEscola,
      plataforma:    comissaoPlataforma,
      comissao_rate: commissionRate,
    },
  });
});

export default router;
