/**
 * Cliente de Integração Oficial do Notion para Sincronização Unificada GENSBot.
 *
 * Utiliza fetch nativo com a REST API v1 do Notion para alta performance sem dependências extras.
 */

export interface NotionPagePropertyRichText {
  plain_text: string;
}

export interface NotionPagePropertyTitle {
  title: NotionPagePropertyRichText[];
}

export interface NotionPagePropertyText {
  rich_text: NotionPagePropertyRichText[];
}

export interface NotionPagePropertySelect {
  select: { name: string } | null;
  multi_select?: { name: string }[];
}

export interface NotionPagePropertyStatus {
  status: { name: string } | null;
}

export interface NotionPagePropertyFiles {
  files: Array<{
    name: string;
    file?: { url: string };
    external?: { url: string };
  }>;
}

export interface NotionPageItem {
  id: string;
  created_time: string;
  last_edited_time: string;
  url: string;
  properties: Record<string, any>;
}

export interface MappedNotionDemand {
  notionPageId: string;
  titulo: string;
  tipo: 'post' | 'reel' | 'story' | 'avulso';
  status: 'planejamento' | 'copy' | 'criacao_arte' | 'revisao_cliente' | 'pronto_publicar' | 'publicado';
  legenda: string;
  briefing: string;
  arquivosUrls: string[];
  lastEditedTime: string;
}

const NOTION_API_VERSION = '2022-06-28';

function getHeaders() {
  const token = process.env.NOTION_API_KEY;
  if (!token) {
    throw new Error('NOTION_API_KEY não está configurada nas variáveis de ambiente.');
  }
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_API_VERSION,
    'Content-Type': 'application/json',
  };
}

/**
 * Busca páginas de uma base de dados no Notion.
 */
export async function queryNotionDatabase(databaseId: string): Promise<NotionPageItem[]> {
  const cleanId = databaseId.replace(/-/g, '');
  const res = await fetch(`https://api.notion.com/v1/databases/${cleanId}/query`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      page_size: 100,
      sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
    }),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro ao consultar Notion database (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.results || [];
}

/**
 * Procura por todas as databases acessíveis no Notion workspace.
 */
export async function searchNotionDatabases(): Promise<Array<{ id: string; title: string; url: string }>> {
  const res = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      filter: { value: 'database', property: 'object' },
      page_size: 50,
    }),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro ao buscar databases do Notion (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return (data.results || []).map((db: any) => ({
    id: db.id,
    title: db.title?.[0]?.plain_text || 'Database Sem Título',
    url: db.url,
  }));
}

/**
 * Extrai texto simples de um campo RichText do Notion desfazendo sequências literais \\n.
 */
export function extractRichText(prop: any): string {
  if (!prop) return '';
  let rawText = '';
  if (Array.isArray(prop.rich_text)) {
    rawText = prop.rich_text.map((t: any) => t.plain_text || '').join('');
  } else if (Array.isArray(prop.title)) {
    rawText = prop.title.map((t: any) => t.plain_text || '').join('');
  }
  if (!rawText) return '';
  return rawText.replace(/\\n/g, '\n').replace(/\\r/g, '').trim();
}

/**
 * Busca o conteúdo dos blocos (body) de uma página no Notion caso as propriedades da database estejam vazias.
 */
export async function fetchNotionPageContent(pageId: string): Promise<string> {
  const cleanId = pageId.replace(/-/g, '');
  try {
    const res = await fetch(`https://api.notion.com/v1/blocks/${cleanId}/children?page_size=100`, {
      method: 'GET',
      headers: getHeaders(),
      next: { revalidate: 0 },
    });

    if (!res.ok) return '';
    const data = await res.json();
    const blocks = data.results || [];
    const lines: string[] = [];

    for (const b of blocks) {
      const type = b.type;
      const contentObj = b[type];
      if (!contentObj) continue;

      let text = '';
      if (Array.isArray(contentObj.rich_text)) {
        text = contentObj.rich_text.map((t: any) => t.plain_text || '').join('').replace(/\\n/g, '\n').trim();
      }

      if (!text) continue;

      if (type.startsWith('heading_1')) {
        lines.push(`# ${text}`);
      } else if (type.startsWith('heading_2')) {
        lines.push(`## ${text}`);
      } else if (type.startsWith('heading_3')) {
        lines.push(`### ${text}`);
      } else if (type === 'bulleted_list_item' || type === 'numbered_list_item') {
        lines.push(`• ${text}`);
      } else if (type === 'to_do') {
        lines.push(`[${contentObj.checked ? 'X' : ' '}] ${text}`);
      } else if (type === 'quote' || type === 'callout') {
        lines.push(`> ${text}`);
      } else if (type === 'toggle') {
        lines.push(`▼ ${text}`);
      } else {
        lines.push(text);
      }
    }

    return lines.join('\n');
  } catch {
    return '';
  }
}

