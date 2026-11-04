import { describe, it, expect, vi, beforeEach } from 'vitest';

const tabelas: Record<string, Record<string, unknown>[]> = {};
const criar = vi.fn();

function builder(nome: string) {
  let rows = tabelas[nome] || [];
  const chain = {
    select: () => chain,
    eq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), chain),
    in: (c: string, v: unknown[]) => ((rows = rows.filter((r) => v.includes(r[c]))), chain),
    update: () => chain,
    delete: () => chain,
    maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    then: (res: (v: { data: unknown[]; error: null }) => void) => res({ data: rows, error: null }),
  };
  return chain;
}
vi.mock('../supabase', () => ({ supabase: { from: (n: string) => builder(n) } }));
vi.mock('../publicacao', () => ({ criarPublicacao: (...a: unknown[]) => criar(...a) }));

import { FERRAMENTAS_C14, dataComFuso, validarMidias } from './ferramentas-c14';

const [agendar, publicar, editar, cancelar] = FERRAMENTAS_C14;
const master = { tokenId: 't', clientId: 'c', membroId: 'm1', agenciaId: 'ag1', papel: 'master' as const, nome: 'Dono' };
const DEM = '11111111-1111-4111-8111-111111111111';
const POST = '22222222-2222-4222-8222-222222222222';
const base = { conta: 'bakanasnet', confirmar_conta: '@bakanasnet', tipo: 'IMAGE', midias: ['https://cdn.test/a.jpg'], confirmar: true };

beforeEach(() => {
  criar.mockReset();
  criar.mockResolvedValue({ situacao: 'publicado', post: { id: 'p1' }, link: 'https://instagram.com/p/x' });
  tabelas.membros = [{ id: 'm1', agencia_id: 'ag1' }];
  tabelas.instagram_accounts = [{ id: 'ia1', user_id: 'm1', instagram_user_id: 'ig1', instagram_username: 'bakanasnet', access_token: 'tok', token_expires_at: null }];
  tabelas.clientes = [{ id: 'cl1', nome: 'Bakanas Net', agencia_id: 'ag1', instagram_account_id: 'ia1' }];
  tabelas.conteudo_items = [{ id: DEM, agencia_id: 'ag1', cliente_id: 'cl1', titulo: 'T', status: 'agendamento', legenda: 'Oi', arquivos: [] }];
  tabelas.scheduled_posts = [{ id: POST, status: 'scheduled', media_type: 'IMAGE', instagram_user_id: 'ig1' }];
});

describe('publicar_agora', () => {
  it('publica com confirmação e devolve link', async () => {
    const r = (await publicar.executar(base, master)) as Record<string, unknown>;
    expect(r.situacao).toBe('publicado');
    expect(r.link).toContain('instagram.com');
    expect(criar).toHaveBeenCalledOnce();
  });
  it('recusa sem confirmar: true', async () => {
    await expect(publicar.executar({ ...base, confirmar: false }, master)).rejects.toThrow(/confirmar/);
    expect(criar).not.toHaveBeenCalled();
  });
  it('recusa @ diferente', async () => {
    await expect(publicar.executar({ ...base, confirmar_conta: '@netmais' }, master)).rejects.toThrow(/confirmar_conta/);
  });
  it('recusa demanda de outro cliente', async () => {
    tabelas.conteudo_items = [{ id: DEM, agencia_id: 'ag1', cliente_id: 'outro', titulo: 'T', status: 'agendamento', legenda: '', arquivos: [] }];
    await expect(publicar.executar({ ...base, demanda_id: DEM }, master)).rejects.toThrow(/outro cliente/);
    expect(criar).not.toHaveBeenCalled();
  });
  it('recusa conta sem cliente, token expirado e não-master', async () => {
    tabelas.clientes = [];
    await expect(publicar.executar(base, master)).rejects.toThrow(/vinculada/);
    tabelas.clientes = [{ id: 'cl1', nome: 'B', agencia_id: 'ag1', instagram_account_id: 'ia1' }];
    tabelas.instagram_accounts[0].token_expires_at = '2020-01-01T00:00:00Z';
    await expect(publicar.executar(base, master)).rejects.toThrow(/expirou/);
    await expect(publicar.executar(base, { ...master, papel: 'membro' })).rejects.toThrow(/master/);
  });
  it('usa os arquivos da demanda quando não manda midias', async () => {
    tabelas.conteudo_items[0].arquivos = [{ url: 'https://cdn.test/z.jpg', ordem: 0 }];
    await publicar.executar({ ...base, midias: undefined, demanda_id: DEM }, master);
    expect(criar.mock.calls[0][0].mediaUrl).toBe('https://cdn.test/z.jpg');
  });
  it('automação exige copy humanizada', async () => {
    await expect(publicar.executar({ ...base, automacao: { palavras_chave: ['EU QUERO'], mensagem_dm: 'oi' } }, master)).rejects.toThrow(/humanizer/);
  });
});

describe('agendar_post', () => {
  it('agenda no futuro e recusa data passada ou sem fuso', async () => {
    criar.mockResolvedValue({ situacao: 'agendado', post: { id: 'p2', scheduled_at: 'x' } });
    const futuro = new Date(Date.now() + 3_600_000).toISOString();
    const r = (await agendar.executar({ ...base, data_hora: futuro }, master)) as Record<string, unknown>;
    expect(r.situacao).toBe('agendado');
    await expect(agendar.executar({ ...base, data_hora: '2020-01-01T10:00:00Z' }, master)).rejects.toThrow(/futuro/);
    await expect(agendar.executar({ ...base, data_hora: '2030-01-01T10:00:00' }, master)).rejects.toThrow(/fuso/);
  });
});

describe('editar e cancelar', () => {
  it('não mexe em post já publicado', async () => {
    tabelas.scheduled_posts[0].status = 'published';
    await expect(editar.executar({ post_id: POST, legenda: 'x' }, master)).rejects.toThrow(/já está no feed/);
    await expect(cancelar.executar({ post_id: POST }, master)).rejects.toThrow(/já está no feed/);
  });
  it('edita e cancela post agendado', async () => {
    expect(await editar.executar({ post_id: POST, legenda: 'nova' }, master)).toMatchObject({ alterado: ['caption'] });
    expect(await cancelar.executar({ post_id: POST }, master)).toEqual({ cancelado: POST });
  });
  it('não acha post de conta de outra agência', async () => {
    tabelas.instagram_accounts = [];
    await expect(cancelar.executar({ post_id: POST }, master)).rejects.toThrow(/não está conectada/);
  });
});

describe('helpers', () => {
  it('dataComFuso e validarMidias', () => {
    expect(dataComFuso('2026-11-10T18:00:00-03:00', 'x')).toBe('2026-11-10T21:00:00.000Z');
    expect(() => dataComFuso('2026-11-10', 'x')).toThrow();
    expect(() => validarMidias('CAROUSEL', ['https://a'])).toThrow(/2 a 10/);
    expect(() => validarMidias('REELS', ['https://a', 'https://b'])).toThrow(/exatamente 1/);
  });
});
