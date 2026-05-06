import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
  FunnelChart, Funnel, LabelList,
} from "recharts";
import {
  TrendingUp, TrendingDown, Users, FileText, AlertTriangle,
  CheckCircle2, Download, RefreshCw, BarChart3, PieChart as PieIcon,
  BookOpen, Shield, MessageSquare, BadgePercent, ArrowDownToLine,
  Banknote, Calendar, Filter, ChevronDown, Zap, Scale, Info,
  XCircle,
} from "lucide-react";

const API = "/api";
const MESES_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const AOA = (v: number) =>
  new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(v);

const PCT = (v: number) => `${v}%`;

const CHART_COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#84cc16"];

/* ── Shared KPI Card ── */
function KpiCard({ label, value, sub, icon: Icon, color = "primary", trend }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color?: string; trend?: "up"|"down"|"neutral";
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-indigo-50 text-indigo-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    violet: "bg-violet-50 text-violet-600",
    cyan: "bg-cyan-50 text-cyan-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-3 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[color] ?? colorMap.primary}`}>
        <Icon className="w-5 h-5"/>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium truncate">{label}</p>
        <p className="text-lg font-bold text-slate-900 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {trend && (
        <div className="ml-auto flex-shrink-0">
          {trend === "up" && <TrendingUp className="w-4 h-4 text-emerald-500"/>}
          {trend === "down" && <TrendingDown className="w-4 h-4 text-red-500"/>}
        </div>
      )}
    </div>
  );
}

