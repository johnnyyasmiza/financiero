create table if not exists public.expenses (
  id text primary key,
  merchant text,
  category text not null,
  amount numeric not null,
  date date not null,
  payment text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.revenues (
  id text primary key,
  source text not null,
  amount numeric not null,
  date date not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.bills (
  id text primary key,
  name text not null,
  amount numeric not null,
  status text not null check (status in ('Paye', 'A payer')),
  due_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.assets (
  id text primary key,
  name text not null,
  value numeric not null,
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;
alter table public.revenues enable row level security;
alter table public.bills enable row level security;
alter table public.assets enable row level security;

create policy "anon expenses access" on public.expenses for all to anon using (true) with check (true);
create policy "anon revenues access" on public.revenues for all to anon using (true) with check (true);
create policy "anon bills access" on public.bills for all to anon using (true) with check (true);
create policy "anon assets access" on public.assets for all to anon using (true) with check (true);
