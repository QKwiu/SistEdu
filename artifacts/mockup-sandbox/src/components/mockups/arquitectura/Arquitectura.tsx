export default function Arquitectura() {
  return (
    <div style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", background: "#f8fafc", minHeight: "100vh", padding: "32px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#2563eb,#16a34a)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 18 }}>K</div>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>Kiwara Tech</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "4px 0", letterSpacing: "-0.5px" }}>Arquitectura Aplicacional — MVP v1.0</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Angola · Junho 2026 · React + Vite · Express 5 · PostgreSQL</p>
        </div>

        {/* ── LAYER 1: Utilizadores ── */}
        <Layer label="UTILIZADORES" color="#1e3a5f" bg="#e8f0fe" borderColor="#3b82f6">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            <UserBox icon="👤" title="Admin Plataforma" desc="Kiwara Tech" color="#3b82f6" />
            <UserBox icon="🏫" title="Gestor Escolar" desc="Director / Secretário" color="#8b5cf6" />
            <UserBox icon="👨‍👩‍👧" title="Encarregado / Aluno" desc="Via browser — qualquer dispositivo" color="#0891b2" badge="WEB" />
            <UserBox icon="🖥️" title="Atendente / Tesoureiro" desc="Staff da escola" color="#059669" />
          </div>
        </Layer>

        <Arrow />

        {/* ── LAYER 2: Apresentação ── */}
        <Layer label="CAMADA DE APRESENTAÇÃO — SPA React + Vite (Web Responsiva)" color="#312e81" bg="#eef2ff" borderColor="#6366f1">
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #c7d2fe", padding: "10px 14px", marginBottom: 10 }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#4338ca", textTransform: "uppercase", letterSpacing: "0.05em" }}>Aplicação Web Única — Adaptável a Desktop · Tablet · Mobile</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
              <AppBox icon="⚙️" title="Dashboard Admin" sub="Configuração da plataforma" color="#4338ca" />
              <AppBox icon="📊" title="Dashboard Escola" sub="Gestão escolar completa" color="#7c3aed" />
              <AppBox icon="📱" title="Portal Encarregado" sub="Web Responsivo ★ Mobile/Tablet" color="#0891b2" highlight />
              <AppBox icon="🌐" title="Portal Público" sub="Escola pública + comunicados" color="#059669" />
              <AppBox icon="💳" title="Staff Portal" sub="Caixa · Propinas · Recibos" color="#d97706" />
            </div>
          </div>
          <div style={{ background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>✅</span>
            <p style={{ margin: 0, fontSize: 12, color: "#166534", fontWeight: 600 }}>Sem aplicação mobile nativa no MVP — o Portal do Encarregado é totalmente web e responsivo, acessível via browser em qualquer dispositivo (smartphone, tablet, computador).</p>
          </div>
        </Layer>

        <Arrow />

        {/* ── LAYER 3: API ── */}
        <Layer label="CAMADA DE API — Express 5 + Node.js (REST)" color="#7c2d12" bg="#fff7ed" borderColor="#f97316">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8 }}>
            <ApiBox icon="🔐" title="Auth & Sessões" items={["Admin JWT","School Token","Guardian Token","Staff Token"]} color="#dc2626" />
            <ApiBox icon="🎓" title="Gestão Escolar" items={["Alunos","Turmas","Matrículas","Infantil"]} color="#7c3aed" />
            <ApiBox icon="💰" title="Propinas & Faturas" items={["Ciclo faturação","Baixas manuais","Referências","Recibos"]} color="#d97706" />
            <ApiBox icon="📢" title="Comunicar" items={["Portal público","SMS","Push FCM","Aniversários"]} color="#0891b2" />
            <ApiBox icon="💳" title="Pagamentos" items={["EMIS SEPE","GPO Reference","Multicaixa Exp.","Direct Debit"]} color="#059669" />
            <ApiBox icon="📈" title="Relatórios & Config" items={["Financeiro","RBAC/Permissões","Platform config","Auditoria"]} color="#6366f1" />
          </div>
        </Layer>

        <Arrow />

        {/* ── LAYER 4: Dados ── */}
        <Layer label="DADOS — PostgreSQL" color="#064e3b" bg="#f0fdf4" borderColor="#10b981">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
            {["schools", "students", "propinas", "sessions", "fcm_device_tokens", "platform_config", "audit_logs"].map(t => (
              <div key={t} style={{ background: "#fff", border: "1px solid #a7f3d0", borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
                <div style={{ fontSize: 16, marginBottom: 2 }}>🗄️</div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#065f46", fontFamily: "monospace" }}>{t}</p>
              </div>
            ))}
          </div>
        </Layer>

        <Arrow />

        {/* ── LAYER 5: Integrações ── */}
        <Layer label="INTEGRAÇÕES EXTERNAS" color="#1e3a5f" bg="#f8fafc" borderColor="#94a3b8">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
            <IntBox icon="🔔" title="Firebase FCM" sub="Push Notifications" provider="Google Cloud" color="#f59e0b" />
            <IntBox icon="📱" title="Provedor SMS" sub="Notificações SMS" provider="Configurável" color="#0891b2" />
            <IntBox icon="🏛️" title="EMIS SEPE" sub="Emolumentos escolares" provider="Angola" color="#dc2626" />
            <IntBox icon="🔗" title="GPO Reference" sub="Referências pagamento" provider="Angola" color="#7c3aed" />
            <IntBox icon="💳" title="Multicaixa Express" sub="Pagamentos móveis" provider="EMIS Angola" color="#059669" />
          </div>
        </Layer>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 24, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>
            Kiwara Tech · Arquitectura MVP · Produzido em Junho 2026 · Monorepo pnpm · Deploy Replit
          </p>
        </div>
      </div>
    </div>
  );
}

function Layer({ label, color, bg, borderColor, children }: any) {
  return (
    <div style={{ background: bg, border: `2px solid ${borderColor}`, borderRadius: 12, padding: "12px 14px", marginBottom: 0 }}>
      <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        ▌ {label}
      </p>
      {children}
    </div>
  );
}

function Arrow() {
  return (
    <div style={{ textAlign: "center", padding: "4px 0", color: "#94a3b8", fontSize: 20 }}>↕</div>
  );
}

function UserBox({ icon, title, desc, color, badge }: any) {
  return (
    <div style={{ background: "#fff", border: `1.5px solid ${color}30`, borderRadius: 10, padding: "10px 10px", textAlign: "center", position: "relative" }}>
      {badge && (
        <span style={{ position: "absolute", top: 6, right: 6, background: "#0891b2", color: "#fff", fontSize: 8, fontWeight: 800, padding: "2px 5px", borderRadius: 4 }}>{badge}</span>
      )}
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{title}</p>
      <p style={{ margin: 0, fontSize: 10, color: "#64748b" }}>{desc}</p>
    </div>
  );
}

function AppBox({ icon, title, sub, color, highlight }: any) {
  return (
    <div style={{ background: highlight ? "#e0f2fe" : "#f8fafc", border: `1.5px solid ${highlight ? "#0891b2" : "#e2e8f0"}`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: highlight ? "#0c4a6e" : "#0f172a" }}>{title}</p>
      <p style={{ margin: 0, fontSize: 9, color: "#64748b", lineHeight: 1.3 }}>{sub}</p>
    </div>
  );
}

function ApiBox({ icon, title, items, color }: any) {
  return (
    <div style={{ background: "#fff", border: `1.5px solid ${color}30`, borderRadius: 10, padding: "8px 8px" }}>
      <div style={{ fontSize: 16, marginBottom: 4, textAlign: "center" }}>{icon}</div>
      <p style={{ margin: "0 0 5px", fontSize: 10, fontWeight: 700, color, textAlign: "center" }}>{title}</p>
      {items.map((i: string) => (
        <p key={i} style={{ margin: "1px 0", fontSize: 9, color: "#475569" }}>· {i}</p>
      ))}
    </div>
  );
}

function IntBox({ icon, title, sub, provider, color }: any) {
  return (
    <div style={{ background: "#fff", border: `1.5px solid ${color}40`, borderRadius: 10, padding: "10px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#0f172a" }}>{title}</p>
      <p style={{ margin: "0 0 2px", fontSize: 9, color: "#64748b" }}>{sub}</p>
      <span style={{ display: "inline-block", background: `${color}15`, color, fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, border: `1px solid ${color}30` }}>{provider}</span>
    </div>
  );
}
