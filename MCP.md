# Ferramentas do MCP (MCP.md)

Catálogo de tudo que o Claude consegue fazer no GENSBot pelo MCP (`src/lib/mcp/`). Fonte de verdade: o `inputSchema`/`description` de cada ferramenta, em `src/lib/mcp/ferramentas*.ts`. Se este arquivo e o código divergirem, o código vence — corrija aqui no mesmo PR.

**Como usar:** converse com o Claude numa sessão com o conector do GENSBot ativado. Uma ferramenta nova só aparece em **conversas abertas depois do deploy** — uma conversa já aberta guarda a lista de ferramentas do início e não atualiza sozinha.

---

## Novo nesta rodada (01/10/2026) — Audiência, automações e métricas pelo Claude

Sete ferramentas novas, nascidas da Onda de captura de lead (e-mail/telefone antes de entregar material) e de uma rodada de melhorias do MCP:

| Ferramenta | O que faz |
|---|---|
| `listar_audiencia` | Os leads de uma conta — mesmas colunas do "Exportar CSV" da tela de Audiência, com filtros (busca, tag, automação, só quem deixou e-mail+telefone). JSON ou CSV pronto. |
| `metricas_automacao` | O funil de uma automação (comentário → DM → clique → lead capturado) com taxas de conversão, ou o ranking de todas as automações de uma conta. |
| `editar_automacao_parcial` | Edita só o que mudou numa automação pausada — troca um campo, ou adiciona/remove/edita uma pergunta — sem reescrever tudo. Foi o que faltava pra inserir "Capturar Lead" numa automação já existente sem mexer no banco na mão. |
| `criar_link_utm` / `listar_links_utm` | Gera um link rastreável (UTM + URL curta `/r/código` que conta clique) e consulta os que já existem numa conta. |
| `ler_contato` | A ficha completa de um lead — dados, respostas das perguntas, jornada pelas automações, últimas mensagens. Localiza por `@` ou pelo ID numérico do Instagram. |
| `listar_fila_publicacao` | O que está agendado, publicando ou falhou pra uma conta (só leitura; agendar continua só pela tela). |
| `metricas_instagram` | Alcance, visitas ao perfil, crescimento de seguidores e as publicações com melhor desempenho — mesmos dados do painel de Métricas. |

Todas com testes automatizados e consultas validadas contra o banco real antes do deploy. Nenhuma expõe token de acesso nem dado de outra conta/agência.

---

## Catálogo completo (44 ferramentas)

### Operação e clientes
| Ferramenta | Faz o quê |
|---|---|
| `resumo_operacao` | Visão geral: demandas por etapa, tarefas atrasadas, aprovações pendentes. |
| `listar_clientes` | Clientes da agência. |
| `ler_cliente` | Detalhe de um cliente. |
| `listar_membros` | Equipe da agência. |

### Esteira de conteúdo (demandas) e rotina
| Ferramenta | Faz o quê |
|---|---|
| `listar_demandas` | Demandas com filtros (cliente, mês, etapa, responsável). Membro só vê as dele. |
| `criar_demandas_lote` | Cria várias demandas de um cliente num mês, direto em "planejamento" (só master). Post/reel/story exigem o scorecard do MetodoViral. |
| `atualizar_demanda` | Edita título, legenda, briefing, datas, responsáveis, prioridade. |
| `mover_etapa` | Troca a etapa de uma demanda. |
| `listar_tarefas` | Tarefas da rotina. |
| `criar_tarefa` | Cria uma tarefa. |
| `atualizar_tarefa` | Muda status/campos de uma tarefa. Membro só mexe nas próprias. |

### Aprovação e formulários
| Ferramenta | Faz o quê |
|---|---|
| `listar_pendentes_aprovacao` | O que está esperando aprovação do cliente. |
| `preparar_aprovacao` | Monta a mensagem de aprovação de uma demanda. |
| `link_aprovacao_mes` | Link do feed de aprovação do mês. |
| `listar_formularios` | Formulários existentes. |
| `criar_formulario` | Cria um formulário (briefing, pesquisa, captação de leads) em rascunho. |
| `editar_campos_formulario` | Edita as perguntas de um formulário. |
| `ler_respostas_formulario` | Respostas recebidas num formulário. |

### Automações de DM (Instagram)
| Ferramenta | Faz o quê |
|---|---|
| `listar_contas_instagram` | Contas conectadas e a qual cliente pertencem. |
| `listar_automacoes` | Automações de uma conta (nome, status, gatilhos, palavras-chave). |
| `ler_automacao` | Passo a passo de uma automação. |
| `criar_automacao` | Cria uma automação no formato do formulário guiado. Nasce sempre pausada. |
| `editar_automacao` | Reescreve uma automação pausada inteira. |
| `editar_automacao_parcial` ✨ | Edita só o que mudou — campos soltos e/ou operações pontuais nas perguntas (inclusive inserir "Capturar Lead"). |
| `pausar_automacao` | Pausa uma automação ativa. |

### Audiência (leads)
| Ferramenta | Faz o quê |
|---|---|
| `listar_audiencia` ✨ | Leads de uma conta, mesmas colunas do CSV da tela, com filtros. |
| `ler_contato` ✨ | Ficha completa de um lead: dados, respostas, jornada, mensagens. |

