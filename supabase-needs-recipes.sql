create extension if not exists pgcrypto;

create table if not exists public.needs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  store text,
  category text,
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

alter table public.needs disable row level security;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  name text,
  amount numeric,
  status text,
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.invoices disable row level security;

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text unique,
  category text not null,
  subcategory text,
  image_url text,
  base_servings numeric default 2,
  prep_time_minutes numeric,
  cook_time_minutes numeric,
  difficulty text,
  instructions jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.recipes add column if not exists name text;
alter table public.recipes add column if not exists normalized_name text;
alter table public.recipes add column if not exists category text;
alter table public.recipes add column if not exists subcategory text;
alter table public.recipes add column if not exists image_url text;
alter table public.recipes add column if not exists base_servings numeric default 2;
alter table public.recipes add column if not exists prep_time_minutes numeric;
alter table public.recipes add column if not exists cook_time_minutes numeric;
alter table public.recipes add column if not exists difficulty text;
alter table public.recipes add column if not exists instructions jsonb;
alter table public.recipes add column if not exists slug text;
alter table public.recipes add column if not exists title text;
alter table public.recipes add column if not exists category_slug text;
alter table public.recipes add column if not exists minutes numeric;
alter table public.recipes add column if not exists tags jsonb;
create unique index if not exists recipes_normalized_name_unique on public.recipes (normalized_name);
alter table public.recipes disable row level security;

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references public.recipes(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  quantity numeric not null,
  unit text not null,
  created_at timestamptz default now()
);

alter table public.recipe_ingredients add column if not exists recipe_key text;
alter table public.recipe_ingredients add column if not exists ingredient_name text;
alter table public.recipe_ingredients add column if not exists product_id uuid;
alter table public.recipe_ingredients add column if not exists updated_at timestamptz default now();
alter table public.recipe_ingredients disable row level security;
