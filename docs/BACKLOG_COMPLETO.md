# GENSBot: tudo o que falta fazer

Atualizado em 05/11/2026. Este é o documento-mestre do que ainda não foi feito, em ordem de prioridade, com o porquê, o que entregar, como construir e como saber que ficou pronto. Documentos de apoio: `AUDITORIA_MOBILE.md`, `ANALISE_ORKESTRYA.md` (referência de design e fluxo), `PLANO_PROXIMOS_PASSOS.md` (cronograma original) e `PLANO_ONBOARDING_CLIENTE.md` (link de conexão das redes).

**Regras de trabalho (valem para tudo abaixo)**
- Cada item entra no **celular e no desktop juntos**.
- Antes de começar, abrir uma branch nova a partir da `main` atualizada. Se um PR já estiver aberto, **não empurrar commit novo nele** sem avisar (isso já fez uma mudança ficar de fora do merge).
- Migrations do banco: escrever o arquivo em `supabase/migrations/`, aplicar só com autorização, e sempre aditivas (`create table if not exists`, `add column if not exists`).
- Todo item termina com: `tsc` limpo, testes passando (o `r2.test` já falhava antes e é ignorado), conferência na tela real depois do deploy e atualização deste documento.
- Verificação na tela: páginas de teste em `src/app/f/preview-*` com `fetch` simulado, sempre apagadas depois; produção só com login do usuário.

## Já entregue (para contexto)

