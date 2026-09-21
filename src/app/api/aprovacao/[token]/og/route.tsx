import { ImageResponse } from 'next/og';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const { data: item } = await supabase
      .from('conteudo_items')
      .select(`
        id,
        tipo,
        titulo,
        legenda,
        arquivos,
        cliente:clientes(
          nome,
          foto_url,
          nicho
        )
      `)
      .eq('token_aprovacao', token)
      .maybeSingle();

    const titulo = item?.titulo || 'Nova Publicação para Aprovação';
    const clienteNome = (item?.cliente as any)?.nome || 'Agência GENS';
    const tipo = item?.tipo || 'post';
    const arquivos = Array.isArray(item?.arquivos) ? item.arquivos : [];
    const primeiroArquivo = arquivos[0];
    const isImagem = primeiroArquivo && primeiroArquivo.tipo === 'imagem';
    const totalSlides = arquivos.length;

    const formatoLabel =
      tipo === 'reel'
        ? 'REELS 9:16'
        : tipo === 'story'
        ? 'STORY 9:16'
        : totalSlides > 1
        ? `CARROSSEL (${totalSlides} SLIDES)`
        : 'POST NO FEED 4:5';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            backgroundColor: '#0c100a',
            backgroundImage: 'radial-gradient(circle at 80% 20%, #203515 0%, #0c100a 60%)',
            color: '#ffffff',
            fontFamily: 'sans-serif',
            padding: '50px 60px',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}
        >
          {/* Coluna Esquerda: Informações e Branding */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              maxWidth: '620px',
            }}
          >
            {/* Topo: Logo da Agência & Badge do Formato */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '6px 14px',
                  borderRadius: '100px',
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '100%',
                    backgroundColor: '#d8ff3c',
                  }}
                />
                <span
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    letterSpacing: '-0.3px',
                    color: '#ffffff',
                  }}
                >
                  Agência GENS
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  backgroundColor: '#d8ff3c',
                  color: '#0c100a',
                  padding: '6px 14px',
                  borderRadius: '100px',
                  fontSize: '13px',
                  fontWeight: 800,
                  letterSpacing: '0.5px',
                }}
              >
                {formatoLabel}
              </div>
            </div>

            {/* Centro: Título da Publicação & Perfil */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '20px 0' }}>
              <span
                style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  color: '#9ba395',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                {clienteNome}
              </span>

              <h1
                style={{
                  fontSize: '44px',
                  fontWeight: 800,
                  lineHeight: 1.15,
                  margin: 0,
                  color: '#ffffff',
                  letterSpacing: '-1px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                }}
              >
                {titulo}
              </h1>

              <p
                style={{
                  fontSize: '17px',
                  color: '#b0baa8',
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                Prévia oficial no formato nativo do Instagram. Acesse o link para conferir os slides e aprovar com 1 clique.
              </p>
            </div>

            {/* Rodapé: Chamada de Ação */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: 'rgba(216, 255, 60, 0.12)',
                border: '1px solid rgba(216, 255, 60, 0.3)',
                padding: '12px 20px',
                borderRadius: '16px',
                width: 'fit-content',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '100%',
                  backgroundColor: '#d8ff3c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0c100a',
                  fontWeight: 900,
                  fontSize: '14px',
                }}
              >
                ✓
              </div>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#d8ff3c',
                }}
              >
                Aprovação Rápida & Feedback por Minutagem
              </span>
            </div>
          </div>

          {/* Coluna Direita: Moldura Visual da Postagem */}
          <div
            style={{
              display: 'flex',
              width: '380px',
              height: '490px',
              borderRadius: '28px',
              overflow: 'hidden',
              backgroundColor: '#161c13',
              border: '2px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              position: 'relative',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isImagem ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={primeiroArquivo.url}
                alt="Prévia do Post"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '16px',
                  padding: '30px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: '70px',
                    height: '70px',
                    borderRadius: '100%',
                    backgroundColor: 'rgba(216, 255, 60, 0.2)',
                    border: '2px solid #d8ff3c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    color: '#d8ff3c',
                  }}
                >
                  ▶
                </div>
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#ffffff',
                  }}
                >
                  {tipo === 'reel' ? 'Vídeo Reels' : 'Story'}
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    color: '#8f9b88',
                  }}
                >
                  Clique no link para assistir e pontuar
                </span>
              </div>
            )}

            {/* Badge de Slides ou Reels Sobreposto */}
            <div
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                color: '#ffffff',
                padding: '4px 12px',
                borderRadius: '100px',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              {totalSlides > 1 ? `1/${totalSlides}` : formatoLabel}
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch {
    return new Response('Erro ao gerar imagem de prévia', { status: 500 });
  }
}
