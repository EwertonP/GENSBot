# Plano: assinatura e envio de contratos (custo zero, dentro do GENSBot)

Status: **só plano**, pronto para implementar em fases. Decisão: **não usar OpenSign nem outro provedor**. A assinatura é nossa, sobre a infraestrutura que já temos (Vercel, Supabase, R2), sem custo novo.

Este plano parte do que **já existe** (PR #223) e cobre só o que falta. Os planos `PLANO_CONTRATOS_PROPOSTAS.md` (visão geral e referência do Orkestrya) e `BACKLOG_COMPLETO.md` (item 5) continuam valendo.

## 1. Ponto de partida: o que já existe

- Tabelas `modelos_documento`, `propostas`, `contratos` (migration `20261109_propostas_e_contratos.sql`) e dados da agência como contratada.
- Biblioteca de modelos e variáveis em `src/lib/documentos-modelos.ts`; aba Documentos em `src/components/documentos-tab.tsx`.
- Páginas públicas `/proposta/[token]` e `/contrato/[token]` e rotas `/api/contratos/public/[token]` e `/assinar`. O cliente digita ou desenha a assinatura, o sistema grava nome, documento, e-mail, IP e data.
- Ao assinar: o negócio do CRM vira "ganho", a ficha do cliente recebe valor e vencimento e nasce o lançamento de receita no Financeiro.
- Copiar o link público depois de criar o contrato ou a proposta.

## 2. O que falta (lacunas verificadas no código)

| # | Lacuna | Onde aparece |
|---|---|---|
| 1 | **Texto não é congelado.** O contrato lido pelo cliente é o `conteudo_html` editável; mudar o modelo ou o contrato depois da assinatura altera o que "foi assinado". | `contratos.conteudo_html` |
| 2 | **Sem hash.** Nada prova que o texto assinado é o mesmo de hoje. | rota `/assinar` |
| 3 | **A rota `/assinar` não valida o status.** Aceita assinar rascunho ou contrato cancelado, e não é atômica (duas assinaturas ao mesmo tempo). | `assinar/route.ts` |
| 4 | **Sem contra-assinatura da agência.** As colunas `assinatura_agencia_*` existem, mas nada as grava; o contrato vira "assinado" só com o cliente. | `contratos` |
| 5 | **Sem PDF.** Só "imprimir ou salvar PDF" pelo navegador, sem versão oficial guardada. | página pública |
| 6 | **Sem arquivo no painel do cliente.** O contrato assinado não fica listado na ficha do cliente nem tem download. | `cliente-ficha.tsx` |
| 7 | **Envio manual.** Só copia o link; não há botão "Enviar pelo WhatsApp", marcação de enviado, visualizado ou lembrete. | `documentos-tab.tsx` |
| 8 | **Sem aviso.** Quando o cliente assina, ninguém é notificado (`notificar` não tem tipo de contrato). | `notificar.ts` |
| 9 | **Sem validade e sem revogação do link.** O token vale para sempre e não dá para invalidar. | `contratos` |
| 10 | **Sem trilha de eventos** (enviado, aberto, assinado, contra-assinado, cancelado). | — |
| 11 | **Imagem da assinatura no banco** (`assinatura_cliente_imagem` em texto, base64): pesa e infla a linha. | `contratos` |

## 3. Desenho

### 3.1 Estados
`rascunho` → `aguardando_assinatura` (enviado ao cliente) → `assinado_cliente` → `assinado` (contra-assinado, PDF gerado) · `cancelado` a qualquer momento antes de `assinado`.
A migration troca o `check` de `status` para incluir `assinado_cliente`. Contratos já `assinado` pela v1 continuam válidos.

### 3.2 Banco (migration aditiva e idempotente, `20261112_assinatura_contratos.sql`)
Colunas novas em `contratos`:
- `conteudo_final_html text` — texto resolvido e congelado no envio.
- `hash_documento text` — SHA-256 de `conteudo_final_html` (hex).
- `enviado_em timestamptz`, `visualizado_em timestamptz`, `expira_em timestamptz`, `revogado_em timestamptz`.
- `assinatura_agencia_membro_id uuid references membros(id)`, `assinatura_agencia_ip text`.
- `pdf_url text` e `pdf_hash text` (PDF assinado arquivado no R2).
- `assinatura_cliente_imagem_url text` (a imagem passa para o R2; a coluna antiga fica sem uso).

Tabela nova `contrato_eventos` (trilha, só inserção):
`id uuid pk`, `contrato_id fk on delete cascade`, `agencia_id`, `tipo text` (`criado|enviado|visualizado|assinado_cliente|contra_assinado|cancelado|link_revogado|pdf_gerado`), `ip text`, `user_agent text`, `membro_id uuid null`, `dados jsonb`, `criado_em timestamptz default now()`.
RLS ligado, sem policies (acesso só pelo service role, como as demais).

Colunas equivalentes (`enviado_em`, `visualizado_em`, `expira_em`) em `propostas` só se o envio da proposta entrar na mesma rodada.

### 3.3 Código novo
- `src/lib/contrato-assinatura.ts` (puro, com testes):
  - `congelarContrato(contrato, agencia, cliente)` → resolve variáveis e devolve `{ html, hash }`.
  - `hashDocumento(html)` com `crypto.createHash('sha256')`.
  - `validarAssinatura({nome, doc, email})` (nome com 2+ palavras; CPF/CNPJ com dígito verificador; e-mail opcional válido).
  - `podeAssinar(contrato, agora)` → `{ok, motivo}` (status certo, não expirou, não revogado).
- `src/lib/contrato-pdf.ts` (puro): `gerarPdfContrato({html, titulo, hash, assinaturas, evidencias})` com **`pdf-lib`** (MIT, gratuito, roda no Vercel). O HTML do Tiptap vira blocos (título, parágrafo, lista, negrito) desenhados com Helvetica, que cobre os acentos do português. Última página: **certificado de evidências** (quem, documento, e-mail, data/hora UTC, IP, aparelho, hash).
- `src/lib/contrato-eventos.ts`: `registrarEvento(...)` que nunca derruba a ação que o chamou.
- `notificar.ts`: novos tipos `contrato_assinado` e `contrato_visualizado` (push padrão ligado só para o primeiro).

### 3.4 Rotas
| Rota | Quem | O que faz |
|---|---|---|
| `POST /api/contratos/[id]/enviar` | agência | exige dados da agência completos; congela texto e hash; define `expira_em` (padrão 15 dias); status `aguardando_assinatura`; evento `enviado`; devolve link e texto pronto para WhatsApp. Opcional `{ canal: 'whatsapp' }` envia pela sessão OpenWA já existente. |
| `POST /api/contratos/[id]/revogar` | agência | `revogado_em`, status `cancelado`, evento. Para trocar o link: gera novo `token_publico`. |
| `GET /api/contratos/public/[token]` | cliente | devolve o texto **congelado**; marca `visualizado_em` na primeira vez e notifica. Retorna 410 se expirado/revogado. |
| `POST /api/contratos/public/[token]/assinar` | cliente | valida com `podeAssinar` e `validarAssinatura`; update **condicional** (`where status = 'aguardando_assinatura'`) para ser atômico; sobe a imagem ao R2; grava IP, user agent e hora; status `assinado_cliente`; evento; notifica a agência. A integração com CRM, ficha do cliente e Financeiro passa para depois da contra-assinatura. |
| `POST /api/contratos/[id]/contra-assinar` | agência | só se `assinado_cliente`; grava membro, IP e hora; gera PDF; sobe ao R2; grava `pdf_url` e `pdf_hash`; status `assinado`; evento `contra_assinado` e `pdf_gerado`; dispara CRM "ganho", ficha do cliente e lançamento no Financeiro (a lógica atual, movida para uma função reutilizável). |
| `GET /api/contratos/[id]/pdf` | agência | URL assinada do PDF (R2) com `Content-Disposition`. |
| `GET /api/contratos/public/[token]/pdf` | cliente | só depois de `assinado`; devolve o PDF para o cliente baixar. |

Todas as rotas da agência usam `contextoDocumentos()` e filtram por `agencia_id`. A rota pública nunca devolve dados de outros clientes nem tokens.

### 3.5 Telas
- **Lista de contratos (aba Documentos):** status coloridos (rascunho, aguardando cliente, **sua assinatura**, assinado, cancelado, vencido), contadores no topo (Assinados, Aguardando cliente, Sua assinatura, Rascunhos) e botões por linha: Enviar, Copiar link, Contra-assinar, Baixar PDF, Revogar. Linha do tempo em Sheet com os eventos.
- **Envio:** diálogo com o resumo (cliente, valor, validade do link), prévia do texto de WhatsApp e dois botões: "Enviar pelo WhatsApp" e "Copiar link". Bloqueia e mostra o que falta se os dados da agência estiverem incompletos.
- **Página pública `/contrato/[token]`:** mostra a validade do link, o hash resumido no rodapé e, depois de assinado, o selo "Assinado" com botão "Baixar PDF". Alvos de toque de 44px no celular. Aplicar o tema escuro/claro do aparelho (hoje a página é só clara).
- **Ficha do cliente (`cliente-ficha.tsx`):** nova seção **Documentos** com contratos e propostas do cliente, status, data de assinatura e botão de download do PDF. É o "arquivo no painel do cliente". Vale também para o portal do cliente (`/portal/[token]`), mostrando só o contrato assinado.
- **Contra-assinatura:** botão na lista e na ficha, abrindo um diálogo "Assinar como [nome da agência]" com a assinatura da agência pré-cadastrada (Configurações > Agência).

### 3.6 Custo zero
- **Vercel / Supabase / R2:** já em uso, dentro do plano gratuito. Cada PDF pesa algumas centenas de KB.
- **`pdf-lib`:** código aberto, MIT.
- **Envio do link:** WhatsApp pela sessão OpenWA que já temos, ou copiar o link. E-mail automático (Resend) fica opcional e **fora do escopo** desta fase.
- **Sem OTP:** o link vai só para o WhatsApp do cliente cadastrado, o que já comprova o recebimento.

### 3.7 Segurança e jurídico
- Token longo e aleatório já existe; adicionar **expiração e revogação**.
- Limite de tentativas na rota pública (por IP e por token).
- Texto congelado + hash + PDF com certificado: qualquer alteração posterior é detectável.
- É **assinatura eletrônica simples**, base MP 2.200-2/2001, art. 10, § 2º. Não é parecer jurídico; o texto dos modelos deve ser revisado por um advogado. Se um dia for preciso ICP-Brasil, entra como camada futura.

## 4. Fases (uma branch e um PR por fase; mesma regra das ondas)

1. **Fundação e correção:** migration; `contrato-assinatura.ts` com testes; consertar a rota `/assinar` (status, atomicidade, validação); tipos de notificação; trilha de eventos.
   *Pronto quando:* assinar rascunho ou contrato revogado retorna erro; duas assinaturas simultâneas gravam só uma; testes verdes.
2. **Envio:** `/enviar`, `/revogar`, texto congelado + hash, validade do link, botão Enviar com WhatsApp/copiar, marca de visualizado e aviso.
   *Pronto quando:* o cliente abre o link, a agência vê "visualizado", e editar o modelo depois não muda o texto enviado.
3. **PDF e contra-assinatura:** `contrato-pdf.ts` com testes, `/contra-assinar`, PDF no R2, certificado de evidências, download dos dois lados, integrações (CRM, ficha, Financeiro) movidas para depois da contra-assinatura.
   *Pronto quando:* o PDF abre com acentos corretos, traz as duas assinaturas e o hash confere com o texto.
4. **Arquivo no painel do cliente:** seção Documentos na ficha e no portal; lista com contadores e linha do tempo na aba Documentos.
   *Pronto quando:* o contrato assinado aparece na ficha do cliente com download.
5. **Propostas e acabamento:** aplicar envio/validade/visualizado também às propostas; tema escuro/claro na página pública; lembrete de contrato parado há N dias (opcional).

Cada fase termina com `tsc`, `vitest`, `next build`, harness de verificação com `fetch` simulado (sempre apagado) e conferência na tela real.

## 5. Testes previstos
- `contrato-assinatura.test.ts`: hash estável, `podeAssinar` por status/expiração/revogação, validação de CPF/CNPJ e nome.
- `contrato-pdf.test.ts`: gera PDF com acentos, lista e negrito, e a última página de evidências; hash do PDF não vazio.
- Rotas: assinatura dupla, token inexistente, contrato expirado, contra-assinar sem assinatura do cliente (deve recusar).

## 6. Decisões já tomadas e pendentes
- **Tomado:** sem OpenSign; assinatura própria; custo zero.
- **Sugestão (confirmar):** validade do link de 15 dias; só master contra-assina; assinatura da agência pré-cadastrada em Configurações > Agência; envio por WhatsApp como canal principal.
- **Pendente:** revisão jurídica dos 9 modelos de contrato; se o contrato assinado deve criar a mensalidade sozinho (hoje já cria, mantido); se o cliente recebe o PDF também por e-mail (exigiria Resend, ainda não incluído).

## 7. Riscos
- Gerar PDF a partir de HTML sem navegador exige o conversor de blocos do `contrato-pdf.ts`; estruturas muito complexas do editor (tabelas, imagens) ficam fora da primeira versão, e o editor deve limitar a formatação ao que o PDF suporta.
- O limite de tempo da função no Vercel gratuito (geração do PDF na contra-assinatura) deve ser conferido; o PDF é leve e deve caber com folga.
