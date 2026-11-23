-- AethexFlow account data. Per-user rows are scoped in server functions.

create table if not exists conversations (
  id text primary key,
  user_id text not null,
  title text not null,
  provider text not null default 'grok',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_user_idx on conversations (user_id, updated_at desc);

create table if not exists messages (
  id text primary key,
  conversation_id text not null,
  user_id text not null,
  role text not null,
  content text not null,
  tool_trace text,
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on messages (conversation_id, created_at);

create table if not exists memories (
  id text primary key,
  user_id text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists memories_user_idx on memories (user_id, created_at desc);

create table if not exists hub_configs (
  user_id text primary key,
  base_url text not null default '',
  model text not null default '',
  api_key text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists workflows (
  id text primary key,
  user_id text not null,
  name text not null,
  definition text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workflows_user_idx on workflows (user_id, updated_at desc);

create table if not exists workflow_runs (
  id text primary key,
  workflow_id text not null,
  user_id text not null,
  status text not null,
  log text not null,
  created_at timestamptz not null default now()
);
create index if not exists workflow_runs_user_idx on workflow_runs (user_id, created_at desc);

create table if not exists admins (
  user_id text primary key,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id text primary key,
  actor_id text,
  action text not null,
  meta text,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on audit_log (created_at desc);

create table if not exists feature_flags (
  key text primary key,
  value text not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists mcp_tokens (
  id text primary key,
  user_id text not null,
  label text not null,
  token_hash text not null unique,
  token_prefix text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists mcp_tokens_user_idx on mcp_tokens (user_id);
