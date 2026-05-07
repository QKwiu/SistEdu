import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Shield, AlertTriangle, CheckCircle2, RefreshCw,
  Plus, Pencil, Trash2, Lock, Unlock, KeyRound, X, Save,
  ShieldOff, Eye, EyeOff, Filter, Search, ChevronDown,
  Clock, UserCheck, UserX, Zap, Info, History,
} from "lucide-react";

const API = "/api";

const MODULES = [
  { key: "alunos",       label: "Alunos & Turmas" },
  { key: "propinas",     label: "Propinas & Faturas" },
  { key: "reconciliacao",label: "Reconciliação" },
  { key: "ocorrencias",  label: "Ocorrências" },
  { key: "comunicar",    label: "Comunicados" },
  { key: "debito_direto",label: "Débito Directo" },
  { key: "emolumentos",  label: "Emolumentos" },
  { key: "relatorios",   label: "Relatórios" },
  { key: "gestao_acessos", label: "Gestão de Acessos" },
];

const ACTIONS = [
  { key: "pode_ler",    label: "Ler",    short: "R" },
  { key: "pode_criar",  label: "Criar",  short: "C" },
  { key: "pode_editar", label: "Editar", short: "U" },
  { key: "pode_apagar", label: "Apagar", short: "D" },
];

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  activo:    { label: "Activo",    color: "bg-emerald-100 text-emerald-700", icon: UserCheck },
  inactivo:  { label: "Inactivo",  color: "bg-slate-100 text-slate-500",    icon: UserX },
  bloqueado: { label: "Bloqueado", color: "bg-red-100 text-red-700",         icon: ShieldOff },
};

const ACAO_LABELS: Record<string, string> = {
  criar_staff: "Criou utilizador", editar_staff: "Editou utilizador",
  bloquear_staff: "Bloqueou utilizador", activar_staff: "Activou utilizador",
  desactivar_staff: "Desactivou utilizador", eliminar_staff: "Eliminou utilizador",
  reset_password: "Repôs password", criar_role: "Criou perfil",
  editar_role: "Editou perfil", eliminar_role: "Eliminou perfil",
};

const AOA = (v: number) =>
  new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(v);

