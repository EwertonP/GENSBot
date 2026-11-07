# Plano: notificações do GENSBot (equipe) — de "avisos soltos" para um sistema que acompanha a operação

## Contexto
O GENSBot já tem sino, push PWA (Web Push/VAPID), preferências por tipo e um service worker. Mas só 8 pontos do código chamam `notificar()`. A equipe fica sem aviso justamente nos momentos em que a cliente age fora do fluxo de aprovação individual (comentário, grade aprovada em massa, resposta ao pedido de informação, contrato assinado, proposta aceita, lead de formulário) e nada olha prazo, demanda parada ou aprovação esquecida. A notificação em si é pobre: só título, texto e link (sem imagem, sem botões, sem agrupamento, sem badge do app).

Decisões do Ewerton (esta conversa): aparelho principal **Android** (imagem e botões funcionam); **só equipe** por enquanto (cliente por WhatsApp/push fica para depois); rotina por **resumo diário de manhã**.

## Situação hoje (fatos verificados)
- `src/lib/notificar.ts`: 6 tipos, grava em `notificacoes`, push por `pushPadrao` + `notificacao_preferencias`. Não verifica erro do insert.
- `src/lib/push.ts` / `public/sw.js`: payload só `title/body/url/tag`. SW ignora `image`, `actions`, `data` extra. TTL 12 h e urgência fixos. Sem `setAppBadge`, sem `pushsubscriptionchange`.
- Sino (`notificacoes-sino.tsx`): polling de 60 s, sem filtro, sem apagar, sem agrupamento. Tabela `notificacoes` nunca é limpa.
- `check-alerts` e `refresh-token` mandam push/e-mail direto, só ao dono (`user_id`), fora do sino e das preferências. `check-alerts` **não tem agendamento no repo** (pg_cron só cobre publish, drain, refresh-token, notion-sync e rotina).
- Destinatários sempre `responsavel_id`/`co_responsaveis_ids` ou o dono; não existe "gestor da conta" nem "responsável pelo cliente".
- Crons: pg_cron + `CRON_SECRET` a cada minuto (publish, drain) e diários; nenhum lê `prazo`, `vencimento` ou `data_termino`.
- Reaproveitável: `resumo_operacao`, `listar_pendentes_aprovacao` (`dias_esperando`), `saude_da_operacao` (MCP), `calcularIndiceSaude`, `hojeBrasilia`, `validarCron`, `alert_notifications` (modelo de dedupe), `enviarMensagemOpenWA`.
- Em branch ainda não mesclada (`feat/contratos-assinatura-fundacao`) já existem os tipos `contrato_visualizado` e `contrato_assinado` e os avisos no fluxo de assinatura.

## Princípios
1. **Um evento, uma notificação clara e acionável**: quem fez, o quê, em qual cliente e post, e o próximo passo.
2. **Ruído sob controle**: urgente (falha, cliente pediu ajuste, assinou) vai na hora com push; rotina (prazo, parado, tarefas) vai no **resumo da manhã**; informativo só no sino.
3. **Ação na própria notificação** onde o aparelho suporta (Android/desktop); no iPhone abre a tela certa já com os botões.
4. **Seguro**: ações da notificação usam token assinado de uso único, com lista fixa de ações.

## Catálogo de notificações
| Tipo | Quando | Quem recebe | Push |
|---|---|---|---|
| `cliente_comentou` (novo) | cliente comenta slide/minuto na peça | responsável + co-responsáveis | sim |
| `cliente_respondeu_info` (novo) | resposta ao pedido de informação (portal) | responsável | sim |
| `grade_aprovada` (novo) | aprovação em massa do feed | responsáveis dos itens + gestor | sim |
| `cliente_aprovou` / `_pediu_ajuste` / `_sugeriu_texto` | existentes; passam a incluir portal e imagem do post | responsável | sim |
| `post_publicado` (novo) | publicado com sucesso (agendado ou imediato) | responsável | não (só sino) |
| `post_falhou` | existente + falha da publicação imediata e do MCP | quem agendou + responsável + gestor | sim, urgente |
| `token_expirando` (novo, passa por `notificar`) | token Instagram/Threads/TikTok vencendo ou falha de renovação | responsável do cliente + gestor | sim |
| `contrato_assinado` / `contrato_visualizado` | já feitos na branch de contratos | autor do contrato | assinado: sim |
| `proposta_aceita` / `proposta_recusada` (novos) | resposta da cliente | autor + gestor | aceita: sim |
| `lead_novo` | existente + formulário público, webhook CRM, Instagram | responsável do cliente/comercial | não |
| `resumo_diario` (novo) | todo dia de manhã | cada membro; versão master com saúde da operação | sim |

Prazo vencendo/atrasado, demanda parada, aprovação esquecida, tarefa de rotina e lançamento atrasado entram **no resumo diário**, não como avisos soltos.

