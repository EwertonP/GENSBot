# Typebot → CRM do GENSBot (pré-qualificação)

Endpoint: `POST /api/crm/inbound/typebot` (separado do `/api/crm/inbound/webhook`, que continua aberto para anúncios).

## Variáveis de ambiente (Vercel)
- `CRM_INBOUND_TYPEBOT_SECRET` (obrigatória): segredo longo e aleatório. Sem ele o endpoint responde 503.
- `CRM_INBOUND_AGENCIA_ID` (opcional): agência dona dos leads. Sem ela usa a primeira agência.
Depois de criar as variáveis, é preciso novo deploy.

## No Typebot
1. Pergunte, nesta ordem, e guarde cada resposta em uma variável: `nome`, `whatsapp`, `email` (opcional), `empresa` (opcional), `nicho`, `dor`, `faturamento` (opcional), `investimento`, `como_conheceu`.
2. Variáveis ocultas pela URL do formulário (opcionais): `utm_source`, `utm_medium`, `utm_campaign`. Um bloco "Set variable" com "Result ID" guarda o id em `result_id`.
3. No final, um bloco **HTTP Request**:
   - Método `POST`, URL `https://SEU-GENSBOT/api/crm/inbound/typebot`
   - Header `x-gens-secret: <o segredo>` e `Content-Type: application/json`
   - Body (JSON) com as variáveis do Typebot:
     `{ "nome": "{{nome}}", "whatsapp": "{{whatsapp}}", "email": "{{email}}", "empresa": "{{empresa}}", "nicho": "{{nicho}}", "dor": "{{dor}}", "faturamento": "{{faturamento}}", "investimento": "{{investimento}}", "como_conheceu": "{{como_conheceu}}", "utm_source": "{{utm_source}}", "utm_medium": "{{utm_medium}}", "utm_campaign": "{{utm_campaign}}", "result_id": "{{result_id}}" }`
4. Depois do HTTP Request, o bloco **Redirect** para `https://wa.me/55NUMERO?text=Oi, sou {{nome}}. {{dor}}`.

## O que acontece no CRM
- Cria um negócio no primeiro estágio do funil padrão, origem "site", prioridade alta, etiquetas `Typebot` e `Nicho: ...`.
- As respostas ficam numa nota na linha do tempo (e em `dados_extras`).
- Mesmo telefone em negócio **aberto**: não duplica; adiciona a nota e a etiqueta `Typebot`.
- Respostas: 201 criado, 200 já existia (`duplicado: true`), 400 dados inválidos, 401 senha errada, 503 segredo não configurado.

## Limites conhecidos
- Quem abandona o formulário antes do HTTP Request não chega ao CRM (as respostas parciais ficam só no Typebot).
- Valores numéricos chegam como texto; o CRM guarda como texto na nota e não preenche o campo "valor" do negócio.
