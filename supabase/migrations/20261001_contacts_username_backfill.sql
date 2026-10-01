-- Recupera o @ de contatos que comentaram num post e ficaram sem username.
-- O webhook de comentário sempre trouxe `from.username`, mas o caminho das automações
-- em canvas descartava esse valor e gravava o IGSID (ou nada) no lugar. O payload cru
-- de cada webhook fica em `events`, então o @ correto ainda está lá.
with commenters as (
  select distinct on (c->'value'->'from'->>'id')
    c->'value'->'from'->>'id' as igsid,
    c->'value'->'from'->>'username' as username
  from public.events e,
       jsonb_array_elements(case when jsonb_typeof(e.payload->'entry') = 'array' then e.payload->'entry' else '[]'::jsonb end) en,
       jsonb_array_elements(case when jsonb_typeof(en->'changes') = 'array' then en->'changes' else '[]'::jsonb end) c
  where c->>'field' = 'comments'
    and c->'value'->'from'->>'username' is not null
  order by c->'value'->'from'->>'id', e.created_at desc
)
update public.contacts ct
set username = cm.username
from commenters cm
where ct.instagram_id = cm.igsid
  and (ct.username is null or ct.username = ct.instagram_id);

-- O IGSID gravado como username não é um @ — "sem @" passa a ser sempre null.
update public.contacts
set username = null
where username = instagram_id;
