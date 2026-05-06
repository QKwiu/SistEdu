import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

/* ─── Auth middleware (school session) ─── */
async function schoolAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autorizado" });
  const token = auth.slice(7);
  const rows = await db.execute(sql`
    SELECT s.id AS school_id, s.name AS school_name
    FROM sessions sess
    JOIN schools s ON s.id = sess.school_id
    WHERE sess.token = ${token} AND sess.expires_at > now()
    LIMIT 1
  `);
  if (!rows.rows.length) return res.status(401).json({ error: "Sessão inválida" });
  req.schoolId = rows.rows[0].school_id as number;
  req.schoolName = rows.rows[0].school_name as string;
  next();
}

/* ── Migration: ensure tables needed for reports exist ── */
export async function runReportsMigration() {
  await db.execute(sql`
    ALTER TABLE propina_ajustes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
  `);
}

/* ─── GET /school/relatorios/overview ─── */
router.get("/school/relatorios/overview", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;

    const [stats, multas, descontos, bolseiros, smsCount, comunicados] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pago') AS total_pagas,
          COUNT(*) FILTER (WHERE status = 'pendente') AS total_pendentes,
          COUNT(*) FILTER (WHERE status = 'vencido') AS total_vencidas,
          COUNT(*) AS total_geradas,
          COALESCE(SUM(montante) FILTER (WHERE status = 'pago'), 0) AS receita_realizada,
          COALESCE(SUM(montante + COALESCE(multa,0)) FILTER (WHERE status IN ('pendente','vencido')), 0) AS receita_pendente,
          COALESCE(SUM(montante + COALESCE(multa,0)), 0) AS receita_prevista
        FROM propinas WHERE school_id = ${sid}
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(multa),0) AS total_multas_geradas,
               COALESCE(SUM(multa) FILTER (WHERE status='pago'),0) AS total_multas_cobradas
        FROM propinas WHERE school_id=${sid}
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(desconto),0) AS total_descontos
        FROM propinas WHERE school_id=${sid}
      `),
      db.execute(sql`
        SELECT COUNT(DISTINCT ba.student_id) AS total_bolseiros
        FROM bolsa_atribuicoes ba
        JOIN students st ON st.id = ba.student_id
        WHERE st.school_id=${sid} AND ba.estado='activa'
      `),
      db.execute(sql`
        SELECT COUNT(*) AS total_sms FROM sms_logs WHERE school_id=${sid}
      `),
      db.execute(sql`
        SELECT COUNT(*) AS total_comunicados FROM comunicados WHERE escola_id=${sid}
      `),
    ]);

    const st = stats.rows[0] as any;
    const m = multas.rows[0] as any;
    const d = descontos.rows[0] as any;
    const b = bolseiros.rows[0] as any;
    const sms = smsCount.rows[0] as any;
    const com = comunicados.rows[0] as any;

    const totalGeradas = Number(st.total_geradas) || 0;
    const totalVencidas = Number(st.total_vencidas) || 0;

    res.json({
      total_pagas: Number(st.total_pagas),
      total_pendentes: Number(st.total_pendentes),
      total_vencidas: totalVencidas,
      total_geradas: totalGeradas,
      receita_realizada: Number(st.receita_realizada),
      receita_pendente: Number(st.receita_pendente),
      receita_prevista: Number(st.receita_prevista),
      inadimplencia_pct: totalGeradas > 0 ? Math.round((totalVencidas / totalGeradas) * 100) : 0,
      total_multas_geradas: Number(m.total_multas_geradas),
      total_multas_cobradas: Number(m.total_multas_cobradas),
      total_descontos_bolsas: Number(d.total_descontos),
      total_bolseiros: Number(b.total_bolseiros),
      total_sms: Number(sms.total_sms),
      total_comunicados: Number(com.total_comunicados),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /school/relatorios/receita-mensal ─── */
router.get("/school/relatorios/receita-mensal", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const rows = await db.execute(sql`
      SELECT
        mes, ano,
        COALESCE(SUM(montante),0) AS previsto,
        COALESCE(SUM(montante) FILTER (WHERE status='pago'),0) AS realizado,
        COALESCE(SUM(multa) FILTER (WHERE status='pago'),0) AS multas_cobradas,
        COALESCE(SUM(desconto),0) AS descontos,
        COUNT(*) AS total_propinas,
        COUNT(*) FILTER (WHERE status='pago') AS pagas
      FROM propinas
      WHERE school_id = ${sid}
      GROUP BY mes, ano
      ORDER BY
        CASE ano WHEN '2025' THEN 1 WHEN '2026' THEN 2 WHEN '2027' THEN 3 ELSE 4 END,
        CASE mes
          WHEN 'Janeiro' THEN 1 WHEN 'Fevereiro' THEN 2 WHEN 'Março' THEN 3
          WHEN 'Abril' THEN 4 WHEN 'Maio' THEN 5 WHEN 'Junho' THEN 6
          WHEN 'Julho' THEN 7 WHEN 'Agosto' THEN 8 WHEN 'Setembro' THEN 9
          WHEN 'Outubro' THEN 10 WHEN 'Novembro' THEN 11 WHEN 'Dezembro' THEN 12
          ELSE 13 END
    `);
    res.json(rows.rows.map((r: any) => ({
      mes: r.mes,
      ano: r.ano,
      label: `${r.mes.slice(0,3)} ${r.ano}`,
      previsto: Number(r.previsto),
      realizado: Number(r.realizado),
      multas_cobradas: Number(r.multas_cobradas),
      descontos: Number(r.descontos),
      total_propinas: Number(r.total_propinas),
      pagas: Number(r.pagas),
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /school/relatorios/funil-pagamentos ─── */
router.get("/school/relatorios/funil-pagamentos", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const rows = await db.execute(sql`
      SELECT
        COUNT(*) AS total_geradas,
        COUNT(*) FILTER (WHERE referencia IS NOT NULL OR transaction_id IS NOT NULL) AS com_referencia,
        COUNT(*) FILTER (WHERE status='pago') AS liquidadas,
        COUNT(*) FILTER (WHERE status='vencido') AS vencidas,
        COUNT(*) FILTER (WHERE status='pendente') AS pendentes,
        COUNT(*) FILTER (WHERE baixa_manual=true) AS baixas_manuais,
        COUNT(*) FILTER (WHERE pagamento_origem='online') AS pagamentos_online
      FROM propinas WHERE school_id=${sid}
    `);
    res.json(rows.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /school/relatorios/inadimplencia-turma ─── */
router.get("/school/relatorios/inadimplencia-turma", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const rows = await db.execute(sql`
      SELECT
        COALESCE(t.nome, 'Sem Turma') AS turma,
        COUNT(DISTINCT p.student_id) AS total_alunos,
        COUNT(DISTINCT p.student_id) FILTER (WHERE p.status='vencido') AS alunos_inadimplentes,
        COUNT(*) FILTER (WHERE p.status='vencido') AS propinas_vencidas,
        COALESCE(SUM(p.montante + COALESCE(p.multa,0)) FILTER (WHERE p.status='vencido'),0) AS valor_divida,
        COALESCE(SUM(p.montante) FILTER (WHERE p.status='pago'),0) AS receita_realizada
      FROM propinas p
      JOIN students st ON st.id = p.student_id
      LEFT JOIN turmas t ON t.id = st.turma_id
      WHERE p.school_id=${sid}
      GROUP BY t.nome
      ORDER BY valor_divida DESC
    `);
    res.json(rows.rows.map((r: any) => ({
      turma: r.turma,
      total_alunos: Number(r.total_alunos),
      alunos_inadimplentes: Number(r.alunos_inadimplentes),
      propinas_vencidas: Number(r.propinas_vencidas),
      valor_divida: Number(r.valor_divida),
      receita_realizada: Number(r.receita_realizada),
      pct_inadimplencia: Number(r.total_alunos) > 0
        ? Math.round((Number(r.alunos_inadimplentes) / Number(r.total_alunos)) * 100)
        : 0,
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /school/relatorios/demografico ─── */
router.get("/school/relatorios/demografico", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const [sexo, turno, turmaStats, estado] = await Promise.all([
      db.execute(sql`
        SELECT COALESCE(NULLIF(sexo,''), 'Não indicado') AS sexo, COUNT(*) AS total
        FROM students WHERE school_id=${sid} GROUP BY sexo
      `),
      db.execute(sql`
        SELECT COALESCE(t.turno,'Não definido') AS turno, COUNT(st.id) AS total
        FROM students st
        LEFT JOIN turmas t ON t.id = st.turma_id
        WHERE st.school_id=${sid} GROUP BY t.turno
      `),
      db.execute(sql`
        SELECT COALESCE(t.nome,'Sem Turma') AS turma, COUNT(st.id) AS total,
               COUNT(st.id) FILTER (WHERE st.estado='activo') AS activos
        FROM students st
        LEFT JOIN turmas t ON t.id = st.turma_id
        WHERE st.school_id=${sid} GROUP BY t.nome ORDER BY total DESC
      `),
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE estado='activo') AS activos,
          COUNT(*) FILTER (WHERE estado='inactivo' OR estado='transferido') AS inactivos,
          COUNT(*) AS total
        FROM students WHERE school_id=${sid}
      `),
    ]);
    res.json({
      por_sexo: sexo.rows.map((r: any) => ({ sexo: r.sexo, total: Number(r.total) })),
      por_turno: turno.rows.map((r: any) => ({ turno: r.turno, total: Number(r.total) })),
      por_turma: turmaStats.rows.map((r: any) => ({ turma: r.turma, total: Number(r.total), activos: Number(r.activos) })),
      estado: {
        activos: Number((estado.rows[0] as any).activos),
        inactivos: Number((estado.rows[0] as any).inactivos),
        total: Number((estado.rows[0] as any).total),
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /school/relatorios/bolsas-multas ─── */
router.get("/school/relatorios/bolsas-multas", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const [bolsas, multas, tiposBolsa] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(DISTINCT ba.student_id) AS total_bolseiros,
          COALESCE(SUM(p.desconto),0) AS total_desconto_aplicado,
          COUNT(ba.id) AS total_atribuicoes,
          COUNT(ba.id) FILTER (WHERE ba.estado='activa') AS atribuicoes_activas,
          COUNT(ba.id) FILTER (WHERE ba.estado='revogada') AS atribuicoes_revogadas
        FROM bolsa_atribuicoes ba
        JOIN students st ON st.id=ba.student_id
        LEFT JOIN propinas p ON p.bolsa_atribuicao_id=ba.id
        WHERE st.school_id=${sid}
      `),
      db.execute(sql`
        SELECT
          COALESCE(SUM(multa),0) AS total_multas_geradas,
          COALESCE(SUM(multa) FILTER (WHERE status='pago'),0) AS multas_cobradas,
          COALESCE(SUM(multa) FILTER (WHERE status IN ('pendente','vencido')),0) AS multas_pendentes,
          COUNT(*) FILTER (WHERE multa > 0) AS propinas_com_multa
        FROM propinas WHERE school_id=${sid}
      `),
      db.execute(sql`
        SELECT bt.nome, bt.tipo_desconto, bt.valor, bt.abrangencia,
               COUNT(ba.id) AS atribuicoes,
               COUNT(ba.id) FILTER (WHERE ba.estado='activa') AS activas
        FROM bolsa_tipos bt
        LEFT JOIN bolsa_atribuicoes ba ON ba.bolsa_tipo_id=bt.id
        WHERE bt.school_id=${sid}
        GROUP BY bt.id, bt.nome, bt.tipo_desconto, bt.valor, bt.abrangencia
        ORDER BY activas DESC
      `),
    ]);
    const b = bolsas.rows[0] as any;
    const m = multas.rows[0] as any;
    res.json({
      bolsas: {
        total_bolseiros: Number(b.total_bolseiros),
        total_desconto_aplicado: Number(b.total_desconto_aplicado),
        total_atribuicoes: Number(b.total_atribuicoes),
        atribuicoes_activas: Number(b.atribuicoes_activas),
        atribuicoes_revogadas: Number(b.atribuicoes_revogadas),
      },
      multas: {
        total_geradas: Number(m.total_multas_geradas),
        cobradas: Number(m.multas_cobradas),
        pendentes: Number(m.multas_pendentes),
        propinas_com_multa: Number(m.propinas_com_multa),
      },
      tipos_bolsa: tiposBolsa.rows.map((r: any) => ({
        nome: r.nome,
        tipo_desconto: r.tipo_desconto,
        valor: Number(r.valor),
        abrangencia: r.abrangencia,
        atribuicoes: Number(r.atribuicoes),
        activas: Number(r.activas),
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /school/relatorios/audit-log ─── */
router.get("/school/relatorios/audit-log", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const tipo = req.query.tipo as string | undefined;

    const whereExtra = tipo ? sql` AND pa.tipo = ${tipo}` : sql``;

    const rows = await db.execute(sql`
      SELECT
        pa.id,
        'ajuste' AS origem,
        pa.tipo,
        pa.motivo AS descricao,
        pa.created_by AS utilizador,
        pa.created_at,
        p.mes || ' ' || p.ano AS propina_label,
        st.nome AS aluno_nome,
        pa.multa_anterior, pa.multa_nova,
        pa.valor_anterior, pa.valor_novo,
        pa.nova_data_vencimento
      FROM propina_ajustes pa
      JOIN propinas p ON p.id = pa.propina_id
      JOIN students st ON st.id = p.student_id
      WHERE p.school_id = ${sid} ${whereExtra}
      ORDER BY pa.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const total = await db.execute(sql`
      SELECT COUNT(*) AS total
      FROM propina_ajustes pa
      JOIN propinas p ON p.id = pa.propina_id
      WHERE p.school_id = ${sid}
    `);

    res.json({
      rows: rows.rows,
      total: Number((total.rows[0] as any).total),
      limit,
      offset,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /school/relatorios/comunicacoes ─── */
router.get("/school/relatorios/comunicacoes", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const [smsByEvento, smsByStatus, recentSms, comunicados] = await Promise.all([
      db.execute(sql`
        SELECT COALESCE(evento,'outro') AS evento, COUNT(*) AS total
        FROM sms_logs WHERE school_id=${sid} GROUP BY evento ORDER BY total DESC
      `),
      db.execute(sql`
        SELECT status, COUNT(*) AS total FROM sms_logs WHERE school_id=${sid} GROUP BY status
      `),
      db.execute(sql`
        SELECT id, telefone, mensagem, status, evento, data_envio
        FROM sms_logs WHERE school_id=${sid}
        ORDER BY data_envio DESC LIMIT 20
      `),
      db.execute(sql`
        SELECT c.id, c.titulo, c.prioridade, c.created_at,
               COUNT(cl.comunicado_id) AS leituras
        FROM comunicados c
        LEFT JOIN comunicados_lidos cl ON cl.comunicado_id=c.id
        WHERE c.escola_id=${sid}
        GROUP BY c.id ORDER BY c.created_at DESC LIMIT 20
      `),
    ]);
    res.json({
      sms_por_evento: smsByEvento.rows,
      sms_por_status: smsByStatus.rows,
      sms_recentes: recentSms.rows,
      comunicados_recentes: comunicados.rows,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /school/relatorios/bolseiros ─── */
router.get("/school/relatorios/bolseiros", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const rows = await db.execute(sql`
      SELECT
        st.id AS student_id,
        st.nome AS aluno_nome,
        st.numero_processo,
        COALESCE(t.nome,'Sem Turma') AS turma,
        bt.nome AS bolsa_nome,
        bt.tipo_desconto,
        bt.valor AS desconto_valor,
        ba.data_inicio,
        ba.data_fim,
        ba.estado,
        COALESCE(SUM(p.desconto),0) AS total_desconto_aplicado
      FROM bolsa_atribuicoes ba
      JOIN students st ON st.id=ba.student_id
      JOIN bolsa_tipos bt ON bt.id=ba.bolsa_tipo_id
      LEFT JOIN turmas t ON t.id=st.turma_id
      LEFT JOIN propinas p ON p.bolsa_atribuicao_id=ba.id
      WHERE st.school_id=${sid}
      GROUP BY st.id, st.nome, st.numero_processo, t.nome, bt.nome, bt.tipo_desconto, bt.valor, ba.data_inicio, ba.data_fim, ba.estado
      ORDER BY ba.estado, st.nome
    `);
    res.json(rows.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /school/relatorios/export/alunos ─── (CSV) ─── */
router.get("/school/relatorios/export/alunos", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const rows = await db.execute(sql`
      SELECT
        st.numero_processo AS "Nº Processo",
        st.nome AS "Nome",
        st.bilhete AS "Bilhete de Identidade",
        COALESCE(st.sexo,'') AS "Sexo",
        COALESCE(TO_CHAR(st.data_nascimento,'DD/MM/YYYY'),'') AS "Data de Nascimento",
        COALESCE(t.nome,'Sem Turma') AS "Turma",
        COALESCE(t.turno,'') AS "Turno",
        st.estado AS "Estado",
        COALESCE(st.nome_encarregado,'') AS "Encarregado",
        COALESCE(st.telefone_encarregado,'') AS "Tel. Encarregado",
        TO_CHAR(st.created_at,'DD/MM/YYYY') AS "Data Matrícula"
      FROM students st
      LEFT JOIN turmas t ON t.id=st.turma_id
      WHERE st.school_id=${sid}
      ORDER BY t.nome NULLS LAST, st.nome
    `);
    const headers = Object.keys(rows.rows[0] || {});
    const csv = [
      headers.join(","),
      ...rows.rows.map((r: any) =>
        headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=alunos.csv");
    res.send("\uFEFF" + csv);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /school/relatorios/export/propinas ─── (CSV) ─── */
router.get("/school/relatorios/export/propinas", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;
    const status = req.query.status as string | undefined;
    const whereStatus = status ? sql` AND p.status = ${status}` : sql``;

    const rows = await db.execute(sql`
      SELECT
        st.numero_processo AS "Nº Processo",
        st.nome AS "Aluno",
        COALESCE(t.nome,'Sem Turma') AS "Turma",
        p.mes AS "Mês",
        p.ano AS "Ano",
        p.montante AS "Valor Base (AOA)",
        COALESCE(p.multa,0) AS "Multa (AOA)",
        COALESCE(p.desconto,0) AS "Desconto (AOA)",
        (p.montante + COALESCE(p.multa,0) - COALESCE(p.desconto,0)) AS "Total (AOA)",
        UPPER(p.status) AS "Estado",
        COALESCE(TO_CHAR(p.data_vencimento,'DD/MM/YYYY'),'') AS "Data Vencimento",
        COALESCE(TO_CHAR(p.pago_em,'DD/MM/YYYY'),'') AS "Data Pagamento",
        COALESCE(p.metodo_pagamento,'') AS "Método",
        COALESCE(p.referencia,'') AS "Referência",
        COALESCE(p.internal_reference,'') AS "Ref. Interna"
      FROM propinas p
      JOIN students st ON st.id=p.student_id
      LEFT JOIN turmas t ON t.id=st.turma_id
      WHERE p.school_id=${sid} ${whereStatus}
      ORDER BY t.nome NULLS LAST, st.nome, p.ano, 
        CASE p.mes
          WHEN 'Janeiro' THEN 1 WHEN 'Fevereiro' THEN 2 WHEN 'Março' THEN 3
          WHEN 'Abril' THEN 4 WHEN 'Maio' THEN 5 WHEN 'Junho' THEN 6
          WHEN 'Julho' THEN 7 WHEN 'Agosto' THEN 8 WHEN 'Setembro' THEN 9
          WHEN 'Outubro' THEN 10 WHEN 'Novembro' THEN 11 WHEN 'Dezembro' THEN 12
          ELSE 13 END
    `);
    const headers = Object.keys(rows.rows[0] || {});
    const csv = [
      headers.join(","),
      ...rows.rows.map((r: any) =>
        headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=propinas.csv");
    res.send("\uFEFF" + csv);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── Multa calculation helper (mirrors applyFinesForSchool logic) ─── */
function calcMultaParaPropina(
  montante: number,
  dataVencimento: Date,
  regra: any
): number {
  if (!regra) return 0;
  const now = new Date();
  const today = now.getDate();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();

  const isPreviousMonth =
    dataVencimento.getFullYear() < thisYear ||
    (dataVencimento.getFullYear() === thisYear && dataVencimento.getMonth() < thisMonth);

  const isOverdue = dataVencimento < now;
  if (!isOverdue) return 0;

  const modelo = Number(regra.modelo ?? 1);
  let multa = 0;

  if (modelo === 1) {
    if (isPreviousMonth || today > Number(regra.dia_limite)) {
      multa = montante * (Number(regra.percentagem) / 100);
    }
  } else if (modelo === 2) {
    const brackets = Array.isArray(regra.brackets) ? regra.brackets : [];
    if (isPreviousMonth && brackets.length > 0) {
      multa = montante * (Number(brackets[brackets.length - 1].percentagem) / 100);
    } else {
      for (const b of brackets) {
        if (today >= Number(b.dia_inicio) && today <= Number(b.dia_fim)) {
          multa = montante * (Number(b.percentagem) / 100);
          break;
        }
      }
      if (multa === 0 && brackets.length > 0 && today > Number(brackets[brackets.length - 1].dia_fim)) {
        multa = montante * (Number(brackets[brackets.length - 1].percentagem) / 100);
      }
    }
  } else if (modelo === 3) {
    if (isPreviousMonth || today > Number(regra.dia_limite)) {
      multa = Number(regra.valor_fixo);
    }
  }

  return multa;
}

/* ─── GET /school/relatorios/multas-analise ─── */
router.get("/school/relatorios/multas-analise", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;

    const [propinasRes, regraRes] = await Promise.all([
      db.execute(sql`
        SELECT
          p.id, p.mes, p.ano, p.montante, COALESCE(p.multa, 0) AS multa_actual,
          p.status, p.data_vencimento,
          st.nome AS aluno_nome, st.id AS student_id,
          COALESCE(t.nome, 'Sem Turma') AS turma,
          EXTRACT(DAY FROM now() - p.data_vencimento)::int AS dias_atraso
        FROM propinas p
        JOIN students st ON st.id = p.student_id
        LEFT JOIN turmas t ON t.id = st.turma_id
        WHERE p.school_id = ${sid}
          AND p.status IN ('vencido', 'pendente')
          AND p.data_vencimento < now()
        ORDER BY p.data_vencimento ASC
      `),
      db.execute(sql`
        SELECT * FROM multa_regras WHERE school_id = ${sid} LIMIT 1
      `),
    ]);

    const regra = regraRes.rows[0] ?? null;
    const propinas = propinasRes.rows as any[];

    let totalMultaAplicada = 0;
    let totalMultaCalculada = 0;
    let totalDelta = 0;
    let countSemMulta = 0;
    let countMultaErrada = 0;
    let countCorretas = 0;

    const detalhes = propinas.map((p: any) => {
      const montante = Number(p.montante);
      const multaActual = Number(p.multa_actual);
      const dataVenc = new Date(p.data_vencimento);
      const multaCalculada = calcMultaParaPropina(montante, dataVenc, regra);
      const delta = multaCalculada - multaActual;

      totalMultaAplicada += multaActual;
      totalMultaCalculada += multaCalculada;
      totalDelta += delta;

      let estadoMulta: "correcta" | "sem_multa" | "incorrecta" | "sem_regra";
      if (!regra) {
        estadoMulta = "sem_regra";
      } else if (multaCalculada === 0 && multaActual === 0) {
        estadoMulta = "correcta";
        countCorretas++;
      } else if (multaActual === 0 && multaCalculada > 0) {
        estadoMulta = "sem_multa";
        countSemMulta++;
      } else if (Math.abs(delta) > 0.01) {
        estadoMulta = "incorrecta";
        countMultaErrada++;
      } else {
        estadoMulta = "correcta";
        countCorretas++;
      }

      return {
        id: p.id,
        aluno_nome: p.aluno_nome,
        turma: p.turma,
        mes: p.mes,
        ano: p.ano,
        montante,
        multa_actual: multaActual,
        multa_calculada: multaCalculada,
        delta,
        dias_atraso: Number(p.dias_atraso),
        status: p.status,
        estado_multa: estadoMulta,
      };
    });

    const regraInfo = regra ? {
      modelo: Number(regra.modelo),
      tipo_calculo: regra.tipo_calculo,
      dia_limite: Number(regra.dia_limite),
      valor_fixo: Number(regra.valor_fixo ?? 0),
      percentagem: Number(regra.percentagem ?? 0),
      aplica_automatico: regra.aplica_automatico,
      brackets: regra.brackets ?? [],
    } : null;

    res.json({
      resumo: {
        total_vencidas: propinas.length,
        total_multa_aplicada: totalMultaAplicada,
        total_multa_calculada: totalMultaCalculada,
        total_delta: totalDelta,
        count_sem_multa: countSemMulta,
        count_multa_incorrecta: countMultaErrada,
        count_correctas: countCorretas,
        tem_regra: !!regra,
        aplica_automatico: regra?.aplica_automatico ?? false,
      },
      regra: regraInfo,
      propinas: detalhes,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── POST /school/relatorios/multas-aplicar ─── */
router.post("/school/relatorios/multas-aplicar", schoolAuth, async (req: any, res) => {
  try {
    const sid = req.schoolId;

    const [propinasRes, regraRes] = await Promise.all([
      db.execute(sql`
        SELECT
          p.id, p.montante, COALESCE(p.multa, 0) AS multa_actual,
          p.status, p.data_vencimento, p.mes, p.ano
        FROM propinas p
        WHERE p.school_id = ${sid}
          AND p.status IN ('vencido', 'pendente')
          AND p.data_vencimento < now()
      `),
      db.execute(sql`SELECT * FROM multa_regras WHERE school_id = ${sid} LIMIT 1`),
    ]);

    const regra = regraRes.rows[0] ?? null;
    if (!regra) {
      return res.status(400).json({ error: "Nenhuma regra de multa configurada para esta escola" });
    }

    const propinas = propinasRes.rows as any[];
    let actualizadas = 0;
    let sem_alteracao = 0;

    for (const p of propinas) {
      const montante = Number(p.montante);
      const multaActual = Number(p.multa_actual);
      const dataVenc = new Date(p.data_vencimento);
      const multaCalculada = calcMultaParaPropina(montante, dataVenc, regra);

      const novoStatus = "vencido";
      const mudouMulta = Math.abs(multaCalculada - multaActual) > 0.01;
      const mudouStatus = p.status !== novoStatus;

      if (mudouMulta || mudouStatus) {
        await db.execute(sql`
          UPDATE propinas
          SET multa = ${multaCalculada}, status = ${novoStatus}
          WHERE id = ${p.id} AND school_id = ${sid}
        `);

        if (mudouMulta) {
          await db.execute(sql`
            INSERT INTO propina_ajustes
              (propina_id, tipo, multa_anterior, multa_nova, motivo, created_by, created_at)
            VALUES
              (${p.id}, 'ajuste_valor', ${multaActual}, ${multaCalculada},
               ${'Rectificação automática via relatório — regra: ' + regra.tipo_calculo},
               'sistema', now())
          `);
        }
        actualizadas++;
      } else {
        sem_alteracao++;
      }
    }

    res.json({
      ok: true,
      actualizadas,
      sem_alteracao,
      total_processadas: propinas.length,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

