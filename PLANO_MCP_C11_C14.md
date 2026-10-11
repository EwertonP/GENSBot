# Plano: novas ferramentas do MCP (ondas C11 a C14)

Data: 10/10/2026. Status: planejamento, nada implementado.

## Por que

Hoje o Claude cria demanda, tarefa, formulário e automação, mas trava em três pontos:

1. **Cliente:** não existe `criar_cliente`. A Bakanasnet precisou ser criada pela tela, com login no navegador.
2. **Automação:** nasce sempre pausada e só é editada pausada, então toda automação criada pelo Claude exige uma ida à tela pra ativar.
3. **Publicação:** só existe `listar_fila_publicacao` (leitura). O Claude não consegue pegar uma arte pronta (Figma), subir e publicar ou agendar na conta certa.

O objetivo é fechar o ciclo pelo chat: criar cliente → criar demandas → exportar a arte do Figma → agendar ou publicar → automação de DM já ativa.

Seguindo a regra das ondas: **cada onda é mergeada e testada em produção antes de começar a próxima.**

---

## Onda C11: clientes (`ferramentas-c11.ts`)

| Ferramenta | Faz o quê | Reaproveita |
|---|---|---|
| `criar_cliente` | Nome, nicho, cor, conta do Instagram (username, opcional), posts/reels por mês. Devolve o id. | `parseClienteInput(body, 'criar')` e `validarContaInstagram` do `POST /api/clientes` |
| `editar_cliente` | Edição parcial: nome, nicho, cor, briefing, observações (regras), volume, vincular ou trocar o Instagram. | `parseClienteInput(body, 'editar')` do `PATCH /api/clientes/[id]`, inclusive a foto puxada da conta |
| `arquivar_cliente` | `ativo: false` (e `true` pra restaurar). É o "excluir" do dia a dia. | Mesmo PATCH, que já trata `{ ativo }` |
| `excluir_cliente` | Exclusão definitiva, só master. Exige `confirmar_nome` igual ao nome do cliente. Recusa se houver demandas, automações ou posts agendados, e manda arquivar. | Nova, usa `serviceSupabase` com o mesmo escopo de agência |

Antes de codar:
- Mover `parseClienteInput` e `validarContaInstagram` pra `src/lib/clientes.ts`, se ainda estiverem dentro da rota, pra rota e MCP usarem a mesma validação.
- Conferir no Supabase o que tem FK pra `clientes` (`conteudo_items`, `contatos`, `formularios`, `instagram_accounts`...) e se é `ON DELETE CASCADE` ou `RESTRICT`. Isso define a trava do `excluir_cliente`.

---

## Onda C12: automação já ativa (`ferramentas-c3.ts` + `servidor.ts`)

Mudança de regra. Hoje é "pausada por padrão; ativar só pela tela". Passa a ser **"sempre ativa"** (decisão 2):

- `criar_automacao` grava `active: true`. Se alguma palavra-chave já dispara outra automação ativa na conta, devolve isso em `conflitos_de_palavra_chave` como aviso, mas a automação fica ativa. `manter_pausada: true` é a única forma de criar pausada.
- `editar_automacao` e `editar_automacao_parcial` passam a aceitar automação ativa. A ferramenta pausa, salva a versão anterior em `automation_versions` (já faz isso), grava e reativa. Assim a conversa em andamento não pega um fluxo pela metade. Novo parâmetro `manter_pausada` pra quem quiser revisar antes.
- Nova `ativar_automacao`, par da `pausar_automacao` que já existe, com a mesma checagem de conflito.
- `copy_humanizada: true` continua obrigatório.
- Conta sem token válido ou sem permissão de mensagens → cria pausada e avisa, em vez de ativar algo que vai falhar.

Atualizar junto: `INSTRUCOES` em `servidor.ts` (a frase "ativar é sempre pela tela"), a seção "Regras" do `MCP.md`, e os testes de `ferramentas-c3`.

---

## Onda C13: mídia (`ferramentas-c13.ts`)

A Graph API só publica a partir de uma **URL pública**. O GENSBot já sobe mídia pro R2 com URL assinada (`getPresignedUploadUrl` em `src/lib/r2.ts`).

| Ferramenta | Faz o quê |
|---|---|
| `preparar_upload_midia` | Recebe nome, tipo (`image/jpeg`, `video/mp4`) e tamanho. Devolve uma URL de upload assinada (PUT, expira em ~10 min) e a URL pública final. |
| `importar_midia_url` | O servidor baixa uma URL (export do Figma, link do Drive, arquivo de outra demanda) e grava no R2. Serve quando o Claude tem a URL mas não o arquivo. Só https, com limite de tamanho e tipo. |
| `anexar_midia_demanda` | Liga as URLs à demanda (`conteudo_items`), na ordem dos slides, pra aparecer na esteira e na aprovação. |

**Fluxo com o Figma** (lado do Claude, sem código no GENSBot):
1. O Claude acha o frame no arquivo do cliente (Figma MCP).
2. Exporta cada frame do carrossel em 1080×1350 (4:5) ou 1080×1080, e o vídeo do Reels em 1080×1920.
3. Sobe com `preparar_upload_midia` + PUT (curl), ou passa a URL de export pro `importar_midia_url`.
4. Anexa na demanda e agenda (C14).

Validações no servidor, pra falhar antes da Meta:
- **Imagem precisa ser JPEG.** A API de publicação não aceita PNG, e o Figma exporta PNG por padrão. Converter no servidor (`sharp`) ou exigir export em JPG.
- Proporção entre 4:5 e 1.91:1 no feed. Carrossel de 2 a 10 itens, todos na mesma proporção.
- Reels: MP4/MOV, H.264, 3 s a 15 min, 9:16. Conferir os limites atuais na doc da Meta antes de travar os números.

