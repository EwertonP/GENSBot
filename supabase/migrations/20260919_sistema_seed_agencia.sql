-- Sistema unificado: agência GENS, dono e cadastro automático
--
-- Diferente do ProspeccaoGens, este banco JÁ tem usuários reais. Por isso a
-- semente é conservadora: só o dono comprovado (é quem tem todos os contatos,
-- contas de Instagram e automações) vira master. Os demais usuários existentes
-- ficam SEM linha em membros de propósito — sem membro, agencia_atual() é nulo
-- e a RLS nega tudo (falha fechada) até alguém aprovar explicitamente.

insert into public.agencias (nome, slug)
values ('Agência GENS', 'gens')
on conflict (slug) do nothing;

insert into public.membros (id, agencia_id, nome, email, papel, ativo)
select
  u.id,
  a.id,
  'Ewerton Phillipe',
  u.email,
  'master',
  true
from auth.users u
cross join public.agencias a
where u.email = 'ewertonphillipe18@gmail.com'
  and a.slug = 'gens'
on conflict (id) do nothing;

-- Cria o membro assim que alguém se cadastra. Como o dono já existe, todo
-- cadastro novo entra inativo e depende de aprovação de um master — ter o
-- link de /register não pode ser o mesmo que ter acesso.
--
-- Este trigger roda no caminho do cadastro do GENSBot em produção, então a
-- função NUNCA pode derrubar o signup: qualquer erro vira aviso e o cadastro
-- segue. Pior caso: o usuário existe sem linha em membros (fecha, não abre).
create or replace function public.criar_membro_no_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agencia uuid;
begin
  select id into v_agencia from public.agencias where slug = 'gens';

  if v_agencia is null then
    return new;
  end if;

  insert into public.membros (id, agencia_id, nome, email, papel, ativo)
  values (
    new.id,
    v_agencia,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'nome', ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    'membro',
    false
  )
  on conflict (id) do nothing;

  return new;
exception when others then
  raise warning 'criar_membro_no_signup falhou para %: %', new.id, sqlerrm;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.criar_membro_no_signup();
