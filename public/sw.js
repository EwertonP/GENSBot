/* Service worker do GENSBot: notificações push (com imagem e botões), número no
   ícone do app e abertura da tela certa. Sem cache de páginas ou dados (é uma
   ferramenta de operação ao vivo; dado velho atrapalha). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

/** Número de não lidas no ícone do app (onde o sistema suporta). */
function atualizarBadge(naoLidas) {
  try {
    const nav = self.navigator;
    if (typeof naoLidas !== 'number' || !nav) return Promise.resolve();
    if (naoLidas > 0 && 'setAppBadge' in nav) return nav.setAppBadge(naoLidas);
    if (naoLidas === 0 && 'clearAppBadge' in nav) return nav.clearAppBadge();
  } catch (e) {
    /* badge é só um extra */
  }
  return Promise.resolve();
}

/** Avisa as telas abertas para atualizarem o sino na hora. */
function avisarTelas(naoLidas) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
    janelas.forEach((j) => j.postMessage({ tipo: 'notificacao', naoLidas: typeof naoLidas === 'number' ? naoLidas : null }));
  });
}

self.addEventListener('push', (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { title: 'GENSBot', body: event.data ? event.data.text() : '' };
  }
  const titulo = dados.title || 'GENSBot';
  const acoes = Array.isArray(dados.acoes) ? dados.acoes : [];
  // Cada botão guarda o que fazer ao ser tocado (abrir uma tela ou executar uma ação assinada).
  const porId = {};
  acoes.forEach((a) => {
    if (a && a.id) porId[a.id] = { url: a.url || null, token: a.token || null };
  });

  const opcoes = {
    body: dados.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: dados.tag || undefined,
    renotify: Boolean(dados.tag),
    data: { url: dados.url || '/', acoes: porId },
  };
  if (dados.image) opcoes.image = dados.image;
  if (acoes.length) opcoes.actions = acoes.filter((a) => a && a.id && a.rotulo).map((a) => ({ action: a.id, title: a.rotulo }));
  if (dados.prioridade === 'urgente') opcoes.requireInteraction = true;
  if (dados.prioridade === 'baixa') opcoes.silent = true;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(titulo, opcoes),
      atualizarBadge(dados.naoLidas),
      avisarTelas(dados.naoLidas),
    ])
  );
});

function abrirTela(destinoRelativo) {
  const destino = new URL(destinoRelativo || '/', self.location.origin).href;
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
    for (const j of janelas) {
      if (new URL(j.url).origin === self.location.origin && 'focus' in j) {
        if ('navigate' in j) j.navigate(destino);
        return j.focus();
      }
    }
    return self.clients.openWindow(destino);
  });
}

/** Executa a ação assinada do botão; se não der certo, abre a tela para a pessoa decidir. */
function executarAcao(token, urlReserva) {
  return fetch('/api/notificacoes/acao', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
    .then((res) => res.json().catch(() => ({})).then((json) => ({ ok: res.ok, json })))
    .then(({ ok, json }) => {
      if (!ok) return abrirTela(urlReserva);
      return self.registration.showNotification(json.titulo || 'Pronto', {
        body: json.mensagem || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-96.png',
        tag: 'acao-feita',
        silent: true,
        data: { url: urlReserva, acoes: {} },
      });
    })
    .catch(() => abrirTela(urlReserva));
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const acao = event.action && data.acoes ? data.acoes[event.action] : null;

  if (acao && acao.token) {
    event.waitUntil(executarAcao(acao.token, acao.url || data.url));
    return;
  }
  event.waitUntil(abrirTela((acao && acao.url) || data.url));
});

/* O navegador pode trocar a inscrição do aparelho: reinscreve e avisa o servidor. */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const opcoes = event.oldSubscription && event.oldSubscription.options;
      const chave = opcoes && opcoes.applicationServerKey;
      if (!chave) return;
      const nova = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: nova.toJSON() }),
      });
    })().catch(() => {})
  );
});
