# Plano: Contratos e Propostas (réplica do Orkestrya)

Status: **só plano**, nada implementado. Base: inspeção do Orkestrya em 05/11/2026 (somente leitura: nenhum contrato ou proposta foi criado ou enviado lá). Este documento detalha o item 5 do `BACKLOG_COMPLETO.md`.

## 1. Objetivo

Dentro do GENSBot a agência cria modelos de contrato e de proposta com variáveis, pré-visualiza exatamente como o cliente vai ver, envia por **link público**, o cliente lê e assina na própria página, a agência contra-assina e o documento assinado fica guardado.

## 2. O que o Orkestrya faz (referência)

### 2.1 Modelos (Configurações > Modelos)
- Abas: Contratos, Propostas, Manual do cliente, Quadros.
- Cards com "Editar" e lixeira. Um modelo é o **Padrão** (contrato padrão é usado pela automação que gera o contrato quando a proposta é aceita; proposta padrão vem pré-selecionada).
- 9 modelos de contrato e 11 de proposta prontos por serviço: Redes Sociais, Instagram, Redes + Tráfego, Marketing 360, Tráfego Pago, Produção Audiovisual, Identidade Visual, Site e Landing Page, Criação de Conteúdo (proposta ainda tem Comercial Padrão e Consultoria).
- "Gerar modelo pronto" (guiado) e "Novo modelo".
- Aviso no topo quando faltam dados da agência (CNPJ, endereço, e-mail, telefone, PIX), porque entram como CONTRATADA em todo contrato.

### 2.2 Editor
- Duas colunas. Esquerda: editor rico (negrito, itálico, sublinhado, título, lista, lista numerada) com as variáveis como chips laranja `{{Razão social}}`. Direita: painel **Variáveis** ("clique pra inserir onde o cursor estiver").
- Variáveis do contrato:
  - Contratante (cliente): razão social, nome do contato, CNPJ/CPF, endereço, e-mail, telefone.
  - Contratada (agência): razão social, CNPJ, endereço, e-mail, telefone, chave PIX.
  - Serviço: nome, escopo, valor, período, data de início, data de renovação.
  - Proposta de origem: número da proposta.
  - Data: data de hoje.
- Variáveis extras da proposta: título, número, investimento (valor, periodicidade e prazo), valor mensal, prazo do contrato, valor por período e prazo (sem total), condição de pagamento, entrada/setup, válida até.
- Marca d'água, cabeçalho e rodapé por upload (PNG, JPG, WEBP); na proposta só cabeçalho e rodapé.
- Botões "Pré-visualizar" e "Salvar modelo"; "Usar como modelo padrão".
- Texto em linguagem simples, cláusulas numeradas (objeto, como o trabalho acontece, compromissos, investimento, suspensão, cancelamento, disposições finais, foro).

### 2.3 Pré-visualização (a página do cliente)
- Rota própria (`.../preview`) com aviso "Pré-visualização com dados de exemplo, é assim que o cliente vê" e "Voltar pro editor".
- Capa escura com gradiente âmbar, selo ("Contrato digital" / "Proposta comercial"), título grande, "Preparado para [cliente]" e a linha "Leia e assine direto nesta página" (proposta: "Aceite direto nesta página").
- Cartão de investimento: nome do serviço, tipo de cobrança, valor; grade com início, renovação, condição, entrada/setup; chips de formas de pagamento (PIX, Boleto).
- Corpo em seções numeradas com ícone. Proposta usa componentes: metodologia em cards 1-2-3, motivos em grade 2x2, passos em lista. Contrato usa cláusulas 1.1, 1.2... com listas.
- Linha do tempo do contrato: início, renovação, renova automático.
- Fim: frase de assinatura eletrônica ("registrada com nome, documento, data e hora"), bloco "O começo da nossa jornada", três selos (Assinatura eletrônica, Força legal citando art. 10, § 2º da MP 2.200-2/2001, Linguagem acessível) e o quadro **As partes**.
- Quadro "As partes": contratante com CNPJ, representante, endereço, e-mail, telefone e a nota "assina ao final desta página"; contratada com a nota "contra-assina após a sua assinatura".

