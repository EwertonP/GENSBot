/**
 * Ferramentas do MCP — Onda C13: mídia pra publicação.
 *
 * A Graph API do Instagram só publica a partir de uma URL pública. Estas
 * ferramentas colocam a arte (export do Figma, vídeo do Reels) no R2 e a ligam
 * à demanda, pra depois a C14 agendar ou publicar. Só master mexe em mídia.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { supabase as db } from '../supabase';
import { ErroFerramenta, type Ferramenta } from './ferramentas';
import { str } from './ferramentas-c3';
import { isR2Configured, getPresignedUploadUrl, putR2Object } from '../r2';
import { sanitizeFileName } from '../storage-upload';
import type { ArquivoConteudo } from '../conteudo';
import type { ContextoMcp } from './oauth';

type Args = Record<string, unknown>;

const MB = 1024 * 1024;
/** Tipos que a Graph API aceita. PNG fica de fora: a publicação recusa. */
export const TIPOS_MIDIA: Record<string, { tipo: 'imagem' | 'video'; limite: number; ext: string }> = {
  'image/jpeg': { tipo: 'imagem', limite: 8 * MB, ext: 'jpg' },
  'video/mp4': { tipo: 'video', limite: 300 * MB, ext: 'mp4' },
  'video/quicktime': { tipo: 'video', limite: 300 * MB, ext: 'mov' },
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPIRA_UPLOAD_S = 600;
const MAX_REDIRECTS = 3;

function exigirMaster(ctx: ContextoMcp) {
  if (ctx.papel !== 'master') throw new ErroFerramenta('Só o master pode subir e anexar mídia.');
}
function exigirR2() {
  if (!isR2Configured()) throw new ErroFerramenta('O armazenamento de mídia (R2) não está configurado neste ambiente.');
}
function tipoPermitido(mime: string) {
  const t = TIPOS_MIDIA[mime.toLowerCase().split(';')[0].trim()];
  if (!t) {
    throw new ErroFerramenta(
      `Tipo "${mime}" não aceito. Use ${Object.keys(TIPOS_MIDIA).join(', ')} (PNG não publica no Instagram: exporte do Figma em JPG).`,
    );
  }
  return t;
}
function chaveR2(agenciaId: string, nome: string, ext: string) {
  const base = sanitizeFileName(nome || `midia.${ext}`);
  return `mcp/${agenciaId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${base}`;
}

/** Endereços que o servidor nunca deve buscar (rede interna, loopback, metadata de nuvem). */
export function ipPrivado(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
    const mapeado = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapeado ? ipPrivado(mapeado[1]) : false;
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

async function validarDestino(url: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new ErroFerramenta('"url" não é uma URL válida.');
  }
  if (u.protocol !== 'https:') throw new ErroFerramenta('"url" precisa ser https.');
  if (u.username || u.password) throw new ErroFerramenta('"url" não pode ter usuário/senha.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new ErroFerramenta('"url" aponta pra um endereço interno.');
  }
  const enderecos = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (enderecos.length === 0) throw new ErroFerramenta('Não consegui resolver o endereço da "url".');
  if (enderecos.some((e) => ipPrivado(e.address))) throw new ErroFerramenta('"url" aponta pra um endereço interno.');
  return u;
}

async function baixar(url: string, limite: number): Promise<{ corpo: Buffer; mime: string }> {
  let atual = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const alvo = await validarDestino(atual);
    const resp = await fetch(alvo, { redirect: 'manual', signal: AbortSignal.timeout(45_000) });
    if (resp.status >= 300 && resp.status < 400) {
      const prox = resp.headers.get('location');
      if (!prox) throw new ErroFerramenta('Redirecionamento sem destino.');
      atual = new URL(prox, alvo).toString();
      continue;
    }
    if (!resp.ok) throw new ErroFerramenta(`A URL respondeu ${resp.status}.`);
    const declarado = Number(resp.headers.get('content-length'));
    if (declarado > limite) throw new ErroFerramenta(`Arquivo maior que o limite de ${Math.round(limite / MB)} MB.`);
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length > limite) throw new ErroFerramenta(`Arquivo maior que o limite de ${Math.round(limite / MB)} MB.`);
    return { corpo: buf, mime: (resp.headers.get('content-type') || '').toLowerCase().split(';')[0].trim() };
  }
  throw new ErroFerramenta('Redirecionamentos demais.');
}

/** Confere pelo conteúdo, não só pelo cabeçalho: o Figma pode devolver PNG com content-type genérico. */
export function detectarMime(b: Buffer): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 12 && b.subarray(4, 8).toString('ascii') === 'ftyp') {
    return b.subarray(8, 12).toString('ascii').startsWith('qt') ? 'video/quicktime' : 'video/mp4';
  }
  if (b.length > 8 && b.subarray(1, 4).toString('ascii') === 'PNG') return 'image/png';
  return null;
}

