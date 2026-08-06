export default function Termos() {
  return (
    <div className="min-h-screen bg-background text-muted-foreground font-sans p-6 md:p-16 flex flex-col justify-center items-center">
      <div className="max-w-2xl w-full bg-card/30 border border-border/60 rounded-3xl p-8 backdrop-blur-md">
        <h1 className="text-2xl font-bold text-foreground mb-6">Termos de Uso</h1>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            Estes termos regem o uso do GENSBot, uma aplicação própria de automação de Instagram. Ao conectar uma conta do Instagram ou criar uma automação, você concorda com as condições abaixo.
          </p>
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-1">1. Descrição do Serviço</h2>
            <p>
              O GENSBot permite configurar respostas automáticas a comentários e mensagens diretas (DM) recebidas em uma conta profissional do Instagram conectada, incluindo respostas públicas, envio de links e sequências de mensagens de acompanhamento.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-1">2. Responsabilidades do Usuário</h2>
            <p>
              Você é responsável por garantir que a conta conectada seja uma conta profissional do Instagram sob sua administração, e que o conteúdo das automações configuradas (mensagens, palavras-chave, links) esteja de acordo com a lei aplicável e com as Políticas da Plataforma Meta e Diretrizes da Comunidade do Instagram.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-1">3. Uso Aceitável</h2>
            <p>
              É proibido usar o serviço para envio de spam, conteúdo enganoso, discurso de ódio, ou qualquer prática que viole os termos da Meta para desenvolvedores. Reservamo-nos o direito de suspender contas que violem estas condições.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-1">4. Limitação de Responsabilidade</h2>
            <p>
              O GENSBot depende da disponibilidade e das políticas da API do Instagram/Meta, que estão fora do nosso controle. Não nos responsabilizamos por interrupções, alterações de permissão, ou suspensão de conta decorrentes de ações da Meta.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-1">5. Alterações</h2>
            <p>
              Podemos atualizar estes termos periodicamente. A data da última atualização está indicada ao final desta página.
            </p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-8 border-t border-border/60 pt-4">
          Última atualização: Agosto de 2026.
        </p>
      </div>
    </div>
  );
}
