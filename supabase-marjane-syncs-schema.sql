create table if not exists public.marjane_syncs (
  id uuid primary key default gen_random_uuid(),
  sync_type text,
  source text default 'marjane',
  raw_json jsonb,
  imported_items jsonb,
  created_at timestamp default now()
);

alter table public.marjane_syncs disable row level security;

create index if not exists marjane_syncs_source_idx on public.marjane_syncs(source);
create index if not exists marjane_syncs_sync_type_idx on public.marjane_syncs(sync_type);
create index if not exists marjane_syncs_created_at_idx on public.marjane_syncs(created_at);

notify pgrst, 'reload schema';
