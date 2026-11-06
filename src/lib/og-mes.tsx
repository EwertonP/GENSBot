import { ImageResponse } from 'next/og';
import { COR_ETAPA_IMAGEM } from './miniatura-mes';
import type { EtapaMes } from './link-do-mes';

export interface DadosImagemMes {
  identificacao: string;
  mesNome: string;
  ano: string;
  resumo: string;
  linhas: { etapa: EtapaMes; rotulo: string; n: number }[];
  foto: string | null;
  inicial: string;
}

/** Imagem 1200x630 da miniatura do link do mês (WhatsApp e redes). */
export function imagemDoMes(d: DadosImagemMes): ImageResponse {
  const { identificacao, mesNome, ano, resumo, linhas, foto, inicial } = d;

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          backgroundColor: '#00140F',
          backgroundImage: 'radial-gradient(circle at 85% 15%, #0B3A2E 0%, #00140F 62%)',
          color: '#EAF6F0',
          fontFamily: 'sans-serif',
          padding: '56px 64px',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
        }}
      >
        {/* Esquerda: cliente, mês e resumo */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', width: '660px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', padding: '8px 18px', borderRadius: '100px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '100%', backgroundColor: '#00DC94' }} />
              <span style={{ fontSize: '18px', fontWeight: 700 }}>Agência GENS</span>
            </div>
            <div style={{ display: 'flex', backgroundColor: '#00DC94', color: '#00281E', padding: '8px 18px', borderRadius: '100px', fontSize: '16px', fontWeight: 800, letterSpacing: '1px' }}>
              CONTEÚDO DO MÊS
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '28px', fontWeight: 600, color: '#9DBEB1', marginBottom: '8px' }}>{identificacao}</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '20px' }}>
              <span style={{ fontSize: mesNome.length > 8 ? '88px' : '100px', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-2px' }}>{mesNome}</span>
              <span style={{ fontSize: '52px', fontWeight: 700, color: '#9DBEB1' }}>{ano}</span>
            </div>
            <span style={{ fontSize: '34px', fontWeight: 600, color: '#EAF6F0', marginTop: '14px' }}>{resumo}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', backgroundColor: 'rgba(0,220,148,0.12)', border: '1px solid rgba(0,220,148,0.35)', padding: '14px 24px', borderRadius: '18px', width: 'fit-content' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '100%', backgroundColor: '#00DC94', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00281E', fontWeight: 900, fontSize: '18px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" stroke="#00281E" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontSize: '22px', fontWeight: 700, color: '#00DC94' }}>Acompanhe cada etapa e aprove por aqui</span>
          </div>
        </div>

        {/* Direita: foto do perfil e em que etapa estão os posts */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '380px', gap: '24px' }}>
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="" width={132} height={132} style={{ width: '132px', height: '132px', borderRadius: '100%', objectFit: 'cover', border: '4px solid #00DC94' }} />
          ) : (
            <div style={{ width: '132px', height: '132px', borderRadius: '100%', backgroundColor: '#083026', border: '4px solid #00DC94', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '60px', fontWeight: 800, color: '#00DC94' }}>
              {inicial}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', backgroundColor: '#04221A', border: '1px solid #21574A', borderRadius: '26px', padding: '22px 26px', gap: '12px' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#9DBEB1', letterSpacing: '1.5px' }}>ANDAMENTO DOS POSTS</span>
            {linhas.length === 0 ? (
              <span style={{ fontSize: '20px', color: '#9DBEB1' }}>Nada planejado ainda</span>
            ) : (
              linhas.map((l) => (
                <div key={l.etapa} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '100%', backgroundColor: COR_ETAPA_IMAGEM[l.etapa] }} />
                    <span style={{ fontSize: '22px', fontWeight: 600 }}>{l.rotulo}</span>
                  </div>
                  <span style={{ fontSize: '26px', fontWeight: 800, color: COR_ETAPA_IMAGEM[l.etapa] }}>{l.n}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600' },
    }
  );
}