/* ── Section Header ── */
function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Custom Tooltip ── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {typeof p.value === "number" && p.value > 999 ? AOA(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   TAB: FINANCEIRO
═══════════════════════════════════════════ */
function FinanceiroTab({ token }: { token: string }) {
  const [overview, setOverview] = useState<any>(null);
  const [receita, setReceita] = useState<any[]>([]);
  const [funil, setFunil] = useState<any>(null);
  const [inadimplencia, setInadimplencia] = useState<any[]>([]);
  const [multasAnalise, setMultasAnalise] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aplicandoMultas, setAplicandoMultas] = useState(false);
  const [aplicarResult, setAplicarResult] = useState<any>(null);
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, rc, fn, in_, ma] = await Promise.all([
        fetch(`${API}/school/relatorios/overview`, { headers }).then(r => r.json()),
        fetch(`${API}/school/relatorios/receita-mensal`, { headers }).then(r => r.json()),
        fetch(`${API}/school/relatorios/funil-pagamentos`, { headers }).then(r => r.json()),
        fetch(`${API}/school/relatorios/inadimplencia-turma`, { headers }).then(r => r.json()),
        fetch(`${API}/school/relatorios/multas-analise`, { headers }).then(r => r.json()),
      ]);
      setOverview(ov); setReceita(rc); setFunil(fn); setInadimplencia(in_); setMultasAnalise(ma);
    } catch {}
    setLoading(false);
  }, [token]);

  const aplicarMultas = async () => {
    setAplicandoMultas(true);
    setAplicarResult(null);
    try {
      const res = await fetch(`${API}/school/relatorios/multas-aplicar`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
      });
      const data = await res.json();
      setAplicarResult(data);
      await load();
    } catch {
      setAplicarResult({ error: "Erro de comunicação com o servidor" });
    }
    setAplicandoMultas(false);
  };

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-5 h-5 animate-spin text-indigo-500"/></div>;

  const funilData = funil ? [
    { name: "Propinas Geradas", value: Number(funil.total_geradas), fill: "#6366f1" },
    { name: "Com Referência/GPO", value: Number(funil.com_referencia), fill: "#8b5cf6" },
    { name: "Liquidadas", value: Number(funil.liquidadas), fill: "#10b981" },
  ] : [];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Receita Realizada" value={AOA(overview?.receita_realizada ?? 0)} sub={`${overview?.total_pagas ?? 0} propinas pagas`} icon={CheckCircle2} color="green" trend="up"/>
        <KpiCard label="Receita Pendente" value={AOA(overview?.receita_pendente ?? 0)} sub={`${(overview?.total_pendentes ?? 0) + (overview?.total_vencidas ?? 0)} em aberto`} icon={Clock} color="amber"/>
        <KpiCard label="Taxa de Inadimplência" value={PCT(overview?.inadimplencia_pct ?? 0)} sub={`${overview?.total_vencidas ?? 0} propinas vencidas`} icon={AlertTriangle} color={overview?.inadimplencia_pct > 20 ? "red" : "amber"} trend={overview?.inadimplencia_pct > 20 ? "down" : "neutral"}/>
        <KpiCard label="Multas Cobradas" value={AOA(overview?.total_multas_cobradas ?? 0)} sub={`de ${AOA(overview?.total_multas_geradas ?? 0)} geradas`} icon={Banknote} color="violet"/>
      </div>

      {/* Gráfico Receita Mensal */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <SectionTitle title="Receita Prevista vs. Realizada" sub="Comparativo mensal (valores em AOA)"/>
        {receita.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">Sem dados de propinas registadas</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={receita} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={44}/>
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}/>
              <Tooltip content={<ChartTooltip/>}/>
              <Legend wrapperStyle={{ fontSize: 11 }}/>
              <Bar dataKey="previsto" name="Previsto" fill="#e0e7ff" radius={[4,4,0,0]}/>
              <Bar dataKey="realizado" name="Realizado" fill="#6366f1" radius={[4,4,0,0]}/>
              <Bar dataKey="multas_cobradas" name="Multas" fill="#f59e0b" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funil */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <SectionTitle title="Funil de Conversão de Pagamentos"/>
          <div className="space-y-2">
            {funilData.map((item, i) => {
              const max = funilData[0]?.value || 1;
              const pct = Math.round((item.value / max) * 100);
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">{item.name}</span>
                    <span className="text-slate-900 font-bold">{item.value}</span>
                  </div>
                  <div className="h-5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: item.fill }}
                    />
                  </div>
                  <p className="text-right text-xs text-slate-400 mt-0.5">{pct}%</p>
                </div>
              );
            })}
            <div className="pt-2 border-t border-slate-100 flex gap-4 text-xs">
              <span className="text-slate-500">Manual: <strong className="text-slate-700">{funil?.baixas_manuais ?? 0}</strong></span>
              <span className="text-slate-500">Online: <strong className="text-slate-700">{funil?.pagamentos_online ?? 0}</strong></span>
              <span className="text-slate-500">Pendentes: <strong className="text-amber-600">{funil?.pendentes ?? 0}</strong></span>
              <span className="text-slate-500">Vencidas: <strong className="text-red-500">{funil?.vencidas ?? 0}</strong></span>
            </div>
          </div>
        </div>

        {/* Inadimplência por Turma */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <SectionTitle title="Inadimplência por Turma"/>
          {inadimplencia.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">Sem dados</p>
          ) : (
            <div className="overflow-auto max-h-56">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-1.5 text-slate-500 font-medium">Turma</th>
                    <th className="text-right py-1.5 text-slate-500 font-medium">Alunos</th>
                    <th className="text-right py-1.5 text-slate-500 font-medium">Em Dívida</th>
                    <th className="text-right py-1.5 text-slate-500 font-medium">Valor Dívida</th>
                    <th className="text-right py-1.5 text-slate-500 font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {inadimplencia.map((row, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-1.5 font-medium text-slate-700">{row.turma}</td>
                      <td className="text-right text-slate-500">{row.total_alunos}</td>
                      <td className="text-right">
                        <span className={row.alunos_inadimplentes > 0 ? "text-red-500 font-semibold" : "text-slate-500"}>
                          {row.alunos_inadimplentes}
                        </span>
                      </td>
                      <td className="text-right text-slate-700">{AOA(row.valor_divida)}</td>
                      <td className="text-right">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          row.pct_inadimplencia > 30 ? "bg-red-100 text-red-600" :
                          row.pct_inadimplencia > 10 ? "bg-amber-100 text-amber-600" :
                          "bg-emerald-100 text-emerald-600"
                        }`}>{row.pct_inadimplencia}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Análise e Equacionamento de Multas ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-600"/>
            <div>
              <p className="text-sm font-semibold text-slate-800">Análise e Equacionamento de Multas</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Simulação das multas devidas com base na regra configurada — compara valores aplicados vs. calculados
              </p>
            </div>
          </div>
          <button
            onClick={aplicarMultas}
            disabled={aplicandoMultas || !multasAnalise?.resumo?.tem_regra || (multasAnalise?.resumo?.total_delta ?? 0) === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap"
          >
            {aplicandoMultas ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin"/> A aplicar...</>
            ) : (
              <><Zap className="w-3.5 h-3.5"/> Rectificar Multas</>
            )}
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Regra configurada */}
          {multasAnalise?.regra ? (
            <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <Info className="w-3.5 h-3.5 text-indigo-500 mt-0.5 flex-shrink-0"/>
              <p className="text-xs text-slate-600">
                <strong className="text-slate-800">Regra activa:</strong>{" "}
                {multasAnalise.regra.tipo_calculo === "fixa"
                  ? `Multa fixa de ${AOA(multasAnalise.regra.valor_fixo)} por propina vencida após o dia ${multasAnalise.regra.dia_limite}`
                  : multasAnalise.regra.tipo_calculo === "percentual"
                  ? `${multasAnalise.regra.percentagem}% do valor da propina após o dia ${multasAnalise.regra.dia_limite}`
                  : `Modelo ${multasAnalise.regra.modelo} — escalonado por dias de atraso`}
                {" · "}
                <span className={multasAnalise.regra.aplica_automatico ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                  {multasAnalise.regra.aplica_automatico ? "Aplicação automática activa" : "Aplicação manual (automático desactivado)"}
                </span>
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0"/>
              <p className="text-xs text-red-700 font-medium">Nenhuma regra de multa configurada. Configure em Definições → Regras de Multa.</p>
            </div>
          )}

          {/* KPIs de multas */}
          {multasAnalise?.resumo && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <p className="text-[10px] text-slate-500 font-medium">Propinas em Atraso</p>
                <p className="text-xl font-bold text-slate-800">{multasAnalise.resumo.total_vencidas}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">vencidas ou pendentes</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <p className="text-[10px] text-amber-600 font-medium">Multas Aplicadas (BD)</p>
                <p className="text-xl font-bold text-amber-800">{AOA(multasAnalise.resumo.total_multa_aplicada)}</p>
                <p className="text-[10px] text-amber-500 mt-0.5">valor actual no sistema</p>
              </div>
              <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-200">
                <p className="text-[10px] text-indigo-600 font-medium">Multas Calculadas (Regra)</p>
                <p className="text-xl font-bold text-indigo-800">{AOA(multasAnalise.resumo.total_multa_calculada)}</p>
                <p className="text-[10px] text-indigo-500 mt-0.5">conforme regra vigente</p>
              </div>
              <div className={`rounded-xl p-3 border ${
                (multasAnalise.resumo.total_delta ?? 0) > 0
                  ? "bg-red-50 border-red-200"
                  : "bg-emerald-50 border-emerald-200"
              }`}>
                <p className={`text-[10px] font-medium ${(multasAnalise.resumo.total_delta ?? 0) > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  Diferença (Delta)
                </p>
                <p className={`text-xl font-bold ${(multasAnalise.resumo.total_delta ?? 0) > 0 ? "text-red-800" : "text-emerald-800"}`}>
                  {(multasAnalise.resumo.total_delta ?? 0) >= 0 ? "+" : ""}{AOA(multasAnalise.resumo.total_delta ?? 0)}
                </p>
                <p className={`text-[10px] mt-0.5 ${(multasAnalise.resumo.total_delta ?? 0) > 0 ? "text-red-500" : "text-emerald-500"}`}>
                  {(multasAnalise.resumo.total_delta ?? 0) > 0 ? "valores em falta no sistema" : "sistema actualizado"}
                </p>
              </div>
            </div>
          )}

          {/* Badges de estado */}
          {multasAnalise?.resumo && (
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold">
                <CheckCircle2 className="w-3 h-3"/> {multasAnalise.resumo.count_correctas} correctas
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold">
                <XCircle className="w-3 h-3"/> {multasAnalise.resumo.count_sem_multa} sem multa aplicada
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold">
                <AlertTriangle className="w-3 h-3"/> {multasAnalise.resumo.count_multa_incorrecta} com valor incorrecto
              </span>
            </div>
          )}

          {/* Resultado da aplicação */}
          {aplicarResult && (
            <div className={`flex items-start gap-2 rounded-xl px-3 py-2 border text-xs ${
              aplicarResult.error
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}>
              {aplicarResult.error ? (
                <><XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"/> <span>{aplicarResult.error}</span></>
              ) : (
                <><CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"/>
                <span>
                  <strong>{aplicarResult.actualizadas}</strong> propinas rectificadas com sucesso
                  {aplicarResult.sem_alteracao > 0 && ` · ${aplicarResult.sem_alteracao} já estavam correctas`}
                </span></>
              )}
            </div>
          )}

          {/* Tabela de detalhe por propina */}
          {(multasAnalise?.propinas ?? []).length > 0 && (
            <div className="overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    {["Aluno", "Turma", "Propina", "Dias Atraso", "Multa BD", "Multa Calculada", "Delta", "Estado"].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-slate-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {multasAnalise.propinas.map((p: any, i: number) => (
                    <tr key={i} className={`border-b border-slate-100 transition-colors ${
                      p.estado_multa === "sem_multa" ? "bg-red-50 hover:bg-red-100" :
                      p.estado_multa === "incorrecta" ? "bg-amber-50 hover:bg-amber-100" :
                      "hover:bg-slate-50"
                    }`}>
                      <td className="px-3 py-2 font-medium text-slate-800 max-w-[120px] truncate">{p.aluno_nome}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{p.turma}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{p.mes} {p.ano}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          p.dias_atraso > 60 ? "bg-red-100 text-red-700" :
                          p.dias_atraso > 30 ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>{p.dias_atraso}d</span>
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {p.multa_actual > 0 ? AOA(p.multa_actual) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2 font-semibold text-indigo-700 whitespace-nowrap">
                        {p.multa_calculada > 0 ? AOA(p.multa_calculada) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {p.delta !== 0 ? (
                          <span className={`font-bold ${p.delta > 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {p.delta > 0 ? "+" : ""}{AOA(p.delta)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.estado_multa === "correcta" ? "bg-emerald-100 text-emerald-700" :
                          p.estado_multa === "sem_multa" ? "bg-red-100 text-red-700" :
                          p.estado_multa === "incorrecta" ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-500"
                        }`}>
                          {p.estado_multa === "correcta" ? "✓ Correcta" :
                           p.estado_multa === "sem_multa" ? "Sem multa" :
                           p.estado_multa === "incorrecta" ? "Valor errado" : "Sem regra"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(multasAnalise?.propinas ?? []).length === 0 && (
            <p className="text-xs text-slate-400 text-center py-6">Nenhuma propina vencida encontrada para análise</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   TAB: ACADÉMICO & DEMOGRAFIA
═══════════════════════════════════════════ */
function AcademicoTab({ token }: { token: string }) {
  const [demo, setDemo] = useState<any>(null);
  const [bolsas, setBolsas] = useState<any>(null);
  const [bolseiros, setBolseiros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, b, bl] = await Promise.all([
        fetch(`${API}/school/relatorios/demografico`, { headers }).then(r => r.json()),
        fetch(`${API}/school/relatorios/bolsas-multas`, { headers }).then(r => r.json()),
        fetch(`${API}/school/relatorios/bolseiros`, { headers }).then(r => r.json()),
      ]);
      setDemo(d); setBolsas(b); setBolseiros(bl);
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-5 h-5 animate-spin text-indigo-500"/></div>;

  const sexoData = demo?.por_sexo?.map((r: any) => ({
    name: r.sexo === "M" ? "Masculino" : r.sexo === "F" ? "Feminino" : r.sexo,
    value: Number(r.total),
  })) ?? [];

  const turnoData = demo?.por_turno?.map((r: any) => ({
    name: r.turno,
    value: Number(r.total),
  })) ?? [];

  return (
    <div className="space-y-6">
      {/* KPIs demográficos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total de Alunos" value={String(demo?.estado?.total ?? 0)} sub={`${demo?.estado?.activos ?? 0} activos`} icon={Users} color="primary"/>
        <KpiCard label="Bolseiros Activos" value={String(bolsas?.bolsas?.atribuicoes_activas ?? 0)} sub={`${AOA(bolsas?.bolsas?.total_desconto_aplicado ?? 0)} em descontos`} icon={BadgePercent} color="violet"/>
        <KpiCard label="Turmas" value={String(demo?.por_turma?.length ?? 0)} sub={demo?.por_turno?.map((t: any) => t.turno).join(" · ")} icon={BookOpen} color="cyan"/>
        <KpiCard label="Multas Pendentes" value={AOA(bolsas?.multas?.pendentes ?? 0)} sub={`${bolsas?.multas?.propinas_com_multa ?? 0} propinas c/ multa`} icon={AlertTriangle} color="amber"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Distribuição por Sexo */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <SectionTitle title="Distribuição por Género"/>
          {sexoData.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">Sem dados de género</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={sexoData} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {sexoData.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={(v: any) => [v, "Alunos"]}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-3 justify-center mt-1">
                {sexoData.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-1 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}/>
                    <span className="text-slate-600">{item.name}: <strong>{item.value}</strong></span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Distribuição por Turno */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <SectionTitle title="Distribuição por Turno"/>
          {turnoData.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">Sem dados de turno</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={turnoData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
                <XAxis type="number" tick={{ fontSize: 10 }}/>
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={50}/>
                <Tooltip content={<ChartTooltip/>}/>
                <Bar dataKey="value" name="Alunos" fill="#6366f1" radius={[0,4,4,0]}>
                  {turnoData.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Alunos por Turma */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <SectionTitle title="Alunos por Turma"/>
          <div className="space-y-2 max-h-48 overflow-auto">
            {(demo?.por_turma ?? []).map((row: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}/>
                <span className="text-xs text-slate-700 flex-1 truncate font-medium">{row.turma}</span>
                <span className="text-xs font-bold text-slate-900">{row.total}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bolsas e Multas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <SectionTitle title="Impacto de Bolsas de Estudo" sub="Abdicação de Receita"/>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[
              { l: "Bolseiros Activos", v: bolsas?.bolsas?.atribuicoes_activas ?? 0, fmt: String },
              { l: "Total Desconto Aplicado", v: bolsas?.bolsas?.total_desconto_aplicado ?? 0, fmt: AOA },
              { l: "Bolseiros Únicos", v: bolsas?.bolsas?.total_bolseiros ?? 0, fmt: String },
              { l: "Atribuições Revogadas", v: bolsas?.bolsas?.atribuicoes_revogadas ?? 0, fmt: String },
            ].map((item, i) => (
              <div key={i} className="bg-violet-50 rounded-xl p-3">
                <p className="text-[10px] text-violet-600 font-medium">{item.l}</p>
                <p className="text-base font-bold text-violet-900">{item.fmt(item.v)}</p>
              </div>
            ))}
          </div>
          {(bolsas?.tipos_bolsa ?? []).length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-500 mb-2">Por tipo de bolsa</p>
              <div className="space-y-1">
                {bolsas.tipos_bolsa.map((bt: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-xs">
                    <span className="text-slate-700 font-medium">{bt.nome}</span>
                    <div className="flex gap-3">
                      <span className="text-slate-500">{bt.tipo_desconto === "percentagem" ? `${bt.valor}%` : AOA(bt.valor)}</span>
                      <span className="font-bold text-violet-600">{bt.activas} activas</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <SectionTitle title="Receitas de Multas e Penalizações"/>
          <div className="space-y-3">
            {[
              { l: "Total Multas Geradas", v: bolsas?.multas?.total_geradas ?? 0, color: "text-slate-700", bg: "bg-slate-50" },
              { l: "Multas Cobradas", v: bolsas?.multas?.cobradas ?? 0, color: "text-emerald-700", bg: "bg-emerald-50" },
              { l: "Multas Pendentes", v: bolsas?.multas?.pendentes ?? 0, color: "text-amber-700", bg: "bg-amber-50" },
            ].map((item, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-xl ${item.bg}`}>
                <span className="text-xs text-slate-600 font-medium">{item.l}</span>
                <span className={`text-sm font-bold ${item.color}`}>{AOA(item.v)}</span>
              </div>
            ))}
            <div className="bg-slate-50 rounded-xl px-3 py-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-600 font-medium">Taxa de Cobrança</span>
                <span className="text-sm font-bold text-indigo-700">
                  {bolsas?.multas?.total_geradas > 0
                    ? `${Math.round((bolsas.multas.cobradas / bolsas.multas.total_geradas) * 100)}%`
                    : "—"}
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                  style={{ width: bolsas?.multas?.total_geradas > 0
                    ? `${Math.round((bolsas.multas.cobradas / bolsas.multas.total_geradas) * 100)}%`
                    : "0%" }}/>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista Bolseiros */}
      {bolseiros.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <SectionTitle title="Listagem de Bolseiros" sub={`${bolseiros.filter((b: any) => b.estado === "activa").length} bolsas activas`}/>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Nº Proc.", "Aluno", "Turma", "Bolsa", "Desconto", "Data Início", "Estado"].map(h => (
                    <th key={h} className="text-left py-2 pr-3 text-slate-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bolseiros.map((b: any, i: number) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-1.5 pr-3 text-slate-400 font-mono">{b.numero_processo ?? "—"}</td>
                    <td className="py-1.5 pr-3 font-medium text-slate-800">{b.aluno_nome}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{b.turma}</td>
                    <td className="py-1.5 pr-3 text-slate-700">{b.bolsa_nome}</td>
                    <td className="py-1.5 pr-3 font-semibold text-violet-600">
                      {b.tipo_desconto === "percentagem" ? `${b.desconto_valor}%` : AOA(b.desconto_valor)}
                    </td>
                    <td className="py-1.5 pr-3 text-slate-500">{b.data_inicio ? new Date(b.data_inicio).toLocaleDateString("pt-AO") : "—"}</td>
                    <td className="py-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        b.estado === "activa" ? "bg-emerald-100 text-emerald-700" :
                        b.estado === "revogada" ? "bg-red-100 text-red-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>{b.estado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   TAB: AUDITORIA
═══════════════════════════════════════════ */
function AuditoriaTab({ token }: { token: string }) {
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [comunicacoes, setComunicacoes] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tipoFilter, setTipoFilter] = useState("");
  const [page, setPage] = useState(0);
  const LIMIT = 20;
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = `${API}/school/relatorios/audit-log?limit=${LIMIT}&offset=${page * LIMIT}${tipoFilter ? `&tipo=${tipoFilter}` : ""}`;
      const [al, com] = await Promise.all([
        fetch(url, { headers }).then(r => r.json()),
        fetch(`${API}/school/relatorios/comunicacoes`, { headers }).then(r => r.json()),
      ]);
      setAuditLog(al.rows ?? []); setTotal(al.total ?? 0); setComunicacoes(com);
    } catch {}
    setLoading(false);
  }, [token, tipoFilter, page]);

  useEffect(() => { load(); }, [load]);

  const TIPOS = ["perdao_multa", "ajuste_valor", "reagendamento", "justificacao", "bolsa_aplicada"];
  const TIPO_LABELS: Record<string, string> = {
    perdao_multa: "Perdão de Multa",
    ajuste_valor: "Ajuste de Valor",
    reagendamento: "Reagendamento",
    justificacao: "Justificação",
    bolsa_aplicada: "Bolsa Aplicada",
  };
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      {/* SMS & Comunicados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <SectionTitle title="Comunicações por Evento (SMS)"/>
          {(comunicacoes?.sms_por_evento ?? []).length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Nenhum SMS enviado</p>
          ) : (
            <div className="space-y-2">
              {comunicacoes.sms_por_evento.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}/>
                  <span className="text-xs text-slate-600 flex-1">{r.evento}</span>
                  <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full">{r.total}</span>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-2 flex gap-4 text-xs">
                {comunicacoes.sms_por_status?.map((r: any) => (
                  <span key={r.status} className="text-slate-500">
                    {r.status}: <strong className={r.status === "failed" ? "text-red-500" : "text-slate-700"}>{r.total}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <SectionTitle title="Comunicados Recentes"/>
          {(comunicacoes?.comunicados_recentes ?? []).length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Nenhum comunicado publicado</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-auto">
              {comunicacoes.comunicados_recentes.slice(0, 8).map((c: any) => (
                <div key={c.id} className="flex items-start gap-2 pb-2 border-b border-slate-50">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${c.prioridade === "urgente" ? "bg-red-400" : c.prioridade === "alta" ? "bg-amber-400" : "bg-slate-300"}`}/>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate">{c.titulo}</p>
                    <p className="text-[10px] text-slate-400">{new Date(c.created_at).toLocaleDateString("pt-AO")} · {c.leituras} leituras</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Audit Log */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle title="Log de Ajustes Financeiros" sub={`${total} registos de auditoria`}/>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Filter className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"/>
              <select
                value={tipoFilter}
                onChange={e => { setTipoFilter(e.target.value); setPage(0); }}
                className="pl-7 pr-8 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none"
              >
                <option value="">Todos os tipos</option>
                {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t] ?? t}</option>)}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><RefreshCw className="w-4 h-4 animate-spin text-indigo-400"/></div>
        ) : auditLog.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">Nenhum registo encontrado</p>
        ) : (
          <>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Data", "Aluno", "Propina", "Tipo Ajuste", "Detalhe", "Por"].map(h => (
                      <th key={h} className="text-left py-2 pr-3 text-slate-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">
                        {row.created_at ? new Date(row.created_at).toLocaleDateString("pt-AO") : "—"}
                      </td>
                      <td className="py-2 pr-3 font-medium text-slate-800 max-w-[120px] truncate">{row.aluno_nome}</td>
                      <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{row.propina_label}</td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.tipo === "perdao_multa" ? "bg-emerald-100 text-emerald-700" :
                          row.tipo === "ajuste_valor" ? "bg-indigo-100 text-indigo-700" :
                          row.tipo === "reagendamento" ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>{TIPO_LABELS[row.tipo] ?? row.tipo}</span>
                      </td>
                      <td className="py-2 pr-3 text-slate-600 max-w-[160px] truncate">{row.descricao || "—"}</td>
                      <td className="py-2 text-slate-400">{row.utilizador ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-400">{page * LIMIT + 1}–{Math.min((page+1) * LIMIT, total)} de {total}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}
                    className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">
                    ←
                  </button>
                  <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page >= totalPages-1}
                    className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">
                    →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   TAB: EXPORTAÇÃO
═══════════════════════════════════════════ */
function ExportacaoTab({ token }: { token: string }) {
  const [dlStatus, setDlStatus] = useState<Record<string, "idle"|"loading"|"done"|"error">>({});
  const headers = { Authorization: `Bearer ${token}` };

  const downloadCSV = async (key: string, url: string, filename: string) => {
    setDlStatus(s => ({ ...s, [key]: "loading" }));
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("Erro");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      setDlStatus(s => ({ ...s, [key]: "done" }));
      setTimeout(() => setDlStatus(s => ({ ...s, [key]: "idle" })), 2500);
    } catch {
      setDlStatus(s => ({ ...s, [key]: "error" }));
      setTimeout(() => setDlStatus(s => ({ ...s, [key]: "idle" })), 3000);
    }
  };

  const exports = [
    {
      key: "alunos",
      title: "Fichas de Alunos",
      desc: "Exporta todos os alunos com dados biográficos, turma, encarregado e número de processo.",
      badge: "CSV",
      color: "indigo",
      icon: Users,
      action: () => downloadCSV("alunos", `${API}/school/relatorios/export/alunos`, "alunos.csv"),
    },
    {
      key: "propinas_todas",
      title: "Todas as Propinas",
      desc: "Exporta o registo completo de propinas com estado, valores, multas, descontos e referências.",
      badge: "CSV",
      color: "indigo",
      icon: FileText,
      action: () => downloadCSV("propinas_todas", `${API}/school/relatorios/export/propinas`, "propinas_todas.csv"),
    },
    {
      key: "propinas_pagas",
      title: "Propinas Pagas",
      desc: "Apenas propinas com status PAGO — útil para conciliação bancária.",
      badge: "CSV",
      color: "green",
      icon: CheckCircle2,
      action: () => downloadCSV("propinas_pagas", `${API}/school/relatorios/export/propinas?status=pago`, "propinas_pagas.csv"),
    },
    {
      key: "propinas_vencidas",
      title: "Propinas Vencidas",
      desc: "Apenas propinas com status VENCIDO — lista de inadimplentes para acção de cobrança.",
      badge: "CSV",
      color: "red",
      icon: AlertTriangle,
      action: () => downloadCSV("propinas_vencidas", `${API}/school/relatorios/export/propinas?status=vencido`, "propinas_vencidas.csv"),
    },
    {
      key: "propinas_pendentes",
      title: "Propinas Pendentes",
      desc: "Apenas propinas com status PENDENTE — faturas em aberto ainda dentro do prazo.",
      badge: "CSV",
      color: "amber",
      icon: Clock,
      action: () => downloadCSV("propinas_pendentes", `${API}/school/relatorios/export/propinas?status=pendente`, "propinas_pendentes.csv"),
    },
  ];

  const colorMap: Record<string, string> = {
    indigo: "from-indigo-50 to-indigo-100 border-indigo-200",
    green: "from-emerald-50 to-emerald-100 border-emerald-200",
    red: "from-red-50 to-red-100 border-red-200",
    amber: "from-amber-50 to-amber-100 border-amber-200",
  };
  const iconColorMap: Record<string, string> = {
    indigo: "text-indigo-600", green: "text-emerald-600", red: "text-red-600", amber: "text-amber-600",
  };
  const btnColorMap: Record<string, string> = {
    indigo: "bg-indigo-600 hover:bg-indigo-700",
    green: "bg-emerald-600 hover:bg-emerald-700",
    red: "bg-red-600 hover:bg-red-700",
    amber: "bg-amber-500 hover:bg-amber-600",
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-3">
        <ArrowDownToLine className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0"/>
        <div>
          <p className="text-xs font-semibold text-amber-800">Exportação de Dados (CSV)</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Todos os ficheiros exportados incluem BOM UTF-8 e são compatíveis com Excel, Google Sheets e LibreOffice Calc.
            Os dados são filtrados automaticamente pela sua instituição.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {exports.map(item => {
          const status = dlStatus[item.key] ?? "idle";
          const Icon = item.icon;
          return (
            <div key={item.key} className={`bg-gradient-to-br ${colorMap[item.color]} border rounded-2xl p-4 flex flex-col gap-3`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  <Icon className={`w-4.5 h-4.5 ${iconColorMap[item.color]}`}/>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 leading-tight">{item.title}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded bg-white ${iconColorMap[item.color]}`}>{item.badge}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
              <button
                onClick={item.action}
                disabled={status === "loading"}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-white transition-colors ${btnColorMap[item.color]} disabled:opacity-60`}
              >
                {status === "loading" ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin"/> A exportar...</>
                ) : status === "done" ? (
                  <><CheckCircle2 className="w-3.5 h-3.5"/> Ficheiro descarregado!</>
                ) : status === "error" ? (
                  <><AlertTriangle className="w-3.5 h-3.5"/> Erro — tente novamente</>
                ) : (
                  <><Download className="w-3.5 h-3.5"/> Descarregar {item.badge}</>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Helper icon ── */
function Clock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
type ReportTab = "financeiro" | "academico" | "auditoria" | "exportacao";

const TABS: { key: ReportTab; label: string; icon: React.ElementType }[] = [
  { key: "financeiro", label: "Financeiro", icon: TrendingUp },
  { key: "academico", label: "Académico", icon: BookOpen },
  { key: "auditoria", label: "Auditoria", icon: Shield },
  { key: "exportacao", label: "Exportação", icon: ArrowDownToLine },
];

export default function ReportsDashboard({ token }: { token: string }) {
  const [activeTab, setActiveTab] = useState<ReportTab>("financeiro");

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col min-h-0"
    >
      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 sticky top-0 z-10">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                <Icon className="w-4 h-4"/>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {activeTab === "financeiro" && <FinanceiroTab token={token}/>}
        {activeTab === "academico" && <AcademicoTab token={token}/>}
        {activeTab === "auditoria" && <AuditoriaTab token={token}/>}
        {activeTab === "exportacao" && <ExportacaoTab token={token}/>}
      </div>
    </motion.div>
  );
}