### Métricas e links
| Ferramenta | Faz o quê |
|---|---|
| `metricas_automacao` ✨ | Funil e taxas de conversão de uma automação, ou ranking da conta. |
| `metricas_instagram` ✨ | Alcance, engajamento, crescimento de seguidores, melhores posts. |
| `criar_link_utm` ✨ | Gera link rastreável com UTM + URL curta. |
| `listar_links_utm` ✨ | Links UTM já criados numa conta. |

### Publicação
| Ferramenta | Faz o quê |
|---|---|
| `listar_fila_publicacao` ✨ | O que está agendado, publicando ou falhou. Só leitura. |

### Mídia (C13)
| Ferramenta | Faz o quê |
|---|---|
| `preparar_upload_midia` | URL assinada (PUT, 10 min) + URL pública final. Só JPG, MP4, MOV. Só master. |
| `importar_midia_url` | O servidor baixa uma URL https (export do Figma) e grava no R2. Recusa PNG e endereços internos. Só master. |
| `anexar_midia_demanda` | Liga as URLs à demanda, na ordem dos slides (1 a 10). Só master. |

### Publicação (C14)
| Ferramenta | Faz o quê |
|---|---|
| `agendar_post` | Agenda pra uma data futura (IMAGE, CAROUSEL, REELS, STORIES). Move a demanda pra "agendamento". O cron publica. |
| `publicar_agora` | Publica na hora. Exige `confirmar: true` (só após o "aprovado" no chat). Devolve o link, ou "processando" em Reels pesado. |
| `editar_post_agendado` | Legenda, data, mídias, colaboradores de post que ainda não publicou. |
| `cancelar_post_agendado` | Tira da fila e solta a demanda. Post já no feed só pelo app do Instagram. |

Travas: só master; `confirmar_conta` repete o @; a conta precisa estar vinculada a um cliente; a demanda precisa ser desse cliente; token válido. A automação de DM do post vai em `automacao` (nasce ativa, `copy_humanizada: true`).

### Saúde da operação
| Ferramenta | Faz o quê |
|---|---|
| `saude_da_operacao` | Varredura só de leitura, só master. Lista priorizada (crítico primeiro) do que está quebrado ou prestes a quebrar, com o que fazer em cada item. |

O que ela confere, com os limiares em `LIMIARES` (`ferramentas-saude.ts`):
- **Instagram:** acesso vencido (crítico), vencendo em até 3 dias (crítico) ou até 10 dias (atenção, a renovação automática começa com 30 de folga), conta sem data de vencimento (atenção).
- **Fila de publicação:** post que falhou nos últimos 14 dias, post agendado há mais de 10 min sem sair, post preso em "publicando" há mais de 20 min (todos críticos).
- **Automações ativas:** 5 ou mais mensagens iniciais em 14 dias e nenhum clique no link (atenção; sintoma de automação parando na 1ª DM).
- **Demandas:** atrasadas, travadas e esperando o cliente há mais de 5 dias, agrupadas por cliente (atenção).
- **Agenda:** cliente ativo com Instagram conectado e nada agendado nos próximos 7 dias (atenção).

Nunca lê nem devolve o token das contas. Para o panorama de quem não é master, continua o `resumo_operacao`.

✨ = novo nesta rodada (01/10/2026).

---

## Regras que valem pra (quase) tudo

- **Pausada por padrão.** `criar_automacao` sempre nasce pausada; `editar_automacao`/`editar_automacao_parcial` só mexem em automação já pausada. Ativar é sempre na tela, nunca pelo Claude — é o ponto de revisão humana antes de uma automação responder gente de verdade.
- **Copy passa pelo humanizer antes.** Toda ferramenta que grava texto que um lead ou cliente vai ler exige `copy_humanizada: true` — confirmação de que o texto já foi humanizado, não uma checagem automática.
- **Escopo por agência.** Toda ferramenta enxerga só clientes/contas/automações da agência de quem está conversando. Membro que não é master só vê/edita o que criou (automações, tarefas, demandas); leitura de audiência e métricas não tem essa segunda trava — é por conta, não por quem criou o quê.
- **Token nunca aparece.** Ferramentas que chamam a Graph API (`metricas_instagram`, as automações) buscam o token do banco só internamente; nenhuma resposta devolve o valor do token.
- **Versão anterior sempre salva.** `editar_automacao` e `editar_automacao_parcial` guardam o fluxo anterior em `automation_versions` antes de sobrescrever — dá pra restaurar pela tela.

## Pra quem for adicionar uma ferramenta nova

Cada "onda" é um arquivo próprio (`ferramentas-cN.ts`), registrado em `src/lib/mcp/servidor.ts`. Padrão:
1. Reaproveite o que já existe — `resolverConta`/`automacaoDaAgencia`/`membrosDaAgencia`/`str`/`lista`/`conflitos` (exportados de `ferramentas-c3.ts`) cobrem a maior parte da permissão e validação.
2. Teste com um Supabase falso (ver `ferramentas-c5.test.ts` em diante pro padrão do mock genérico) — não bate no banco de verdade.
3. Valide as consultas reais (sintaxe do PostgREST) contra o Supabase antes de ir pro ar; não precisa popular dado de teste pra isso, um erro de coluna/relacionamento já aparece com a chave anônima.
4. Atualize a contagem em `mcp.test.ts` (`listarFerramentas()).toHaveLength(N)`) e este arquivo.
5. No PR, lembre que a ferramenta só aparece em conversa nova — não adianta testar na mesma conversa onde ela foi codada.
