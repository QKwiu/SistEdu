import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { apiLimiter } from "./lib/rate-limiters";
import { pool } from "@workspace/db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

/* ── Trust Replit's reverse proxy (sets X-Forwarded-For) ── */
/* Required for express-rate-limit v8 to work correctly     */
app.set("trust proxy", 1);

/* ── Security headers ── */
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

/* ── Strict CORS ── */
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Webhook-Signature", "X-Idempotency-Key"],
  credentials: true,
}));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

/* ── Body size limits (DoS prevention) ── */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

/* ── General API rate limit ── */
app.use("/api", apiLimiter);

app.use("/api", router);

// 🔒 SEGURANÇA: documentos de alunos requerem sessão autenticada — previne acesso público a BIs e documentos pessoais (IDOR / Data Exposure)
async function uploadsAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Acesso não autorizado." });
  }
  const token = auth.slice(7);
  try {
    const r = await pool.query(
      `SELECT 1 FROM sessions WHERE token=$1 AND expires_at > NOW()
       UNION ALL
       SELECT 1 FROM guardian_sessions WHERE token=$1 AND expires_at > NOW()
       UNION ALL
       SELECT 1 FROM admin_sessions WHERE token=$1 AND expires_at > NOW()
       LIMIT 1`,
      [token]
    );
    if (!r.rows.length) return res.status(401).json({ error: "Sessão inválida." });
    next();
  } catch {
    return res.status(500).json({ error: "Erro interno." });
  }
}

// Serve uploaded documents (authenticated)
const uploadsDir = path.join(__dirname, "..", "uploads");
app.use("/api/uploads", uploadsAuth, express.static(uploadsDir));

export default app;
