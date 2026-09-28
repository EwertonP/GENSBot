import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { urlDeRetorno, validarPedido } from '@/lib/mcp/autorizacao';
import Logo from '@/components/logo';

export const dynamic = 'force-dynamic';

const PERMISSOES = [
  'Ver clientes, equipe, demandas e a sua rotina',
  'Criar e editar demandas e tarefas em seu nome',
  'Mover demandas entre etapas da esteira (sem publicar)',
  'Preparar links e mensagens de aprovação (a equipe envia)',
  'Criar formulários em rascunho e ler as respostas',
  'Criar e editar automações de DM sempre pausadas (ativar é só pela tela)',
];

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AutorizarPage({ searchParams }: Props) {
  const bruto = await searchParams;
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(bruto)) {
    const valor = Array.isArray(v) ? v[0] : v;
    if (valor) params[k] = valor;
  }

  const validacao = await validarPedido(params);
  if (!validacao.ok) {
    if (validacao.podeRedirecionar && params.redirect_uri) {
      redirect(urlDeRetorno(params.redirect_uri, { error: 'invalid_request', error_description: validacao.erro, state: params.state || null }));
    }
    return <Mensagem titulo="Não foi possível conectar" texto={validacao.erro} />;
  }
  const { pedido } = validacao;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const volta = `/oauth/authorize?${new URLSearchParams(params).toString()}`;
    redirect(`/login?next=${encodeURIComponent(volta)}`);
  }

  const { data: membro } = await serviceSupabase.from('membros').select('nome, email, ativo, papel').eq('id', user.id).maybeSingle();
  if (!membro?.ativo) {
    return <Mensagem titulo="Acesso pendente" texto="Seu acesso ao GENSBot ainda não foi aprovado por um administrador da agência." />;
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-lg font-bold font-display text-foreground">Conectar {pedido.clientName} ao GENSBot</h1>
            <p className="text-sm text-muted-foreground">
              Entrando como <span className="font-semibold text-foreground">{membro.nome || membro.email}</span>
              {membro.papel === 'master' ? ' (administrador)' : ''}. O Claude vai agir em seu nome, com as mesmas permissões que você tem aqui.
            </p>
          </div>

          <ul className="flex flex-col gap-2 text-sm text-foreground">
            {PERMISSOES.map((p) => (
              <li key={p} className="flex gap-2">
                <span aria-hidden className="text-primary">
                  ✓
                </span>
                {p}
              </li>
            ))}
          </ul>

          <p className="text-xs text-muted-foreground">
            O Claude não publica posts, não ativa automações, não envia mensagens a clientes e não exclui nada. Você corta o acesso a qualquer momento removendo o
            connector no Claude, e ele cai sozinho se o membro for desativado.
          </p>

          <form method="post" action="/api/oauth/authorize" className="flex gap-2 justify-end">
            {Object.entries(params).map(([k, v]) => (k !== 'decisao' ? <input key={k} type="hidden" name={k} value={v} /> : null))}
            <button
              type="submit"
              name="decisao"
              value="negar"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              name="decisao"
              value="permitir"
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
            >
              Permitir acesso
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function Mensagem({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 flex flex-col gap-2">
        <h1 className="text-lg font-bold font-display text-foreground">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{texto}</p>
      </section>
    </main>
  );
}
