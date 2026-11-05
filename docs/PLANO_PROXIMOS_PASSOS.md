# Plano dos próximos passos (nov/2026 em diante)

Regra para tudo: **cada item entra no celular e no desktop juntos**, e cada rodada termina com mesclar, fazer deploy e conferir nas telas reais antes de começar a seguinte.

## Situação hoje (04/11/2026)

| Item | Estado |
|---|---|
| Logo/ícone novos, forma pílula, PageHeader (#206) | na `main` |
| Demanda: barra de comandos + chips + "Enviar para aprovação" (#207) | na `main` |
| Paridade desktop do PageHeader e da demanda + docs (#208) | PR aberto, falta conferir |
| Financeiro MVP (#209) | PR aberto, **migration não aplicada** |
| Correções da auditoria mobile | **não feitas** |
| Tela de demanda "réplica do Orkestrya" | **não feita** (especificada abaixo) |

## Semana 1: fechar o que está aberto

1. Mesclar #208 e conferir no celular e no desktop (PageHeader, demanda aberta).
2. Aplicar a migration do Financeiro, mesclar #209 e testar com um cliente real (mensalidade → lançamento → marcar recebido).
3. **Correções da auditoria** (docs/AUDITORIA_MOBILE.md):
   - CRM: scroll horizontal e os 4 seletores abaixo de 40px.
   - Automação aberta: campo "Nome do Fluxo" (33px), botão "Adicionar" cortado, "Salvar Fluxo" solto.
   - Audiência: filtro por tag (38px), cartões sem campos vazios.
   - Automações e Equipe: botões soltos em largura total.
   - Skeleton nos placeholders enganosos ("0 demandas").
4. Atualizar `PLANO_MOBILE.md` marcando o que foi concluído.

## Semanas 2 a 3: a tela de demanda (prioridade máxima)

A especificação está na seção seguinte. Entregas, nesta ordem:

- **2a.** Editor rico (descrição e legenda) trocando as áreas de texto atuais.
- **2b.** Sheet reorganizado: título grande, chips, descrição, legenda, anexos, comentários, card de propriedades.
- **3a.** Chips com seletores: tipo, cliente, responsáveis, etiquetas, prioridade, prazo, data de postagem.
- **3b.** Criar enxuto (só título, chips, descrição, legenda e anexos) e editar completo.
- **3c.** Menu "⋯" completo (duplicar, mover de quadro, repetir, copiar link, arquivar, excluir).

## Semana 4: Financeiro, segunda rodada

- Contas (onde o dinheiro está) e saldo geral; categorias editáveis com meta mensal.
- Despesa recorrente (aluguel, ferramentas) com projeção.
- Aba "A pagar e receber" e relatório de despesas por categoria.
- Cobrança: botão no lançamento atrasado que abre mensagem pronta para o cliente.
- Cronômetro por demanda (alimenta custo por cliente).

## Semana 5: Propostas e Contratos

- Modelos por serviço (partir dos 9 modelos do Orkestrya: redes sociais, tráfego, Marketing 360, conteúdo, audiovisual, branding, site).
- Dados da agência como CONTRATADA (aviso quando faltam CNPJ, endereço, PIX).
- Status (rascunho, aguardando cliente, assinado), renovação e link para o cliente.
- Ligação com o CRM: entrar em "Proposta" cria a proposta.

## Semana 6: Cliente e portal

- Ficha do cliente por abas + índice de Saúde (0 a 100) + Central Estratégica (persona, concorrentes, posicionamento).
- Interruptores "Visível para o cliente" e "Aguardando informação do cliente" na demanda.
- Sheet de aprovação com regras pós-resposta (mover de coluna conforme Aprovado, Alteração, Reprovado).
- Foto do cliente em dois temas.

## Depois (backlog)

Meu Dia, Histórico de atividades, setores/cargos/permissões por função, metas do mês no Comercial, chat interno, Plano de Mídia, Mapa Mental, Funil, Central de Ajuda.

Dívida técnica paralela: limpar ~186 hex e ~190 cores Tailwind cruas, renomear `--lime` para um nome neutro, regra de lint para componentes de tela.

---

# Réplica da tela de demanda (Orkestrya)

Fonte: demanda aberta e "Nova demanda" no Orkestrya, vistas no celular. Os seletores foram conferidos em 05/11/2026.

## Estrutura da tela (de cima para baixo)

1. **Sheet com alça** (bottom sheet no celular; modal largo no desktop).
2. **Rótulo + ações:** "DEMANDA · ETAPA" (ou "NOVA DEMANDA") e botões redondos: concluir ✓, adicionar capa, ⋯, automações da demanda, fechar. Ao criar só aparecem capa e fechar.
3. **Barra de comandos fixa:** Excluir (vermelho, ícone), Cancelar, Salvar (primário). Já feita no #207.
4. **Título grande** editável.
5. **Chips numa linha:** formato (Post, Reels, Carrossel, Story), tipo (Demanda), cliente (só ao criar; "Trocar" ao editar), responsáveis (avatar), **Etiqueta**.
6. **Descrição (briefing)** com o editor rico.
7. **Legenda** com editor próprio.
8. Anexos.
9. Comentários.
10. **Card de ação e propriedades:** "Enviar para aprovação", cronômetro, lista Coluna / Prioridade / Tipo / Datas / Postagem.
11. Interruptores do cliente.

## Editor rico (o "bloco onde você digita")

Barra de ferramentas da **descrição**, da esquerda para a direita: desfazer, refazer, | **tamanho do texto** (T, H2, H3), | negrito, itálico, sublinhado, tachado, destaque (marca-texto), | lista com marcadores, lista numerada, citação, divisória (digitar `--` cria a linha). Placeholder: "Escreva o briefing da demanda. Dica: -- cria uma linha divisória." Limite de 5.000 caracteres.

Barra de ferramentas da **legenda**: emoji, lista, `#` (inserir hashtag), A (maiúsculas), α (minúsculas), Aa (capitalizar), negrito e itálico (em unicode, para funcionar no Instagram), "↔" (inserir espaço invisível/quebra), inserir imagem. Rodapé: "Salvar como padrão" (legenda base do cliente) e **contador por rede** (Instagram 0/2200). Aviso: "Tudo o que for escrito aqui será considerado na aprovação de posts e no agendamento."

**Como construir:** biblioteca de editor (Tiptap, que roda sobre ProseMirror) com as extensões de negrito, itálico, sublinhado, tachado, destaque, cabeçalhos, listas, citação e linha horizontal. A descrição fica salva como HTML sanitizado (nova coluna `briefing_html`, mantendo `briefing` em texto simples para busca, MCP e WhatsApp). A legenda continua texto puro (o Instagram não aceita formatação), com negrito/itálico convertidos em caracteres unicode. A barra vira um componente `EditorBarra` reutilizável.

## Anexos (post, carrossel, vídeo)

Botão "mídia" e "Google Drive" no sheet de aprovação; no card, o anexo mostra miniatura com contagem. Aceita imagens (carrossel com ordem arrastável), vídeo e link do Drive. A aprovação exige ao menos uma mídia ou link. No GENSBot já existe upload para o R2; a mudança é de organização (miniaturas ordenáveis, contador, validação).

## Layout no desktop (visto com a janela larga)

Modal centralizado, **duas colunas**:
- **Coluna esquerda (rola):** descrição, legenda, **Anexos** (Arquivo, Link, Google Drive), **Checklists** ("Nova checklist" e "Trazer da aba Checklist"), e um bloco com abas **Comentários / Histórico / Aprovação** (comentário com `@` para marcar alguém, emoji, imagem, enviar).
- **Coluna direita:** cartão escuro com "Enviar para aprovação", cronômetro e as propriedades (**Coluna, Prioridade, Tipo, Datas, Postagem**), e abaixo os dois interruptores do cliente com a explicação.
- **Rodapé fixo:** Excluir (contorno vermelho) à esquerda; Cancelar e Salvar à direita. No topo: "Concluir" (✓ verde), capa, ⋯, automações, fechar.
No celular as duas colunas viram uma só, na mesma ordem.

## Etiquetas, prioridade, responsáveis, tipo, datas (conferido)

- **Etiqueta:** abre um popover "Etiquetas: crie etiquetas para organizar as demandas do seu jeito" com **"+ Criar etiqueta"** (cor e nome).
- **Responsável:** popover com busca simples de membros e a opção **"Ninguém"**; mostra o avatar no chip.
- **Prioridade:** **Sem prioridade / Alta (vermelho) / Média (amarelo) / Baixa (verde)**, na linha "Prioridade" do cartão.
- **Tipo:** lista **personalizável** (ex.: REELS, com cor) com **"Gerenciar tipos"**; é diferente do formato do primeiro chip (Post). No GENSBot corresponde às categorias/nichos do cliente.
- **Datas:** linhas "Datas" (prazo) e "Postagem" (data de publicação), cada uma abre calendário.
- **Power-ups (ícone de raio):** automações **do card**: "Nenhum power-up ainda. Automações que rodam sozinhas quando algo acontece neste card. Ex.: quando o card entrar em Aprovação, atribuir um responsável e mandar o link pro cliente." Botão "+ Novo power-up". Existe também o power-up **da coluna**.
- **Concluir:** botão verde no topo marca a demanda como concluída sem mover de coluna.

## Mudanças de dados

- `conteudo_items.briefing_html text` (descrição rica).
- Etiquetas: tabela `etiquetas (id, agencia_id, nome, cor)` e `conteudo_etiquetas (conteudo_id, etiqueta_id)`.
- Nada mais muda: prioridade, responsáveis e datas já existem.

## Ordem de construção

1. Instalar o Tiptap, criar `EditorBarra` e `EditorRico`; trocar só o campo de descrição; migrar texto antigo para parágrafos.
2. Trocar a legenda (barra própria, contador, "Salvar como padrão").
3. Reorganizar o sheet na ordem acima; propriedades em lista; chips com seletores.
4. Etiquetas (tabela, seletor, filtro no quadro).
5. Criar enxuto vs editar completo; menu "⋯".
6. Teste de ponta a ponta no celular e no desktop: criar, editar, anexar, enviar para aprovação.

## Pendente de conferir no Orkestrya
- Carrossel com várias mídias (ordem e miniaturas): precisa de arquivo para enviar.
- Abas **Histórico** e **Aprovação** do bloco de comentários com a demanda já movimentada.
