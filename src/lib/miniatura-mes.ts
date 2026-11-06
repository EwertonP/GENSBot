/**
 * Textos da miniatura do link do mês (título, descrição e imagem de prévia que
 * aparecem no WhatsApp). Funções puras, para título, descrição e imagem
 * dizerem sempre a mesma coisa.
 */
import { ETAPAS_PROCESSO, type EtapaMes } from './link-do-mes';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "2026-11-01" vira { nome: "Novembro", minusculo: "novembro", ano: "2026" }. */
export function nomeDoMes(mes: string): { nome: string; minusculo: string; ano: string } {
  const [ano, m] = mes.split('-');
  const minusculo = MESES[Number(m) - 1] || '';
  return { nome: minusculo ? `${minusculo.charAt(0).toUpperCase()}${minusculo.slice(1)}` : '', minusculo, ano: ano || '' };
}

/** "@camilalucas_adv" a partir do usuário do Instagram ou do nome cadastrado. */
export function identificacaoDoCliente(c: { nome: string; usuario: string | null }): string {
  if (c.usuario) return `@${c.usuario.replace(/^@/, '')}`;
  return c.nome;
}

function plural(n: number, singular: string, pluralTxt: string): string {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}

export interface ResumoMes {
  mes: string;
  total: number;
  para_voce: number;
}

export function tituloDaMiniatura(cliente: { nome: string; usuario: string | null }, mes: string): string {
  const m = nomeDoMes(mes);
  return `Conteúdo de ${m.minusculo} de ${m.ano} · ${identificacaoDoCliente(cliente)}`;
}

export function descricaoDaMiniatura(r: ResumoMes): string {
  const m = nomeDoMes(r.mes);
  if (r.total === 0) return `Acompanhe aqui o conteúdo de ${m.minusculo}: os posts aparecem conforme são planejados.`;
  const posts = `${plural(r.total, 'post', 'posts')} em ${m.minusculo}.`;
  const acao = r.para_voce > 0 ? ` ${r.para_voce === 1 ? '1 espera' : `${r.para_voce} esperam`} a sua aprovação.` : '';
  return `${posts}${acao} Acompanhe cada etapa e aprove por aqui.`;
}

/** Linhas da lista de etapas da imagem: só as que têm posts, na ordem do processo. */
export function linhasDaImagem(porEtapa: Record<EtapaMes, number>): { etapa: EtapaMes; rotulo: string; n: number }[] {
  return ETAPAS_PROCESSO.filter((e) => (porEtapa[e.etapa] || 0) > 0).map((e) => ({ etapa: e.etapa, rotulo: e.rotulo, n: porEtapa[e.etapa] }));
}

/** Cor (já com contraste sobre o fundo escuro da imagem) de cada etapa. */
export const COR_ETAPA_IMAGEM: Record<EtapaMes, string> = {
  texto: '#6CC9FF',
  producao: '#B9A5FF',
  revisao: '#9DBEB1',
  aprovacao: '#FFD84D',
  agendado: '#00DC94',
  publicado: '#4ADE80',
};