/**
 * Converte propriedades da página do Notion para a estrutura de demanda do GENSBot.
 */
export function mapNotionPageToDemand(page: NotionPageItem): MappedNotionDemand {
  const props = page.properties || {};

  // 1. Título do Post (Nome do projeto / Tema do Post / Title)
  const titleProp = props['Nome do projeto'] || props['Tema do Post'] || props['Título'] || props['Titulo'] || props['Name'] || props['Conteúdo'] || Object.values(props).find((p: any) => p.type === 'title');
  const titulo = extractRichText(titleProp) || 'Demanda Sem Título (Notion)';

  // 2. Formato (Seleção / Formato / Tipo)
  let tipo: 'post' | 'reel' | 'story' | 'avulso' = 'post';
  const selProp = props['Seleção'] || props['Formato'] || props['Tipo'] || props['Tipo de Conteúdo'] || props['Formato do Post'];
  const selText = (
    selProp?.multi_select?.[0]?.name ||
    selProp?.select?.name ||
    ''
  ).toLowerCase();

  if (selText.includes('vídeo') || selText.includes('video') || selText.includes('reels') || selText.includes('reel')) {
    tipo = 'reel';
  } else if (selText.includes('story') || selText.includes('stories')) {
    tipo = 'story';
  } else if (selText.includes('carrossel') || selText.includes('feed') || selText.includes('post') || selText.includes('imagem') || selText.includes('estático') || selText.includes('estatico')) {
    tipo = 'post';
  }

  // 3. Legenda
  const legendaProp = props['Legenda'] || props['Legenda Completa'] || props['Caption'];
  let legenda = extractRichText(legendaProp);

  // 4. Extração Completa de Roteiro / Texto da Arte / Briefing / Copy / Descrição
  const roteiroText = extractRichText(props['Roteiro']);
  const textoArteText = extractRichText(props['Texto da arte'] || props['Texto da Arte'] || props['Texto Arte']);
  const briefingPropText = extractRichText(props['Briefing']);
  const copyText = extractRichText(props['Copy']);
  const descricaoText = extractRichText(props['Descrição'] || props['Descricao']);
  const conteudoText = extractRichText(props['Conteúdo'] || props['Conteudo']);

  // Se a legenda estiver vazia, verifica se há copy ou descrição para usar como legenda
  if (!legenda) {
    if (copyText) {
      legenda = copyText;
    } else if (descricaoText) {
      legenda = descricaoText;
    }
  }

  // Combina todas as fontes de briefing/roteiro/texto de slides disponíveis
  const sections: string[] = [];

  if (roteiroText) {
    sections.push(textoArteText || briefingPropText ? `--- ROTEIRO ---\n${roteiroText}` : roteiroText);
  }

  if (textoArteText && textoArteText !== roteiroText) {
    sections.push(roteiroText || briefingPropText ? `--- TEXTO DA ARTE / SLIDES ---\n${textoArteText}` : textoArteText);
  }

  if (briefingPropText && briefingPropText !== roteiroText && briefingPropText !== textoArteText) {
    sections.push(`--- BRIEFING ---\n${briefingPropText}`);
  }

  if (copyText && copyText !== legenda && copyText !== roteiroText && copyText !== textoArteText) {
    sections.push(`--- COPY ---\n${copyText}`);
  }

  if (descricaoText && descricaoText !== legenda && descricaoText !== roteiroText && descricaoText !== textoArteText) {
    sections.push(`--- DESCRIÇÃO ---\n${descricaoText}`);
  }

  if (conteudoText && conteudoText !== titulo && conteudoText !== legenda && conteudoText !== roteiroText && conteudoText !== textoArteText) {
    sections.push(`--- CONTEÚDO ---\n${conteudoText}`);
  }

  const briefing = sections.join('\n\n');

  // 5. Arquivos e Mídias
  const filesProp = props['Anexar arquivo'] || props['Imagens'] || props['Arquivos'] || props['Criativos'];
  const arquivosUrls: string[] = [];
  if (filesProp && Array.isArray(filesProp.files)) {
    for (const f of filesProp.files) {
      const url = f.file?.url || f.external?.url;
      if (url) arquivosUrls.push(url);
    }
  }

  // 6. Mapeamento de Status Notion -> GENSBot
  const statusProp = props['Status'];
  const statusName = (statusProp?.status?.name || statusProp?.select?.name || '').toLowerCase();
  let status: MappedNotionDemand['status'] = 'planejamento';

  if (statusName.includes('publicado') || statusName.includes('postado')) {
    status = 'publicado';
  } else if (statusName.includes('aprovado') || statusName.includes('agendado') || statusName.includes('pronto')) {
    status = 'pronto_publicar';
  } else if (statusName.includes('revisão') || statusName.includes('revisao') || statusName.includes('cliente')) {
    status = 'revisao_cliente';
  } else if (statusName.includes('progresso') || statusName.includes('design') || statusName.includes('arte') || statusName.includes('edição')) {
    status = 'criacao_arte';
  } else if (statusName.includes('copy') || statusName.includes('roteiro')) {
    status = 'copy';
  }

  return {
    notionPageId: page.id,
    titulo,
    tipo,
    status,
    legenda,
    briefing,
    arquivosUrls,
    lastEditedTime: page.last_edited_time,
  };
}

