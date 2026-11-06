# Plano: link do mês (roteiro e aprovação em um só lugar)

Status: **só plano**. Substitui o PDF que a agência manda hoje: um link aberto por cliente e por mês, onde a cliente vê o que está planejado e em aprovação, edita texto e aprova, no celular ou no computador.

## 1. O que já existe
- Link do feed do mês: `/aprovacao/feed/<token_aprovacao_mes>` (ferramenta MCP `link_aprovacao_mes`), com a lista `STATUS_VISIVEIS_AO_CLIENTE`.
- Link por post: `/aprovacao/[token]` com aprovar em 1 clique, pedir ajuste (por slide ou tempo do vídeo) e nome de quem aprovou.
- Cron de publicação que apaga demandas publicadas há 7 dias (`src/app/api/cron/publish-scheduled/route.ts`).

## 2. Regra de visibilidade (decidida)
O link é uma janela viva do mês: lê o status no momento em que abre. Mover o card no kanban já atualiza o link.

| Status da demanda | No link |
|---|---|
| Planejamento | Aparece **só com texto** (título da capa, roteiro/texto dos slides, legenda). Sem arte. |
| Criação, revisão interna | **Oculta.** |
| Aprovação (revisão do cliente) | Aparece **com a mídia pronta** ao lado do texto. |
| Agendado / publicado | Sai da aba principal e vai para a aba **Publicados**. |

Abas: **Para você** (planejamento + aprovação) e **Publicados** (contador "4 de 9 publicados", somente leitura, com permalink do Instagram quando houver).

## 3. Edição de texto (decidida)
Nunca sobrescreve direto: guarda o texto original e a proposta da cliente; a agência aceita ou recusa.
- **Planejamento:** a edição vira proposta de texto-base (barato, antes do design).
- **Aprovação:** a arte já foi feita; mudar título da capa ou texto de slide é **pedido de ajuste**, marcado como "a arte também muda".
- Aviso no sino e push para a agência a cada proposta; histórico por demanda.

## 4. Layout
- **Desktop:** três áreas. Lista de posts do mês (com status) · prévia (imagem, carrossel ou vídeo, reaproveitando o componente do link por post) · texto e ajustes.
- **Mobile:** cards na lista; ao tocar, post em tela cheia com mídia primeiro, depois roteiro em texto grande; barra fixa embaixo com **Aprovar** e **Pedir ajuste**; "anterior/próximo" para percorrer os posts; botão "copiar roteiro" e "modo leitura" (fonte maior) para gravar. Alvos de toque de 44px.

## 5. Mês e token
O link carrega o mês (`/aprovacao/mes/<token>?m=2026-11` ou token por mês) para novembro não virar dezembro. Token longo e aleatório, com **revogar e renovar** na ficha do cliente. Mostra só os status visíveis; nunca dados de outros clientes.

## 6. Retenção (fase 3 entregue)
Descoberta na implementação: a mídia **já é apagada do armazenamento no instante da publicação** (todos os caminhos de publicar esvaziam `arquivos`). Por isso não existe "mídia por 7 dias"; a aba Publicados mostra só o texto e avisa que os arquivos foram arquivados.
- **Texto:** a demanda publicada fica disponível por **30 dias** (padrão) e depois é excluída de vez. Prazo por cliente em `clientes.retencao_texto_dias` (7 a 365; vazio = 30). A tela para editar esse prazo entra na fase 4.
- A limpeza roda a cada chamada do cron de publicação, inclusive quando não há nada a publicar (antes só rodava quando havia posts vencidos) e apaga qualquer mídia que tenha sobrado.
- Em aberto: guardar o link do post no Instagram (permalink) na demanda para a aba Publicados mostrar o post real. Hoje o link é calculado na publicação e não é salvo.

## 7. Fases (um PR por fase)
1. **Tela do mês, leitura e aprovação:** rota, regra de visibilidade por status, abas Para você/Publicados, layout desktop e mobile, aprovar e pedir ajuste reaproveitando o que existe.
2. **Edição como proposta:** tabela de propostas de texto (original, novo, autor, status), aceitar/recusar na esteira, notificações.
3. **Retenção:** texto por 30 dias com prazo por cliente, limpeza no cron (mídia já é apagada na publicação).
4. **Acabamento:** campo de prazo de retenção por cliente, revogar/renovar link, "copiar roteiro" e modo leitura, copiar o link do mês da ficha do cliente e do MCP.

## 8. Decisões pendentes
- Guardar o permalink do Instagram para a aba Publicados (ver seção 6).
- Se a cliente vê o status "em planejamento" ou só "texto para revisar".
- Se aceitar uma proposta de texto em planejamento já deixa a demanda como aprovada ou só atualiza o texto.
