# Auditoria mobile (375px) — 2026-11-04

Método: produção (allingens.vercel.app) no navegador do app a 375x812, com uma sonda que mede overflow horizontal, altura dos controles, alvos < 40px, irmãos com alturas diferentes, controles órfãos quebrados em linha, texto < 12px e texto truncado. Somente leitura. Cliente de teste: @camilalucas_adv.

Legenda: P1 = quebra a organização/uso, P2 = inconsistência visível, P3 = polimento.

## Resultado por tela

| Tela | Overflow | Principais achados |
|---|---|---|
| Demandas (esteira) | não | Sem pendências graves após Fase C. |
| Demanda aberta (sheet) | não | P2: cabeçalho ainda alto; chips e botões irregulares na ficha. |
| Clientes / ficha | não | P2: chips e botões com larguras irregulares na ficha do cliente. |
| Agendamentos | não | Passos 2–4 ainda não auditados. |
| Automações (lista) | não | P2: botão "Criar Novo Fluxo" quebra em duas linhas; nomes truncados nos cards. |
| Automação aberta | não | P1: campo "Nome do Fluxo" 33px de altura (alvo pequeno). P1: botão "Adicionar" cortado ("Adiciona") ao lado do campo de resposta. P2: "Salvar Fluxo" com 110/301px, órfão. P2: select "Contém a palavra-chave" 42px vs 40px dos irmãos. P3: textarea da mensagem inicial com altura fixa pequena, corta o texto. |
| Audiência e leads | não | P1: select "Filtrar por tag" 38px, abaixo do padrão 40/44. P2: cartões de lead repetem linhas vazias (E-mail "—", Telefone "—"); esconder campos vazios. P2: "Exportar CSV" solto, sem alinhamento com o filtro. |
| CRM | **sim** | P1: overflow horizontal na página. P1: seletores "Vendas…" (32px), "Em Aberto" (36px) e "Todos os Responsáveis/Origens" (36px) abaixo de 40px e com alturas diferentes. P2: cabeçalho com 4 controles em linha apertada. |
| Equipe | não | P2: "Cadastrar Membro" ocupa 175 de 343px (órfão, deveria ser largura total). P2: ações do cartão (Editar / Desativar / lixeira) com pesos diferentes. P3: e-mails truncados. |

## Correções prioritárias

1. **CRM:** achar o elemento que estoura a largura (provável kanban/tabela dentro do container sem `min-w-0`/`overflow-x-auto` interno) e padronizar os 4 seletores em `Select` de 40px (44 no toque), em linha única `FilterBar`.
2. **Alvos pequenos:** subir "Nome do Fluxo", "Filtrar por tag" e os selects do CRM para o tamanho `md` do `Button`/`Input` (40, 44 no toque).
3. **Automação aberta:** campo + botão "Adicionar" empilhados no mobile (`ActionBar`), "Salvar Fluxo" em largura total, textarea da mensagem com altura mínima maior.
4. **Botões órfãos:** "Criar Novo Fluxo" e "Cadastrar Membro" com `block` no mobile.
5. **Audiência:** ocultar campos vazios nos cartões, alinhar "Exportar CSV" na `FilterBar`.
6. **Placeholders de carregamento enganosos:** "0 demandas" e "Selecione uma conta específica" aparecem antes dos dados chegarem; trocar por skeleton.
7. **Ficha do cliente e demanda aberta:** `MetaGrid` e `SheetHeader` compactos (itens da Fase C ainda pendentes).
8. **Dashboard:** toggle com altura diferente dos vizinhos.

## Ainda não auditado

Modal de item do calendário, Agendamentos passos 2–4, ficha do lead, drawer de negócio do CRM, edição de membro e aba Produtividade, drawer "Mais", sheet de notificações, popover de perfil, paleta de comandos, sheets Criar/filtros, formulário de nova demanda, páginas públicas (login, aprovação, relatório, formulário).

## Observação

Esta auditoria é de produção; a logo/ícone novos e a remoção do "2.0" estão na branch `feat/logo-e-icone-novos`, ainda não mesclada.
