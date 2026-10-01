/**
 * Ferramentas do MCP — Onda C6: edição de automação por partes.
 *
 * `editar_automacao` (c3) reescreve a automação inteira — todo campo omitido
 * é apagado, e foi o motivo de duas edições nesta agência terem sido feitas
 * direto no banco em vez de pelo MCP (adicionar "Capturar Lead" no meio de um
 * fluxo já existente). Esta ferramenta edita só o que for informado: um
 * recorte de campos (`campos`) e/ou uma lista de operações sobre as
 * perguntas (`operacoes`) — adicionar, remover ou editar um passo sem
 * reenviar os outros.
 *
 * Só funciona em fluxos "lineares" compilados pelo formulário guiado (mesma
 * limitação do decompileFlow usado por editar_automacao) e sem ramificação —
 * um fluxo com condição (se/senão) só é editável pelo Canvas da tela.
 */
import { supabase as db } from '../supabase';
import { ErroFerramenta, type Ferramenta } from './ferramentas';
import { str, lista, urlOuNull, automacaoDaAgencia, conflitos } from './ferramentas-c3';
import { buildFlowFromAdvancedForm, decompileFlow, type QualificationStep, type QualificationQuestionStep } from '../flow-engine/wizardCompiler';
import { defaultCaptureLeadConfig } from '../flow-engine/captureLeadDefaults';
import type { Automation, Followup } from '../../types/automation';

type Args = Record<string, unknown>;
const GATILHOS = ['dm', 'comment', 'story', 'story_mention'] as const;
const MATCH = ['contains', 'exact', 'any'] as const;

function isQuestionLike(step: QualificationStep): step is QualificationQuestionStep {
  return step.kind === 'question';
}
function hasText(step: QualificationStep): step is Extract<QualificationStep, { text: string }> {
  return step.kind === 'question' || step.kind === 'message' || step.kind === 'link';
}

/** Monta um passo "pergunta" novo a partir do mesmo formato usado em criar_automacao.perguntas[i]. */
function montarPerguntaNova(p: Args, posicao: number): QualificationQuestionStep {
  const texto = str(p.texto, 1000);
  if (!texto) throw new ErroFerramenta(`operacoes[${posicao}].pergunta.texto é obrigatório.`);
  return {
    kind: 'question',
    text: texto,
    buttons: lista(p.botoes, 3, 20),
    timeoutMinutes: Math.min(Math.max(Number(p.lembrete_apos_minutos) || 720, 5), 10080),
    reminderText: str(p.texto_lembrete, 500) || 'Oi! Ainda estou por aqui, fico à disposição pra continuar quando você puder. 🙂',
    ...(str(p.salvar_em_campo, 40) ? { saveReplyToField: str(p.salvar_em_campo, 40) } : {}),
    ...(str(p.tag_prefixo, 40) ? { saveReplyAsTagPrefix: str(p.tag_prefixo, 40) } : {}),
  };
}

/**
 * Aplica as operações em ordem sobre uma cópia das perguntas. `posicao` sempre se refere
 * ao estado ATUAL da lista — considerando as operações já aplicadas nesta mesma chamada,
 * não os índices originais — igual editar um documento de cima pra baixo.
 */
