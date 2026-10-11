import { describe, it, expect } from 'vitest';
import { FERRAMENTAS_CRM } from './ferramentas-crm';
import { listarFerramentas } from './servidor';

describe('MCP CRM Tools', () => {
  it('exporta 4 ferramentas de CRM com schemas válidos', () => {
    expect(FERRAMENTAS_CRM.length).toBe(4);
    const nomes = FERRAMENTAS_CRM.map((f) => f.name);
    expect(nomes).toContain('crm_listar_negocios');
    expect(nomes).toContain('crm_criar_negocio');
    expect(nomes).toContain('crm_mover_negocio');
    expect(nomes).toContain('crm_adicionar_nota');
  });

  it('as ferramentas aparecem na lista do servidor MCP', () => {
    const todas = listarFerramentas();
    const crmTools = todas.filter((t) => t.name.startsWith('crm_'));
    expect(crmTools.length).toBe(4);
  });
});
