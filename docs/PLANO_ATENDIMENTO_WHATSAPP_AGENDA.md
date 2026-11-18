# Plano: atendimento no WhatsApp com IA e agenda (piloto: Dra. Laís Leal)

Status: **etapas 2 (#260) e 3a (#261) mescladas e validadas em produção; etapa 3b pronta para revisão** (18/11/2026). Agenda: **Cal.com (nuvem, plano gratuito)** no lugar do Cal.diy.

## 1. Objetivo
A IA conversa no WhatsApp da clínica, **propõe horários reais** de uma agenda ligada ao Google Agenda da médica, e a **equipe confirma**. Cada conversa alimenta o CRM do GENSBot automaticamente, e a secretária pode corrigir tudo à mão. Um **link de agendamento** enviado na conversa deixa a reserva pronta e no contato certo.

Decisões: canal = OpenWA (Kapso fica para depois, atrás de um adaptador); agenda = **Cal.com nuvem** (decidido em 18/11; o Cal.diy da VPS fica como reserva e será desligado depois) + Google Calendar; autonomia = IA propõe, equipe confirma; IA = Gemini direto, plano pago; um cliente no início.

## 2. Infraestrutura já no ar (Fase 0)
VPS na Shardcloud (Ubuntu 22.04, 4 vCPU, 4 GB, template Docker). Túnel Cloudflare (`gensbot-agenda`), sem portas públicas.

| Serviço | Endereço | Observação |
|---|---|---|
| Cal.diy (painel e páginas de agendamento) | `https://agenda.dralaisleal.com.br` | cadastro público desligado |
| API v2 do Cal.diy | `https://api-agenda.dralaisleal.com.br` | exige `Authorization: Bearer cal_…` |
| OpenWA | `https://wa.dralaisleal.com.br` | motor whatsapp-web.js, sem número conectado |

Código em `/opt/gensbot-agenda` (cal.diy e OpenWA, `docker compose`). Segredos só em `.env` da VPS (modo 600) e em variáveis de ambiente do GENSBot. Nada disso entra no repositório.

## 2.1 Mudança de agenda: Cal.com (18/11/2026)
Testado com chave de API do plano gratuito: horários livres, reserva, conflito recusado, cancelamento e webhooks funcionam; Google Agenda conectado. A VPS fica só com o OpenWA.
- API: `https://api.cal.com/v2` (mesmos caminhos e cabeçalhos de versão do Cal.diy).
- O e-mail do paciente precisa ser real (a nuvem recusa domínio que não recebe e-mail).
- O interruptor "Requires confirmation" não apareceu na interface gratuita: a confirmação da equipe é feita no GENSBot (a IA só propõe; a reserva só é criada depois da aprovação). Reserva direta pelo link continua imediata.
- Os dados das reservas ficam no Cal.com (EUA): citar o Cal.com na política de privacidade antes do go-live.
- Chaves e segredos do webhook ficam **por cliente**, cifrados, na tabela `agenda_integracoes` (não em variável de ambiente).

## 2.2 Proteção do número (anti-banimento) e ritmo humano
Desenho decidido para a etapa 4, implementado só com a automação **desligada por padrão** por cliente (`atendimento_config.ligado = false`):
- **Nunca dormir dentro de `after()`** (limite de 60 s). A resposta vai para uma fila com `enviar_em`, drenada por cron a cada minuto.
- **Debounce:** cada nova mensagem do paciente adia o envio; responde uma vez ao lote, depois de um silêncio aleatório.
- **Antes de responder:** marcar como lido (`POST /api/sessions/:id/chats/read`) e mostrar "digitando" (`POST …/chats/typing`, `state: typing`) por tempo proporcional ao texto. Ritmos e limites a calibrar nos testes.
- **Limites:** só em horário de atendimento, teto de respostas por hora, nunca iniciar conversa, nunca responder em grupo, nunca para número que não escreveu antes.
- **Assunção humana:** mensagem `fromMe` que o robô não enviou (a secretária respondeu pelo celular) pausa a IA nessa conversa por algumas horas.
- **Canal de teste (dry-run)** que só registra em `whatsapp_ia_acoes` e um simulador de mensagens, para ajustar respostas e tempos antes de existir o número da doutora.
- OpenWA: `RESOLVE_LID_TO_PHONE=true` (aplicado na VPS em 18/11) para contatos `@lid`.

## 2.3 Registro da etapa 2 (PR da branch `feat/atendimento-whatsapp-base`)
- Webhook do WhatsApp: corrigida a regex `/D/g` (apagava a letra D, não os não-dígitos); em mensagem enviada por nós o contato é o destinatário; `@lid` sem telefone guarda a mensagem mas não cria lead nem follow-up.
- `src/lib/telefone.ts`: JID, E.164 e o 9º dígito brasileiro.
- Receptor `POST /api/webhook/agenda/[token]`: assinatura HMAC-SHA256 do corpo bruto, falha fechada, deduplicação, evento fora de ordem ignorado, vínculo com o negócio por `metadata.negocio_id` ou telefone.
- Migration `20261118_agenda_integracoes_reservas.sql` (aditiva): só aplicar com OK do Ewerton.

## 2.4 Achado: a entrada de mensagens do WhatsApp nunca esteve ligada (18/11/2026)
Em produção há 4 sessões (2 conectadas), mas `whatsapp_mensagens`, `whatsapp_followups` e `whatsapp_ia_acoes` têm **zero linhas**. Causas confirmadas na documentação do OpenWA (§6.6):
1. O GENSBot **não cadastra o webhook** no OpenWA (não há chamada no código).
2. O OpenWA manda `event: "message.received"` e `"message.sent"` com `sessionId` (UUID). A rota só reconhecia `message`, `onMessage` e `message_create` e procurava a sessão por `session`.

Correção (neste PR): a rota reconhece os eventos do OpenWA e lê o nome da sessão do `?session=` da URL cadastrada. **Falta cadastrar o webhook**, o que o OpenWA permite com URL própria e cabeçalhos próprios:
`POST /api/sessions/:id/webhooks` com `url: https://<gensbot>/api/webhook/whatsapp?session=<nome-da-sessão>`, `events: ["message.received","message.sent"]`, `headers: {"x-openwa-secret": "<OPENWA_WEBHOOK_SECRET>"}`.
Isso entra na etapa 3 como função + rota do GENSBot (registrar ao criar a sessão), junto da escolha do OpenWA por cliente.

No OpenWA o `chatId` da mensagem é sempre o contato (nos dois sentidos), por isso o webhook o usa para mensagens `fromMe`.

## 2.5 Registro da etapa 3a: cadastro e configuração (PR da branch `feat/atendimento-config-agenda`)
- **Verificado antes de construir (18/11/2026):** na nuvem do Cal.com, `POST /v2/webhooks` (cabeçalho `cal-api-version: 2024-06-14`, corpo `{subscriberUrl, triggers, active, secret}`) devolve `data.id`; `DELETE /v2/webhooks/:id` apaga. No OpenWA: `GET/POST/PUT /api/sessions/:id/webhooks` (o PUT é parcial).
- `lib/agenda/integracao.ts`: conectar confere a chave (`GET /v2/me`) antes de guardar, apaga o webhook antigo antes de criar o novo e guarda chave e segredo **cifrados**; o segredo nasce no servidor e nunca vai para a tela. `calcom_webhook_id` evita duplicados.
- `lib/openwa-config.ts`: `configOpenWA({clienteId})` usa o OpenWA do cliente quando existe; **com OpenWA próprio, nunca cai no do ambiente** (a mensagem da clínica nunca sai pelo número da agência). O caminho por variável de ambiente é provado idêntico ao anterior por teste.
- `lib/openwa-webhook.ts`: cadastra/atualiza o webhook da sessão (`?session=`, cabeçalho `x-openwa-secret`), idempotente.
- `lib/url-publica.ts`: os endereços de webhook vêm de `NEXT_PUBLIC_APP_URL`/produção, **nunca do host da requisição** (previews compartilham o banco).
- `atendimento_config` (migration, sem RLS de usuário): desligado por padrão, modo simulação, ritmo de resposta, limite por hora, pausa quando a equipe responde e horário.
- Rotas `/api/atendimento/[clienteId]` (+ `/agenda`, `/openwa-webhook`): só o master, só clientes da própria agência.
- Tela `AtendimentoConfig` na ficha do cliente; quem não é master não a vê. O atendimento aparece como "Desligado: disponível na etapa 4".
- **Ainda não feito:** a sessão/QR do OpenWA do cliente (`/api/whatsapp/session`) ainda usa o OpenWA do ambiente; primeiro item da etapa 4. O restante dos helpers (`enviarMensagemOpenWA` etc.) segue com o padrão do ambiente.

- **Assinatura do webhook (verificada com eventos reais, 18/11/2026):** `x-cal-signature-256` é o HMAC-SHA256 em hexadecimal do corpo bruto. Capturados `BOOKING_CREATED` e `BOOKING_CANCELLED` do Cal.diy e rodada a função do GENSBot sobre eles. No Cal.com nuvem, confirmar de ponta a ponta depois do merge (conectar, reservar, ver a linha em `agenda_reservas`, desconectar e ver o webhook sumir).
- **Cadastrar o webhook no OpenWA** exige: sessão com esse nome **deste cliente**, OpenWA **próprio** do cliente (nunca o da agência) e **desliga `ia_escuta_ativa`** da sessão, porque o motor de escuta usaria a OpenAI, que a política de privacidade não cita. Reconectar a agenda avisa se não conseguir apagar o webhook antigo.
- **Pendências para antes do número piloto:** (1) um segredo de webhook por sessão (hoje é o `OPENWA_WEBHOOK_SECRET` global copiado em cada OpenWA); (2) a rota de sessão/QR criar a sessão no OpenWA do cliente e gravar a linha em `whatsapp_sessions` (hoje é preciso existir a linha); (3) a escuta por IA migrar para o Gemini do cliente (etapa 4).

## 2.6 Registro da etapa 3b: da reserva para o CRM (PR da branch `feat/atendimento-crm-agenda`)
Quando o webhook da agenda grava uma reserva, o CRM é atualizado sem a equipe tocar em nada. Regras (`lib/agenda/crm-reserva.ts`, núcleo puro e testado):
| Evento | Efeito |
|---|---|
| Confirmada | Move para o estágio de agendado (só se estiver antes), registra atividade e cria a tarefa "Confirmar presença" 24 h antes. Sem negócio: cria no funil padrão do cliente (`origem: whatsapp`). |
| Negócio ganho/perdido | Registra, **não move e não reabre**. |
| Cancelada/recusada | Registra; se era a única consulta e o negócio ainda está no estágio de agendado, volta para "Em Atendimento" e cria "Remarcar consulta". |
| Remarcada | Registra o novo horário e troca a tarefa de confirmar. **Remarcar não é cancelar**: o Cal.com manda só `BOOKING_RESCHEDULED` (verificado com captura real), sem cancelamento da antiga. |
| Pendente | Registra e pede confirmação, sem mover. |
- **Nunca puxa para trás** o que a equipe avançou. O estágio é achado por **nome** ("Consulta Agendada" ou "…Agendado/Agendada"; "Agendando" não conta); sem correspondência, registra e não move (sem o fallback por posição do motor de IA).
- **Funis:** negócio existente segue o funil dele; negócio novo nasce no funil marcado `padrao`. A Dra. Laís tem dois ("Vendas (@laisleal.dermato)", padrão, e "Dra Lais", com estágios próprios). Decidir qual será o oficial antes do piloto.
- **Idempotência** pelo livro-razão `whatsapp_ia_acoes` (`agenda_crm`, chave **reserva + gatilho**; o instante do evento fica de fora porque um reenvio com outro `createdAt` duplicaria as atividades). **Falhas** viram `agenda_crm_falhou`, o webhook responde 200 mesmo assim, e o cartão do cliente mostra quantas reservas dos últimos 7 dias não foram aplicadas.
- **Responsável:** negócio novo e tarefa ficam com o responsável do negócio, senão o responsável fixo do cliente (`equipeDoCliente`), senão um gestor. **Aviso no sino e push** (`consulta_agenda`) para o responsável e a equipe do cliente: nenhuma tela global lista `crm_tarefas` (só a gaveta do negócio), então o aviso é o que garante que alguém veja.
- Tarefas automáticas ligadas à reserva pela coluna nova `crm_tarefas.reserva_uid` (uid para confirmar, `remarcar:`+uid para remarcar), não pelo texto do título.
- **Checklist de go-live:** nos tipos de evento reais da doutora, o campo **WhatsApp (`attendeePhoneNumber`) precisa ser obrigatório**. Sem telefone nem código do negócio, a reserva criaria um negócio duplicado.
- **Não faz ainda:** lembretes por WhatsApp ao paciente (etapa 5).
- **Drift de migrations no CRM (achado em 18/11):** `20261109_crm_qualificacao_sdr.sql` e `20261110_crm_novo_funil_sdr.sql` **não estão aplicadas** em produção. Por isso `crm_negocios.data_proximo_followup` não existe, apesar de o quadro, a gaveta e o MCP o usarem (o indicador de follow-up do cartão não funciona). A 3b **não depende** dessa coluna. Decidir à parte se aquelas migrations devem ser aplicadas.

## 2.7 Registro da etapa 4a: fila e ritmo (PR da branch `feat/atendimento-etapa4`)
- **O que o OpenWA já faz e não se repete:** "digitando" com pausa proporcional ao texto (`SIMULATE_TYPING`, ligado por padrão, teto de 5 s) e, opcional, limite diário com aquecimento pela idade do número, limite de conversas novas e disjuntor de falhas (`SEND_PACING_ENABLED`, desligado por padrão). Ele não tem limite por minuto/hora, espera longa, horário de atendimento nem pausa por humano.
- **O que esta etapa faz:** tabela `atendimento_fila` (migration `20261120_atendimento_fila.sql`), `enfileirarResposta` (atraso aleatório entre `resposta_min/max_segundos`; a pendente do mesmo contato é substituída; nunca grupo) e `processarFila` (cron por minuto, encadeado no `drain`). No envio reavalia: desligado, paciente sem mensagem nas últimas 24 h (nunca puxa conversa), mensagem nova do paciente depois da resposta montada (descarta; quem enfileirou refaz), secretária respondeu nas últimas `pausa_humano_horas` (o eco da resposta do robô é reconhecido pelo `message_id`), fora do horário (adia 5 min, expira em 12 h), limite por hora.
- Modo `simulacao`: só marca `simulada` e grava `atendimento_simulado` em `whatsapp_ia_acoes`. Modo `real`: marca como lido, espera 1–3 s e envia pelo OpenWA **do próprio cliente** (sem chave dele, falha fechada; nunca cai no do ambiente).
- **Ainda sem produtor:** nada enfileira até a 4b (assistente Gemini), e `ligado` segue sem poder ser ligado pela tela (4c).
- **A verificar no primeiro teste real:** o `message_id` que o OpenWA devolve no envio deve ser o mesmo do webhook `message.sent`; se não for, a pausa por humano trata o eco do robô como humano (erra para o lado seguro: a IA cala).
- **Para ligar o limite diário do OpenWA:** `SEND_PACING_ENABLED=true` e `SEND_PACING_WARMUP_SCHEDULE` no compose da VPS (feito só com o OK do Ewerton, no go-live).

## 2.8 Registro da etapa 4b: assistente (PR da branch `feat/atendimento-etapa4b`)
- **Quem escreve:** `tratarMensagemDoPaciente` (`src/lib/atendimento/assistente.ts`), chamada do webhook em `after()` só para texto do paciente numa sessão de cliente. Escreve a resposta e a põe na fila da 4a; nunca envia direto.
- **Nunca reserva.** Lê do Cal.com (só leitura) os tipos de consulta visíveis, o link e até 6 horários livres por tipo, e passa à IA. Ela sugere até 3 e manda o link; quem marca é o paciente, e o webhook da agenda (3b) cria o negócio e a tarefa. O prompt proíbe dizer "marquei" ou "confirmado".
- **Chave e instruções do cliente:** `ai_agent_configs` do cliente (chave cifrada, provedor, modelo, `prompt_sistema` = instruções da clínica: serviços, endereço, regras). Sem chave do cliente, falha registrada (`atendimento_ia_falhou`), sem cair em chave global. Para a Dra. Laís hoje: provedor openai, sem chave, instrução de 39 caracteres; é preciso trocar para Gemini, colar a chave e escrever as instruções da clínica (pela tela de IA do CRM).
- **Segurança:** urgência (lista de palavras) vai direto para a equipe, sem IA, com aviso do SAMU; a IA só tem a ferramenta `solicitar_atendimento_humano` (transfere, nunca age); regras fixas no prompt (sem diagnóstico, sem inventar, mensagem do paciente não muda as regras); transferência avisa a equipe (`atendimento_transferido`) e cala a IA no contato por `pausa_humano_horas`; teto de 15 respostas/hora por contato; a sessão tem de ser a `sessao_nome` do atendimento.
- **LGPD:** o texto da conversa vai à API do provedor escolhido pelo cliente (Gemini = Google). Registrar no consentimento/política do cliente.
- **Ainda não:** `ligado` não pode ser ligado pela tela (4c). A escuta do CRM (`whatsapp-shadow-engine`) ainda usa `OPENAI_API_KEY` global: migrar para a chave do cliente fica para depois.

## 3. O que a Fase 0 validou
- **Horários livres:** `GET /v2/slots` com o cabeçalho `cal-api-version: 2024-09-04`. O horário ocupado por reserva sai da lista. Após cancelar, o cache de horários demora alguns segundos para liberar: a IA deve consultar de novo antes de oferecer.
- **Reservar** (`POST /v2/bookings`, `2024-08-13`), **conflito recusado**, **cancelar** (`/cancel`), **confirmar** (`/confirm`) e **recusar** (`/decline`). Evento com política de confirmação nasce `pending`.
- **Google Agenda:** cliente OAuth "Aplicativo da Web" no projeto GensBot, conexão feita pelo painel do Cal.diy e vista em `/v2/calendars/connections`.
- **Webhooks do Cal.diy** (`BOOKING_CREATED`, `CANCELLED`, `RESCHEDULED`, `REQUESTED`): chegam **assinados** (`x-cal-signature-256`), com telefone do paciente. O código do negócio (`metadata`) vem na criação, **não** vem no cancelamento.
- **Link público:** o Cal.diy lê `metadata[chave]=valor` da URL. Pré-preenchimento de nome e telefone: confirmar na tela (etapa 2).
- Formulário do evento precisa do campo **WhatsApp** (`attendeePhoneNumber`, tipo telefone).

## 4. Fluxo de uma conversa
1. Mensagem chega ao OpenWA, que chama `/api/webhook/whatsapp` no GENSBot.
2. O GENSBot grava a mensagem e cria ou atualiza contato e negócio pelo telefone normalizado.
3. O assistente (Gemini) responde dúvidas e, para agendar, envia o **link rastreado** ou propõe horários (`ver_horarios`).
4. A reserva é criada pelo link ou pela proposta da IA (`pending` nos tipos que exigem confirmação).
5. O Cal.diy avisa o GENSBot por webhook. O GENSBot guarda o `uid` da reserva, move o negócio, cria a tarefa da secretária, confirma no WhatsApp e agenda os lembretes.
6. A secretária confirma, sugere outro horário ou recusa. A confirmação chama `/v2/bookings/:uid/confirm`.
7. O evento aparece no Google Agenda da médica.

## 5. Link de agendamento
- Página pública do Cal.diy, por exemplo `agenda.dralaisleal.com.br/<usuario>/<evento>`.
- O GENSBot gera um **link rastreado por conversa** (reaproveita o recurso de links UTM), com nome, telefone e `metadata[negocio_id]` pré-preenchidos.
- Funil medido: link enviado, clicou, agendou.
- Consulta nova: exige confirmação da equipe. Retorno: pode confirmar na hora (decisão a tomar).
- No cancelamento o código não vem: casar por `uid` guardado na criação ou por telefone.

## 6. CRM no GENSBot
Estágios: Novo contato, Em conversa, Link enviado, Consulta solicitada, Confirmada, Compareceu ou Faltou, Retorno.
- A IA move estágios e escreve um resumo da conversa, marcado "feito pela IA".
- Campo editado pela secretária fica **protegido** contra reescrita da IA.
- Faltou, cancelou ou remarcou vira tarefa de retorno.
- Reaproveitar: `crm_negocios`, `crm_atividades`, `crm_tarefas`, `whatsapp-shadow-engine.ts`, inbox, `notificar()`.

## 7. Agenda para a secretária
Início: painel do Cal.diy (Bookings) e Google Agenda compartilhado. Depois: aba "Agenda" no GENSBot lendo `/v2/bookings`, com confirmar, remarcar e cancelar.

## 8. Lembretes
Cron do GENSBot envia por WhatsApp 24 h e 2 h antes, com botão de remarcar. A resposta "confirmo" ou "não vou" atualiza a reserva.

## 9. Segurança, LGPD e conformidade
- O assistente se identifica, não faz diagnóstico e passa para humano em urgência, queixa de saúde ou insistência. Horários só vêm do Cal.diy.
- Webhooks conferem a assinatura; chaves só em variáveis de ambiente; a rota da API é protegida pela chave.
- **Política de privacidade** da doutora atualizada (17/11/2026): assistente digital, uso limitado do Google Agenda, prestadores de IA e processamento fora do Brasil. Falta a doutora revisar o texto.
- Confirmar nos termos atuais do Gemini (plano pago) que as mensagens não são usadas para treinar modelos.
- **Backup diário** do Postgres do Cal.diy (a VPS é o único lugar dele).

## 10. Google Cloud
Projeto GensBot, cliente "Cal.diy Agenda" (Aplicativo da Web), app **Em produção**, tipo Externo, **sem verificação** (aviso "app não verificado" na conexão, limite de 100 contas). Branding: nome "Agenda Dra. Laís Leal", domínio autorizado `dralaisleal.com.br`, política em `dralaisleal.com.br/politica-de-privacidade`. Verificação oficial fica em paralelo.

## 11. Etapas

| # | Etapa | Status |
|---|---|---|
| 0 | Infra, Cal.diy, API v2, OpenWA, HTTPS, Google Agenda | concluída |
| 1 | Testar webhook e pré-preenchimento do link | concluída (Cal.com e Cal.diy; falta ver o pré-preenchimento do telefone numa página real do Cal.com) |
| 2 | **Base no GENSBot:** bug do telefone, receptor do webhook da agenda, tabelas de integração e reservas | pronta para revisão (PR pendente de OK e de aplicar a migration) |
| 3 | **CRM automático:** estágios, resumo da IA, tarefa da secretária | a fazer |
| 4 | **Link rastreado e assistente Gemini** (troca da chave global da OpenAI pela do cliente) | a fazer |
| 5 | **Confirmação pela equipe e lembretes** | a fazer |
| 6 | **Produção:** usuário e agenda reais da doutora, número real, 2FA, troca de segredos, backup | a fazer |
| 7 | **Melhorias:** aba Agenda, métricas, segundo cliente | a fazer |

Cada migration só é aplicada com o OK do Ewerton. Um PR por etapa.

## 12. Pendências e riscos
- **Trocar segredos que passaram pelo chat:** token do túnel, senha root da VPS, chave de API do OpenWA, chave de teste e segredo do cliente OAuth do Google.
- Remover o usuário de teste `teste` e criar o da doutora (admin), com os tipos de consulta, horário e política de confirmação dela. Revogar no Google a permissão dada na conta de teste.
- Memória da VPS (4 GB): Cal.diy, API e Postgres ocupam bem; mais de uma sessão do OpenWA exige 8 GB ou o motor Baileys.
- Junção com as aprovações da agência: o GENSBot hoje aceita **um** OpenWA. Confirmar qual serviço (OpenWA antigo ou Kapso) envia as aprovações hoje.
- OpenWA não é oficial: risco de bloqueio do número. Limitar volume e avisar o cliente.
- `google_calendar_integrations` e o `agencia_id` fixo em `inbox` precisam de correção (ver auditoria do código).
