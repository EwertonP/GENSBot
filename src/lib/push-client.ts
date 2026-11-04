/** Lado do navegador das notificações push. Só chamar em useEffect/handlers. */

export type EstadoPush = 'indisponivel' | 'precisa-instalar' | 'bloqueado' | 'desativado' | 'ativo';

const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalado = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function chavePublica(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
}

function paraUint8(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function estadoPush(): Promise<EstadoPush> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !chavePublica()) return 'indisponivel';
  // No iPhone o push só existe com o app instalado na tela inicial.
  if (ehIOS() && !instalado()) return 'precisa-instalar';
  if (!('PushManager' in window) || !('Notification' in window)) return 'indisponivel';
  if (Notification.permission === 'denied') return 'bloqueado';
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'ativo' : 'desativado';
}

/** Pede permissão, inscreve o aparelho e registra no servidor. Precisa vir de um toque. */
export async function ativarPush(): Promise<EstadoPush> {
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') return permissao === 'denied' ? 'bloqueado' : 'desativado';

  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraUint8(chavePublica()) }));
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }),
  });
  if (!res.ok) {
    await sub.unsubscribe();
    throw new Error('Não foi possível ativar as notificações. Tente de novo.');
  }
  return 'ativo';
}

export async function desativarPush(): Promise<EstadoPush> {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    await sub.unsubscribe();
  }
  return 'desativado';
}

export async function enviarTestePush(): Promise<string> {
  const res = await fetch('/api/push/test', { method: 'POST' });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || 'Não foi possível enviar o teste.');
  return 'Teste enviado. A notificação deve chegar em instantes.';
}
