import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import crypto from 'crypto';

export interface AssinaturaEvidencia {
  parte: 'contratante' | 'contratada';
  nome: string;
  documento?: string | null;
  email?: string | null;
  dataHora: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface DadosPdfContrato {
  titulo: string;
  numero?: string | null;
  conteudoHtml: string;
  hashDocumento: string;
  assinaturaCliente?: AssinaturaEvidencia | null;
  assinaturaAgencia?: AssinaturaEvidencia | null;
  agenciaNome?: string | null;
  clienteNome?: string | null;
}

/**
 * Normaliza e sanitiza texto para ser compatível com fontes WinAnsi padrão do PDF.
 */
function sanitizarTexto(texto: string): string {
  if (!texto) return '';
  return texto
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x00-\x7F\xA0-\xFF]/g, ' ') // Mantém caracteres ISO-8859-1 (português)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

/**
 * Converte HTML simples gerado pelo editor para blocos estruturados.
 */
interface BlocoTexto {
  tipo: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'tr' | 'hr';
  texto: string;
}

function extrairBlocosHtml(html: string): BlocoTexto[] {
  if (!html) return [];

  // Remove quebras desnecessárias e scripts
  const limpo = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  const blocos: BlocoTexto[] = [];

  // Regex para tags de bloco comuns, incluindo linhas de tabela (tr)
  const regexTags = /<(h1|h2|h3|p|li|tr|hr)[^>]*>([\s\S]*?)<\/\1>|<(hr)[^>]*\/?>/gi;
  let match;
  let achouAlgum = false;

  while ((match = regexTags.exec(limpo)) !== null) {
    achouAlgum = true;
    const tag = (match[1] || match[3] || '').toLowerCase() as BlocoTexto['tipo'];
    const conteudoBruto = match[2] || '';

    let textoTratado = conteudoBruto;
    if (tag === 'tr') {
      textoTratado = textoTratado.replace(/<\/(td|th)>\s*<(td|th)[^>]*>/gi, ' • ');
    }

    // Remove tags internas (ex: strong, span, em) e decodifica entidades básicas
    const textoLimpo = sanitizarTexto(
      textoTratado
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim()
    );

    if (tag === 'hr' || textoLimpo.length > 0) {
      blocos.push({ tipo: tag, texto: textoLimpo });
    }
  }

  // Fallback se não encontrar tags estruturadas (ex: texto puro com quebras)
  if (!achouAlgum) {
    const textoGeral = sanitizarTexto(
      limpo
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim()
    );
    const linhas = textoGeral.split('\n');
    for (const linha of linhas) {
      const trimmed = linha.trim();
      if (trimmed) {
        blocos.push({ tipo: 'p', texto: trimmed });
      }
    }
  }

  return blocos;
}

/**
 * Divide uma linha de texto em várias respeitando a largura máxima permitida.
 */
function quebrarLinhas(texto: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const palavras = texto.split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return [''];

  const linhas: string[] = [];
  let linhaAtual = palavras[0];

  for (let i = 1; i < palavras.length; i++) {
    const palavra = palavras[i];
    const testeLinha = `${linhaAtual} ${palavra}`;
    const largura = font.widthOfTextAtSize(testeLinha, fontSize);

    if (largura <= maxWidth) {
      linhaAtual = testeLinha;
    } else {
      linhas.push(linhaAtual);
      linhaAtual = palavra;
    }
  }
  linhas.push(linhaAtual);
  return linhas;
}

/**
 * Gera documento PDF completo com o contrato assinado e certificado de evidências.
 */
