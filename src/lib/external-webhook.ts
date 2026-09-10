/** Disparador de Webhook Externo (Make, Zapier, etc.) configurado em `automations.webhook_url`.
 * Extraído de src/app/api/webhook/route.ts (caminho legado) pra ser reaproveitado também
 * pelo motor de fluxo novo (src/lib/flow-engine/runner.ts), que antes nunca chamava isso. */
export async function triggerExternalWebhook(url: string, contact: any, auto: any) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: 'lead_captured',
        automation: {
          id: auto.id,
          name: auto.name
        },
        contact: {
          instagram_id: contact.instagram_id,
          username: contact.username,
          email: contact.email,
          phone: contact.phone,
          timestamp: new Date().toISOString()
        }
      })
    });
  } catch (err) {
    console.error('Falha ao disparar webhook externo:', err);
  }
}
