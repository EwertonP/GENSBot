import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockContrato = {
  id: 'c1',
  agencia_id: 'ag-1',
  titulo: 'Contrato de Teste',
  numero: 'CT-2026-001',
  status: 'assinado',
  conteudo_html: '<p>Texto do contrato</p>',
  conteudo_final_html: '<p>Texto congelado do contrato</p>',
  hash_documento: '1234567890abcdef',
  token_publico: 'token-abc',
  pdf_url: null,
  assinatura_cliente_nome: 'Cliente Fulano',
  assinatura_cliente_doc: '12345678901',
  assinatura_cliente_email: 'cliente@teste.com',
  assinatura_cliente_data: '2026-11-05T12:00:00Z',
  assinatura_cliente_ip: '127.0.0.1',
  assinatura_agencia_nome: 'Agência Legal',
  assinatura_agencia_data: '2026-11-05T13:00:00Z',
  assinatura_agencia_ip: '127.0.0.1',
};

const mockSelectContrato = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockSelectContrato,
          eq: () => ({
            maybeSingle: mockSelectContrato,
          }),
        }),
      }),
    })),
  },
}));

vi.mock('@/lib/documentos-server', () => ({
  contextoDocumentos: vi.fn().mockResolvedValue({
    ok: true,
    ctx: {
      membro: { id: 'm1', agencia_id: 'ag-1', nome: 'Membro Teste' },
      agencia: { id: 'ag-1', nome: 'Agência Teste' },
    },
  }),
}));

import { GET as getPdfAgencia } from './[id]/pdf/route';
import { GET as getPdfPublico } from './public/[token]/pdf/route';

describe('Rotas de PDF de Contratos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/contratos/[id]/pdf gera e retorna o PDF como attachment', async () => {
    mockSelectContrato.mockResolvedValue({ data: mockContrato, error: null });

    const req = new Request('http://localhost/api/contratos/c1/pdf');
    const res = await getPdfAgencia(req, { params: Promise.resolve({ id: 'c1' }) });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="contrato-CT-2026-001.pdf"');

    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(500);
  });

  it('GET /api/contratos/public/[token]/pdf recusa download se o contrato ainda não estiver assinado por ambas as partes', async () => {
    mockSelectContrato.mockResolvedValue({
      data: { ...mockContrato, status: 'aguardando_assinatura' },
      error: null,
    });

    const req = new Request('http://localhost/api/contratos/public/token-abc/pdf');
    const res = await getPdfPublico(req, { params: Promise.resolve({ token: 'token-abc' }) });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('após a conclusão');
  });

  it('GET /api/contratos/public/[token]/pdf libera download quando assinado', async () => {
    mockSelectContrato.mockResolvedValue({
      data: mockContrato,
      error: null,
    });

    const req = new Request('http://localhost/api/contratos/public/token-abc/pdf');
    const res = await getPdfPublico(req, { params: Promise.resolve({ token: 'token-abc' }) });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
  });
});
