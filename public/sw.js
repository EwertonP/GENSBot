/* Service worker do GENSBot: só notificações push e abertura da tela certa.
   Sem cache de páginas ou dados (é uma ferramenta de operação ao vivo; dado
   velho atrapalha). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { title: 'GENSBot', body: event.data ? event.data.text() : '' };
  }
  const titulo = dados.title || 'GENSBot';
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: dados.tag || undefined,
      renotify: Boolean(dados.tag),
      data: { url: dados.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if (new URL(j.url).origin === self.location.origin && 'focus' in j) {
          if ('navigate' in j) j.navigate(destino);
          return j.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
