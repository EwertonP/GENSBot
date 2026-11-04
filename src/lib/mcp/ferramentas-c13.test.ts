import { describe, it, expect, vi, beforeEach } from 'vitest';

const tabelas: Record<string, Record<string, unknown>[]> = {};
let ultimoUpdate: Record<string, unknown> | null = null;

function builder(nome: string) {
  let rows = tabelas[nome] || [];
  const chain = {
    select: () => chain,
    eq: (col: string, val: unknown) => {
      rows = rows.filter((r) => r[col] === val);
      return chain;
    },
    update: (v: Record<string, unknown>) => {
      ultimoUpdate = v;
      return chain;
    },
    maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: rows, error: null }),
  };
  return chain;
}

vi.mock('../supabase', () => ({ supabase: { from: (nome: string) => builder(nome) } }));
vi.mock('../r2', () => ({
  isR2Configured: () => true,
  getPresignedUploadUrl: async (key: string) => ({ uploadUrl: `https://r2.test/up/${key}`, publicUrl: `https://cdn.test/${key}` }),
  putR2Object: async (key: string) => `https://cdn.test/${key}`,
}));

import { FERRAMENTAS_C13, detectarMime, ipPrivado } from './ferramentas-c13';

const [preparar, importar, anexar] = FERRAMENTAS_C13;
const master = { tokenId: 't', clientId: 'c', membroId: 'm1', agenciaId: 'ag1', papel: 'master' as const, nome: 'Dono' };
const membro = { ...master, papel: 'membro' as const };
const DEM = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  ultimoUpdate = null;
  tabelas.conteudo_items = [{ id: DEM, agencia_id: 'ag1', titulo: 'Carrossel', status: 'agendamento' }];
});

describe('preparar_upload_midia', () => {
  it('devolve URL assinada e pública pra JPG', async () => {
    const r = (await preparar.executar({ nome: 'Slide 1.jpg', tipo: 'image/jpeg', tamanho_bytes: 1000 }, master)) as Record<string, string>;
    expect(r.upload_url).toContain('mcp/ag1/');
    expect(r.url_publica).toContain('https://cdn.test/mcp/ag1/');
  });
  it('recusa PNG', async () => {
    await expect(preparar.executar({ nome: 'a.png', tipo: 'image/png', tamanho_bytes: 10 }, master)).rejects.toThrow(/PNG/);
  });
  it('recusa arquivo grande demais', async () => {
    await expect(preparar.executar({ nome: 'a.jpg', tipo: 'image/jpeg', tamanho_bytes: 50 * 1024 * 1024 }, master)).rejects.toThrow(/limite/);
  });
  it('só master', async () => {
    await expect(preparar.executar({ nome: 'a.jpg', tipo: 'image/jpeg', tamanho_bytes: 10 }, membro)).rejects.toThrow(/master/);
  });
});

describe('importar_midia_url', () => {
  it('recusa http e endereços internos', async () => {
    await expect(importar.executar({ url: 'http://x.com/a.jpg' }, master)).rejects.toThrow(/https/);
    await expect(importar.executar({ url: 'https://localhost/a.jpg' }, master)).rejects.toThrow(/interno/);
    await expect(importar.executar({ url: 'https://169.254.169.254/latest' }, master)).rejects.toThrow(/interno/);
    await expect(importar.executar({ url: 'https://[::1]/a.jpg' }, master)).rejects.toThrow(/interno/);
  });
});

describe('helpers', () => {
  it('ipPrivado', () => {
    for (const ip of ['10.0.0.1', '127.0.0.1', '192.168.1.1', '172.20.0.1', '169.254.169.254', '::1', '::ffff:10.0.0.1']) expect(ipPrivado(ip)).toBe(true);
    for (const ip of ['8.8.8.8', '172.32.0.1']) expect(ipPrivado(ip)).toBe(false);
  });
  it('detectarMime pelo conteúdo', () => {
    expect(detectarMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectarMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0]))).toBe('image/png');
    expect(detectarMime(Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(4)]))).toBe('video/mp4');
  });
});

describe('anexar_midia_demanda', () => {
  const m = (n: number) => ({ url: `https://cdn.test/s${n}.jpg`, tipo: 'imagem' });
  it('grava arquivos na ordem', async () => {
    const r = (await anexar.executar({ demanda_id: DEM, midias: [m(1), m(2)] }, master)) as { anexadas: number };
    expect(r.anexadas).toBe(2);
    const arq = (ultimoUpdate as { arquivos: { ordem: number }[] }).arquivos;
    expect(arq.map((a) => a.ordem)).toEqual([0, 1]);
  });
  it('não acha demanda de outra agência', async () => {
    tabelas.conteudo_items = [{ id: DEM, agencia_id: 'outra', titulo: 'x', status: 'planejamento' }];
    await expect(anexar.executar({ demanda_id: DEM, midias: [m(1)] }, master)).rejects.toThrow(/não encontrada/);
  });
  it('recusa url http, demanda já publicada e só master', async () => {
    await expect(anexar.executar({ demanda_id: DEM, midias: [{ url: 'http://x/a.jpg', tipo: 'imagem' }] }, master)).rejects.toThrow(/https/);
    tabelas.conteudo_items = [{ id: DEM, agencia_id: 'ag1', titulo: 'x', status: 'publicado' }];
    await expect(anexar.executar({ demanda_id: DEM, midias: [m(1)] }, master)).rejects.toThrow(/já foi publicada/);
    await expect(anexar.executar({ demanda_id: DEM, midias: [m(1)] }, membro)).rejects.toThrow(/master/);
  });
});
