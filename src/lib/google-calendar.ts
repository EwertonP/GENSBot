/**
 * Cliente nativo e leve da Google Calendar API v3 (REST).
 * Sem bibliotecas pesadas externas; renova refresh_token automaticamente.
 */

import { supabase as serviceSupabase } from '@/lib/supabase';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export interface GoogleCalendarIntegration {
  id: string;
  agencia_id: string;
  cliente_id: string | null;
  email: string | null;
  calendar_id: string;
  access_token: string | null;
  refresh_token: string;
  token_expira_em: string | null;
  sincronizacao_ativa: boolean;
}

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  return { clientId, clientSecret };
}

/**
 * Gera a URL oficial de consentimento do Google Calendar
 */
export function gerarGoogleAuthUrl(params: {
  clienteId?: string | null;
  agenciaId: string;
  redirectUri: string;
}): string {
  const { clientId } = getGoogleOAuthConfig();
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID não configurado nas variáveis de ambiente.');
  }

  // Passa o clienteId e agenciaId no state codificado em base64
  const stateData = JSON.stringify({
    clienteId: params.clienteId || null,
    agenciaId: params.agenciaId,
  });
  const state = Buffer.from(stateData).toString('base64url');

  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPES,
    access_type: 'offline', // Obrigatório para receber o refresh_token
    prompt: 'consent', // Garante que o refresh_token venha em novas conexões
    state,
  });

  return `${GOOGLE_AUTH_URL}?${query.toString()}`;
}

/**
 * Troca o código retornado pelo Google por tokens de acesso
 */
export async function trocarCodigoPorGoogleTokens(params: {
  code: string;
  redirectUri: string;
}): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  email?: string;
}> {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  if (!clientId || !clientSecret) {
    throw new Error('Credenciais GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET ausentes.');
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: params.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao obter token do Google (${res.status}): ${errText}`);
  }

  const data = await res.json();

  // Busca o email do usuário logado
  let email: string | undefined;
  if (data.access_token) {
    try {
      const resUser = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (resUser.ok) {
        const u = await resUser.json();
        email = u.email;
      }
    } catch {
      // Silencioso
    }
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    email,
  };
}

/**
 * Obtém um access_token válido renovando via refresh_token se necessário
 */
export async function obterAccessTokenValido(
  integracao: GoogleCalendarIntegration
): Promise<string> {
  const agora = Date.now();
  const expiraEm = integracao.token_expira_em ? new Date(integracao.token_expira_em).getTime() : 0;

  // Se o token ainda tem pelo menos 5 minutos de validade, reutiliza
  if (integracao.access_token && expiraEm > agora + 5 * 60 * 1000) {
    return integracao.access_token;
  }

  // Renova via refresh_token
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: integracao.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`Erro ao renovar token do Google Agenda: ${errTxt}`);
  }

  const data = await res.json();
  const novoAccessToken = data.access_token;
  const novoExpiraEm = new Date(agora + data.expires_in * 1000).toISOString();

  // Salva no banco o token renovado
  await serviceSupabase
    .from('google_calendar_integrations')
    .update({
      access_token: novoAccessToken,
      token_expira_em: novoExpiraEm,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', integracao.id);

  return novoAccessToken;
}

/**
 * Cria um agendamento/consulta médica diretamente no Google Calendar da clínica
 */
export async function criarEventoGoogleCalendar({
  clienteId,
  agenciaId,
  titulo,
  nomePaciente,
  telefonePaciente,
  dataInicio,
  dataFim,
  observacoes,
}: {
  clienteId?: string | null;
  agenciaId: string;
  titulo: string;
  nomePaciente: string;
  telefonePaciente?: string | null;
  dataInicio: string; // ISO
  dataFim: string; // ISO
  observacoes?: string | null;
}): Promise<{ ok: boolean; eventId?: string; htmlLink?: string; erro?: string }> {
  try {
    // 1. Busca a integração conectada
    let query = serviceSupabase
      .from('google_calendar_integrations')
      .select('*')
      .eq('agencia_id', agenciaId)
      .eq('sincronizacao_ativa', true);

    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    } else {
      query = query.is('cliente_id', null);
    }

    const { data: integracao, error } = await query.maybeSingle();

    if (error || !integracao) {
      return { ok: false, erro: 'Google Agenda não conectado para este cliente.' };
    }

    // 2. Garante o access_token válido
    const token = await obterAccessTokenValido(integracao as GoogleCalendarIntegration);

    // 3. Monta os dados do evento
    const descricao = [
      `👤 Paciente: ${nomePaciente}`,
      telefonePaciente ? `📱 WhatsApp: ${telefonePaciente}` : null,
      observacoes ? `📝 Observações: ${observacoes}` : null,
      ``,
      `_Agendado automaticamente pelo GENSBot CRM._`,
    ]
      .filter(Boolean)
      .join('\n');

    const calendarId = encodeURIComponent(integracao.calendar_id || 'primary');
    const url = `${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: `${titulo} - ${nomePaciente}`,
        description: descricao,
        start: { dateTime: dataInicio },
        end: { dateTime: dataFim },
      }),
    });

    if (!res.ok) {
      const errTxt = await res.text();
      return { ok: false, erro: `Google Calendar API erro (${res.status}): ${errTxt}` };
    }

    const eventoCriado = await res.json();
    return {
      ok: true,
      eventId: eventoCriado.id,
      htmlLink: eventoCriado.htmlLink,
    };
  } catch (err: unknown) {
    console.error('Erro ao criar evento no Google Calendar:', err);
    return { ok: false, erro: err instanceof Error ? err.message : String(err) };
  }
}
