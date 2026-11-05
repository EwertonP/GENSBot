# Plano: link de onboarding do cliente (conectar Instagram, Threads e TikTok sozinho)

Status: **só plano**, nada implementado. Verificado em 05/11/2026 nas documentações oficiais (fontes no fim).

## Resposta curta

Dá para fazer. O cliente abre um link, segue um guia passo a passo, autoriza cada rede na tela oficial dela (a senha nunca passa por nós) e, ao terminar, o onboarding fecha e ele entra no painel do cliente. Há **uma etapa manual da agência** (adicionar o cliente como testador no painel da Meta) e **um risco sério no TikTok** (abaixo).

## O que foi verificado

### Instagram e Threads: modo testador
- **Quem adiciona:** a agência, no painel do app Meta: *Funções do app > Funções* e então "Testadores do Instagram" (informando o @ da conta) ou "Testador do Threads".
- **Não existe API para isso.** A referência do Graph API (`/{app-id}/roles`) só permite **ler** as funções; criar, alterar e apagar não são suportados no endpoint. Então essa etapa é **manual, uma vez por cliente e por rede**.
- **Quem aceita:** o cliente, logado na própria conta.
  - **Threads:** *Configurações da conta > Permissões do site* (site ou app do Threads) — confirmado na doc oficial.
  - **Instagram:** *Editar perfil > Apps e sites > Convites de testador* (site ou app) — descrito na doc do Instagram e em guias; a página atual de Instagram Login não repete o caminho, então vale conferir na tela real no primeiro cliente.
- **O que o modo testador permite:** Threads testers concedem as permissões do app a qualquer momento, sem App Review. No Instagram, o acesso Padrão cobre contas com função no app (testadores); contas **sem** função exigem Acesso Avançado, App Review e Business Verification.
- **Validade do acesso (Threads):** perfil público: 90 dias, renovável com o token de longa duração. Perfil **privado**: não renova, o cliente precisa autorizar de novo.
- **Não consegui confirmar** o limite de testadores por app. Conferir no painel antes de crescer a carteira.

### TikTok: não tem testador, e há um bloqueio de política
- Não há "testador" equivalente. O cliente pode autorizar, mas o que o app consegue fazer depende da **auditoria** do TikTok.
- **Sem auditoria:** toda publicação sai **somente privada** (`SELF_ONLY`), no máximo **5 usuários** postando em 24h, e a conta precisa estar **privada** no momento da postagem; publicar em conta pública é recusado.
- **Com auditoria:** libera público, mas a política diz que o app não pode ser limitado a testes ou uso interno e que **"uma ferramenta de equipe para subir conteúdo em contas que você gerencia" não é aceitável**. Isso descreve justamente o GENSBot (agência publicando nas contas dos clientes), então a aprovação **pode ser negada**. É o maior risco do plano.
- Mesmo auditado: teto de ~15 posts por dia por criador, e a tela de publicação precisa seguir regras (mostrar o nome da conta, escolher privacidade sem padrão, interações, declaração de música, aviso de conteúdo comercial).
- **Sandbox / "target users":** não encontrei na doc; **não confirmado**.

## Fluxo proposto

1. **Agência** cria o cliente e clica em **"Gerar link de onboarding"** na ficha.
2. **Agência** adiciona o @ do Instagram e do Threads do cliente como testadores no painel da Meta (checklist na própria ficha: "Convite do Instagram enviado", "Convite do Threads enviado"). Para isso a agência precisa saber o @ de cada rede: o link pode começar **pedindo os @** ao cliente e avisar a agência.
3. **Cliente** abre `/conectar/<token>` (sem login): vê a marca da agência e uma lista de passos.
   - **Passo 0:** abrir no **computador** (para aceitar convites).
   - **Passo 1, Instagram:** (a) "Aceite o convite": link e instruções com captura de tela para *Apps e sites > Convites de testador*; (b) botão **Conectar Instagram**; (c) status "Conectado como @nome".
   - **Passo 2, Threads:** (a) aceitar em *Configurações > Permissões do site*; (b) botão **Conectar Threads**; (c) status.
   - **Passo 3, TikTok:** botão **Conectar TikTok** (ver risco); status.
   - Cada passo mostra erro claro quando falha: "conta pessoal em vez de profissional", "convite ainda não aceito", "perfil privado".
