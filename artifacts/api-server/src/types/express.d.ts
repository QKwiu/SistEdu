/**
 * express.d.ts — Extensão global do Request do Express
 *
 * Elimina o uso de `req: any` em todas as rotas ao declarar
 * as propriedades adicionadas pelos middlewares de autenticação.
 *
 * Este ficheiro é incluído automaticamente via tsconfig `include: ["src"]`.
 */

declare global {
  namespace Express {
    interface Request {
      /** Token JWT bruto do encarregado — definido por authMiddleware/guardianAuth */
      guardianToken?: string;
      /** Token JWT bruto da escola — definido por schoolAuth em school.ts, contingencia.ts, etc. */
      schoolToken?: string;
      /** Token JWT bruto do admin — definido por adminAuth em direct-debit.ts, admin.ts, etc. */
      adminToken?: string;
      /** ID numérico da escola — definido por schoolAuth (rbac.ts) e staffAuth (enriquecimento directo) */
      schoolId?: number;
      /** Nome da escola — definido por schoolAuth em rbac.ts */
      schoolName?: string;
      /** Email do actor autenticado (escola ou staff) — definido por schoolAuth/staffAuth em rbac.ts */
      actorEmail?: string;
      /** ID numérico do utilizador staff — definido por staffAuth em rbac.ts */
      staffId?: number;
      /** Email do utilizador staff — definido por staffAuth em rbac.ts */
      staffEmail?: string;
      /** Nome do utilizador staff — definido por staffAuth em rbac.ts */
      staffNome?: string;
      /** Nome do perfil/role do utilizador staff — definido por staffAuth em rbac.ts */
      staffRoleNome?: string;
    }
  }
}

export {};
