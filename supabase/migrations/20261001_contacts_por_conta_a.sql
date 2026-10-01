-- Ficha do contato por conta do Instagram — parte A (expand), aplicada ANTES do deploy.
--
-- Até aqui `contacts.instagram_id` (o IGSID da pessoa) era a chave primária global:
-- se a mesma pessoa falasse com dois clientes, os dois dividiam uma linha e um
-- sobrescrevia e-mail, tags e automação do outro. A chave passa a ser o par
-- (conta do Instagram, pessoa).
--
-- Esta parte só adiciona coisas, então o código antigo (que faz upsert com
-- onConflict 'instagram_id') continua funcionando até o deploy do código novo
-- (onConflict 'instagram_user_id,instagram_id'). A troca da chave primária e das
-- FKs fica na parte B, aplicada depois do deploy.
alter table public.contacts
  add column if not exists id uuid not null default gen_random_uuid();

alter table public.contacts
  alter column instagram_user_id set not null;

alter table public.contacts
  add constraint contacts_conta_pessoa_key unique (instagram_user_id, instagram_id);

-- followups não guardava a conta; precisa dela pra apontar pro par (conta, pessoa) na parte B.
alter table public.followups
  add column if not exists instagram_user_id text;

update public.followups f
set instagram_user_id = c.instagram_user_id
from public.contacts c
where c.instagram_id = f.contact_id
  and f.instagram_user_id is null;