export const FERRAMENTAS_C13: Ferramenta[] = [
  {
    name: 'preparar_upload_midia',
    title: 'Preparar upload de mídia',
    description:
      'Gera uma URL assinada (PUT, expira em 10 min) pra subir um arquivo no armazenamento do GENSBot, e a URL pública final que vai pra publicação. Faça o PUT com o mesmo Content-Type informado. Só JPG, MP4 ou MOV (PNG não publica no Instagram).',
    inputSchema: {
      type: 'object',
      properties: {
        nome: { type: 'string', description: 'Nome do arquivo, ex.: slide-1.jpg.' },
        tipo: { type: 'string', enum: Object.keys(TIPOS_MIDIA), description: 'Content-Type do arquivo.' },
        tamanho_bytes: { type: 'number', description: 'Tamanho do arquivo, pra recusar antes de subir se passar do limite.' },
      },
      required: ['nome', 'tipo', 'tamanho_bytes'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args: Args, ctx) {
      exigirMaster(ctx);
      exigirR2();
      const t = tipoPermitido(str(args.tipo, 60));
      const tamanho = Number(args.tamanho_bytes);
      if (!Number.isFinite(tamanho) || tamanho <= 0) throw new ErroFerramenta('"tamanho_bytes" precisa ser um número positivo.');
      if (tamanho > t.limite) throw new ErroFerramenta(`Arquivo de ${t.tipo} passa do limite de ${Math.round(t.limite / MB)} MB.`);

      const key = chaveR2(ctx.agenciaId, str(args.nome, 120), t.ext);
      const mime = str(args.tipo, 60).toLowerCase();
      const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, mime, EXPIRA_UPLOAD_S);
      return { upload_url: uploadUrl, metodo: 'PUT', content_type: mime, expira_em_segundos: EXPIRA_UPLOAD_S, url_publica: publicUrl, tipo: t.tipo };
    },
  },
  {
    name: 'importar_midia_url',
    title: 'Importar mídia por URL',
    description:
      'O servidor baixa uma URL https (export do Figma, link direto de arquivo) e grava no armazenamento do GENSBot. Devolve a URL pública pronta pra publicar. Só JPG, MP4 ou MOV, conferidos pelo conteúdo do arquivo; recusa endereços internos.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL https do arquivo.' },
        nome: { type: 'string', description: 'Nome do arquivo (opcional).' },
      },
      required: ['url'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args: Args, ctx) {
      exigirMaster(ctx);
      exigirR2();
      const { corpo, mime: mimeCabecalho } = await baixar(str(args.url, 2000), 300 * MB);
      const mime = detectarMime(corpo) || mimeCabecalho;
      if (mime === 'image/png') throw new ErroFerramenta('O arquivo é PNG, e o Instagram não publica PNG. Exporte do Figma em JPG.');
      const t = tipoPermitido(mime);
      if (corpo.length > t.limite) throw new ErroFerramenta(`Arquivo de ${t.tipo} passa do limite de ${Math.round(t.limite / MB)} MB.`);

      const key = chaveR2(ctx.agenciaId, str(args.nome, 120) || `midia.${t.ext}`, t.ext);
      const publicUrl = await putR2Object(key, corpo, mime);
      return { url_publica: publicUrl, tipo: t.tipo, content_type: mime, tamanho_bytes: corpo.length };
    },
  },
  {
    name: 'anexar_midia_demanda',
    title: 'Anexar mídia à demanda',
    description:
      'Liga URLs de mídia (de preparar_upload_midia ou importar_midia_url) a uma demanda da esteira, na ordem dos slides. Substitui os arquivos atuais da demanda, então mande a lista completa.',
    inputSchema: {
      type: 'object',
      properties: {
        demanda_id: { type: 'string', description: 'id (uuid) da demanda.' },
        midias: {
          type: 'array',
          minItems: 1,
          maxItems: 10,
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              tipo: { type: 'string', enum: ['imagem', 'video'] },
              nome: { type: 'string' },
            },
            required: ['url', 'tipo'],
            additionalProperties: false,
          },
          description: 'Na ordem de exibição.',
        },
      },
      required: ['demanda_id', 'midias'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args: Args, ctx) {
      exigirMaster(ctx);
      const id = str(args.demanda_id, 64);
      if (!UUID_RE.test(id)) throw new ErroFerramenta('"demanda_id" precisa ser um id (uuid) válido.');
      const midias = Array.isArray(args.midias) ? (args.midias as Args[]) : [];
      if (midias.length < 1 || midias.length > 10) throw new ErroFerramenta('Mande de 1 a 10 mídias.');

      const arquivos: ArquivoConteudo[] = midias.map((m, i) => {
        const url = str(m.url, 2000);
        const tipo = str(m.tipo, 10);
        if (!/^https:\/\//i.test(url)) throw new ErroFerramenta(`Mídia ${i + 1}: "url" precisa ser https.`);
        if (tipo !== 'imagem' && tipo !== 'video') throw new ErroFerramenta(`Mídia ${i + 1}: "tipo" deve ser imagem ou video.`);
        const nome = str(m.nome, 120);
        return { id: crypto.randomUUID(), url, tipo, ordem: i, ...(nome ? { nome } : {}) };
      });
      if (arquivos.some((a) => a.tipo === 'video') && arquivos.length > 1 && arquivos.every((a) => a.tipo === 'video')) {
        throw new ErroFerramenta('Reels é um vídeo só. Carrossel pode misturar imagem e vídeo, mas precisa de ao menos uma imagem.');
      }

      const { data: d } = await db.from('conteudo_items').select('id, titulo, status').eq('id', id).eq('agencia_id', ctx.agenciaId).maybeSingle();
      if (!d) throw new ErroFerramenta('Demanda não encontrada nesta agência.');
      if (d.status === 'publicado') throw new ErroFerramenta('Essa demanda já foi publicada.');

      const { error } = await db.from('conteudo_items').update({ arquivos, atualizado_em: new Date().toISOString() }).eq('id', id);
      if (error) throw new Error(error.message);
      return { demanda: d.titulo, anexadas: arquivos.length, arquivos: arquivos.map((a) => ({ ordem: a.ordem, tipo: a.tipo, url: a.url })) };
    },
  },
];
