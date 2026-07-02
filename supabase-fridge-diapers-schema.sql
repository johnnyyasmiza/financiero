alter table public.fridge_items
add column if not exists auto_consume boolean default false,
add column if not exists daily_consumption numeric,
add column if not exists last_auto_consumed_at date;

update public.fridge_items
set
  unit = 'piece',
  unit_quantity = 1,
  auto_consume = true,
  daily_consumption = coalesce(daily_consumption, 5),
  low_stock_threshold = coalesce(low_stock_threshold, 15),
  last_auto_consumed_at = coalesce(last_auto_consumed_at, purchase_date, current_date),
  updated_at = now()
where name ~* '(couche|couches)';

update public.fridge_items
set
  unit = 'piece',
  unit_quantity = 1,
  updated_at = now()
where name ~* '(oeuf|oeufs|œuf|œufs)';

notify pgrst, 'reload schema';
