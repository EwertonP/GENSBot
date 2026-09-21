-- Adiciona prazo interno e briefing aos itens de conteúdo (TELAS_GENSBOT_2.0.md L3)
alter table public.conteudo_items
  add column if not exists prazo timestamptz,
  add column if not exists briefing text;

-- Adiciona cargo e foto_url aos membros da equipe
alter table public.membros
  add column if not exists cargo text,
  add column if not exists foto_url text;

-- Atualiza trigger de novos usuários para capturar full_name e atualizar em conflito
create or replace function public.criar_membro_no_signup()
returns trigger
language plpgsql
security definer
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
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    'membro',
    false
  )
  on conflict (id) do update set
    nome = coalesce(nullif(excluded.nome, ''), public.membros.nome),
    email = excluded.email;

  return new;
exception when others then
  raise warning 'criar_membro_no_signup falhou para %: %', new.id, sqlerrm;
  return new;
end;
$$;
