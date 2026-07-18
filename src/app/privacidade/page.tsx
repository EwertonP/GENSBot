export default function Privacidade() {
  return (
    <div className="min-h-screen bg-[#07060E] text-zinc-305 font-sans p-6 md:p-16 flex flex-col justify-center items-center">
      <div className="max-w-2xl w-full bg-zinc-900/30 border border-zinc-850/60 rounded-3xl p-8 backdrop-blur-md">
        <h1 className="text-2xl font-bold text-white mb-6">Política de Privacidade</h1>
        <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
          <p>
            Esta política de privacidade descreve como nossa aplicação própria de automação de Instagram coleta, usa e protege as informações de interações.
          </p>
          <div>
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wide mb-1">1. Coleta de Informações</h2>
            <p>
              Processamos interações públicas de comentários e DMs recebidas em nossa conta de teste ou profissional integrada. Coletamos apenas o ID do usuário da Meta, o nome de usuário (username) e o texto do comentário/mensagem para fins de correspondência de palavras-chave.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wide mb-1">2. Uso dos Dados</h2>
            <p>
              Os dados coletados são usados exclusivamente de forma automatizada para disparar as respostas privadas configuradas e o link de destino. Não usamos esses dados para fins publicitários ou compartilhamento com terceiros.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wide mb-1">3. Segurança</h2>
            <p>
              Todas as credenciais e acessos são armazenados em servidor seguro hospedado no Supabase com Row Level Security (RLS) habilitado e chaves privadas restritas ao ambiente de execução.
            </p>
          </div>
        </div>
        <p className="text-[10px] text-zinc-500 mt-8 border-t border-zinc-850/60 pt-4">
          Última atualização: Julho de 2026.
        </p>
      </div>
    </div>
  );
}
