# Melhorias pro GENSBot inspiradas no ZernFlow

> Documento de referência pra retomar em uma conversa nova. Escrito depois de
> clonar e inspecionar `github.com/zernio-dev/zernflow` (não integrado ao
> projeto — só estudado como referência de arquitetura/UX).

## O que é o ZernFlow, resumido

Alternativa open-source ao ManyChat (Next.js + Supabase, MIT), com editor
visual de fluxo em drag-and-drop (React Flow / `@xyflow/react`), inbox, CRM,
sequências, growth e analytics.

## ⚠️ Aviso importante — não copiar a camada de integração

O ZernFlow é um **rebrand incompleto** de um projeto chamado "Late"
(getlate.dev) — a `LICENSE` ainda diz `getlate-dev`, e o código interno
inteiro (rota `/api/webhooks/late`, header `x-late-signature`, campos
`late_*` no banco) continua usando "late" por baixo do nome "Zernio". Isso
não é revelado no README.

Toda a integração com Instagram/WhatsApp/etc passa pela API dessa
"Zernio"/"Late" — ou seja, mensagens e tokens de plataforma dos clientes
trafegam por um terceiro cuja identidade real é obscura, antes de chegar na
rede social de verdade.

**Decisão**: não adotar `zernio-client.ts`, `zernio-webhook.ts`, nem
qualquer campo `late_*`/dependência do pacote `@zernio/node`. O GENSBot
continua falando **direto com a Graph API da Meta**, como já faz hoje — isso
é justamente o diferencial de confiança que vale manter. As ideias abaixo
são só de UX/arquitetura de UI, reimplementadas do zero pro GENSBot.

O código do ZernFlow em si (fora essa camada) não tem nada malicioso —
sem ofuscação, sem exfiltração, HMAC verificado direito, testes reais.
Só a parte de integração de plataforma que não deve ser tocada.

## Ideia principal: editor visual de fluxo (drag-and-drop)

Hoje a criação de automação no GENSBot é um formulário linear em degraus
(1. Gatilho → 2. Resposta Pública → 3. DM inicial → 4. Link → 5. Sequência),
tudo dentro de `src/app/page.tsx`. O ZernFlow mostra um padrão mais robusto,
que combina bem com a inspiração ManyChat que já vínhamos seguindo:

**Padrão observado** (`components/flow-builder/` no ZernFlow):
- Canvas com paleta de nós arrastáveis à esquerda, área de desenho no
  centro, painel de configuração do nó selecionado à direita.
- Tipos de nó: `trigger`, `sendMessage`, `condition`, `delay`, `action`,
  `aiResponse` — cada um com seu próprio painel de config
  (`TriggerPanel`, `SendMessagePanel`, `ConditionPanel`, `DelayPanel`,
  `AiResponsePanel`, `ActionPanel`).
- Persistência: o fluxo inteiro salvo como **JSON blob** (`nodes`/`edges`)
  numa coluna da tabela de automação — não é um grafo relacional
  normalizado. Simples e funciona bem com React Flow.
- **Histórico de versões**: tabela separada (`flow_versions`) guarda
  snapshots a cada publicação, com painel próprio pra ver/restaurar
  versões antigas. O GENSBot não tem isso hoje.
- **Simulador de teste (dry-run)**: `lib/flow-engine/simulator.ts`
  reimplementa a lógica de execução do fluxo pra rodar no navegador sem
  disparar nada de verdade — mostra o caminho que a automação tomaria.
  Diferente do preview visual que o GENSBot já tem (que só mostra a
  aparência das mensagens, não simula decisões/condições).

## O que isso puxa de melhoria concreta pro GENSBot

1. **Nó de condição (`condition`)** — hoje as automações do GENSBot só têm
   correspondência de palavra-chave linear (contains/exact/any). Um nó de
   condição no estilo ZernFlow permitiria ramificar: "se tem tag X, vai
   por aqui; se não, vai por ali" — mais próximo do que ManyChat oferece.

2. **Nó de ação (`action`)** — adicionar/remover tag, atualizar campo do
   contato, como um passo dentro do próprio fluxo, em vez de só acontecer
   implicitamente ao capturar e-mail/telefone.

3. **Sequências como entidade própria** — hoje "follow-ups" ficam presos
   a uma automação (`followups` jsonb em `automations`). O ZernFlow trata
   sequência como algo reutilizável entre fluxos. Vale avaliar se compensa
   pro GENSBot (provavelmente sim, se formos ter reengajamento reutilizável
   entre automações diferentes).

4. **Histórico de versão do fluxo** — permitir reverter uma automação pra
   uma versão anterior depois de editar.

5. **Simulador de decisão, não só visual** — evoluir o simulador de
   Direct (que já reconstruímos pra ficar fiel ao Instagram) pra também
   simular QUAL caminho a automação tomaria dado um input de teste, uma
   vez que existam nós de condição.

6. **Nó de resposta por IA (`aiResponse`)** — conecta com a ideia de IA
   nas automações que já veio à tona antes nesta conversa (o teaser
   "Implemente IA" que já existe no form do GENSBot, hoje só decorativo).

## Recomendação de escopo

Isso é grande — reformular a tela de criação de automação pra um canvas
visual é um projeto de várias etapas, não um ajuste pontual. Sugestão pra
retomar numa conversa nova:

1. Decidir se vale reescrever a tela inteira pra canvas, ou evoluir em
   cima do formulário atual adicionando só nó de condição/ação como um
   passo a mais (mais barato, menos risco).
2. Se for canvas de verdade: planejar o schema novo (`nodes`/`edges` como
   jsonb na tabela `automations`, ou tabela nova), decidir tipos de nó do
   MVP (provavelmente: trigger, sendMessage, condition, delay — deixar
   `action`/`aiResponse` pra depois).
3. Escolher `@xyflow/react` como dependência nova (mesma lib que o
   ZernFlow usa) — é MIT, madura, e resolve o canvas em si sem reinventar.
4. Manter 100% da lógica de envio (`src/lib/drain.ts`,
   `src/app/api/webhook/route.ts`) como está — só a camada de criação/
   edição da automação muda, não a execução.

## Contexto útil da sessão anterior (pra quem retomar)

- Paleta/identidade visual: "Oat & Clay", documentada em `DESIGN.md`.
- Já existe modo escuro (`src/components/theme-toggle.tsx`).
- Automações hoje: `src/app/page.tsx` (form gigante), tipo `Automation` em
  `src/types/automation.ts`, tabela `automations` no Supabase
  (`specific_post_id`, `specific_story_id`, `triggers[]`, `keywords[]`,
  `match_type`, `followups` jsonb, etc.).
- Envio real: `src/lib/drain.ts` (fila com limite de 200 DMs/hora),
  processamento de webhook em `src/app/api/webhook/route.ts`.
- App do Meta (GENSIG) está em processo de App Review pras permissões
  `instagram_business_basic`, `instagram_business_manage_messages`,
  `instagram_business_manage_comments` — aguardando verificação de
  portfólio empresarial antes de poder submeter.
