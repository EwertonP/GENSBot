// Envio de e-mail via API do Resend. Chamada direta por fetch em vez do SDK
// pra não adicionar mais uma dependência só por isso.
export async function sendEmail(params: { to: string; subject: string; text: string; html?: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY não configurada — e-mail não enviado.');
    return { ok: false, error: 'RESEND_API_KEY ausente' };
  }

  // Em contas Resend sem domínio verificado, o remetente precisa ser o
  // endereço sandbox padrão (só entrega pro e-mail que criou a conta Resend).
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.com';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      text: params.text,
      html: params.html,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error('Erro ao enviar e-mail via Resend:', errData);
    return { ok: false, error: errData.message || 'Erro desconhecido do Resend' };
  }

  return { ok: true };
}
