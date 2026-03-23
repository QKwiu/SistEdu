import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface SchoolSession {
  schoolId: string;
  schoolName: string;
  adminEmail: string;
  isNew: boolean;
}

interface AuthContextType {
  session: SchoolSession | null;
  login: (data: SchoolSession) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_KEY = "kiwara_school_session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SchoolSession | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const login = (data: SchoolSession) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    setSession(data);
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function generateSchoolId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "SCH-";
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}