function aplicarOperacoes(perguntasOriginais: QualificationStep[], operacoes: Args[]): QualificationStep[] {
  const perguntas = [...perguntasOriginais];

  operacoes.forEach((op, i) => {
    const tipo = str(op.tipo, 30);
    const posInformada = op.posicao;
    const posicaoAtual = posInformada === undefined ? perguntas.length : Math.trunc(Number(posInformada));

    const pegarExistente = () => {
      if (!Number.isInteger(posicaoAtual) || posicaoAtual < 0 || posicaoAtual >= perguntas.length) {
        throw new ErroFerramenta(`operacoes[${i}]: "posicao" ${posInformada ?? ''} não existe (a automação tem ${perguntas.length} pergunta(s), de 0 a ${perguntas.length - 1}).`);
      }
      return perguntas[posicaoAtual];
    };

    switch (tipo) {
      case 'adicionar_pergunta': {
        const alvo = Math.min(Math.max(0, posicaoAtual), perguntas.length);
        perguntas.splice(alvo, 0, montarPerguntaNova((op.pergunta as Args) || {}, i));
        break;
      }
      case 'adicionar_captura': {
        const campos = lista(op.campos, 2, 10);
        if (campos.length === 0 || campos.some((c) => c !== 'email' && c !== 'phone')) {
          throw new ErroFerramenta(`operacoes[${i}].campos precisa ter "email" e/ou "phone".`);
        }
        const alvo = Math.min(Math.max(0, posicaoAtual), perguntas.length);
        perguntas.splice(alvo, 0, { kind: 'capture', config: { ...defaultCaptureLeadConfig(), fields: campos as ('email' | 'phone')[] } });
        break;
      }
      case 'remover': {
        pegarExistente();
        perguntas.splice(posicaoAtual, 1);
        break;
      }
      case 'editar_texto': {
        const alvo = pegarExistente();
        if (!hasText(alvo)) throw new ErroFerramenta(`operacoes[${i}]: a pergunta na posição ${posicaoAtual} é do tipo "${alvo.kind}" e não tem texto editável assim — use editar_lembrete pro lembrete de uma captura.`);
        const texto = str(op.texto, 1000);
        if (!texto) throw new ErroFerramenta(`operacoes[${i}].texto é obrigatório.`);
        alvo.text = texto;
        break;
      }
      case 'editar_botoes': {
        const alvo = pegarExistente();
        if (!isQuestionLike(alvo)) throw new ErroFerramenta(`operacoes[${i}]: a posição ${posicaoAtual} não é uma pergunta com botões (é "${alvo.kind}").`);
        alvo.buttons = lista(op.botoes, 3, 20);
        break;
      }
      case 'editar_lembrete': {
        const alvo = pegarExistente();
        const texto = str(op.texto, 500);
        if (!texto) throw new ErroFerramenta(`operacoes[${i}].texto é obrigatório.`);
        if (isQuestionLike(alvo)) alvo.reminderText = texto;
        else if (alvo.kind === 'capture') alvo.config.reminderText = texto;
        else throw new ErroFerramenta(`operacoes[${i}]: a posição ${posicaoAtual} ("${alvo.kind}") não tem lembrete.`);
        break;
      }
      case 'editar_link': {
        const alvo = pegarExistente();
        if (alvo.kind !== 'link') throw new ErroFerramenta(`operacoes[${i}]: a posição ${posicaoAtual} não é uma mensagem com link (é "${alvo.kind}").`);
        if (op.url !== undefined) alvo.link_url = urlOuNull(op.url, `operacoes[${i}].url`);
        if (op.botao !== undefined) alvo.link_button_label = str(op.botao, 20) || null;
        break;
      }
      default:
        throw new ErroFerramenta(`operacoes[${i}].tipo "${tipo}" não existe. Use: adicionar_pergunta, adicionar_captura, remover, editar_texto, editar_botoes, editar_lembrete ou editar_link.`);
    }
  });

  return perguntas;
}

/** Operações que escrevem texto que o lead vai ler — exigem copy_humanizada. */
const OPERACOES_COM_COPY = new Set(['adicionar_pergunta', 'editar_texto', 'editar_botoes', 'editar_lembrete']);

function tocaCopy(campos: Args | undefined, operacoes: Args[]): boolean {
  if (campos) {
    for (const chave of ['mensagem_inicial', 'botao_inicial', 'respostas_publicas', 'followups']) {
      if (campos[chave] !== undefined) return true;
    }
    const link = campos.link as Args | undefined;
    if (link && (link.texto !== undefined || link.botao !== undefined)) return true;
  }
  return operacoes.some((op) => OPERACOES_COM_COPY.has(str(op.tipo, 30)));
}