O Figma precisa estar conectado: hoje o `plugin:figma` pede autenticação.

---

## Onda C14: publicação (`ferramentas-c14.ts`)

Primeiro, um refactor: tirar de `POST /api/instagram/publish` a lógica de "agendar ou publicar + amarrar na demanda + automação do post" e levar pra `src/lib/publicacao.ts` (`criarPublicacao(...)`). A rota e o MCP passam a chamar a mesma função.

| Ferramenta | Faz o quê |
|---|---|
| `agendar_post` | Conta, tipo (IMAGE, CAROUSEL, REELS, STORIES), mídias, legenda, data, `demanda_id` opcional, colaboradores, localização, capa e áudio do Reels. Grava em `scheduled_posts` e move a demanda pra `agendamento`. O cron `publish-scheduled` publica. |
| `publicar_agora` | Mesmo formato. Publica na hora, dentro da requisição (decisão 4), depois da verificação de conta. Devolve o link do post publicado, ou `processando` se for um Reels que a Meta ainda não liberou. |
| `editar_post_agendado` | Legenda, data, mídias e colaboradores de um post que **ainda não publicou**. Reaproveita o `PATCH /api/instagram/publish/[id]`. |
| `cancelar_post_agendado` | Tira da fila (`DELETE /api/instagram/publish/[id]`) e devolve a demanda pra etapa anterior. |
| `criar_automacao_do_post` | Opcional: liga a palavra do CTA ("Comente PLANO") ao post publicado. Usa `createAutomationForPublishedPost`, que já existe em `publish-automation.ts`. |

**Editar post que já está no feed:** a Graph API não deixa editar legenda nem mídia de um post publicado. Pelo que sei, só `comment_enabled` muda, e também não dá pra apagar post pela API. Confirmar na doc atual da Meta antes de prometer qualquer coisa. Se continuar assim, "editar uma postagem do feed" pelo Claude fica restrito a posts agendados, e o publicado se edita no app do Instagram.

**Travas** (publicar é público e não tem volta):
- `confirmar: true` obrigatório em `publicar_agora`, e o Claude só manda depois do "aprovado" do Ewerton no chat.
- Verificação de conta completa (ver "Decisões", item 3), pra não publicar arte da Bakanas no perfil da NETMais+.
- Só master publica.
- Se veio de uma demanda, ela vai pra `publicado` com o link do post.

---

## Decisões (Ewerton, 10/10/2026)

1. **Excluir cliente:** arquivar por padrão e excluir de vez só sem histórico, como proposto na C11.
2. **Automação:** nasce **sempre ativa**, porque o conteúdo dela já foi decidido antes de criar. O conflito de palavra-chave vira só aviso na resposta e não pausa a automação. Continua valendo `manter_pausada: true` quando alguém pedir explicitamente.
3. **Aprovação:** acontece **no chat, com o Ewerton**, e não na esteira. O fluxo é:
   1. o Ewerton pede a peça;
   2. o Claude cria e envia;
   3. o Ewerton aprova no chat;
   4. o Claude exporta do Figma, sobe pro GENSBot e publica na conta do cliente.

   Portanto `publicar_agora` não exige etapa da demanda. A trava é `confirmar: true`, que o Claude só manda depois do "aprovado" no chat, mais a verificação de conta.
4. **Publicar na hora:** é na hora mesmo, dentro da requisição, sem fila.

### Verificação de conta obrigatória antes de publicar (decisão 3)

A ferramenta recusa se qualquer um destes falhar, e a resposta mostra o @ e o nome do cliente pra conferência:
- a conta (`instagram_user_id`) está vinculada ao cliente informado (`clientes.instagram_account_id`);
- se veio `demanda_id`, a demanda é desse mesmo cliente;
- o token da conta está válido (não expirado) e tem permissão de publicação;
- `confirmar_conta`: o Claude repete o username que pretende usar, e ele precisa bater com o da conta resolvida.

### Publicar na hora vs. limite de tempo (decisão 4)

Foto e carrossel de imagem publicam em poucos segundos, sem problema. **Reels** depende do processamento do vídeo pela Meta, e hoje a rota tem `maxDuration = 60`. Plano:
- verificar se o projeto já está no Fluid Compute da Vercel, que permite mais tempo por requisição no plano atual, e subir o `maxDuration` da nova rota até o máximo permitido;
- se o vídeo ainda estiver processando quando o tempo acabar, a ferramenta devolve `status: "processando"` com o id do container, e o cron termina de publicar na próxima passada. O Claude acompanha por `listar_fila_publicacao` e avisa quando sair.

## Verificação por onda

- Testes com o Supabase falso no padrão de `ferramentas-c5.test.ts`, e atualizar a contagem em `mcp.test.ts` (hoje 33).
- Validar as consultas reais contra o Supabase antes do deploy.
- Teste de ponta a ponta numa **conversa nova** (o MCP guarda o schema da sessão):
  - C11: criar um cliente de teste, editar, arquivar e excluir.
  - C12: criar automação numa conta de teste e conferir que nasceu ativa. Criar outra com a mesma palavra e conferir que nasceu ativa com o aviso de conflito.
  - C13: exportar um frame do Figma, subir e abrir a URL pública.
  - C14: publicar uma foto na hora numa conta de teste e tentar publicar com a conta errada (tem que recusar). Agendar outro pra daqui a 5 min, ver em `listar_fila_publicacao` passar a "publicado", e cancelar um terceiro antes da hora.
- Atualizar o `MCP.md` (catálogo e regras) em cada PR.
