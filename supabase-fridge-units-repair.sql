create or replace function public.extract_fridge_quantity_from_name(product_name text, pattern text)
returns numeric
language sql
immutable
as $$
  select replace(substring(product_name from pattern), ',', '.')::numeric;
$$;

update public.fridge_items
set
  unit = 'g',
  quantity = public.extract_fridge_quantity_from_name(name, '([0-9]+(?:[.,][0-9]+)?)\s*(?:g|gr|gramme|grammes)'),
  unit_quantity = 1,
  total_quantity = public.extract_fridge_quantity_from_name(name, '([0-9]+(?:[.,][0-9]+)?)\s*(?:g|gr|gramme|grammes)'),
  initial_quantity = public.extract_fridge_quantity_from_name(name, '([0-9]+(?:[.,][0-9]+)?)\s*(?:g|gr|gramme|grammes)'),
  remaining_quantity = public.extract_fridge_quantity_from_name(name, '([0-9]+(?:[.,][0-9]+)?)\s*(?:g|gr|gramme|grammes)'),
  status = 'en_stock',
  updated_at = now()
where status is distinct from 'epuise'
  and coalesce(initial_quantity, total_quantity, quantity, 1) <= 1
  and name ~* '[0-9]+(?:[.,][0-9]+)?\s*(g|gr|gramme|grammes)';

update public.fridge_items
set
  unit = 'kg',
  quantity = public.extract_fridge_quantity_from_name(name, '([0-9]+(?:[.,][0-9]+)?)\s*(?:kg|kilo|kilos)'),
  unit_quantity = 1,
  total_quantity = public.extract_fridge_quantity_from_name(name, '([0-9]+(?:[.,][0-9]+)?)\s*(?:kg|kilo|kilos)'),
  initial_quantity = public.extract_fridge_quantity_from_name(name, '([0-9]+(?:[.,][0-9]+)?)\s*(?:kg|kilo|kilos)'),
  remaining_quantity = public.extract_fridge_quantity_from_name(name, '([0-9]+(?:[.,][0-9]+)?)\s*(?:kg|kilo|kilos)'),
  status = 'en_stock',
  updated_at = now()
where status is distinct from 'epuise'
  and coalesce(initial_quantity, total_quantity, quantity, 1) <= 1
  and name ~* '[0-9]+(?:[.,][0-9]+)?\s*(kg|kilo|kilos)';

update public.fridge_items
set
  unit = 'cl',
  quantity = public.extract_fridge_quantity_from_name(name, '([0-9]+(?:[.,][0-9]+)?)\s*cl'),
  unit_quantity = 1,
  total_quantity = public.extract_fridge_quantity_from_name(name, '([0-9]+(?:[.,][0-9]+)?)\s*cl'),
  initial_quantity = public.extract_fridge_quantity_from_name(name, '([0-9]+(?:[.,][0-9]+)?)\s*cl'),
  remaining_quantity = public.extract_fridge_quantity_from_name(name, '([0-9]+(?:[.,][0-9]+)?)\s*cl'),
  status = 'en_stock',
  updated_at = now()
where status is distinct from 'epuise'
  and coalesce(initial_quantity, total_quantity, quantity, 1) <= 1
  and name ~* '[0-9]+(?:[.,][0-9]+)?\s*cl';

update public.fridge_items
set
  unit = 'l',
  quantity = public.extract_fridge_quantity_from_name(name, '([0-9]+(?:[.,][0-9]+)?)\s*(?:l|litre|litres)'),
  unit_quantity = 1,
  total_quantity = public.extract_fridge_quantity_from_name(name, '([0-9]+(?:[.,][0-9]+)?)\s*(?:l|litre|litres)'),
  initial_quantity = public.extract_fridge_quantity_from_name(name, '([0-9]+(?:[.,][0-9]+)?)\s*(?:l|litre|litres)'),
  remaining_quantity = public.extract_fridge_quantity_from_name(name, '([0-9]+(?:[.,][0-9]+)?)\s*(?:l|litre|litres)'),
  status = 'en_stock',
  updated_at = now()
where status is distinct from 'epuise'
  and coalesce(initial_quantity, total_quantity, quantity, 1) <= 1
  and name ~* '[0-9]+(?:[.,][0-9]+)?\s*(l|litre|litres)'
  and name !~* '[0-9]+(?:[.,][0-9]+)?\s*cl'
  and name !~* '[0-9]+(?:[.,][0-9]+)?\s*ml';

notify pgrst, 'reload schema';
