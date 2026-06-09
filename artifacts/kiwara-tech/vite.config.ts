import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

/**
 * vite-plugin-firebase-sw
 *
 * Gera public/firebase-messaging-sw.js (dev) e dist/public/firebase-messaging-sw.js
 * (build) a partir do template em public/firebase-messaging-sw.js, substituindo os
 * placeholders %VITE_FIREBASE_*% pelas variáveis de ambiente actuais.
 *
 * O SW fica assim no scope correcto (/) e pode usar configuração por ambiente
 * sem expor segredos no código-fonte versionado.
 */
function firebaseSwPlugin(): Plugin {
  const templatePath = path.resolve(import.meta.dirname, "public/firebase-messaging-sw.js");

  function buildSwContent(env: Record<string, string>): string {
    let content = fs.readFileSync(templatePath, "utf-8");
    const keys = [
      "VITE_FIREBASE_API_KEY",
      "VITE_FIREBASE_AUTH_DOMAIN",
      "VITE_FIREBASE_PROJECT_ID",
      "VITE_FIREBASE_STORAGE_BUCKET",
      "VITE_FIREBASE_MESSAGING_SENDER_ID",
      "VITE_FIREBASE_APP_ID",
    ];
    for (const key of keys) {
      content = content.replaceAll(`%${key}%`, env[key] ?? "");
    }
    return content;
  }

  return {
    name: "vite-plugin-firebase-sw",

    // Dev: reescreve o ficheiro na pasta public com os valores actuais
    configResolved(config) {
      if (config.command !== "serve") return;
      try {
        const content = buildSwContent(config.env);
        fs.writeFileSync(templatePath, content, "utf-8");
      } catch {
        // Template ainda tem placeholders — ignora (será gerado na primeira configuração)
      }
    },

    // Build: emite o SW como asset no outDir
    generateBundle(_, bundle) {
      const env: Record<string, string> = {};
      for (const [k, v] of Object.entries(process.env)) {
        if (k.startsWith("VITE_")) env[k] = v ?? "";
      }
      const content = buildSwContent(env);

      // Não deve ser hashed — o browser precisa de encontrá-lo em /firebase-messaging-sw.js
      this.emitFile({
        type:     "asset",
        fileName: "firebase-messaging-sw.js",
        source:   content,
      });

      // Remove o SW do bundle se o Vite o copiou da pasta public (evita duplicado)
      if ("firebase-messaging-sw.js" in bundle) {
        delete bundle["firebase-messaging-sw.js"];
      }
    },
  };
}

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    firebaseSwPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
