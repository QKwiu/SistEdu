/**
 * firebase.ts — Inicialização do Firebase App (SDK Modular v10+).
 *
 * Variáveis de ambiente necessárias (.env.local / Replit Secrets):
 *   VITE_FIREBASE_API_KEY
 *   VITE_FIREBASE_AUTH_DOMAIN
 *   VITE_FIREBASE_PROJECT_ID
 *   VITE_FIREBASE_STORAGE_BUCKET
 *   VITE_FIREBASE_MESSAGING_SENDER_ID
 *   VITE_FIREBASE_APP_ID
 *   VITE_FIREBASE_VAPID_KEY   ← chave pública VAPID da consola Firebase
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            as string,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        as string,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         as string,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             as string,
};

/** Singleton do Firebase App — seguro para hot-reload em desenvolvimento. */
export const firebaseApp: FirebaseApp =
  getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

/**
 * Retorna a instância de Firebase Messaging.
 * Lança erro se o browser não suportar a API ou se as variáveis de ambiente
 * não estiverem configuradas, para falha explícita em vez de erro silencioso.
 */
export function getFirebaseMessaging(): Messaging {
  if (!("Notification" in window)) {
    throw new Error("Este browser não suporta notificações.");
  }
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error(
      "Firebase não configurado: define VITE_FIREBASE_* nas variáveis de ambiente."
    );
  }
  return getMessaging(firebaseApp);
}
