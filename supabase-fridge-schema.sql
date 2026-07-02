create extension if not exists pgcrypto;

create table if not exists public.fridge_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  store text,
  category text,
  name text not null,
  image_url text,
  quantity numeric default 1,
  unit text,
  unit_quantity numeric,
  total_quantity numeric,
  initial_quantity numeric,
  remaining_quantity numeric,
  low_stock_threshold numeric default 20,
  purchase_price numeric,
  purchase_date date default current_date,
  expiry_date date,
  status text default 'en_stock',
  auto_consume boolean default false,
  daily_consumption numeric,
  last_auto_consumed_at date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.fridge_items disable row level security;

create index if not exists fridge_items_status_idx on public.fridge_items(status);
create index if not exists fridge_items_category_idx on public.fridge_items(category);
create index if not exists fridge_items_product_id_idx on public.fridge_items(product_id);

notify pgrst, 'reload schema';