Logo e ícone novos (fundo branco e versão escura), forma em pílula e `PageHeader`, dark mode em preto neutro, demanda aberta no layout do Orkestrya (editor rico, legenda com ferramentas, duas colunas, cartão escuro de ação, etiquetas, abas de comentários), tela de Demandas em largura total, Financeiro MVP (receitas, despesas, mensalidades dos clientes com projeção), botão Atualizar. Migrations aplicadas: `briefing_html`, `etiquetas`, `lancamentos`. Em PR aberto: cores das colunas do kanban (#217) e botão Atualizar (#218).

---

## 1. Correções da auditoria mobile (dívida mais antiga) — [Concluído em 05/11/2026]

**Entregue:**
- **CRM:** Eliminado overflow horizontal com `min-w-0 max-w-full` nos containers, `flex-wrap` no header, e unificação dos 3 seletores em `FilterBar` oficial (desktop inline, mobile Sheet com 44px de toque e badge de filtros ativos). Pipeline selector padronizado para 40px/44px.
- **Automação aberta:** Campo "Nome do Fluxo" com altura mínima de 44px (`h-11`); botão "Adicionar" empilhado no mobile evitando cortes; botões de controle responsivos com "Salvar Fluxo" em largura total no mobile; seletor de correspondência padronizado para `h-11 sm:h-10`; textarea da mensagem inicial expandido com `rows={4}` e `min-h-[110px]`.
- **Audiência e leads:** `DataTable` mobile agora omite automaticamente campos vazios (`isEmpty`); campo de busca e filtro de tags padronizados para `h-11 sm:h-9` (44px mobile / 36px desktop) com alinhamento do botão "Exportar CSV".
- **Automações (lista):** Cabeçalho responsivo com botão "Criar Novo Fluxo" full-width no mobile e sem quebra feia; nomes longos de fluxos com `flex-1 min-w-0 max-w-full` para não truncar precocemente.
- **Equipe:** Botões "Copiar Link de Convite" e "Cadastrar Membro" com largura total no mobile (`h-11`); ações do cartão padronizadas com `IconButton` (Editar, Ativar/Desativar, Excluir) garantindo mesmo peso visual, 40px/44px de toque e tooltips acessíveis; e-mails protegidos com `truncate`.
- **Placeholders e Skeletons:** Substituídos falsos "0 demandas" e "Selecione uma conta" por skeletons animados durante o carregamento inicial no Dashboard, Automações e Equipe.
- **Dashboard:** Seletor de modo ("Minhas Demandas" vs "Painel Profissional") e seletor "Ver como" padronizados na mesma altura (`h-10 sm:h-9`).

**Telas que a auditoria ainda não cobriu (auditar e corrigir):** modal do item do calendário, Agendamentos passos 2 a 4, ficha do lead, drawer de negócio do CRM, edição de membro e aba Produtividade, drawer "Mais", sheet de notificações, popover de perfil, paleta de comandos, sheets Criar e de filtros, formulário de nova demanda, páginas públicas (login, aprovação, relatório, formulário `/f/[slug]`).

**Como:** usar os componentes que já existem (`Button`, `ActionBar`, `FilterBar`, `Select`, `PageHeader`). Reutilizar a sonda de medição (overflow, alturas dos controles, alvos menores que 40px, texto menor que 12px) em produção a 375px antes e depois.

**Pronto quando:** nenhuma das telas acima tem scroll horizontal, nenhum controle tem menos de 40px de altura (44 no toque), nenhum botão de ação principal fica solto em largura parcial, e a sonda não aponta irmãos com altura diferente.

---

## 2. Resto da tela de demanda

### 2.1 Criar enxuto e editar completo — [Concluído em 05/11/2026]
Ao **criar**, mostra só o essencial: título, chips (formato, cliente, responsável, etiqueta), descrição, legenda e anexos. Checklist, comentários, propriedades avançadas e ajustes do cliente ficam ocultos na criação e aparecem no modo de edição (após salvar), acelerando o cadastro.

### 2.2 Menu "⋯" completo — [Concluído em 05/11/2026]
Menu expandido com: **Copiar link da demanda**, **Copiar ID**, **Duplicar demanda**, **Mover para outro cliente**, **Arquivar demanda** (coluna `arquivada_em`, com filtro e restauração na esteira), **Excluir**, e o rodapé "Criada em dd/mm/aaaa às hh:mm".

### 2.3 "Salvar como padrão" e "Legendas padrão" — [Concluído em 05/11/2026]
Tabela `legendas_padrao` criada, rotas de API `/api/legendas-padrao` implementadas e seletor "Modelos (N)" integrado diretamente na barra de formatação da legenda com inserção em um clique, exclusão e botão "Salvar como padrão".

### 2.4 Cronômetro e tempo estimado — [Concluído em 05/11/2026]
"Tempo na demanda" com play/pausa em tempo real no cartão escuro; soma total de tempo por demanda; modal de apontamento manual (+ minutos trabalhados); barra de progresso visual de tempo gasto vs estimado; e opção "Tempo estimado" no menu 3 pontinhos. Tabela `tempos_demanda` e endpoints `/api/conteudo/[id]/tempo` criados com suporte a RLS.

### 2.5 Interruptores do cliente — [Concluído em 05/11/2026]
Interruptor "Portal do cliente" (Visível/Oculto) integrado no cartão escuro; modal "Pedir informação ao cliente" no menu 3 pontinhos com alerta contextual e resposta integrada; colunas aditivas em `conteudo_items`.

### 2.6 Itens menores da demanda — [Concluído em 05/11/2026]
Botão de concluir demanda no cartão escuro e círculo de concluir no topo do card do kanban sem mover de coluna (título tachado, persistência via `concluida: boolean`).

---

## 3. Kanban de Demandas

### 3.1 Barra de filtros no estilo do Orkestrya — [Concluído em 05/11/2026]
Barra em linha única: busca em pílula (`rounded-full`), seleção de cliente, seleção de equipe, alternador de visão em pílula, menu de ferramentas "⋯" (Sincronizar Notion e Duplicar demandas do mês), botões de alternância de Publicados e Arquivados, e botão "Nova Demanda" fixo à direita. No celular, preserva busca + botão compacto "Filtros n".

### 3.2 Card com capa em miniatura — [Concluído em 05/11/2026]
Círculo de conclusão interativo, badges de prioridade, pílula de formato, miniatura de mídia padronizada em 16:9, indicador de pedido de informação pendente, indicador de demanda oculta do portal e menu rápido de 3 pontinhos.

### 3.3 Detalhes
- Reordenar colunas por arrastar, renomear e **cor da coluna** editável; **power-ups da coluna**.
- "Nova coluna" no fim do quadro e quadros por cliente (seletor de quadro).
- Etiquetas filtráveis na barra.

---

## 4. Financeiro, segunda rodada — [Entregue em 05/11/2026]

O Financeiro foi expandido para uma gestão de tesouraria profissional e completa:

- **Contas bancárias e saldo geral:** Tabela `contas_bancarias`, saldo individual calculado em tempo real com base no saldo inicial, receitas e despesas pagas e transferências. Widget com saldo total geral em contas e botão "+ Nova Conta".
- **Transferências entre contas:** Tabela `transferencias_contas`, endpoint `/api/financeiro/transferencias` e modal para transferir saldo entre contas com data e descrição.
- **Categorias editáveis com metas mensais:** Tabela `categorias_financeiro`, endpoint `/api/financeiro/categorias`, modal de criação de categoria com teto/meta mensal e barras de progresso de orçamento na visão geral (alertando em vermelho quando estourado).
- **Despesas recorrentes:** Flag `recorrente` nos lançamentos com projeção automática nos meses futuros (`despesasRecorrentesVirtuais`), gerando previsibilidade junto às mensalidades.
- **Editar lançamento completo:** Suporte a edição de qualquer lançamento (valor, descrição, data, conta, categoria e observações) via Sheet completo.
- **A pagar e A receber:** Filtros dedicados "A Receber" e "A Pagar" separando o que já foi liquidado do que está pendente, com alerta visual de atraso.
- **Cobrança amigável via WhatsApp:** Botão de cobrança direta via WhatsApp com mensagem formatada para lançamentos em atraso com cliente vinculado.

---

## 5. Propostas e Contratos

**Por quê:** é o que fecha a venda e hoje fica fora do sistema. Referência: 11 modelos de proposta e 9 de contrato do Orkestrya.

- **Biblioteca de modelos por serviço** (redes sociais, tráfego pago, Instagram, redes + tráfego, Marketing 360, conteúdo, audiovisual, identidade visual, site e landing page), cada um com "Usar modelo" e "Personalizar". Editor com o mesmo editor rico da demanda.
- **Dados da agência como CONTRATADA** (CNPJ, endereço, e-mail, telefone, PIX) entrando automaticamente; aviso "faltam estes dados" com botão "Completar agora".
- **Proposta:** criar a partir de um modelo, escolher cliente ou lead, itens e valores, validade, e enviar por **link público** que o cliente aceita ou recusa. Status: rascunho, enviada, aceita, recusada, vencida.
- **Contrato:** criar a partir de proposta aceita ou modelo, link público com **assinatura** do cliente (e da agência), status (rascunho, aguardando cliente, assinado), **renovação** (renovam em 30 dias, renovação vencida).
- **Integração com o CRM:** entrar na etapa "Proposta" cria a proposta; proposta aceita cria o contrato; contrato assinado dispara o **onboarding do cliente** (item 8) e cria a mensalidade no Financeiro.
- **Manual do cliente:** documento de boas-vindas por cliente.

**Dados:** `modelos_documento`, `propostas`, `contratos` (e itens), com token público. **Pronto quando:** do lead ao contrato assinado sem sair do sistema, com a mensalidade já aparecendo no Financeiro.

---

## 6. Cliente e portal

- **Ficha do cliente por abas:** Visão geral, Conteúdo, Métricas, Financeiro, Arquivos, Anotações, Acessos. A visão geral resume conteúdo (aguardando aprovação, aprovados, agendados), métricas, demandas, projetos e valores e contrato.
- **Índice de Saúde (0 a 100):** calculado a partir de atrasos, aprovações paradas, pagamento em dia e frequência de entrega; aparece no card do cliente. Definir a fórmula e documentá-la.
- **Central Estratégica:** persona, raio-x do perfil, concorrentes, posicionamento de marca, identidade visual; pode ser **compartilhada** por link. Hoje existe dossiê; falta estruturar e compartilhar.
- **Foto do cliente em dois temas** (claro e escuro) e capa colorida.
- **Regras de aprovação:** no envio para aprovação, definir para cada resposta do cliente (Aprovado, Alteração pedida, Reprovado) a coluna de destino da demanda e as etiquetas aplicadas. Hoje a aprovação existe pelo WhatsApp; falta o movimento automático configurável e o sheet de aprovação próprio (anexos obrigatórios, programação opcional).
- **Painel do cliente (portal):** área logada ou por link em que o cliente vê o resumo das demandas visíveis, aprova posts, responde pedidos de informação e acompanha o contrato. É o destino do fim do onboarding.

---

## 7. Onboarding do cliente com conexão das redes

Resumo (plano completo em `PLANO_ONBOARDING_CLIENTE.md`):

- **Link público por cliente** (`/conectar/<token>`) com guia passo a passo; o cliente autoriza Instagram, Threads e TikTok na tela oficial de cada rede, sem senha passando por nós; ao terminar, marca a etapa "Acessos das redes coletados", avisa a agência e leva ao painel do cliente.
- **Instagram e Threads por modo testador:** a agência adiciona o cliente como testador no painel da Meta (**não existe API para isso**, é manual) e o cliente aceita o convite pelo computador (Threads: Configurações > Permissões do site; Instagram: Editar perfil > Apps e sites > Convites de testador, a confirmar no primeiro cliente).
- **Mudança técnica central:** os callbacks de OAuth hoje exigem a agência logada; passam a aceitar um **`state` assinado** (HMAC, nonce de uso único, validade curta) vindo do link público.
- **TikTok, risco alto:** sem auditoria, só publica como privado e para 5 usuários por dia; com auditoria, a política diz que ferramenta de equipe para contas que você gerencia não é aceitável. Recomendação: manter manual por enquanto e tentar a auditoria depois.
- **Em aberto:** limite de testadores por app (conferir no painel da Meta); caminho do convite do Instagram na tela real.

**Fases:** (1) Instagram e Threads com link e guia, validando com um cliente real; (2) avisos e reconexão antes da expiração; (3) painel do cliente; (4) TikTok depois de decidir a estratégia.

---

## 8. Backlog (depois dos itens acima)

- **Meu Dia:** tarefas de hoje e dos próximos 7 dias, demandas, agenda, checklist e aprovações da pessoa; tela inicial do membro.
- **Histórico de atividades (auditoria):** linha do tempo por dia com ação, módulo, pessoa e hora, com busca e filtros. Já existe base de eventos em `notificacoes`.
- **Setores, cargos e permissões por função:** hoje só há papel master, membro e cliente; separar por função (ex.: designer vê só produção, financeiro vê só Financeiro). Inclui squads e aniversário/tempo de casa.
- **Metas do Comercial:** meta de novos clientes por mês com barra de progresso; etapas Orçamento e Proposta com gatilho que cria o documento.
- **Chat interno** (conversas e grupos) e chat com clientes; hoje a comunicação passa pelo WhatsApp via Kapso.
- **Plano de Mídia** (pedidos de inserção, comissão), **Mapa Mental** e **Funil** (planejamento): só se fizerem sentido para a operação.
- **Central de Ajuda** com "Como fazer" ligado a cada passo do onboarding.
- **Notificações:** migration `20261104_notificacoes.sql` do sino ainda não foi aplicada; aplicar e testar push em uso real.
- **Limpeza técnica:** ~186 hex e ~190 cores Tailwind cruas espalhados no código (trocar por tokens); renomear o token `--lime` (hoje é a menta da marca) para um nome neutro; regra de lint para componentes de tela; os 13 erros de lint de `page.tsx` e os de `esteira-tab.tsx` (`setState` em effect, `any`).
- **Ícone e logo escura:** refazer o ícone do app sobre fundo preto, se quiser uma versão escura.
- **Sessões de teste:** apagar o cliente "Cliente Teste GENSBot" e a demanda de teste que ficaram na conta do Orkestrya.

---

## Ordem sugerida

1. **Correções da auditoria** (item 1): celular redondo, 1 a 2 rodadas.
2. **Resto da demanda, parte barata** (2.1, 2.2, 2.3) e **kanban** (item 3).
3. **Financeiro, segunda rodada** (item 4) em paralelo com **cronômetro** (2.4).
4. **Propostas e Contratos** (item 5) e **onboarding com link** (item 7, fase 1), porque os dois se conectam ao CRM e ao Financeiro.
5. **Cliente e portal** (item 6) e **interruptores do cliente** (2.5), que dependem do painel do cliente.
6. Backlog (item 8) conforme a necessidade.

## Decisões que dependem do Ewerton

- **TikTok:** pedir auditoria, operar só com post privado ou deixar manual (recomendação: manual agora).
- **Convite de testador:** manter manual ou pedir os @ no link para a agência só clicar em "adicionar".
- **Plano de Mídia, Mapa Mental e Funil:** entram ou ficam de fora.
- **Assinatura de contrato:** assinatura simples por link (aceite com registro de IP e data) ou integração com um provedor de assinatura eletrônica.
- **Fórmula do índice de Saúde:** validar os critérios antes de implementar.