## Arquitetura
- **`notificar` v2** (`src/lib/notificar.ts`): aceita `imagem`, `acoes[]`, `prioridade` (urgente/normal/baixa → urgency e TTL do push), `agrupar` (tag por entidade, ex. por demanda) e `entidade` (cliente_id, item_id). Passa a checar o erro do insert e a deduplicar (mesmo tipo+entidade em janela curta).
- **`push.ts`/`sw.js`**: payload ampliado (`image`, `actions`, `data`, `requireInteraction` para urgentes). SW trata `notificationclick` por `event.action`, chama a API de ação, faz `setAppBadge(naoLidas)` e avisa a página aberta (`postMessage`) para atualizar o sino na hora. Acrescenta `pushsubscriptionchange`.
- **Ações seguras**: `POST /api/notificacoes/acao` com token HMAC de uso único e validade de 24 h (mesmo padrão de `relatorio-token.ts`). Lista fixa: `aceitar_sugestao`, `recusar_sugestao`, `marcar_lida`. A lógica de aceitar/recusar é extraída de `api/sugestoes-texto/[sid]/route.ts` para uma função reutilizada pela tela e pela notificação.
- **Resolução de destinatários** (`src/lib/notificar-destinatarios.ts`): responsável + co-responsáveis + editor da demanda; responsável do cliente (`clientes.responsavel_fixo_id`, `membro_clientes`); gestores (master). Remove o uso de "dono da conta" como destino.
- **Resumo diário** (`src/lib/resumo-diario.ts` + `api/cron/resumo-diario`): pg_cron às 08:00 de Brasília (11:00 UTC). Por membro: vence hoje, atrasadas, aguardando a cliente há ≥ 2 dias, posts agendados hoje, tarefas de rotina, mensalidade atrasada (master). Extrai a lógica de `resumo_operacao`/`listar_pendentes_aprovacao` para funções por `(agenciaId, membroId, papel)`. Não envia se estiver vazio. Master recebe também o destaque de `saude_da_operacao`.
- **Retenção**: limpeza de `notificacoes` lidas com mais de 60 dias (no cron do resumo).

## Fases (uma branch e um PR por fase, migration só com autorização)
**Fase 0 — Fundação e higiene**
- `notificar` v2, payload/SW, resolução de destinatários, erro do insert, testes.
- Confirmar no Supabase (`cron.job`) quais jobs estão ativos e **agendar `check-alerts`**; migrar `check-alerts` e `refresh-token` para `notificar` (sino + preferências + responsável do cliente).
- Corrigir `meu-dia-tab.tsx` (data em UTC → Brasília) e o `agId` fixo em `conteudo/[id]/route.ts`.
- **Entregue na fase 0:** `notificar` v2 (imagem, botões, prioridade, agrupar, evitar repetir, contagem de não lidas), payload e service worker (imagem, botões, badge, atualização do sino, `pushsubscriptionchange`), `notificar-destinatarios.ts`, alertas de conta (`alerta_conta`) pelo sino para o dono e os gestores, correção do dia em UTC no Meu Dia.
- **Confirmado no banco (`cron.job`):** o `check-alerts` **não está agendado** (só drain, publish, refresh-token, notion-sync e rotina). Agendar exige escrever em `cron.job` (com autorização).
- Sem migration nesta fase: as colunas novas e a tabela de tokens de ação entram quando forem usadas (fases 2 e 4).
- Adiado: tirar o `agId` fixo (aparece em 7 lugares; no `conteudo/[id]` é código morto).

**Fase 1 — Cobertura dos eventos que a equipe perde hoje**
- Cliente: `cliente_comentou`, `grade_aprovada`, aprovação/info pelo portal, resposta ao pedido de informação, proposta aceita/recusada, lead de formulário/webhook CRM.
- Operação: `post_publicado`, falha da publicação imediata, `token_expirando`.
- Mesclar os tipos de contrato (`contrato_assinado`, `contrato_visualizado`) da branch pendente.
- **Fora de escopo (decidido):** post sem mídia, onboarding concluído, WhatsApp desconectado e erro/parada de cron.

**Fase 2 — Ações e imagem na notificação (Android e desktop)**
- Imagem de prévia (capa ou 1º slide) em aprovação/ajuste/sugestão.
- Botões **Aceitar** e **Recusar** na sugestão de texto; **Abrir** nos demais. Fallback iPhone: abre `?item=…&acao=sugestoes` na demanda.
- Badge do app e atualização imediata do sino.

**Fase 3 — Resumo diário**
- Cron 08:00, composição por membro, versão master, preferência para ligar/desligar e escolher a hora.

**Fase 4 — Preferências e redução de ruído**
- Preferências por canal (sino/push), silenciar cliente, agrupamento ("3 pedidos de ajuste na Camila"), filtros e "apagar/limpar" no sino. Horário de silêncio fica opcional (não foi pedido agora).

**Fase 5 — Observabilidade (opcional, só se fizer falta)**
- Contagem de push enviados/falhos/removidos por tipo. Sem alertas de erro ou parada de cron.

**Fora deste plano (futuro):** avisos à cliente (WhatsApp de aprovação parada, push no link do mês), e-mail transacional.

## Arquivos principais
`src/lib/notificar.ts`, `src/lib/push.ts`, `public/sw.js`, `src/lib/push-client.ts`, `src/components/notificacoes-sino.tsx`, `src/app/api/notificacoes/**` (novo `acao`), `src/app/api/aprovacao/**`, `src/app/api/portal/public/**`, `src/app/api/cron/*` (novo `resumo-diario`; ajustes em `check-alerts`, `refresh-token`, `publish-scheduled`), `src/lib/mcp/ferramentas*.ts` (extrair o miolo), `supabase/migrations/` (novas, aditivas).

## Verificação
- Testes unitários: `notificar` v2 (dedupe, prioridade, destinatários), geração e validação do token de ação (expira, uso único, ação fora da lista), composição do resumo (vazio, atrasadas, master), retenção.
- Manual no Android/Chrome: ativar push, provocar sugestão de texto pelo link do mês, ver a notificação com imagem e botões, tocar **Aceitar** e conferir o texto aplicado e a aprovação desfeita; repetir recusando.
- Resumo: disparar o cron com `CRON_SECRET`, conferir sino e push; conferir `cron.job` no Supabase.
- `tsc`, `vitest`, `eslint` dos arquivos alterados e `next build` a cada fase.
- Cada migration só é aplicada com o OK do Ewerton.
