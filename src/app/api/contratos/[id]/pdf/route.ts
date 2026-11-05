import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { contextoDocumentos } from '@/lib/documentos-server';
import { respostaErro } from '@/lib/clientes-server';
import { gerarPdfContrato } from '@/lib/contrato-pdf';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await contextoDocumentos();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;
  const { id } = await params;

  try {
    const { data: contrato, error: erroContrato } = await db
      .from('contratos')
      .select('id, agencia_id, titulo, numero, status, conteudo_final_html, conteudo_html, hash_documento, pdf_url, assinatura_cliente_nome, assinatura_cliente_doc, assinatura_cliente_email, assinatura_cliente_data, assinatura_cliente_ip, assinatura_agencia_nome, assinatura_agencia_data, assinatura_agencia_ip')
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id)
      .maybeSingle();

    if (erroContrato || !contrato) {
      return respostaErro('Contrato não encontrado.', 404);
    }

    const nomeArquivo = `contrato-${contrato.numero || contrato.id.slice(0, 8)}.pdf`;

    // 1. Se já tiver URL no R2 e for redirect simples ou se tiver parâmetro download
    const url = new URL(req.url);
    const redirectUrl = url.searchParams.get('redirect');

    if (contrato.pdf_url && redirectUrl === 'true') {
      return NextResponse.redirect(contrato.pdf_url);
    }

    // 2. Se já tem pdf_url mas queremos entregar como stream com header Content-Disposition correto
    if (contrato.pdf_url) {
      try {
        const resR2 = await fetch(contrato.pdf_url);
        if (resR2.ok) {
          const buffer = await resR2.arrayBuffer();
          return new NextResponse(buffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
              'Cache-Control': 'private, max-age=3600',
            },
          });
        }
      } catch (err) {
        console.warn('Não foi possível obter PDF do R2 diretamente, gerando dinamicamente:', err);
      }
    }

    // 3. Fallback dinâmico: gera o PDF no momento da requisição
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
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (err: any) {
    console.error('Erro ao gerar download de PDF do contrato:', err);
    return respostaErro('Não foi possível gerar o arquivo PDF.', 500);
  }
}
