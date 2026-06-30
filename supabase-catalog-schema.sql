create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store text,
  name text not null,
  normalized_name text,
  category text not null,
  price numeric,
  unit text,
  unit_quantity numeric,
  unit_base text,
  price_per_base_unit numeric,
  image_url text,
  source_url text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.products add column if not exists unit_quantity numeric;
alter table public.products add column if not exists unit_base text;
alter table public.products add column if not exists price_per_base_unit numeric;

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  store text,
  price numeric,
  unit text,
  checked_at timestamptz not null default now()
);

create table if not exists public.shopping_cart_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  store text,
  name text,
  quantity numeric,
  unit_price numeric,
  total numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  title text,
  store text,
  status text default 'a_venir',
  total numeric,
  items jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  name text,
  amount numeric,
  status text,
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.needs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  store text,
  category text not null,
  name text not null,
  image_url text,
  unit text,
  quantity numeric default 1,
  unit_price numeric,
  total numeric,
  status text default 'a_acheter',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  slug text,
  name text not null,
  normalized_name text unique,
  title text not null,
  category text not null,
  category_slug text,
  subcategory text,
  image_url text,
  base_servings numeric default 2,
  prep_time_minutes numeric,
  cook_time_minutes numeric,
  difficulty text,
  minutes numeric,
  tags jsonb,
  instructions jsonb,
  steps jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recipes add column if not exists slug text;
alter table public.recipes add column if not exists name text;
alter table public.recipes add column if not exists normalized_name text;
alter table public.recipes add column if not exists category_slug text;
alter table public.recipes add column if not exists image_url text;
alter table public.recipes add column if not exists prep_time_minutes numeric;
alter table public.recipes add column if not exists cook_time_minutes numeric;
alter table public.recipes add column if not exists difficulty text;
alter table public.recipes add column if not exists minutes numeric;
alter table public.recipes add column if not exists tags jsonb;
alter table public.recipes add column if not exists instructions jsonb;
create unique index if not exists recipes_normalized_name_unique on public.recipes (normalized_name);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references public.recipes(id) on delete cascade,
  recipe_key text,
  ingredient_name text,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  quantity numeric not null,
  unit text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recipe_ingredients add column if not exists recipe_key text;
alter table public.recipe_ingredients add column if not exists ingredient_name text;
alter table public.recipe_ingredients add column if not exists product_id uuid;
alter table public.recipe_ingredients add column if not exists updated_at timestamptz default now();

alter table public.products enable row level security;
alter table public.price_history enable row level security;
alter table public.shopping_cart_items enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.invoices disable row level security;
alter table public.needs disable row level security;
alter table public.recipes disable row level security;
alter table public.recipe_ingredients disable row level security;

drop policy if exists "anon products access" on public.products;
drop policy if exists "anon price history access" on public.price_history;
drop policy if exists "anon shopping cart access" on public.shopping_cart_items;
drop policy if exists "anon shopping lists access" on public.shopping_lists;

create policy "anon products access" on public.products for all to anon using (true) with check (true);
create policy "anon price history access" on public.price_history for all to anon using (true) with check (true);
create policy "anon shopping cart access" on public.shopping_cart_items for all to anon using (true) with check (true);
create policy "anon shopping lists access" on public.shopping_lists for all to anon using (true) with check (true);