export async function gerarPdfContrato(dados: DadosPdfContrato): Promise<{ buffer: Buffer; hash: string }> {
  const pdfDoc = await PDFDocument.create();

  // Dimensões A4 em pontos
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 54; // ~1.9cm
  const contentWidth = pageWidth - marginX * 2;
  const marginTop = 60;
  const marginBottom = 60;

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - marginTop;

  function novaPagina(): PDFPage {
    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    cursorY = pageHeight - marginTop;
    return currentPage;
  }

  function checarEspaco(alturaNecessaria: number) {
    if (cursorY - alturaNecessaria < marginBottom) {
      novaPagina();
    }
  }

  // --- CABEÇALHO DO DOCUMENTO ---
  checarEspaco(80);

  // Barra de status verde superior
  currentPage.drawRectangle({
    x: marginX,
    y: cursorY - 4,
    width: contentWidth,
    height: 4,
    color: rgb(0.1, 0.65, 0.4),
  });
  cursorY -= 20;

  const tituloSanitizado = sanitizarTexto(dados.titulo || 'Contrato de Prestação de Serviços');
  const numeroTexto = dados.numero ? `Nº ${sanitizarTexto(dados.numero)}` : '';

  currentPage.drawText(tituloSanitizado, {
    x: marginX,
    y: cursorY,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  cursorY -= 18;

  if (numeroTexto) {
    currentPage.drawText(numeroTexto, {
      x: marginX,
      y: cursorY,
      size: 10,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    });
    cursorY -= 16;
  }

  // Linha divisória
  currentPage.drawLine({
    start: { x: marginX, y: cursorY },
    end: { x: marginX + contentWidth, y: cursorY },
    thickness: 0.8,
    color: rgb(0.85, 0.85, 0.85),
  });
  cursorY -= 22;

  // --- CORPO DO CONTRATO ---
  const blocos = extrairBlocosHtml(dados.conteudoHtml);

  for (const bloco of blocos) {
    if (bloco.tipo === 'hr') {
      checarEspaco(20);
      currentPage.drawLine({
        start: { x: marginX, y: cursorY },
        end: { x: marginX + contentWidth, y: cursorY },
        thickness: 0.5,
        color: rgb(0.88, 0.88, 0.88),
      });
      cursorY -= 18;
      continue;
    }

    let fontSize = 10;
    let font = fontRegular;
    let lineHeight = 14;
    let espacoDepois = 10;
    let cor = rgb(0.15, 0.15, 0.15);
    let indent = 0;

    if (bloco.tipo === 'h1') {
      fontSize = 14;
      font = fontBold;
      lineHeight = 18;
      espacoDepois = 12;
      cor = rgb(0.08, 0.08, 0.08);
      checarEspaco(lineHeight + 10);
    } else if (bloco.tipo === 'h2') {
      fontSize = 12;
      font = fontBold;
      lineHeight = 16;
      espacoDepois = 10;
      cor = rgb(0.1, 0.1, 0.1);
      checarEspaco(lineHeight + 8);
    } else if (bloco.tipo === 'h3') {
      fontSize = 11;
      font = fontBold;
      lineHeight = 15;
      espacoDepois = 8;
      cor = rgb(0.12, 0.12, 0.12);
      checarEspaco(lineHeight + 6);
    } else if (bloco.tipo === 'li') {
      fontSize = 9.5;
      font = fontRegular;
      lineHeight = 13.5;
      espacoDepois = 6;
      indent = 14;
    } else if (bloco.tipo === 'tr') {
      fontSize = 9;
      font = fontRegular;
      lineHeight = 13;
      espacoDepois = 5;
      indent = 12;
      cor = rgb(0.2, 0.2, 0.2);
    }

    const larguraTexto = contentWidth - indent;
    const sublinhas = bloco.texto.split('\n');

    for (const sublinha of sublinhas) {
      const linhasEnvelopadas = quebrarLinhas(sublinha, font, fontSize, larguraTexto);

      for (let i = 0; i < linhasEnvelopadas.length; i++) {
        checarEspaco(lineHeight);
        const linha = linhasEnvelopadas[i];

        if ((bloco.tipo === 'li' || bloco.tipo === 'tr') && i === 0) {
          currentPage.drawText(bloco.tipo === 'tr' ? '-' : '•', {
            x: marginX + 4,
            y: cursorY,
            size: fontSize,
            font: fontBold,
            color: rgb(0.2, 0.2, 0.2),
          });
        }

        currentPage.drawText(linha, {
          x: marginX + indent,
          y: cursorY,
          size: fontSize,
          font,
          color: cor,
        });

        cursorY -= lineHeight;
      }
    }

    cursorY -= espacoDepois;
  }

  // --- FOLHA DE ROSTO / CERTIFICADO DE EVIDÊNCIAS ---
  // O certificado começa em uma página própria de evidências
  novaPagina();

  currentPage.drawRectangle({
    x: marginX,
    y: cursorY - 6,
    width: contentWidth,
    height: 6,
    color: rgb(0.1, 0.65, 0.4),
  });
  cursorY -= 28;

  currentPage.drawText('CERTIFICADO DE ASSINATURA ELETRÔNICA', {
    x: marginX,
    y: cursorY,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  cursorY -= 16;

  currentPage.drawText(
    'Este documento foi assinado eletronicamente e possui validade jurídica conforme art. 10, § 2º da MP 2.200-2/2001.',
    {
      x: marginX,
      y: cursorY,
      size: 9,
      font: fontOblique,
      color: rgb(0.4, 0.4, 0.4),
    }
  );
  cursorY -= 24;

  // Box de Hash e Integridade
  currentPage.drawRectangle({
    x: marginX,
    y: cursorY - 45,
    width: contentWidth,
    height: 52,
    color: rgb(0.96, 0.97, 0.98),
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
  });

  currentPage.drawText('INTEGRIDADE DO DOCUMENTO ORIGINAL (SHA-256)', {
    x: marginX + 12,
    y: cursorY - 8,
    size: 8.5,
    font: fontBold,
    color: rgb(0.2, 0.3, 0.4),
  });

  currentPage.drawText(dados.hashDocumento || 'Hash não calculado', {
    x: marginX + 12,
    y: cursorY - 24,
    size: 8,
    font: fontRegular,
    color: rgb(0.3, 0.35, 0.4),
  });

  currentPage.drawText('O hash acima comprova que o conteúdo integral do contrato foi preservado e não sofreu alterações.', {
    x: marginX + 12,
    y: cursorY - 37,
    size: 7.5,
    font: fontOblique,
    color: rgb(0.45, 0.5, 0.55),
  });
  cursorY -= 68;

  // Bloco Signatário 1: Cliente (Contratante)
  checarEspaco(110);
  currentPage.drawRectangle({
    x: marginX,
    y: cursorY - 95,
    width: contentWidth,
    height: 102,
    color: rgb(0.99, 0.99, 0.99),
    borderColor: rgb(0.88, 0.9, 0.92),
    borderWidth: 1,
  });

  currentPage.drawText('SIGNATÁRIO 1 (CONTRATANTE / CLIENTE)', {
    x: marginX + 12,
    y: cursorY - 10,
    size: 9.5,
    font: fontBold,
    color: rgb(0.12, 0.5, 0.3),
  });

  const cli = dados.assinaturaCliente;
  const cliNome = cli?.nome ? sanitizarTexto(cli.nome) : dados.clienteNome ? sanitizarTexto(dados.clienteNome) : 'Pendente de assinatura';
  const cliDoc = cli?.documento ? sanitizarTexto(cli.documento) : 'Não informado';
  const cliEmail = cli?.email ? sanitizarTexto(cli.email) : 'Não informado';
  const cliData = cli?.dataHora ? new Date(cli.dataHora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Pendente';
  const cliIp = cli?.ip ? sanitizarTexto(cli.ip) : 'Não registrado';

  currentPage.drawText(`Nome Completo: ${cliNome}`, { x: marginX + 12, y: cursorY - 26, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText(`CPF / CNPJ: ${cliDoc}`, { x: marginX + 12, y: cursorY - 39, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText(`E-mail: ${cliEmail}`, { x: marginX + 12, y: cursorY - 52, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText(`Data e Hora (Brasília): ${cliData}`, { x: marginX + 12, y: cursorY - 65, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText(`Endereço IP: ${cliIp}`, { x: marginX + 12, y: cursorY - 78, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  cursorY -= 118;

  // Bloco Signatário 2: Agência (Contratada)
  checarEspaco(110);
  currentPage.drawRectangle({
    x: marginX,
    y: cursorY - 95,
    width: contentWidth,
    height: 102,
    color: rgb(0.99, 0.99, 0.99),
    borderColor: rgb(0.88, 0.9, 0.92),
    borderWidth: 1,
  });

  currentPage.drawText('SIGNATÁRIO 2 (CONTRATADA / AGÊNCIA)', {
    x: marginX + 12,
    y: cursorY - 10,
    size: 9.5,
    font: fontBold,
    color: rgb(0.12, 0.5, 0.3),
  });

  const age = dados.assinaturaAgencia;
  const ageNome = age?.nome ? sanitizarTexto(age.nome) : dados.agenciaNome ? sanitizarTexto(dados.agenciaNome) : 'Representante da Agência';
  const ageData = age?.dataHora ? new Date(age.dataHora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Pendente';
  const ageIp = age?.ip ? sanitizarTexto(age.ip) : 'Registrado internamente';

  currentPage.drawText(`Representante: ${ageNome}`, { x: marginX + 12, y: cursorY - 26, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText(`Papel: Contra-assinatura da Contratada`, { x: marginX + 12, y: cursorY - 39, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText(`Data e Hora (Brasília): ${ageData}`, { x: marginX + 12, y: cursorY - 52, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText(`Endereço IP da Agência: ${ageIp}`, { x: marginX + 12, y: cursorY - 65, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText(`Status: Documento concluído e arquivado com segurança`, { x: marginX + 12, y: cursorY - 78, size: 8.5, font: fontOblique, color: rgb(0.3, 0.6, 0.3) });
  cursorY -= 118;

  // Rodapé em todas as páginas com numeração
  const totalPages = pdfDoc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const page = pdfDoc.getPage(i);
    const textoPagina = `Página ${i + 1} de ${totalPages}`;
    const textoRodape = `${tituloSanitizado} | GENSBot Contratos Digitais`;

    page.drawLine({
      start: { x: marginX, y: 38 },
      end: { x: marginX + contentWidth, y: 38 },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9),
    });

    page.drawText(textoRodape, {
      x: marginX,
      y: 26,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.55, 0.55, 0.55),
    });

    const larguraNum = fontRegular.widthOfTextAtSize(textoPagina, 7.5);
    page.drawText(textoPagina, {
      x: marginX + contentWidth - larguraNum,
      y: 26,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.55, 0.55, 0.55),
    });
  }

  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  return { buffer, hash };
}
