/**
 * use-push-notifications.ts
 *
 * Hook que gere todo o ciclo de vida das Push Notifications FCM:
 *   1. Registo do Service Worker (firebase-messaging-sw.js)
 *   2. Pedido de permissão de notificação ao utilizador
 *   3. Obtenção do Token FCM do dispositivo (getToken + VAPID key)
 *   4. Envio do token ao backend para persistência na DB
 *
 * Uso:
 *   const { permission, fcmToken, requestPermission } = usePushNotifications(authToken);
 *
 * Chamar `requestPermission()` num clique do utilizador (requisito dos browsers).
 * O hook auto-regista o SW e tenta obter o token se a permissão já foi concedida
 * em sessões anteriores.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getToken, onMessage, type Messaging } from "firebase/messaging";
import { getFirebaseMessaging } from "@/lib/firebase";

export type PermissionState = "default" | "granted" | "denied" | "unsupported";

export interface PushNotificationState {
  /** Estado actual da permissão de notificação do browser. */
  permission: PermissionState;
  /** Token FCM do dispositivo; null se ainda não obtido. */
  fcmToken: string | null;
  /** Indica que o pedido de permissão / obtenção do token está em curso. */
  loading: boolean;
  /** Mensagem de erro; null se não houver erro. */
  error: string | null;
  /**
   * Solicita permissão de notificação e regista o dispositivo.
   * Chamar apenas a partir de um gesto do utilizador (click/tap).
   */
  requestPermission: () => Promise<void>;
}

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
const API_BASE  = "/api";
const SW_PATH   = "/firebase-messaging-sw.js";

/** Regista o Service Worker e devolve o ServiceWorkerRegistration. */
async function registerSW(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Workers não são suportados neste browser.");
  }
  const existing = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_PATH, { scope: "/" });
}

/**
 * Envia o token FCM ao backend via POST /school/fcm/subscribe.
 *
 * Payload conforme spec:
 *   token_fcm   — token FCM gerado pelo Firebase SDK
 *   device_type — "web" | "mobile_android" | "mobile_ios"
 *
 * Espera HTTP 201 em caso de sucesso; lança erro explícito em qualquer outro caso.
 */
async function subscribeTokenOnBackend(
  fcmToken: string,
  authToken: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/school/fcm/subscribe`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      token_fcm:   fcmToken,
      device_type: "web",
    }),
  });

  if (res.status !== 201) {
    const body = await res.json().catch(() => ({})) as { error?: string; detalhes?: unknown };
    const detail = body.error ?? `Backend devolveu HTTP ${res.status}`;
    console.error("[subscribeTokenOnBackend] Erro:", detail, body.detalhes ?? "");
    throw new Error(detail);
  }
}

export function usePushNotifications(authToken: string | null): PushNotificationState {
  const [permission, setPermission] = useState<PermissionState>(() => {
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission as PermissionState;
  });
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const messagingRef    = useRef<Messaging | null>(null);
  const swRegistration  = useRef<ServiceWorkerRegistration | null>(null);
  const unsubscribeRef  = useRef<(() => void) | null>(null);

  /** Inicializa Messaging e SW uma única vez. */
  useEffect(() => {
    if (permission === "unsupported") return;

    (async () => {
      try {
        messagingRef.current  = getFirebaseMessaging();
        swRegistration.current = await registerSW();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[usePushNotifications] Inicialização falhou:", msg);
        setError(msg);
      }
    })();

    return () => {
      unsubscribeRef.current?.();
    };
  }, [permission]);

  /** Se a permissão já estava concedida de uma sessão anterior, obtém o token. */
  useEffect(() => {
    if (permission !== "granted" || !authToken) return;

    (async () => {
      try {
        if (!messagingRef.current || !swRegistration.current) {
          messagingRef.current  = getFirebaseMessaging();
          swRegistration.current = await registerSW();
        }
        await obtainAndRegisterToken(authToken);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[usePushNotifications] Renovação de token falhou:", msg);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission, authToken]);

  /** Obtém o token FCM e envia-o ao backend. */
  const obtainAndRegisterToken = useCallback(
    async (token: string) => {
      if (!messagingRef.current) throw new Error("Firebase Messaging não inicializado.");
      if (!VAPID_KEY) throw new Error("VITE_FIREBASE_VAPID_KEY não está definida.");
      if (!swRegistration.current) throw new Error("Service Worker não registado.");

      const fcmTok = await getToken(messagingRef.current, {
        vapidKey:                VAPID_KEY,
        serviceWorkerRegistration: swRegistration.current,
      });

      if (!fcmTok) {
        throw new Error("Não foi possível obter o token FCM. Tenta novamente.");
      }

      console.log("[usePushNotifications] Token FCM obtido:", fcmTok.slice(0, 20) + "…");
      setFcmToken(fcmTok);
      await subscribeTokenOnBackend(fcmTok, token);
      console.log("[usePushNotifications] Token registado no backend com sucesso.");

      // Listener para mensagens em foreground (app em foco)
      unsubscribeRef.current?.();
      unsubscribeRef.current = onMessage(messagingRef.current, (payload) => {
        console.log("[usePushNotifications] Mensagem em foreground:", payload);
        const { title, body } = payload.notification ?? {};
        if (Notification.permission === "granted" && title) {
          new Notification(title, {
            body:  body ?? "",
            icon:  "/favicon.svg",
            badge: "/favicon.svg",
          });
        }
      });
    },
    []
  );

  /**
   * Solicita permissão ao utilizador, regista o SW e obtém o token FCM.
   * Deve ser chamado a partir de um clique (requisito dos browsers modernos).
   */
  const requestPermission = useCallback(async () => {
    if (permission === "unsupported") {
      setError("Este browser não suporta notificações push.");
      return;
    }
    if (permission === "denied") {
      setError(
        "Notificações bloqueadas. Activa-as manualmente nas definições do browser."
      );
      return;
    }
    if (!authToken) {
      setError("Sessão inválida. Inicia sessão novamente.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);

      if (result !== "granted") {
        setError("Permissão negada. Podes activar notificações nas definições do browser.");
        return;
      }

      if (!messagingRef.current) messagingRef.current = getFirebaseMessaging();
      if (!swRegistration.current) swRegistration.current = await registerSW();

      await obtainAndRegisterToken(authToken);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[usePushNotifications] Erro:", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [permission, authToken, obtainAndRegisterToken]);

  return { permission, fcmToken, loading, error, requestPermission };
}
