import { describe, expect, it } from 'vitest';
import {
  CORES_CLIENTE,
  corPadraoDoCliente,
  iniciais,
  parseClienteInput,
  parseContatoInput,
  razaoContraste,
  textoSobre,
} from './clientes';

describe('parseClienteInput', () => {
  it('exige nome ao criar', () => {
    expect(parseClienteInput({}, 'criar')).toEqual({ ok: false, error: 'Informe o nome do cliente.' });
    expect(parseClienteInput({ nome: '   ' }, 'criar').ok).toBe(false);
  });

  it('descarta campos fora da whitelist, principalmente agencia_id', () => {
    const r = parseClienteInput(
      {
        nome: 'Clínica Vitta',
        agencia_id: '00000000-0000-0000-0000-000000000000',
        id: '11111111-1111-1111-1111-111111111111',
        criado_em: '2020-01-01',
        lead_id: '22222222-2222-2222-2222-222222222222',
      },
      'criar'
    );
    expect(r).toEqual({ ok: true, data: { nome: 'Clínica Vitta' } });
  });

  it('apara espaços e transforma vazio em null', () => {
    const r = parseClienteInput({ nome: '  Vitta  ', nicho: '   ', briefing: '' }, 'criar');
    expect(r).toEqual({ ok: true, data: { nome: 'Vitta', nicho: null, briefing: null } });
  });

  it('aceita valor com vírgula e arredonda para centavos', () => {
    const r = parseClienteInput({ nome: 'A', valor_mensal: '1999,999' }, 'criar');
    expect(r).toEqual({ ok: true, data: { nome: 'A', valor_mensal: 2000 } });
  });

  it('rejeita valor negativo ou acima do limite de numeric(10,2)', () => {
    expect(parseClienteInput({ nome: 'A', valor_mensal: -1 }, 'criar').ok).toBe(false);
    expect(parseClienteInput({ nome: 'A', valor_mensal: 10_000_000 }, 'criar').ok).toBe(false);
    expect(parseClienteInput({ nome: 'A', valor_mensal: 'abc' }, 'criar').ok).toBe(false);
  });

  it('limita dia de vencimento a 1–31 e dia de revisão a 0–6', () => {
    expect(parseClienteInput({ nome: 'A', dia_vencimento: 0 }, 'criar').ok).toBe(false);
    expect(parseClienteInput({ nome: 'A', dia_vencimento: 32 }, 'criar').ok).toBe(false);
    expect(parseClienteInput({ nome: 'A', dia_vencimento: 10 }, 'criar').ok).toBe(true);
    expect(parseClienteInput({ nome: 'A', dia_revisao: 7 }, 'criar').ok).toBe(false);
    expect(parseClienteInput({ nome: 'A', dia_revisao: 0 }, 'criar').ok).toBe(true);
  });

  it('rejeita número não inteiro onde se espera inteiro', () => {
    expect(parseClienteInput({ nome: 'A', posts_mes: 3.5 }, 'criar').ok).toBe(false);
    expect(parseClienteInput({ nome: 'A', posts_mes: '12' }, 'criar')).toEqual({
      ok: true,
      data: { nome: 'A', posts_mes: 12 },
    });
  });

  it('rejeita data que não existe em vez de normalizar', () => {
    expect(parseClienteInput({ nome: 'A', contrato_inicio: '2026-02-31' }, 'criar').ok).toBe(false);
    expect(parseClienteInput({ nome: 'A', contrato_inicio: '26-02-01' }, 'criar').ok).toBe(false);
    expect(parseClienteInput({ nome: 'A', contrato_inicio: '2026-02-28' }, 'criar').ok).toBe(true);
    expect(parseClienteInput({ nome: 'A', contrato_inicio: '2028-02-29' }, 'criar').ok).toBe(true);
  });

  it('valida formato de cor e de uuid', () => {
    expect(parseClienteInput({ nome: 'A', cor: 'verde' }, 'criar').ok).toBe(false);
    expect(parseClienteInput({ nome: 'A', cor: '#D8FF3C' }, 'criar')).toEqual({
      ok: true,
      data: { nome: 'A', cor: '#d8ff3c' },
    });
    expect(parseClienteInput({ nome: 'A', instagram_account_id: 'nao-e-uuid' }, 'criar').ok).toBe(false);
    expect(
      parseClienteInput({ nome: 'A', instagram_account_id: '62BDB1BC-84DE-4688-A560-7A4DEB75A2BE' }, 'criar')
    ).toEqual({ ok: true, data: { nome: 'A', instagram_account_id: '62bdb1bc-84de-4688-a560-7a4deb75a2be' } });
  });

  it('permite desvincular a conta do Instagram enviando null', () => {
    expect(parseClienteInput({ instagram_account_id: null }, 'editar')).toEqual({
      ok: true,
      data: { instagram_account_id: null },
    });
  });

  it('na edição só devolve os campos presentes', () => {
    expect(parseClienteInput({ etapa: 'Onboarding' }, 'editar')).toEqual({
      ok: true,
      data: { etapa: 'Onboarding' },
    });
  });

  it('na edição recusa corpo sem nenhum campo válido e nome vazio', () => {
    expect(parseClienteInput({ agencia_id: 'x' }, 'editar').ok).toBe(false);
    expect(parseClienteInput({ nome: '' }, 'editar').ok).toBe(false);
  });

  it('exige booleano em ativo', () => {
    expect(parseClienteInput({ ativo: 'false' }, 'editar').ok).toBe(false);
    expect(parseClienteInput({ ativo: false }, 'editar')).toEqual({ ok: true, data: { ativo: false } });
  });

  it('respeita o tamanho máximo dos textos', () => {
    expect(parseClienteInput({ nome: 'x'.repeat(121) }, 'criar').ok).toBe(false);
    expect(parseClienteInput({ nome: 'x'.repeat(120) }, 'criar').ok).toBe(true);
  });

  it('recusa corpo que não é objeto', () => {
    expect(parseClienteInput(null, 'criar').ok).toBe(false);
    expect(parseClienteInput([], 'criar').ok).toBe(false);
    expect(parseClienteInput('texto', 'criar').ok).toBe(false);
  });
});