/**
 * Escreve o status de volta no Notion quando o cliente aprovar o post no GENSBot.
 */
export async function updateNotionPageStatus(pageId: string, newStatusName: string): Promise<boolean> {
  const cleanId = pageId.replace(/-/g, '');
  const res = await fetch(`https://api.notion.com/v1/pages/${cleanId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({
      properties: {
        Status: {
          status: { name: newStatusName },
        },
      },
    }),
  });

  if (!res.ok) {
    // Tenta fallback com select caso a propriedade Status seja select e não status
    const fallbackRes = await fetch(`https://api.notion.com/v1/pages/${cleanId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        properties: {
          Status: {
            select: { name: newStatusName },
          },
        },
      }),
    });
    return fallbackRes.ok;
  }

  return true;
}

/** Normaliza strings para comparação imune a emojis, acentos e prefixos da agência */
export function normalizarNomeComparacao(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^[@\s]+/, '')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\b(dr|dra|doutor|doutora|clinica|centro|diagnostico|radiologia|laboratorio|lab|adv|advocacia|dermato|dermatologia|odonto|odontologia|preparatorio|conteudos|criativos|calendario|editorial|posts|postados)\b/g, ' ')
    .replace(/\s+/g, '')
    .trim();
}

/** Verifica se o título da database no Notion pertence ao cliente da agência */
export function correspondeClienteEnotionDb(nomeCliente: string, tituloNotionDb: string): boolean {
  const normCliente = normalizarNomeComparacao(nomeCliente);
  const normDb = normalizarNomeComparacao(tituloNotionDb);

  if (!normCliente || !normDb) return false;
  if (normCliente === normDb) return true;
  if (normDb.includes(normCliente) || normCliente.includes(normDb)) return true;

  const palavrasCliente = nomeCliente
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^[@\s]+/, '')
    .split(/[\s._-]+/)
    .filter((p) => p.length >= 4 && !['dermato', 'advocacia', 'preparatorio', 'odonto', 'cardio', 'dsgn'].includes(p));

  const palavrasDb = tituloNotionDb
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[\s._-]+/)
    .filter((p) => p.length >= 4 && !['conteudos', 'criativos', 'calendario', 'editorial'].includes(p));

  for (const pc of palavrasCliente) {
    for (const pdb of palavrasDb) {
      if (pc === pdb || (pc.length >= 5 && pdb.includes(pc)) || (pdb.length >= 5 && pc.includes(pdb))) {
        return true;
      }
    }
  }

  return false;
}