function Badge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.inactivo;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${m.color}`}>
      <Icon className="w-3 h-3"/> {m.label}
    </span>
  );
}

/* ── Permission Matrix Editor ── */
function PermissionMatrix({
  permissions, onChange,
}: {
  permissions: Record<string, Record<string, boolean>>;
  onChange: (mod: string, action: string, val: boolean) => void;
}) {
  return (
    <div className="overflow-auto rounded-xl border border-slate-200">
      <table className="w-full text-xs">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            <th className="text-left px-3 py-2.5 text-slate-600 font-semibold w-40">Módulo</th>
            {ACTIONS.map(a => (
              <th key={a.key} className="text-center px-3 py-2.5 text-slate-600 font-semibold whitespace-nowrap">
                <span className="hidden sm:inline">{a.label}</span>
                <span className="sm:hidden">{a.short}</span>
              </th>
            ))}
            <th className="text-center px-3 py-2.5 text-slate-500 font-medium">Tudo</th>
          </tr>
        </thead>
        <tbody>
          {MODULES.map((mod, i) => {
            const mp = permissions[mod.key] ?? {};
            const allOn = ACTIONS.every(a => mp[a.key]);
            return (
              <tr key={mod.key} className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                <td className="px-3 py-2 font-medium text-slate-700">{mod.label}</td>
                {ACTIONS.map(a => (
                  <td key={a.key} className="text-center px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!mp[a.key]}
                      onChange={e => onChange(mod.key, a.key, e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                    />
                  </td>
                ))}
                <td className="text-center px-3 py-2">
                  <button
                    type="button"
                    onClick={() => ACTIONS.forEach(a => onChange(mod.key, a.key, !allOn))}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                      allOn ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {allOn ? "✓ Tudo" : "Selec."}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ══ TAB: UTILIZADORES ══ */
function UtilizadoresTab({ token, roles }: { token: string; roles: any[] }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", role_id: "" });
  const [saving, setSaving] = useState(false);
  const [tempPass, setTempPass] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<any>(null);
  const [actionType, setActionType] = useState<"block"|"reset"|"delete"|null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (filterRole) params.set("role_id", filterRole);
      if (filterStatus) params.set("status", filterStatus);
      const r = await fetch(`${API}/school/rbac/staff?${params}`, { headers });
      setUsers(await r.json());
    } catch {}
    setLoading(false);
  }, [token, q, filterRole, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ nome: "", email: "", telefone: "", role_id: "" });
    setTempPass(null);
    setShowModal(true);
  };

  const openEdit = (u: any) => {
    setEditing(u);
    setForm({ nome: u.nome, email: u.email, telefone: u.telefone ?? "", role_id: u.role_id ? String(u.role_id) : "" });
    setTempPass(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { ...form, role_id: form.role_id || null };
      let res;
      if (editing) {
        res = await fetch(`${API}/school/rbac/staff/${editing.id}`, { method: "PUT", headers, body: JSON.stringify(body) });
      } else {
        res = await fetch(`${API}/school/rbac/staff`, { method: "POST", headers, body: JSON.stringify(body) });
      }
      const data = await res.json();
      if (data.temp_password) setTempPass(data.temp_password);
      else { setShowModal(false); await load(); }
    } catch {}
    setSaving(false);
    if (editing) { setShowModal(false); await load(); }
  };

  const handleToggleStatus = async (user: any, newStatus: string) => {
    setActionLoading(true);
    try {
      await fetch(`${API}/school/rbac/staff/${user.id}/toggle-status`, {
        method: "POST", headers, body: JSON.stringify({ status: newStatus }),
      });
      await load();
    } catch {}
    setActionLoading(false);
    setActionTarget(null); setActionType(null);
  };

  const handleResetPassword = async (user: any) => {
    setActionLoading(true);
    setActionResult(null);
    try {
      const res = await fetch(`${API}/school/rbac/staff/${user.id}/reset-password`, { method: "POST", headers });
      const data = await res.json();
      setActionResult(data.temp_password ?? "Erro");
    } catch {}
    setActionLoading(false);
  };

  const handleDelete = async (user: any) => {
    setActionLoading(true);
    try {
      await fetch(`${API}/school/rbac/staff/${user.id}`, { method: "DELETE", headers });
      setActionTarget(null); setActionType(null);
      await load();
    } catch {}
    setActionLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Pesquisar por nome ou email…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none">
          <option value="">Todos os perfis</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none">
          <option value="">Todos os estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
          <option value="bloqueado">Bloqueado</option>
        </select>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap">
          <Plus className="w-4 h-4"/> Novo Utilizador
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-indigo-400"/></div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
          <p className="text-slate-500 font-medium">Nenhum utilizador encontrado</p>
          <p className="text-xs text-slate-400 mt-1">Crie o primeiro utilizador de staff para esta escola</p>
          <button onClick={openCreate} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
            Criar Utilizador
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Utilizador", "Perfil", "Estado", "Último Acesso", "Acções"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                  u.status === "bloqueado" ? "bg-red-50/40" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {u.nome.slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{u.nome}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.role_nome ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
                        style={{ backgroundColor: u.role_cor ?? "#6366f1" }}>
                        <Shield className="w-2.5 h-2.5"/> {u.role_nome}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Sem perfil</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><Badge status={u.status}/></td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleDateString("pt-AO") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(u)} title="Editar"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                        <Pencil className="w-3.5 h-3.5"/>
                      </button>
                      <button onClick={() => { setActionTarget(u); setActionType("reset"); setActionResult(null); }} title="Repor Password"
                        className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500 transition-colors">
                        <KeyRound className="w-3.5 h-3.5"/>
                      </button>
                      {u.status !== "bloqueado" ? (
                        <button onClick={() => handleToggleStatus(u, "bloqueado")} title="Bloquear (Kill Switch)"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                          <ShieldOff className="w-3.5 h-3.5"/>
                        </button>
                      ) : (
                        <button onClick={() => handleToggleStatus(u, "activo")} title="Desbloquear"
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500 transition-colors">
                          <UserCheck className="w-3.5 h-3.5"/>
                        </button>
                      )}
                      <button onClick={() => { setActionTarget(u); setActionType("delete"); }} title="Eliminar"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-slate-900 text-base">{editing ? "Editar Utilizador" : "Novo Utilizador"}</h3>
                <button onClick={() => { setShowModal(false); setTempPass(null); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                  <X className="w-4 h-4"/>
                </button>
              </div>

              {tempPass ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2"/>
                    <p className="font-semibold text-emerald-800">Utilizador criado com sucesso!</p>
                    <p className="text-xs text-emerald-600 mt-1">Partilhe as seguintes credenciais de forma segura:</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Password Temporária</p>
                    <p className="font-mono text-lg font-bold text-indigo-700 tracking-widest">{tempPass}</p>
                    <p className="text-xs text-slate-400">O utilizador deverá alterar a password no primeiro acesso.</p>
                  </div>
                  <button onClick={() => { setShowModal(false); setTempPass(null); load(); }}
                    className="w-full py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors text-sm">
                    Concluir
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: "Nome completo *", key: "nome", type: "text", placeholder: "Ex: Maria Santos" },
                    { label: "Email *", key: "email", type: "email", placeholder: "maria@escola.ao" },
                    { label: "Telefone", key: "telefone", type: "tel", placeholder: "9XX XXX XXX" },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                      <input
                        type={f.type}
                        value={(form as any)[f.key]}
                        onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Perfil de Acesso</label>
                    <select value={form.role_id} onChange={e => setForm(s => ({ ...s, role_id: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                      <option value="">Sem perfil atribuído</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setShowModal(false)}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm">
                      Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving || !form.nome.trim() || !form.email.trim()}
                      className="flex-1 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-2">
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                      {editing ? "Guardar" : "Criar"}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {actionTarget && actionType === "reset" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900">Repor Password</h3>
                <button onClick={() => { setActionTarget(null); setActionType(null); setActionResult(null); }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4"/></button>
              </div>
              {actionResult ? (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                    <KeyRound className="w-7 h-7 text-amber-500 mx-auto mb-2"/>
                    <p className="font-semibold text-amber-800">Password reposta com sucesso</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Nova password temporária:</p>
                    <p className="font-mono text-lg font-bold text-indigo-700 tracking-widest">{actionResult}</p>
                  </div>
                  <button onClick={() => { setActionTarget(null); setActionType(null); setActionResult(null); }}
                    className="w-full py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors text-sm">
                    Fechar
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Irá gerar uma nova password temporária para <strong>{actionTarget.nome}</strong>. A password actual será invalidada imediatamente.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => { setActionTarget(null); setActionType(null); }}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 text-sm">
                      Cancelar
                    </button>
                    <button onClick={() => handleResetPassword(actionTarget)} disabled={actionLoading}
                      className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                      {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <KeyRound className="w-4 h-4"/>}
                      Repor
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {actionTarget && actionType === "delete" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
                  <Trash2 className="w-6 h-6 text-red-500"/>
                </div>
                <h3 className="font-bold text-slate-900">Eliminar Utilizador</h3>
                <p className="text-sm text-slate-600">
                  Tem a certeza que quer eliminar <strong>{actionTarget.nome}</strong>? Esta acção é irreversível.
                </p>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => { setActionTarget(null); setActionType(null); }}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 text-sm">
                    Cancelar
                  </button>
                  <button onClick={() => handleDelete(actionTarget)} disabled={actionLoading}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                    {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
                    Eliminar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══ TAB: PERFIS (ROLES) ══ */
function PerfisTab({ token, onRolesChange }: { token: string; onRolesChange: (roles: any[]) => void }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ nome: "", descricao: "", cor: "#6366f1" });
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/school/rbac/roles`, { headers });
      const data = await r.json();
      setRoles(data);
      onRolesChange(data);
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const buildDefaultPerms = () => {
    const p: Record<string, Record<string, boolean>> = {};
    MODULES.forEach(m => { p[m.key] = { pode_ler: true, pode_criar: false, pode_editar: false, pode_apagar: false }; });
    return p;
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ nome: "", descricao: "", cor: "#6366f1" });
    setPermissions(buildDefaultPerms());
    setShowModal(true);
  };

  const openEdit = (role: any) => {
    setEditing(role);
    setForm({ nome: role.nome, descricao: role.descricao ?? "", cor: role.cor ?? "#6366f1" });
    const p: Record<string, Record<string, boolean>> = {};
    MODULES.forEach(m => { p[m.key] = { pode_ler: false, pode_criar: false, pode_editar: false, pode_apagar: false }; });
    for (const perm of role.permissions ?? []) {
      p[perm.modulo] = {
        pode_ler: perm.pode_ler, pode_criar: perm.pode_criar,
        pode_editar: perm.pode_editar, pode_apagar: perm.pode_apagar,
      };
    }
    setPermissions(p);
    setShowModal(true);
  };

  const handlePermChange = (mod: string, action: string, val: boolean) => {
    setPermissions(prev => ({ ...prev, [mod]: { ...(prev[mod] ?? {}), [action]: val } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const permsArr = MODULES.map(m => ({ modulo: m.key, ...(permissions[m.key] ?? {}) }));
      const body = { ...form, permissions: permsArr };
      if (editing) {
        await fetch(`${API}/school/rbac/roles/${editing.id}`, { method: "PUT", headers, body: JSON.stringify(body) });
      } else {
        await fetch(`${API}/school/rbac/roles`, { method: "POST", headers, body: JSON.stringify(body) });
      }
      setShowModal(false);
      await load();
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (role: any) => {
    try {
      const res = await fetch(`${API}/school/rbac/roles/${role.id}`, { method: "DELETE", headers });
      const data = await res.json();
      if (!data.ok) { alert(data.error ?? "Erro ao eliminar"); return; }
      setConfirmDelete(null);
      await load();
    } catch {}
  };

  const COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#64748b"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{roles.length} perfis configurados</p>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors">
          <Plus className="w-4 h-4"/> Novo Perfil
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-indigo-400"/></div>
      ) : roles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
          <p className="text-slate-500 font-medium">Nenhum perfil configurado</p>
          <p className="text-xs text-slate-400 mt-1">Crie perfis para definir o que cada equipa pode fazer no sistema</p>
          <button onClick={openCreate} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
            Criar Perfil
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {roles.map(role => {
            const totalPerms = (role.permissions ?? []).reduce((acc: number, p: any) => {
              return acc + [p.pode_ler, p.pode_criar, p.pode_editar, p.pode_apagar].filter(Boolean).length;
            }, 0);
            return (
              <div key={role.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100"
                  style={{ borderLeftColor: role.cor, borderLeftWidth: 4 }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: role.cor + "22" }}>
                      <Shield className="w-4 h-4" style={{ color: role.cor }}/>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{role.nome}</p>
                      {role.descricao && <p className="text-xs text-slate-400">{role.descricao}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      {role.total_utilizadores} user{role.total_utilizadores !== 1 ? "s" : ""}
                    </span>
                    <button onClick={() => openEdit(role)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                      <Pencil className="w-3.5 h-3.5"/>
                    </button>
                    <button onClick={() => setConfirmDelete(role)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Permissões ({totalPerms})</p>
                  <div className="flex flex-wrap gap-1">
                    {MODULES.filter(m => {
                      const p = (role.permissions ?? []).find((rp: any) => rp.modulo === m.key);
                      return p && (p.pode_ler || p.pode_criar || p.pode_editar || p.pode_apagar);
                    }).map(m => {
                      const p = (role.permissions ?? []).find((rp: any) => rp.modulo === m.key);
                      const crud = [
                        p?.pode_criar && "C", p?.pode_ler && "R",
                        p?.pode_editar && "U", p?.pode_apagar && "D",
                      ].filter(Boolean).join("");
                      return (
                        <span key={m.key} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {m.label} <span className="font-mono text-indigo-600">[{crud}]</span>
                        </span>
                      );
                    })}
                    {MODULES.every(m => !(role.permissions ?? []).find((rp: any) => rp.modulo === m.key && (rp.pode_ler || rp.pode_criar))) && (
                      <span className="text-xs text-slate-400">Sem permissões configuradas</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Role Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 bg-black/40 overflow-auto">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base">{editing ? "Editar Perfil" : "Novo Perfil de Acesso"}</h3>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                  <X className="w-4 h-4"/>
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nome do Perfil *</label>
                    <input value={form.nome} onChange={e => setForm(s => ({ ...s, nome: e.target.value }))}
                      placeholder="Ex: Secretaria, Tesouraria, Professor…"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Descrição</label>
                    <input value={form.descricao} onChange={e => setForm(s => ({ ...s, descricao: e.target.value }))}
                      placeholder="Breve descrição das responsabilidades"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Cor de Identificação</label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map(c => (
                      <button key={c} type="button"
                        onClick={() => setForm(s => ({ ...s, cor: c }))}
                        className={`w-7 h-7 rounded-full transition-all border-2 ${form.cor === c ? "border-slate-900 scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c }}/>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    Matriz de Permissões
                    <span className="ml-2 text-[10px] font-normal text-slate-400 normal-case">
                      C=Criar · R=Ler · U=Editar · D=Apagar
                    </span>
                  </label>
                  <PermissionMatrix permissions={permissions} onChange={handlePermChange}/>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setShowModal(false)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 text-sm">
                    Cancelar
                  </button>
                  <button onClick={handleSave} disabled={saving || !form.nome.trim()}
                    className="flex-1 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                    {editing ? "Guardar Alterações" : "Criar Perfil"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6 text-red-500"/>
              </div>
              <h3 className="font-bold text-slate-900">Eliminar Perfil</h3>
              <p className="text-sm text-slate-600">Tem a certeza que quer eliminar o perfil <strong>{confirmDelete.nome}</strong>?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 text-sm">Cancelar</button>
                <button onClick={() => handleDelete(confirmDelete)}
                  className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 text-sm">Eliminar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══ TAB: AUDITORIA ══ */
function AuditoriaTab({ token }: { token: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filterAcao, setFilterAcao] = useState("");
  const LIMIT = 25;
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(page * LIMIT) });
      if (filterAcao) params.set("acao", filterAcao);
      const r = await fetch(`${API}/school/rbac/audit-log?${params}`, { headers });
      const data = await r.json();
      setRows(data.rows ?? []); setTotal(data.total ?? 0);
    } catch {}
    setLoading(false);
  }, [token, page, filterAcao]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / LIMIT);
  const ACOES = Object.keys(ACAO_LABELS);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select value={filterAcao} onChange={e => { setFilterAcao(e.target.value); setPage(0); }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none">
          <option value="">Todas as acções</option>
          {ACOES.map(a => <option key={a} value={a}>{ACAO_LABELS[a]}</option>)}
        </select>
        <span className="text-xs text-slate-400 ml-auto">{total} registos de auditoria</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-indigo-400"/></div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <History className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
          <p className="text-slate-500 font-medium">Nenhum registo de auditoria</p>
          <p className="text-xs text-slate-400 mt-1">As alterações de acessos e permissões serão registadas aqui</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Data / Hora", "Actor", "Acção", "Alvo", "IP"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString("pt-AO")}
                  </td>
                  <td className="px-4 py-2.5">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{row.actor}</p>
                      <p className="text-[10px] text-slate-400">{row.actor_tipo}</p>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      row.acao.includes("bloquear") || row.acao.includes("eliminar") ? "bg-red-100 text-red-700" :
                      row.acao.includes("criar") ? "bg-emerald-100 text-emerald-700" :
                      row.acao.includes("activar") ? "bg-blue-100 text-blue-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>{ACAO_LABELS[row.acao] ?? row.acao}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">{row.alvo ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">{row.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <span className="text-xs text-slate-400">{page * LIMIT + 1}–{Math.min((page+1)*LIMIT, total)} de {total}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}
                  className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">←</button>
                <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page >= totalPages-1}
                  className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">→</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══ MAIN COMPONENT ══ */
type AccessTab = "utilizadores" | "perfis" | "auditoria";

const TABS: { key: AccessTab; label: string; icon: React.ElementType }[] = [
  { key: "utilizadores", label: "Utilizadores",  icon: Users },
  { key: "perfis",       label: "Perfis (RBAC)", icon: Shield },
  { key: "auditoria",    label: "Auditoria",      icon: History },
];

export default function AccessManagement({ token }: { token: string }) {
  const [activeTab, setActiveTab] = useState<AccessTab>("utilizadores");
  const [roles, setRoles] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [killTarget, setKillTarget] = useState<"school"|null>(null);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/school/rbac/summary`, { headers })
      .then(r => r.json())
      .then(setSummary)
      .catch(() => {});
  }, [token, activeTab]);

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
      className="flex-1 flex flex-col min-h-0">

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 pt-4 pb-0 sticky top-0 z-10">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600"/> Gestão de Acessos e Permissões
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">RBAC — controlo de acesso baseado em perfis</p>
          </div>

          {/* Kill Switch institucional */}
          <button
            className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-xl transition-colors"
            onClick={() => setKillTarget("school")}
          >
            <Zap className="w-3.5 h-3.5"/> Kill Switch
          </button>
        </div>

        {/* Summary KPIs */}
        {summary && (
          <div className="grid grid-cols-4 gap-3 mb-3">
            {[
              { label: "Total Utilizadores", value: summary.utilizadores?.total ?? 0, color: "text-slate-800" },
              { label: "Activos", value: summary.utilizadores?.activos ?? 0, color: "text-emerald-600" },
              { label: "Bloqueados", value: summary.utilizadores?.bloqueados ?? 0, color: "text-red-600" },
              { label: "Perfis", value: summary.total_roles ?? 0, color: "text-indigo-600" },
            ].map(k => (
              <div key={k.label} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <p className="text-[10px] text-slate-500 font-medium">{k.label}</p>
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  active ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}>
                <Icon className="w-4 h-4"/> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {activeTab === "utilizadores" && <UtilizadoresTab token={token} roles={roles}/>}
        {activeTab === "perfis" && <PerfisTab token={token} onRolesChange={setRoles}/>}
        {activeTab === "auditoria" && <AuditoriaTab token={token}/>}
      </div>

      {/* Kill Switch Modal */}
      <AnimatePresence>
        {killTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center mx-auto">
                  <Zap className="w-8 h-8 text-red-600"/>
                </div>
                <div>
                  <h3 className="font-bold text-red-700 text-lg">Kill Switch Institucional</h3>
                  <p className="text-sm text-slate-600 mt-2">
                    Esta acção irá <strong>bloquear imediatamente</strong> todos os utilizadores de staff desta instituição,
                    invalidando todas as sessões activas. Apenas o administrador principal pode reverter.
                  </p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 text-left">
                  <p className="font-semibold mb-1">⚠ Esta acção:</p>
                  <ul className="space-y-0.5 list-disc list-inside">
                    <li>Bloqueia todos os utilizadores de staff</li>
                    <li>Invalida todos os tokens de sessão activos</li>
                    <li>É registada no log de auditoria</li>
                  </ul>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setKillTarget(null)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 text-sm">
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await fetch(`${API}/school/rbac/staff`, { headers })
                          .then(r => r.json())
                          .then(async (users: any[]) => {
                            for (const u of users) {
                              if (u.status === "activo") {
                                await fetch(`${API}/school/rbac/staff/${u.id}/toggle-status`, {
                                  method: "POST",
                                  headers: { ...headers, "Content-Type": "application/json" },
                                  body: JSON.stringify({ status: "bloqueado" }),
                                });
                              }
                            }
                          });
                      } catch {}
                      setKillTarget(null);
                    }}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2">
                    <Zap className="w-4 h-4"/> Confirmar Kill Switch
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