4. Ao concluir os passos obrigatórios: marca a etapa **"Acessos das redes coletados"** do onboarding (já existe em `ETAPAS_ONBOARDING_PADRAO`), notifica a agência (sino, push e WhatsApp) e leva o cliente ao **painel do cliente**.
5. **Reconexão:** o mesmo link serve para reautorizar quando o acesso expirar; a agência recebe aviso antes do vencimento.

## O que muda no código

- **Banco:** tabela `onboarding_links` (`id`, `agencia_id`, `cliente_id`, `token_hash`, `expira_em`, `revogado_em`, `usado_em`) e colunas de status por rede (conectada em, expira em). Token longo e aleatório, guardado como hash.
- **Página pública** `/conectar/[token]` (entra na lista pública do `proxy.ts`, como `/aprovacao` e `/f`), com o guia passo a passo.
- **OAuth sem sessão:** hoje os callbacks de Instagram, Threads e TikTok exigem a **agência logada** e recebem só `clienteId` no `state`. Passam a aceitar um **`state` assinado** (HMAC com o token do link, nonce de uso único e validade curta) quando vier do link público, e gravam a conta no cliente certo. O fluxo da agência logada continua igual.
- **Ficha do cliente:** botão "Copiar link de onboarding", checklist dos convites de testador e painel com o status das três redes.
- **Painel do cliente:** o item 6 do plano de semanas (portal com "Visível para o cliente") passa a ser o destino do fim do onboarding.
- **Segurança:** limite de tentativas no link, token revogável, página mostra só o status do próprio cliente (nunca tokens), e registro no histórico de quem conectou e quando.

## Fases

1. **Instagram + Threads com link e guia** (a parte que funciona hoje): tabela de links, página pública, `state` assinado, status, checklist dos convites na ficha, fim do onboarding. Validar com **um cliente real** (confirma o caminho exato do convite do Instagram).
2. **Avisos e reconexão:** notificações, expiração e reenvio do link.
3. **Painel do cliente:** entrada automática ao concluir.
4. **TikTok:** só depois de decidir a estratégia (abaixo).

## Decisões que dependem de você

- **TikTok:** (a) pedir a auditoria e arriscar a negativa pela política de "ferramenta de equipe"; (b) operar sem auditoria, só com post **privado** (rascunho que o cliente publica) e no máximo 5 contas por dia; (c) deixar o TikTok manual por enquanto. Eu recomendo (c) agora e tentar (a) com um pedido bem justificado depois, mostrando que cada cliente autoriza a própria conta.
- **Convite do testador:** manter manual (inevitável pela API) ou pedir os @ no link para a agência só clicar em "adicionar".
- **Limite de testadores por app:** conferir no painel da Meta antes de passar de algumas dezenas de clientes; se houver teto, o caminho de longo prazo é pedir **Acesso Avançado** (App Review + Business Verification) e aí o convite de testador deixa de ser necessário.

## Fontes

- Threads, primeiros passos (testadores, aceite em Permissões do site, App Review para quem não é testador, validade de 90 dias): https://developers.facebook.com/docs/threads/get-started
- Instagram Platform, níveis de acesso (Standard x Advanced, App Review, Business Verification): https://developers.facebook.com/docs/instagram-platform/overview
- Graph API, `/{app-id}/roles` (somente leitura): https://developers.facebook.com/docs/graph-api/reference/app/roles/
- TikTok, diretrizes de Content Sharing (auditoria, SELF_ONLY, limites, "ferramenta de equipe" não aceitável): https://developers.tiktok.com/doc/content-sharing-guidelines
- Caminho do convite do Instagram (doc da Basic Display, descontinuada, e guias): https://developers.secure.facebook.com/docs/instagram-basic-display-api/overview
