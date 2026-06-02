export default function Arquitectura() {
  const BLUE = "#2563eb", VIOLET = "#7c3aed", GREEN = "#059669", AMBER = "#d97706",
        CYAN = "#0891b2", RED = "#dc2626", INDIGO = "#6366f1", SLATE = "#64748b",
        TEAL = "#0d9488", PINK = "#db2777";

  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", background: "#0f172a", minHeight: "100vh", padding: "24px", color: "#f1f5f9" }}>

      {/* ── HEADER ── */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#2563eb,#16a34a)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, color: "#fff" }}>K</div>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", color: "#f8fafc" }}>Kiwara Tech</span>
          <span style={{ background: "#1e3a5f", color: "#93c5fd", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, border: "1px solid #3b82f640" }}>MVP v1.0</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.5px", color: "#f8fafc" }}>Arquitectura Aplicacional — Alto Nível</h1>
        <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Componentes · Serviços · Integrações · Fluxos de Dados</p>
      </div>

      {/* ── MAIN GRID: 3 columns ── */}
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 200px", gap: 16, alignItems: "start" }}>

        {/* ──────── LEFT: UTILIZADORES ──────── */}
        <div>
          <SectionHeader label="UTILIZADORES" color={BLUE} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <UserCard icon="👤" label="Admin Plataforma" detail="Kiwara Tech" color={BLUE} />
            <UserCard icon="🏫" label="Gestor Escolar" detail="Director / Secretário" color={VIOLET} />
            <UserCard icon="👨‍👩‍👧" label="Encarregado / Aluno" detail="Browser — Web Responsivo" color={CYAN} badge="WEB" />
            <UserCard icon="🖥️" label="Atendente / Tesoureiro" detail="Staff da escola" color={GREEN} />
          </div>
          <div style={{ marginTop: 12, background: "#0c1a2e", border: "1px solid #1e3a5f", borderRadius: 8, padding: "8px 10px" }}>
            <p style={{ fontSize: 9, color: "#60a5fa", fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase" }}>Acesso via</p>
            <AccessBadge icon="🌐" label="Browser Web" />
            <AccessBadge icon="📱" label="Mobile (responsivo)" />
            <AccessBadge icon="💻" label="Desktop / Tablet" />
          </div>
        </div>

        {/* ──────── CENTER: SISTEMA ──────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          {/* SPA Layer */}
          <Layer bg="#0d1f3c" border={BLUE} label="SPA WEB — React + Vite (Aplicação Única Responsiva)" labelColor="#93c5fd">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
              <AppComp icon="⚙️" label="Dashboard Admin" sub="Config plataforma, escolas, emolumentos" color={INDIGO} />
              <AppComp icon="📊" label="Dashboard Escola" sub="Gestão alunos, propinas, relatórios" color={VIOLET} />
              <AppComp icon="🌐" label="Portal Encarregado" sub="Web responsivo ★ Mobile/Tablet/Desktop" color={CYAN} highlight />
              <AppComp icon="📋" label="Portal Público" sub="Comunicados, motor partilha, escola" color={GREEN} />
              <AppComp icon="💳" label="Staff Portal" sub="Caixa, baixas, recibos impressão" color={AMBER} />
            </div>
          </Layer>

          {/* Arrow down */}
          <FlowArrow label="HTTP REST / JSON" />

          {/* API Gateway */}
          <div style={{ background: "#1a0a2e", border: `2px solid ${VIOLET}`, borderRadius: 10, padding: "8px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.06em" }}>API GATEWAY — Express 5 + Node.js · Porta 8080</span>
              <span style={{ background: "#7c3aed20", color: "#a78bfa", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, border: "1px solid #7c3aed40" }}>REST API</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 6 }}>
              <ServiceBox icon="🔐" label="Auth Service" items={["JWT / Bcrypt","Sessions","RBAC"]} color={RED} />
              <ServiceBox icon="🎓" label="School Mgmt" items={["Alunos","Turmas","Infantil"]} color={VIOLET} />
              <ServiceBox icon="💰" label="Finance Engine" items={["Propinas","Faturas","Ciclo"]} color={AMBER} />
              <ServiceBox icon="💳" label="Payment Engine" items={["EMIS / GPO","Multicaixa","Direct Debit"]} color={GREEN} />
              <ServiceBox icon="📢" label="Comms Hub" items={["SMS","FCM Push","Portal"]} color={CYAN} />
              <ServiceBox icon="📈" label="Reporting" items={["Financeiro","Config","EMIS"]} color={INDIGO} />
            </div>
          </div>

          {/* Arrow down */}
          <FlowArrow label="SQL / PostgreSQL Driver" />

          {/* Data Layer */}
          <Layer bg="#0a1f14" border={GREEN} label="DATA LAYER — PostgreSQL" labelColor="#4ade80">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
              {[
                { t: "schools", icon: "🏫" },
                { t: "students", icon: "🎓" },
                { t: "propinas", icon: "💰" },
                { t: "sessions", icon: "🔐" },
                { t: "fcm_tokens", icon: "🔔" },
                { t: "platform_config", icon: "⚙️" },
                { t: "comunicados", icon: "📢" },
              ].map(db => (
                <div key={db.t} style={{ background: "#0d2818", border: "1px solid #16a34a40", borderRadius: 7, padding: "6px 4px", textAlign: "center" }}>
                  <div style={{ fontSize: 13, marginBottom: 2 }}>{db.icon}</div>
                  <p style={{ margin: 0, fontSize: 8, fontWeight: 700, color: "#4ade80", fontFamily: "monospace" }}>{db.t}</p>
                </div>
              ))}
            </div>
          </Layer>
        </div>

        {/* ──────── RIGHT: INTEGRAÇÕES ──────── */}
        <div>
          <SectionHeader label="INTEGRAÇÕES EXTERNAS" color={AMBER} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <IntCard icon="🔔" label="Firebase FCM" detail="Push Notifications" sub="JWT RS256 nativo · Google Cloud" color={AMBER} flow="Comms Hub →" />
            <IntCard icon="📱" label="Provedor SMS" detail="Notificações SMS" sub="Configurável via admin" color={CYAN} flow="Comms Hub →" />
            <IntCard icon="🏛️" label="EMIS SEPE" detail="Emolumentos Escolares" sub="Referências oficiais · Angola" color={RED} flow="Payment Engine →" />
            <IntCard icon="🔗" label="GPO Reference" detail="Referências Pagamento" sub="Integração bancária · Angola" color={VIOLET} flow="Payment Engine →" />
            <IntCard icon="💳" label="Multicaixa Express" detail="Pagamentos Móveis" sub="Confirmação automática · EMIS" color={GREEN} flow="Payment Engine →" />
          </div>

          {/* Auth legend */}
          <div style={{ marginTop: 12, background: "#0c1a2e", border: "1px solid #1e3a5f", borderRadius: 8, padding: "8px 10px" }}>
            <p style={{ fontSize: 9, color: "#fbbf24", fontWeight: 700, margin: "0 0 5px", textTransform: "uppercase" }}>Autenticação FCM</p>
            <p style={{ fontSize: 8, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
              JWT RS256 via <code style={{ color: "#a78bfa" }}>crypto</code> Node.js<br/>
              → Google OAuth2 Token<br/>
              → FCM HTTP v1 API<br/>
              <em style={{ color: "#64748b" }}>Sem firebase-admin SDK</em>
            </p>
          </div>
        </div>
      </div>

      {/* ── BOTTOM: SEGURANÇA & INFRA ── */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <InfoBar icon="🔒" title="Segurança" color="#dc2626" bg="#1a0a0a" border="#dc262640"
          items={["bcrypt passwords (staff)","JWT sessions (school/guardian)","HMAC webhook verification","Rate limiting (express-rate-limit)","Helmet.js headers","Env-var admin credentials"]} />
        <InfoBar icon="🏗️" title="Infra & Deploy" color="#6366f1" bg="#0d0d1a" border="#6366f140"
          items={["pnpm Monorepo (workspace)","React + Vite (Frontend)","Express 5 + Node.js (API)","PostgreSQL (Replit DB)","Deploy: Replit","Port 8080 (API) + 25824 (SPA)"]} />
        <InfoBar icon="📦" title="Stack Técnico" color="#0891b2" bg="#0a1a1f" border="#0891b240"
          items={["TypeScript (full-stack)","Tailwind CSS (responsivo)","Drizzle ORM","Zod (validação)","ESBuild (bundle API)","Vite (bundle SPA)"]} />
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", marginTop: 20, paddingTop: 12, borderTop: "1px solid #1e293b" }}>
        <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>
          Kiwara Tech · Angola · MVP v1.0 · Junho 2026 · Portal Encarregado = Web Responsivo (sem app mobile nativa)
        </p>
      </div>
    </div>
  );
}

/* ── SUB-COMPONENTS ── */

function SectionHeader({ label, color }: any) {
  return (
    <div style={{ background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 6, padding: "4px 8px", marginBottom: 8 }}>
      <p style={{ margin: 0, fontSize: 9, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.07em" }}>▌ {label}</p>
    </div>
  );
}

function UserCard({ icon, label, detail, color, badge }: any) {
  return (
    <div style={{ background: "#0f1f35", border: `1px solid ${color}30`, borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
      {badge && <span style={{ position: "absolute", top: 4, right: 4, background: "#0891b2", color: "#fff", fontSize: 7, fontWeight: 800, padding: "1px 4px", borderRadius: 3 }}>{badge}</span>}
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#f1f5f9" }}>{label}</p>
        <p style={{ margin: 0, fontSize: 8, color: "#64748b" }}>{detail}</p>
      </div>
    </div>
  );
}

function AccessBadge({ icon, label }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "2px 0" }}>
      <span style={{ fontSize: 10 }}>{icon}</span>
      <span style={{ fontSize: 9, color: "#94a3b8" }}>{label}</span>
    </div>
  );
}

function Layer({ bg, border, label, labelColor, children }: any) {
  return (
    <div style={{ background: bg, border: `2px solid ${border}`, borderRadius: 10, padding: "8px 10px" }}>
      <p style={{ margin: "0 0 8px", fontSize: 9, fontWeight: 800, color: labelColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>▌ {label}</p>
      {children}
    </div>
  );
}

function FlowArrow({ label }: any) {
  return (
    <div style={{ textAlign: "center", padding: "2px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <div style={{ height: 1, flex: 1, background: "linear-gradient(to right, transparent, #334155)" }} />
      <span style={{ fontSize: 10, color: "#475569", fontWeight: 600 }}>{label}</span>
      <div style={{ height: 1, flex: 1, background: "linear-gradient(to left, transparent, #334155)" }} />
    </div>
  );
}

function AppComp({ icon, label, sub, color, highlight }: any) {
  return (
    <div style={{ background: highlight ? `${color}18` : "#0a1628", border: `1px solid ${highlight ? color : color + "35"}`, borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
      <div style={{ fontSize: 18, marginBottom: 3 }}>{icon}</div>
      <p style={{ margin: "0 0 2px", fontSize: 9, fontWeight: 700, color: highlight ? color : "#cbd5e1" }}>{label}</p>
      <p style={{ margin: 0, fontSize: 7.5, color: "#64748b", lineHeight: 1.3 }}>{sub}</p>
    </div>
  );
}

function ServiceBox({ icon, label, items, color }: any) {
  return (
    <div style={{ background: "#10082a", border: `1px solid ${color}35`, borderRadius: 8, padding: "7px 6px" }}>
      <div style={{ textAlign: "center", fontSize: 16, marginBottom: 3 }}>{icon}</div>
      <p style={{ margin: "0 0 4px", fontSize: 8.5, fontWeight: 700, color, textAlign: "center" }}>{label}</p>
      {items.map((i: string) => (
        <p key={i} style={{ margin: "1px 0", fontSize: 7.5, color: "#64748b" }}>· {i}</p>
      ))}
    </div>
  );
}

function IntCard({ icon, label, detail, sub, color, flow }: any) {
  return (
    <div style={{ background: "#0f1f35", border: `1px solid ${color}35`, borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <div>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#f1f5f9" }}>{label}</p>
          <p style={{ margin: 0, fontSize: 8, color, fontWeight: 600 }}>{detail}</p>
        </div>
      </div>
      <p style={{ margin: "3px 0 2px", fontSize: 7.5, color: "#64748b" }}>{sub}</p>
      <div style={{ background: `${color}15`, border: `1px solid ${color}25`, borderRadius: 4, padding: "2px 5px", display: "inline-block" }}>
        <span style={{ fontSize: 7, color, fontWeight: 700 }}>← {flow}</span>
      </div>
    </div>
  );
}

function InfoBar({ icon, title, color, bg, border, items }: any) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px" }}>
      <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, color, display: "flex", alignItems: "center", gap: 5 }}>
        <span>{icon}</span> {title}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 8px" }}>
        {items.map((i: string) => (
          <p key={i} style={{ margin: "1px 0", fontSize: 8, color: "#94a3b8" }}>· {i}</p>
        ))}
      </div>
    </div>
  );
}
