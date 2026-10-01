import { describe, it, expect, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));

import { linhasDaAudiencia, paraCsv } from './ferramentas-c4';

const contato = (over: Record<string, unknown> = {}) => ({
  instagram_id: '111',
  name: 'Fulano',
  username: 'fulano',
  email: 'f@x.com',
  phone: '+5581999998888',
  notes: null,
  tags: ['PMPE', 'quente'],
  flow_state: { cargo: 'Soldado', _capture: { field: 'email' } },
  last_response_at: '2026-10-01T12:00:00Z',
  first_contact_at: '2026-09-30T10:00:00Z',
  origem: { name: 'PMPE - Raio-X' },
  ...over,
});

describe('listar_audiencia: mesmas colunas do CSV da tela', () => {
  it('uma coluna por resposta, sem o estado interno do motor', () => {
    const { campos, linhas } = linhasDaAudiencia([contato(), contato({ instagram_id: '222', flow_state: { cidade: 'Recife' } })]);
    expect(campos).toEqual(['cargo', 'cidade']);
    expect(linhas[0]).toMatchObject({ nome: 'Fulano', instagram: '@fulano', telefone: '+5581999998888', origem: 'PMPE - Raio-X', tags: 'PMPE; quente', cargo: 'Soldado', cidade: '' });
    expect(Object.keys(linhas[0])).not.toContain('_capture');
  });

  it('@ pendente (username igual ao IGSID ou vazio) sai em branco', () => {
    const { linhas } = linhasDaAudiencia([contato({ username: '111' }), contato({ username: null })]);
    expect(linhas.map((l) => l.instagram)).toEqual(['', '']);
  });

  it('CSV escapa aspas e mantém a ordem das colunas', () => {
    const { linhas } = linhasDaAudiencia([contato({ notes: 'disse "quero"' })]);
    const csv = paraCsv(linhas).split('\n');
    expect(csv[0]).toBe('nome,instagram,email,telefone,origem,tags,cargo,observacoes,ultima_interacao,primeiro_contato,instagram_id');
    expect(csv[1]).toContain('"disse ""quero"""');
  });
});
