-- Sistema unificado: fecha a exposição da função do trigger de cadastro
--
-- Os advisors do Supabase apontaram que criar_membro_no_signup() ficou
-- executável via /rest/v1/rpc/ por anon e authenticated. É função de trigger
-- e não deve ser API. O trigger segue funcionando: o Postgres só confere o
-- privilégio EXECUTE quando o trigger é criado, não a cada disparo.

revoke execute on function public.criar_membro_no_signup()
  from public, anon, authenticated;
