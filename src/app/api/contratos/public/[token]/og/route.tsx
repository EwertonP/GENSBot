import { ImageResponse } from 'next/og';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const { data: contrato } = await supabase
      .from('contratos')
      .select(`
        id,
        titulo,
        status,
        valor_mensal,
        dia_vencimento,
        data_inicio,
        data_termino,
        hash_documento,
        assinatura_cliente_nome,
        cliente:clientes(nome, cnpj_cpf),
        lead:crm_negocios(empresa, nome_contato)
      `)
      .eq('token_publico', token)
      .maybeSingle();

    const nomeCliente =
      (contrato?.cliente as any)?.nome ||
      (contrato?.lead as any)?.empresa ||
      (contrato?.lead as any)?.nome_contato ||
      'Cliente';

    const titulo = contrato?.titulo || 'Contrato de Prestação de Serviços';
    const valorMensal = contrato?.valor_mensal
      ? Number(contrato.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      : null;
    const diaVencimento = contrato?.dia_vencimento || 5;

    const statusBadge =
      contrato?.status === 'assinado'
        ? { label: '100% FORMALIZADO & ASSINADO', bg: '#14532d', color: '#86efac' }
        : contrato?.status === 'assinado_cliente'
        ? { label: 'ASSINADO PELO CLIENTE', bg: '#1e3a8a', color: '#93c5fd' }
        : { label: 'AGUARDANDO ASSINATURA DIGITAL', bg: '#1c1917', color: '#f59e0b' };

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            backgroundColor: '#0c100a',
            backgroundImage: 'radial-gradient(circle at 85% 15%, #203515 0%, #0c100a 65%)',
            color: '#ffffff',
            fontFamily: 'sans-serif',
            padding: '50px 60px',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}
        >
          {/* Coluna Principal */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              width: '100%',
            }}
          >
            {/* Topo: Branding e Badges */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                    borderRadius: '12px',
                    padding: '8px 16px',
                    fontSize: '15px',
                    fontWeight: 800,
                    color: '#4ade80',
                    letterSpacing: '0.05em',
                  }}
                >
                  AGÊNCIA GENS
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: '#94a3b8',
                    letterSpacing: '0.02em',
                  }}
                >
                  INSTRUMENTO JURÍDICO DIGITAL
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: statusBadge.bg,
                  color: statusBadge.color,
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '999px',
                  padding: '6px 16px',
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                }}
              >
                {statusBadge.label}
              </div>
            </div>

            {/* Centro: Título e Card de Informações */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#22c55e',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                CONTRATANTE: {nomeCliente}
              </div>

              <div
                style={{
                  fontSize: '34px',
                  fontWeight: 800,
                  lineHeight: 1.15,
                  color: '#ffffff',
                  letterSpacing: '-0.02em',
                  maxWidth: '980px',
                }}
              >
                {titulo}
              </div>

              {/* Grid de Resumo Executivo */}
              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                  marginTop: '10px',
                }}
              >
                {valorMensal && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '16px',
                      padding: '14px 22px',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>VALOR MENSAL</div>
                    <div style={{ fontSize: '20px', color: '#4ade80', fontWeight: 800, marginTop: '2px' }}>
                      R$ {valorMensal}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '14px 22px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>VENCIMENTO</div>
                  <div style={{ fontSize: '18px', color: '#f8fafc', fontWeight: 700, marginTop: '2px' }}>
                    Todo dia {diaVencimento}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '14px 22px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>ASSINATURA DIGITAL</div>
                  <div style={{ fontSize: '18px', color: '#38bdf8', fontWeight: 700, marginTop: '2px' }}>
                    MP 2.200-2 & Lei 14.063
                  </div>
                </div>
              </div>
            </div>

            {/* Base: Certificação de Segurança e Link */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '20px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
                  Autenticação criptográfica com hash SHA-256 e carimbo de tempo
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  CNPJ CONTRATADA: 55.823.814/0001-18 • Agência GENS
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#22c55e',
                  color: '#052e16',
                  borderRadius: '12px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                }}
              >
                Acessar e Assinar Online
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (err) {
    console.error('Erro ao gerar OG image do contrato:', err);
    return new Response('Erro ao gerar imagem OG', { status: 500 });
  }
}