### 2.4 Listas e criação
- Telas **Contratos** e **Propostas** com cartão de valor total e contadores.
  - Contratos: Assinados, Aguardando cliente, Sua assinatura, Rascunhos, Renovam em 30 dias, Renovação vencida; mais "Gerenciar modelos" e "Novo contrato".
  - Propostas: Aceitas, Em andamento, Enviadas, Vencem em 7 dias, Recusadas, Vencidas; mais seção "Modelos de proposta".
- "Novo contrato": cliente (obrigatório), serviço contratado (obrigatório), escopo, valor, período (mensal etc.), data de início, data de renovação, modelo de contrato.
- Ciclo de status deduzido dos contadores: rascunho, aguardando cliente, aguardando a agência (contra-assinatura), assinado, e depois renovação. **Não testado** o envio real por link.

## 3. Como ficará no GENSBot

### 3.1 Telas (celular e desktop juntos)
| Tela | Conteúdo |
|---|---|
| Contratos | PageHeader, cartão de valor assinado, 6 contadores, lista por status, botão "Novo contrato", "Gerenciar modelos". |
| Propostas | Mesmo padrão, com contadores de proposta e conversão para contrato. |
| Modelos (Configurações) | Abas Contratos e Propostas, cards com Padrão, editar, duplicar, excluir. |
| Editor de modelo | Tiptap (já usamos no `EditorRico`) + painel de variáveis (no celular vira Sheet), upload de marca d'água/cabeçalho/rodapé, "Pré-visualizar", "Salvar". |
| Pré-visualização | Mesma página pública, com dados de exemplo e aviso. |
| Página pública do cliente | `/c/[token]` (contrato) e `/p/[token]` (proposta), sem login. |
| Contra-assinatura | Na lista, ação "Assinar como agência" quando o cliente já assinou. |

Visual: dark neutro e menta do GENSBot (não copiar o âmbar do Orkestrya). Página pública respeita tema claro/escuro do aparelho.

### 3.2 Modelo de dados (migrations aditivas, só com autorização)
- `documento_modelos`: `id`, `agencia_id`, `tipo` (`contrato`|`proposta`), `nome`, `conteudo_html`, `padrao`, `marca_dagua_url`, `cabecalho_url`, `rodape_url`, timestamps.
- `contratos`: `id`, `agencia_id`, `cliente_id`, `proposta_id` (opcional), `modelo_id`, `numero`, `servico`, `escopo`, `valor`, `periodo`, `data_inicio`, `data_renovacao`, `renova_automatico`, `status` (`rascunho`|`enviado`|`assinado_cliente`|`assinado`|`cancelado`), `conteudo_html_final` (variáveis já resolvidas, congelado no envio), `token_hash`, `enviado_em`, `expira_em`.
- `propostas_comerciais` (ou reaproveitar tabela existente se já houver): campos equivalentes, `status` (`rascunho`|`enviada`|`aceita`|`recusada`|`vencida`), `valida_ate`, entrada/setup, condição de pagamento.
- `assinaturas`: `id`, `documento_tipo`, `documento_id`, `parte` (`cliente`|`agencia`), `nome`, `documento` (CPF/CNPJ), `email`, `ip`, `user_agent`, `assinado_em`, `hash_documento`, `imagem_assinatura` (opcional).
- Os campos de agência (razão social, CNPJ, endereço, e-mail, telefone, PIX) ficam em Configurações > Agência; aviso de "dados incompletos" bloqueia o envio.

### 3.3 Variáveis
Mesma lista do Orkestrya, com chaves `{{contratante.razao_social}}` etc. renderizadas por função pura em `src/lib/documentos.ts`. Variável sem valor fica marcada em vermelho na prévia e **bloqueia o envio**. Ao enviar, o HTML é resolvido e congelado em `conteudo_html_final` (editar o modelo depois não altera o que o cliente assinou).

