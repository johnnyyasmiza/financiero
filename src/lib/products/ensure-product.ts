import { normalizeProductName } from "@/lib/price-comparison";
import { supabase } from "@/lib/supabase";

export type EnsureProductInput = {
  id?: string | null;
  productId?: string | null;
  store?: string | null;
  category?: string | null;
  name: string;
  imageUrl?: string | null;
  price?: number | null;
  unit?: string | null;
  unitQuantity?: number | null;
  unitBase?: string | null;
  pricePerBaseUnit?: number | null;
  sourceUrl?: string | null;
};

type ProductRow = {
  id: string;
};

function isUuid(value: string | null | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function toPayload(input: EnsureProductInput, requestedId: string | null) {
  return {
    ...(requestedId ? { id: requestedId } : {}),
    store: input.store || "Marjane",
    name: input.name,
    normalized_name: normalizeProductName(input.name),
    category: input.category || "Epicerie",
    price: input.price && input.price > 0 ? input.price : null,
    unit: input.unit || "piece",
    unit_quantity: input.unitQuantity ?? null,
    unit_base: input.unitBase ?? null,
    price_per_base_unit: input.pricePerBaseUnit ?? null,
    image_url: input.imageUrl || null,
    source_url: input.sourceUrl || null,
    updated_at: new Date().toISOString(),
  };
}

async function findById(productId: string) {
  const { data, error } = await supabase.from("products").select("id").eq("id", productId).maybeSingle();
  if (error) throw error;
  return (data as ProductRow | null)?.id ?? null;
}

async function findByNaturalKey(input: EnsureProductInput) {
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .eq("store", input.store || "Marjane")
    .eq("normalized_name", normalizeProductName(input.name))
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as ProductRow | null)?.id ?? null;
}

async function insertProduct(input: EnsureProductInput, requestedId: string | null) {
  const { data, error } = await supabase.from("products").insert(toPayload(input, requestedId)).select("id").single();

  if (!error) {
    return (data as ProductRow).id;
  }

  if (requestedId) {
    const fallback = await supabase.from("products").insert(toPayload(input, null)).select("id").single();
    if (!fallback.error) {
      return (fallback.data as ProductRow).id;
    }
    throw fallback.error;
  }

  throw error;
}

export async function ensureProductExists(productInput: EnsureProductInput): Promise<string | null> {
  try {
    const requestedId = isUuid(productInput.productId) ? productInput.productId : isUuid(productInput.id) ? productInput.id : null;

    if (requestedId) {
      const existingId = await findById(requestedId);
      if (existingId) {
        return existingId;
      }
    }

    const existingByNaturalKey = await findByNaturalKey(productInput);
    if (existingByNaturalKey) {
      return existingByNaturalKey;
    }

    console.log("Product missing, auto-create product");
    return await insertProduct(productInput, requestedId ?? null);
  } catch (error) {
    console.warn(`Impossible de creer le produit "${productInput.name}" avant ajout au stock.`, error);
    return null;
  }
}
