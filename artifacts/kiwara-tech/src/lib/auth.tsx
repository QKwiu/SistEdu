import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface SchoolSession {
  schoolId: string;
  schoolName: string;
  adminEmail: string;
  isNew: boolean;
  institutionType?: string;
  portalNomenclatura?: string;
}

interface AuthContextType {
  session: SchoolSession | null;
  token: string | null;
  login: (data: SchoolSession, token?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_KEY = "kiwara_school_session";
const TOKEN_KEY = "kiwara_school_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SchoolSession | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY)
  );

  const login = (data: SchoolSession, tok?: string) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    setSession(data);
    if (tok) {
      localStorage.setItem(TOKEN_KEY, tok);
      setToken(tok);
    }
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setSession(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ session, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/* ─── Admin token helpers (module-level, safe to call anywhere) ─── */
export const ADMIN_TOKEN_KEY = "kiwara_admin_token";

export function getAdminToken(): string {
  return localStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
}

export function setAdminToken(token: string): void {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function generateSchoolId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "SCH-";
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}