### 3.4 Envio por link
1. Agência clica "Enviar": o sistema gera token longo e aleatório (só o hash vai ao banco), define validade e copia o link `/c/<token>`.
2. Opcional: envia o link pelo WhatsApp da agência (Kapso, já conectado) e registra no histórico.
3. Cliente abre sem login, lê, preenche nome, documento e e-mail, marca "Li e concordo" e assina. Registrar data, hora, IP e user agent, mais o **hash SHA-256** do documento congelado.
4. Status vira `assinado_cliente`; a agência recebe notificação (sino, push) e contra-assina em um clique (assinatura da agência pré-cadastrada).
5. Ao ficar `assinado`, gerar o **PDF assinado** com carimbo e página de evidências (quem, quando, IP, hash), guardar no R2 e liberar o download para as duas partes.
6. Proposta aceita pode gerar o contrato padrão já preenchido (equivalente à automação do Orkestrya).

### 3.5 Assinatura: o repositório que você vai buscar
Critérios para escolher a biblioteca/serviço antes de implementar:
- Roda em Next.js sem servidor próprio dedicado (Vercel) e funciona bem no celular.
- Gera PDF com carimbo e página de evidências; guarda hash e trilha de auditoria.
- Licença permissiva (MIT/Apache); sem custo por documento, ou custo previsível.
- Assinatura eletrônica simples (nome + aceite + evidências) cobre o caso da agência, com base na MP 2.200-2/2001, art. 10, § 2º (aceite entre as partes). Se um dia for preciso ICP-Brasil/certificado digital, é outra camada.
- Quando você trouxer o link, avalio o encaixe e descrevo a integração (adaptador `assinatura.ts` para trocar o provedor sem mexer nas telas).

> Aviso: o texto jurídico dos modelos deve passar por revisão de um advogado antes de uso com clientes reais.

## 4. Fases

1. **Fundação:** dados da agência completos + migrations (`documento_modelos`, `contratos`, `assinaturas`) + biblioteca de variáveis e testes (vitest).
2. **Modelos e editor:** abas em Modelos, editor com chips e painel de variáveis, upload de marca d'água/cabeçalho/rodapé, modelo padrão, modelos iniciais por serviço.
3. **Pré-visualização e página pública:** componentes da capa, cartão de investimento, linha do tempo, quadro "As partes"; rota `/c/[token]` com sessão anônima e proxy público.
4. **Assinatura:** formulário, evidências, hash, contra-assinatura, PDF assinado no R2, notificações.
5. **Propostas:** mesma base, aceite/recusa, validade, conversão automática em contrato.
6. **Listas e métricas:** telas Contratos/Propostas com contadores, renovações em 30 dias, vínculo com o Financeiro (mensalidade do cliente nasce do contrato assinado).

Cada fase: branch própria a partir da `main`, celular e desktop juntos, `tsc`, `vitest` e `next build` verdes, PR e verificação na tela real antes da próxima (mesma regra das ondas).

## 5. Segurança e privacidade
- Token longo, só hash no banco, expiração e revogação; limite de tentativas na rota pública.
- Página pública mostra só o documento daquele token; nunca dados de outros clientes.
- Documento congelado + hash: qualquer alteração depois da assinatura é detectável.
- Dados pessoais (CPF/CNPJ, IP) com acesso restrito à agência; sem aparecer em URLs.

## 6. Decisões que dependem de você
- Qual biblioteca/serviço de assinatura usar (você vai trazer o repositório).
- Assinatura desenhada (traço na tela) ou só nome digitado + aceite.
- Validade padrão do link (sugestão: 15 dias).
- Quem pode enviar/contra-assinar (só master ou também a equipe).
- Quais modelos iniciais criar primeiro (sugestão: Redes Sociais e Redes + Tráfego Pago) e quem revisa o texto jurídico.
- Se o contrato assinado já cria a mensalidade no Financeiro automaticamente.

## 7. Não verificado
- O envio real por link no Orkestrya (status "enviado", e-mail/WhatsApp automáticos, lembretes), a tela de contra-assinatura e o PDF final não foram testados para não criar dados na conta deles. Conferir com um contrato de teste se precisar de fidelidade nesses pontos.
