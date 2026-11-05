import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { respostaErro } from '@/lib/clientes-server';
import { gerarPdfContrato } from '@/lib/contrato-pdf';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token?.trim()) return respostaErro('Token inválido.', 400);

  try {
    const { data: contrato, error } = await db
      .from('contratos')
      .select(`
        id, agencia_id, titulo, numero, status, conteudo_html, conteudo_final_html, hash_documento,
        pdf_url, revogado_em,
        assinatura_cliente_nome, assinatura_cliente_doc, assinatura_cliente_email,
        assinatura_cliente_ip, assinatura_cliente_data,
        assinatura_agencia_nome, assinatura_agencia_data, assinatura_agencia_ip
      `)
      .eq('token_publico', token)
      .maybeSingle();

    if (error || !contrato) {
      return respostaErro('Contrato não encontrado ou link inválido.', 404);
    }

    if (contrato.revogado_em || contrato.status === 'cancelado') {
      return respostaErro('Este contrato foi cancelado.', 410);
    }

    if (contrato.status !== 'assinado') {
      return respostaErro(
        'O download do PDF oficial com certificado fica disponível após a conclusão e contra-assinatura do documento.',
        403
      );
    }

    const nomeArquivo = `contrato-${contrato.numero || contrato.id.slice(0, 8)}.pdf`;

    // 1. Tenta buscar do R2 se disponível
    if (contrato.pdf_url) {
      try {
        const resR2 = await fetch(contrato.pdf_url);
        if (resR2.ok) {
          const buffer = await resR2.arrayBuffer();
          return new NextResponse(buffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
              'Cache-Control': 'public, max-age=86400',
            },
          });
        }
      } catch (errR2) {
        console.warn('Erro ao carregar PDF do R2 para cliente público, gerando fallback:', errR2);
      }
    }

    // 2. Fallback gerado dinamicamente
    const { buffer } = await gerarPdfContrato({
      titulo: contrato.titulo,
      numero: contrato.numero,
      conteudoHtml: contrato.conteudo_final_html || contrato.conteudo_html || '',
      hashDocumento: contrato.hash_documento || '',
      assinaturaCliente: {
        parte: 'contratante',
        nome: contrato.assinatura_cliente_nome || '',
        documento: contrato.assinatura_cliente_doc || '',
        email: contrato.assinatura_cliente_email || '',
        dataHora: contrato.assinatura_cliente_data || '',
        ip: contrato.assinatura_cliente_ip || '',
      },
      assinaturaAgencia: {
        parte: 'contratada',
        nome: contrato.assinatura_agencia_nome || '',
        dataHora: contrato.assinatura_agencia_data || '',
        ip: contrato.assinatura_agencia_ip || '',
      },
    });

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: any) {
    console.error('Erro ao disponibilizar PDF público do contrato:', err);
    return respostaErro('Não foi possível gerar o arquivo PDF.', 500);
  }
}
