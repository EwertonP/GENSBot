export default function Privacidade() {
  return (
    <div className="min-h-screen bg-background text-muted-foreground font-sans p-6 md:p-16 flex flex-col justify-center items-center">
      <div className="max-w-2xl w-full bg-card/30 border border-border/60 rounded-3xl p-8 backdrop-blur-md">
        <h1 className="text-2xl font-bold text-foreground mb-6">Política de Privacidade</h1>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            Esta política de privacidade descreve como o GENSBot, uma aplicação própria de automação de Instagram, coleta, usa e protege as informações de contas conectadas e de quem interage com elas.
          </p>
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-1">1. Dados coletados ao conectar sua conta</h2>
            <p>
              Ao conectar uma conta profissional do Instagram, coletamos o ID de usuário da Meta, nome de usuário, nome de exibição e foto de perfil, usados para identificar a conta dentro do painel e permitir o processamento das automações.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-1">2. Dados de quem interage com a conta conectada</h2>
            <p>
              Processamos comentários públicos e mensagens diretas (DM) recebidas pela conta conectada, coletando o ID de usuário da Meta, nome de usuário e o texto do comentário/mensagem, para fins de correspondência de palavras-chave e disparo das automações configuradas.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-1">3. Dados de contato capturados via automação</h2>
            <p>
              Quando uma automação está configurada para solicitar e-mail e/ou telefone (captura de lead), armazenamos essas informações fornecidas voluntariamente pelo usuário durante a conversa, para fins de geração de leads da conta conectada.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-1">4. Uso dos Dados</h2>
            <p>
              Os dados coletados são usados exclusivamente de forma automatizada para disparar as respostas configuradas (públicas, privadas e sequências de acompanhamento) e para exibir métricas de desempenho no painel do administrador da conta. Não usamos esses dados para fins publicitários nem compartilhamos com terceiros.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-1">5. Retenção e Exclusão</h2>
            <p>
              Os dados de contato ficam armazenados enquanto a automação estiver ativa. Qualquer pessoa pode solicitar a exclusão completa dos seus dados a qualquer momento — veja as instruções na página de <a href="/exclusao-de-dados" className="text-primary hover:underline">Exclusão de Dados</a>.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-1">6. Segurança</h2>
            <p>
              Todas as credenciais e acessos são armazenados em servidor seguro hospedado no Supabase com Row Level Security (RLS) habilitado e chaves privadas restritas ao ambiente de execução.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-1">7. Conformidade com a Plataforma Meta</h2>
            <p>
              O uso de dados do Instagram por este aplicativo segue as Políticas da Plataforma Meta e os Termos da API do Instagram. Consulte também nossos <a href="/termos" className="text-primary hover:underline">Termos de Uso</a>.
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