describe('parseContatoInput', () => {
  it('exige nome', () => {
    expect(parseContatoInput({ telefone: '1199999' }).ok).toBe(false);
  });

  it('valida formato de e-mail', () => {
    expect(parseContatoInput({ nome: 'Bruno', email: 'bruno@' }).ok).toBe(false);
    expect(parseContatoInput({ nome: 'Bruno', email: 'bruno@vitta.com.br' }).ok).toBe(true);
  });

  it('marca grupo de WhatsApp e ignora agencia_id / cliente_id do corpo', () => {
    const r = parseContatoInput({
      nome: 'Grupo Vitta',
      e_grupo_whatsapp: true,
      agencia_id: 'x',
      cliente_id: 'y',
    });
    expect(r).toEqual({ ok: true, data: { nome: 'Grupo Vitta', e_grupo_whatsapp: true } });
  });
});

describe('avatar', () => {
  it('iniciais: uma palavra usa as duas primeiras letras, várias usam primeira e última', () => {
    expect(iniciais('Vitta')).toBe('VI');
    expect(iniciais('Clínica Vitta Odonto')).toBe('CO');
    expect(iniciais('   ')).toBe('?');
  });

  it('cor padrão é estável para o mesmo nome e sempre vem da paleta', () => {
    expect(corPadraoDoCliente('Vitta')).toBe(corPadraoDoCliente('Vitta'));
    expect(CORES_CLIENTE).toContain(corPadraoDoCliente('Qualquer Nome'));
  });

  it('texto sobre a cor: tinta em fundo claro, papel em fundo escuro', () => {
    expect(textoSobre('#d8ff3c')).toBe('#192313');
    expect(textoSobre('#162d16')).toBe('#f7f8f2');
  });

  it('toda cor da paleta tem texto com contraste mínimo de 4.5:1', () => {
    for (const cor of CORES_CLIENTE) {
      const razao = razaoContraste(cor, textoSobre(cor));
      expect(razao, `${cor} com ${textoSobre(cor)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('num tom médio escolhe o texto de maior contraste, não um limiar fixo', () => {
    // #657e48 (oliva original da marca): papel dá 4.25, tinta dá menos. Vence o papel.
    expect(textoSobre('#657e48')).toBe('#f7f8f2');
  });
});
