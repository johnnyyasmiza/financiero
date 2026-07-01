alter table public.fridge_items
add column if not exists initial_quantity numeric,
add column if not exists remaining_quantity numeric,
add column if not exists low_stock_threshold numeric default 20;

update public.fridge_items
set
  initial_quantity = coalesce(initial_quantity, total_quantity, quantity * coalesce(unit_quantity, 1), quantity, 1),
  remaining_quantity = coalesce(remaining_quantity, total_quantity, quantity * coalesce(unit_quantity, 1), quantity, 1),
  low_stock_threshold = coalesce(low_stock_threshold, 20)
where initial_quantity is null
   or remaining_quantity is null
   or low_stock_threshold is null;

notify pgrst, 'reload schema';
