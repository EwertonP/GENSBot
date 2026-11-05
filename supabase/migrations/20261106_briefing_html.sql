-- Descrição (briefing) com formatação: guarda o HTML do editor rico.
-- `briefing` continua com o texto puro, que MCP, WhatsApp, Notion e a aprovação já leem.
alter table conteudo_items add column if not exists briefing_html text;
