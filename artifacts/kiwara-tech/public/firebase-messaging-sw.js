/**
 * firebase-messaging-sw.js
 *
 * Service Worker para receber Push Notifications FCM em background.
 *
 * Este ficheiro é GERADO automaticamente pelo plugin Vite (vite-plugin-firebase-sw)
 * configurado em vite.config.ts — não o edites manualmente.
 * Os placeholders %VITE_FIREBASE_*% são substituídos pelas variáveis de ambiente
 * no arranque do servidor de desenvolvimento e na build de produção.
 *
 * Utiliza o SDK Firebase Compat via CDN (necessário em Service Workers não bundled).
 * A versão deve corresponder à instalada em package.json.
 */

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "",
  authDomain:        "",
  projectId:         "",
  storageBucket:     "",
  messagingSenderId: "",
  appId:             "",
});

const messaging = firebase.messaging();

/**
 * onBackgroundMessage — disparado quando chega uma notificação FCM
 * e o separador da app está em segundo plano ou fechado.
 */
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw] Mensagem em background:", payload);

  const { title, body, icon } = payload.notification ?? {};
  const data = payload.data ?? {};

  self.registration.showNotification(title ?? "Kiwara Tech", {
    body:  body  ?? "Tem uma nova notificação da escola.",
    icon:  icon  ?? "/favicon.svg",
    badge: "/favicon.svg",
    tag:   data.tag ?? "kiwara-push",
    data:  { url: data.url ?? "/" },
    actions: data.url
      ? [{ action: "open", title: "Ver detalhes" }]
      : [],
  });
});

/**
 * notificationclick — abre/foca o separador correcto ao clicar na notificação.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});
