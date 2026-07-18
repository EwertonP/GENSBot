-- Enable extension for uuid generation
create extension if not exists "uuid-ossp";

-- Table: config (Single row configuration)
create table if not exists config (
  id boolean primary key default true check (id = true),
  instagram_token text,
  instagram_user_id text,
  instagram_username text,
  profile_picture_url text,
  token_expires_at timestamp with time zone,
  updated_at timestamp with time zone default now()
);

-- Table: automations
create table if not exists automations (
  id uuid primary key default gen_random_uuid(),
  instagram_user_id text, -- ID of the Instagram page/user this automation belongs to
  name text not null,
  active boolean not null default true,
  triggers text[] not null, -- 'comment', 'story', 'dm'
  keywords text[] not null, -- words to match
  match_type text not null, -- 'contains', 'exact', 'any'
  specific_post_id text, -- optional Instagram post media ID
  public_replies text[] not null default '{}', -- random replies for comments
  welcome_dm text not null, -- first private message
  quick_reply_button text, -- label for quick reply button (triggers 24h window)
  link_text text, -- message with the link
  link_button_label text, -- label on the link URL button
  link_url text, -- link destination
  reminder_text text, -- optional reminder message
  reminder_delay_minutes integer, -- delay before sending reminder
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Table: contacts
create table if not exists contacts (
  instagram_id text primary key,
  instagram_user_id text, -- ID of the Instagram page/user this contact engaged with
  username text,
  first_contact_at timestamp with time zone default now(),
  last_response_at timestamp with time zone, -- Opens/extends 24h window
  last_automation_id uuid references automations(id) on delete set null,
  updated_at timestamp with time zone default now()
);

-- Table: followups
create table if not exists followups (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references automations(id) on delete cascade,
  contact_id text references contacts(instagram_id) on delete cascade,
  step integer not null, -- 1 = Link, 2 = Reminder
  status text not null default 'waiting_trigger', -- 'waiting_trigger', 'queued', 'sent', 'failed'
  created_at timestamp with time zone default now()
);

-- Table: queue
create table if not exists queue (
  id uuid primary key default gen_random_uuid(),
  contact_id text references contacts(instagram_id) on delete cascade,
  automation_id uuid references automations(id) on delete set null,
  type text not null, -- 'private_reply', 'public_reply', 'link_dm', 'reminder_dm'
  recipient_id text not null, -- comment_id or instagram_id
  payload jsonb not null, -- message data: { text: "...", etc. }
  status text not null default 'pending', -- 'pending', 'sending', 'sent', 'failed', 'skipped'
  error_message text,
  scheduled_at timestamp with time zone not null default now(),
  claimed_at timestamp with time zone, -- for atomic locked claim
  sent_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Table: events
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  processed boolean default false,
  created_at timestamp with time zone default now()
);

-- Enable RLS on all tables
alter table config enable row level security;
alter table automations enable row level security;
alter table contacts enable row level security;
alter table followups enable row level security;
alter table queue enable row level security;
alter table events enable row level security;

-- Index for queue performance (drain worker)
create index if not exists idx_queue_drain on queue (status, scheduled_at) where status = 'pending';
create index if not exists idx_events_processed on events (processed) where processed = false;

-- Stored procedure for atomic queue jobs claiming (Skip locked)
create or replace function claim_queue_jobs(batch_size int)
returns setof queue
language plpgsql
security definer
as $$
begin
  return query
  update queue
  set status = 'sending', claimed_at = now()
  where id in (
    select id from queue
    where status = 'pending' and scheduled_at <= now()
    order by scheduled_at asc
    limit batch_size
    for update skip locked
  )
  returning *;
end;
$$;

-- SaaS Extension Columns
alter table automations add column if not exists ask_email boolean not null default false;
alter table automations add column if not exists ask_phone boolean not null default false;
alter table automations add column if not exists webhook_url text;

alter table contacts add column if not exists email text;
alter table contacts add column if not exists phone text;
alter table contacts add column if not exists conversation_state text not null default 'idle';
alter table contacts add column if not exists last_active_automation_id uuid references automations(id) on delete set null;

-- Table: messages
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  instagram_user_id text, -- ID of the Instagram page/user this message belongs to
  contact_id text references contacts(instagram_id) on delete cascade,
  direction text not null, -- 'inbound' or 'outbound'
  text text,
  payload jsonb, -- full message metadata
  created_at timestamp with time zone default now()
);

-- Table: analytics_events
create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  instagram_user_id text, -- ID of the Instagram page/user
  contact_id text references contacts(instagram_id) on delete cascade,
  automation_id uuid references automations(id) on delete cascade,
  event_type text not null, -- 'comment', 'welcome_dm_sent', 'link_clicked', 'reminder_sent', 'lead_captured'
  created_at timestamp with time zone default now()
);

-- RLS and Indexes for SaaS Extensions
alter table messages enable row level security;
alter table analytics_events enable row level security;

create index if not exists idx_messages_contact on messages (contact_id, created_at desc);
create index if not exists idx_analytics_events_type on analytics_events (instagram_user_id, event_type);


