export default function ExclusaoDeDados() {
  return (
    <div className="min-h-screen bg-[#07060E] text-zinc-300 font-sans p-6 md:p-16 flex flex-col justify-center items-center">
      <div className="max-w-2xl w-full bg-zinc-900/30 border border-zinc-850/60 rounded-3xl p-8 backdrop-blur-md">
        <h1 className="text-2xl font-bold text-white mb-6">Instruções de Exclusão de Dados</h1>
        <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
          <p>
            Esta aplicação respeita as diretrizes de proteção e exclusão de dados pessoais da Meta.
          </p>
          <div>
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wide mb-1">Como solicitar a exclusão de suas interações:</h2>
            <p className="mb-2">
              Se você interagiu com nossas publicações ou enviou mensagens diretas (DM) e deseja excluir todo o histórico de logs, fila de disparos e registro de contato do nosso banco de dados, por favor execute os passos abaixo:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Envie uma DM para nossa conta do Instagram integrada com a palavra exata <strong>EXCLUIR MEUS DADOS</strong>.</li>
              <li>Nosso sistema processará o comando removendo seu ID único de contato e todos os dados associados na tabela do banco de dados no Supabase imediatamente.</li>
            </ul>
          </div>
        </div>
        <p className="text-[10px] text-zinc-500 mt-8 border-t border-zinc-850/60 pt-4">
          Última atualização: Julho de 2026.
        </p>
      </div>
    </div>
  );
}
