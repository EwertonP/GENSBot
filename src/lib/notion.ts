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
 * Extrai texto simples de um campo RichText do Notion.
 */
export function extractRichText(prop: any): string {
  if (!prop) return '';
  if (Array.isArray(prop.rich_text)) {
    return prop.rich_text.map((t: any) => t.plain_text || '').join('');
  }
  if (Array.isArray(prop.title)) {
    return prop.title.map((t: any) => t.plain_text || '').join('');
  }
  return '';
}

/**
 * Converte propriedades da página do Notion para a estrutura de demanda do GENSBot.
 */
export function mapNotionPageToDemand(page: NotionPageItem): MappedNotionDemand {
  const props = page.properties || {};

  // 1. Título do Post (Nome do projeto / Tema do Post / Title)
  const titleProp = props['Nome do projeto'] || props['Tema do Post'] || props['Título'] || props['Name'] || props['Conteúdo'] || Object.values(props).find((p: any) => p.type === 'title');
  const titulo = extractRichText(titleProp) || 'Demanda Sem Título (Notion)';

  // 2. Formato (Seleção / Formato / Tipo)
  let tipo: 'post' | 'reel' | 'story' | 'avulso' = 'post';
  const selProp = props['Seleção'] || props['Formato'] || props['Tipo'];
  const selText = (
    selProp?.multi_select?.[0]?.name ||
    selProp?.select?.name ||
    ''
  ).toLowerCase();

  if (selText.includes('vídeo') || selText.includes('video') || selText.includes('reels') || selText.includes('reel')) {
    tipo = 'reel';
  } else if (selText.includes('story') || selText.includes('stories')) {
    tipo = 'story';
  } else if (selText.includes('carrossel') || selText.includes('feed') || selText.includes('post') || selText.includes('imagem')) {
    tipo = 'post';
  }

  // 3. Legenda
  const legendaProp = props['Legenda'] || props['Legenda Completa'];
  const legenda = extractRichText(legendaProp);

  // 4. Roteiro / Briefing / Texto da Arte
  const roteiroProp = props['Roteiro'] || props['Texto da arte'] || props['Briefing'] || props['Copy'];
  const briefing = extractRichText(roteiroProp);

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