export const FERRAMENTAS_C6: Ferramenta[] = [
  {
    name: 'editar_automacao_parcial',
    title: 'Editar automação por partes (só pausada)',
    description:
      'Edita só o que for informado numa automação PAUSADA, sem precisar reenviar o resto (ao contrário de editar_automacao, que reescreve tudo). "campos" troca valores do topo (mensagem inicial, link, etc.); "operacoes" adiciona/remove/edita perguntas uma por vez — inclusive "adicionar_captura" pra inserir o bloco "Capturar Lead" no meio de um fluxo já existente. A versão anterior vai para o histórico. Só funciona em fluxo sem ramificação (se tiver condição "se/senão", é só pelo Canvas da tela). Operação que grava texto que o lead vai ler exige copy_humanizada = true.',
    inputSchema: {
      type: 'object',
      properties: {
        automacao_id: { type: 'string' },
        campos: {
          type: 'object',
          description: 'Só os campos informados mudam; o resto permanece como está.',
          properties: {
            nome: { type: 'string' },
            gatilhos: { type: 'array', items: { type: 'string', enum: GATILHOS as unknown as string[] } },
            palavras_chave: { type: 'array', items: { type: 'string' } },
            tipo_correspondencia: { type: 'string', enum: MATCH as unknown as string[] },
            respostas_publicas: { type: 'array', items: { type: 'string' } },
            mensagem_inicial: { type: 'string' },
            botao_inicial: { type: 'string', description: 'Até 20 caracteres.' },
            link: {
              type: 'object',
              properties: { texto: { type: 'string' }, url: { type: 'string' }, botao: { type: 'string' } },
              description: 'Só as chaves informadas (texto/url/botao) mudam.',
            },
            followups: {
              type: 'array',
              maxItems: 5,
              description: 'Substitui TODOS os follow-ups (não dá pra editar um só por aqui ainda).',
              items: {
                type: 'object',
                properties: { texto: { type: 'string' }, apos_minutos: { type: 'number' }, link_url: { type: 'string' }, link_botao: { type: 'string' } },
                required: ['texto'],
              },
            },
          },
        },
        operacoes: {
          type: 'array',
          maxItems: 10,
          description: '"posicao" é o índice na lista de perguntas (ler_automacao), 0 = primeira. Aplicadas em ordem; cada "posicao" considera as operações anteriores desta mesma chamada.',
          items: {
            type: 'object',
            properties: {
              tipo: { type: 'string', enum: ['adicionar_pergunta', 'adicionar_captura', 'remover', 'editar_texto', 'editar_botoes', 'editar_lembrete', 'editar_link'] },
              posicao: { type: 'number', description: 'adicionar_*: onde inserir (padrão: no fim, antes do link). Os demais: obrigatório, a pergunta a mudar/remover.' },
              pergunta: {
                type: 'object',
                description: 'Só para tipo "adicionar_pergunta" — mesmo formato de criar_automacao.perguntas[i].',
                properties: {
                  texto: { type: 'string' },
                  botoes: { type: 'array', items: { type: 'string' }, maxItems: 3 },
                  lembrete_apos_minutos: { type: 'number' },
                  texto_lembrete: { type: 'string' },
                  salvar_em_campo: { type: 'string' },
                  tag_prefixo: { type: 'string' },
                },
              },
              campos: { type: 'array', items: { type: 'string', enum: ['email', 'phone'] }, description: 'Só para tipo "adicionar_captura".' },
              texto: { type: 'string', description: 'Para editar_texto, editar_lembrete.' },
              botoes: { type: 'array', items: { type: 'string' }, maxItems: 3, description: 'Só para editar_botoes.' },
              url: { type: 'string', description: 'Só para editar_link.' },
              botao: { type: 'string', description: 'Só para editar_link (texto do botão, até 20 caracteres).' },
            },
            required: ['tipo'],
          },
        },
        copy_humanizada: { type: 'boolean', description: 'Obrigatório true quando a chamada grava texto novo que o lead vai ler.' },
      },
      required: ['automacao_id'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args: Args, ctx) {
      const atual = await automacaoDaAgencia(ctx, str(args.automacao_id, 64));
      if (atual.active) throw new ErroFerramenta('A automação está ATIVA. Pause antes (pausar_automacao) para não mudar conversas em andamento sem revisão.');
      if (!atual.flow_definition) throw new ErroFerramenta('Essa automação ainda está no formato antigo, sem fluxo. Use editar_automacao (reescreve tudo) pra migrá-la pro formulário guiado antes de editar por partes.');

      const decompilado = decompileFlow(atual.flow_definition);
      if (!decompilado.compatible) throw new ErroFerramenta(`Esse fluxo não é editável por partes: ${decompilado.reason}`);
      if (decompilado.condition) throw new ErroFerramenta('Essa automação tem uma ramificação (se/senão) — isso só é editável pelo Canvas da tela.');

      const campos = (args.campos as Args) || undefined;
      const operacoes = Array.isArray(args.operacoes) ? (args.operacoes as Args[]) : [];
      if (!campos && operacoes.length === 0) throw new ErroFerramenta('Informe "campos" e/ou "operacoes" — sem isso não há o que editar.');
      if (tocaCopy(campos, operacoes) && args.copy_humanizada !== true) {
        throw new ErroFerramenta('Passe toda a copy nova (perguntas, botões, mensagem, follow-ups) pelo humanizer antes e envie copy_humanizada = true.');
      }

      const base = decompilado.form;
      const nome = campos?.nome !== undefined ? str(campos.nome, 200) || atual.name : atual.name;
      const gatilhos = campos?.gatilhos !== undefined ? lista(campos.gatilhos, 4, 20) : base.triggers;
      if (gatilhos.length === 0 || gatilhos.some((g) => !GATILHOS.includes(g as (typeof GATILHOS)[number]))) {
        throw new ErroFerramenta(`"campos.gatilhos" precisa ter um ou mais de: ${GATILHOS.join(', ')}.`);
      }
      const matchType = (campos?.tipo_correspondencia !== undefined ? str(campos.tipo_correspondencia, 10) : base.match_type) as Automation['match_type'];
      if (!MATCH.includes(matchType)) throw new ErroFerramenta(`"campos.tipo_correspondencia" deve ser: ${MATCH.join(', ')}.`);
      const palavras = campos?.palavras_chave !== undefined ? lista(campos.palavras_chave, 20, 60) : base.keywords;
      if (matchType !== 'any' && palavras.length === 0) throw new ErroFerramenta('"campos.palavras_chave" não pode ficar vazio (ou use tipo_correspondencia "any").');

      const link = (campos?.link as Args) || {};
      const followups: Followup[] =
        campos?.followups !== undefined
          ? (campos.followups as Args[]).slice(0, 5).map((f, i) => {
              const texto = str(f.texto, 1000);
              if (!texto) throw new ErroFerramenta(`campos.followups[${i}].texto é obrigatório.`);
              return {
                id: crypto.randomUUID(),
                delay_minutes: Math.min(Math.max(Number(f.apos_minutos) || 1440, 5), 43200),
                text: texto,
                link_url: urlOuNull(f.link_url, `campos.followups[${i}].link_url`),
                link_button_label: str(f.link_botao, 20) || null,
              };
            })
          : base.followups;

      const formAtualizado: Automation = {
        name: nome,
        active: false,
        triggers: gatilhos,
        keywords: palavras,
        match_type: matchType,
        specific_post_id: base.specific_post_id,
        specific_story_id: base.specific_story_id,
        public_replies: campos?.respostas_publicas !== undefined ? lista(campos.respostas_publicas, 5, 300) : base.public_replies,
        welcome_dm: campos?.mensagem_inicial !== undefined ? str(campos.mensagem_inicial, 1000) || base.welcome_dm : base.welcome_dm,
        quick_reply_button: campos?.botao_inicial !== undefined ? str(campos.botao_inicial, 20) || null : base.quick_reply_button,
        welcome_dm_timeout_minutes: base.welcome_dm_timeout_minutes,
        welcome_dm_reminder_text: base.welcome_dm_reminder_text,
        link_text: link.texto !== undefined ? str(link.texto, 1000) || null : base.link_text,
        link_url: link.url !== undefined ? urlOuNull(link.url, 'campos.link.url') : base.link_url,
        link_button_label: link.botao !== undefined ? str(link.botao, 20) || null : base.link_button_label,
        followups,
      };

      const perguntasFinais = aplicarOperacoes(decompilado.questions, operacoes);
      const flow = buildFlowFromAdvancedForm(formAtualizado, perguntasFinais);
      const versaoAnterior = atual.flow_version || 0;

      const { error: vErr } = await db.from('automation_versions').insert({
        automation_id: atual.id,
        user_id: atual.user_id,
        version_number: versaoAnterior,
        flow_definition: atual.flow_definition,
        label: `Antes da edição por partes pelo Claude (via ${ctx.nome})`,
      });
      if (vErr) throw new Error(vErr.message);

      const { error } = await db
        .from('automations')
        .update({
          name: formAtualizado.name,
          triggers: formAtualizado.triggers,
          keywords: formAtualizado.keywords,
          match_type: formAtualizado.match_type,
          public_replies: formAtualizado.public_replies,
          welcome_dm: formAtualizado.welcome_dm,
          quick_reply_button: formAtualizado.quick_reply_button,
          link_text: formAtualizado.link_text,
          link_url: formAtualizado.link_url,
          link_button_label: formAtualizado.link_button_label,
          followups: formAtualizado.followups,
          flow_definition: flow,
          flow_version: versaoAnterior + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', atual.id)
        .eq('active', false);
      if (error) throw new Error(error.message);

      return {
        automacao_id: atual.id,
        nome: formAtualizado.name,
        status: 'pausada',
        versao: versaoAnterior + 1,
        campos_alterados: campos ? Object.keys(campos) : [],
        operacoes_aplicadas: operacoes.length,
        total_perguntas: perguntasFinais.length,
        ...(campos?.palavras_chave !== undefined ? { conflitos_de_palavra_chave: await conflitos(atual.instagram_user_id, palavras, atual.id) } : {}),
      };
    },
  },
];
