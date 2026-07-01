import { normalizeProductName } from "@/lib/price-comparison";
import { ensureProductExists } from "@/lib/products/ensure-product";
import { supabase } from "@/lib/supabase";
import { cacheData, enqueueOfflineOperation, getCachedData, isNetworkError, isOnline, notifyOfflineStatus } from "@/lib/offline-store";

export const shoppingStores = ["Marjane", "Carrefour", "Boucherie Amsterdam", "HRI", "Swika"] as const;
const PRODUCTS_CACHE_KEY = "shopping:products";
const NEEDS_CACHE_KEY = "shopping:needs:a_acheter";

export type ShoppingProduct = {
  id: string;
  store: string;
  name: string;
  normalizedName: string;
  category: string;
  price: number | null;
  unit: string;
  unitQuantity: number | null;
  unitBase: string | null;
  pricePerBaseUnit: number | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  updatedAt: string | null;
  createdAt: string | null;
};

export type ShoppingProductInput = {
  store: string;
  name: string;
  category: string;
  price: number | null;
  unit: string;
  unitQuantity?: number | null;
  unitBase?: string | null;
  pricePerBaseUnit?: number | null;
  imageUrl: string | null;
  sourceUrl: string | null;
};

type ProductRow = {
  id: string;
  store: string | null;
  name: string;
  normalized_name: string | null;
  category: string | null;
  price: number | null;
  unit: string | null;
  unit_quantity?: number | null;
  unit_base?: string | null;
  price_per_base_unit?: number | null;
  image_url: string | null;
  source_url: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type CartItemInput = {
  productId: string;
  store: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type ShoppingListInput = {
  title: string;
  store: string;
  total: number;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }>;
};

export type Need = {
  id: string;
  productId: string | null;
  store: string;
  category: string;
  name: string;
  imageUrl: string | null;
  unit: string;
  quantity: number;
  unitPrice: number | null;
  total: number | null;
  status: "a_acheter" | "pris" | string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type NeedInput = {
  productId: string | null;
  store: string;
  category: string;
  name: string;
  imageUrl: string | null;
  unit: string;
  quantity: number;
  unitPrice: number | null;
  total: number | null;
};

export type RecipeIngredientProductInput = {
  recipeKey: string;
  ingredientName: string;
  productId: string;
};

type NeedRow = {
  id: string;
  product_id: string | null;
  store: string | null;
  category: string | null;
  name: string;
  image_url: string | null;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;
  total: number | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function getErrorMessage(error: unknown) {
  const supabaseError = error as { message?: string; details?: string; hint?: string; code?: string };
  const parts = [supabaseError.message, supabaseError.details, supabaseError.hint, supabaseError.code].filter(Boolean);

  if (supabaseError.code === "42501" || supabaseError.message?.toLowerCase().includes("row-level security")) {
    parts.unshift("RLS bloque l'opération Supabase. Désactive RLS ou ajoute une policy select/insert/update/delete pour anon.");
  }

  if (supabaseError.code === "42P01" || supabaseError.code === "42703") {
    parts.unshift("Schéma Supabase incomplet. Exécute le SQL du fichier supabase-catalog-schema.sql.");
  }

  return parts.join("\n") || "Erreur Supabase.";
}

function throwCatalogError(error: unknown) {
  throw new Error(getErrorMessage(error));
}

function toProduct(row: ProductRow): ShoppingProduct {
  return {
    id: row.id,
    store: row.store ?? "",
    name: row.name,
    normalizedName: row.normalized_name ?? normalizeProductName(row.name),
    category: row.category ?? "Autre",
    price: row.price === null ? null : Number(row.price),
    unit: row.unit ?? "pièce",
    unitQuantity: row.unit_quantity === null || row.unit_quantity === undefined ? null : Number(row.unit_quantity),
    unitBase: row.unit_base ?? null,
    pricePerBaseUnit: row.price_per_base_unit === null || row.price_per_base_unit === undefined ? null : Number(row.price_per_base_unit),
    imageUrl: row.image_url,
    sourceUrl: row.source_url,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

function toProductPayload(product: ShoppingProductInput) {
  return {
    store: product.store,
    name: product.name,
    normalized_name: normalizeProductName(product.name),
    category: product.category,
    price: product.price && product.price > 0 ? product.price : null,
    unit: product.unit,
    unit_quantity: product.unitQuantity ?? null,
    unit_base: product.unitBase ?? null,
    price_per_base_unit: product.pricePerBaseUnit ?? null,
    image_url: product.imageUrl || null,
    source_url: product.sourceUrl || null,
    updated_at: new Date().toISOString(),
  };
}

export async function getProducts() {
  const { data, error } = await supabase.from("products").select("*").order("name", { ascending: true });

  if (error) {
    const cached = await getCachedData<ShoppingProduct[]>(PRODUCTS_CACHE_KEY);

    if (cached) {
      return cached;
    }

    throwCatalogError(error);
  }

  const products = ((data ?? []) as ProductRow[]).map(toProduct);
  await cacheData(PRODUCTS_CACHE_KEY, products);
  return products;
}

export async function addProduct(product: ShoppingProductInput) {
  const payload = toProductPayload(product);
  const { data, error } = await supabase.from("products").insert(payload).select("*").single();

  if (error) {
    throwCatalogError(error);
  }

  const inserted = toProduct(data as ProductRow);

  if (inserted.price && inserted.price > 0) {
    await addPriceHistory(inserted);
  }

  return inserted;
}

export async function ensureProductExistsForStock(product: ShoppingProduct) {
  const productId = await ensureProductExists({
    id: product.id,
    store: product.store,
    category: product.category,
    name: product.name,
    imageUrl: product.imageUrl,
    price: product.price,
    unit: product.unit,
    unitQuantity: product.unitQuantity,
    unitBase: product.unitBase,
    pricePerBaseUnit: product.pricePerBaseUnit,
    sourceUrl: product.sourceUrl,
  });

  if (!productId) return null;
  const { data, error } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
  if (error || !data) return null;
  return toProduct(data as ProductRow);
}

export async function updateProduct(id: string, product: ShoppingProductInput) {
  const payload = toProductPayload(product);
  const { data, error } = await supabase.from("products").update(payload).eq("id", id).select("*").single();

  if (error) {
    throwCatalogError(error);
  }

  const updated = toProduct(data as ProductRow);

  if (updated.price && updated.price > 0) {
    await addPriceHistory(updated);
  }

  return updated;
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    throwCatalogError(error);
  }
}

export async function addPriceHistory(product: ShoppingProduct) {
  const { error } = await supabase.from("price_history").insert({
    product_id: product.id,
    store: product.store,
    price: product.price,
    unit: product.unit,
  });

  if (error) {
    throwCatalogError(error);
  }
}

export async function addShoppingCartItems(items: CartItemInput[]) {
  if (items.length === 0) {
    return;
  }

  const { error } = await supabase.from("shopping_cart_items").insert(
    items.map((item) => ({
      product_id: item.productId,
      store: item.store,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.total,
    })),
  );

  if (error) {
    throwCatalogError(error);
  }
}

export async function addShoppingList(list: ShoppingListInput) {
  const { error } = await supabase.from("shopping_lists").insert({
    title: list.title,
    store: list.store,
    status: "a_venir",
    total: list.total,
    items: list.items,
  });

  if (error) {
    throwCatalogError(error);
  }
}

function toNeed(row: NeedRow): Need {
  return {
    id: row.id,
    productId: row.product_id,
    store: row.store ?? "",
    category: row.category ?? "Autre",
    name: row.name,
    imageUrl: row.image_url,
    unit: row.unit ?? "piece",
    quantity: Number(row.quantity ?? 1),
    unitPrice: row.unit_price === null || row.unit_price === undefined ? null : Number(row.unit_price),
    total: row.total === null || row.total === undefined ? null : Number(row.total),
    status: row.status ?? "a_acheter",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toNeedPayload(item: NeedInput) {
  return {
    product_id: item.productId,
    store: item.store,
    category: item.category,
    name: item.name,
    image_url: item.imageUrl || null,
    unit: item.unit,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total: item.total,
    status: "a_acheter",
    updated_at: new Date().toISOString(),
  };
}

export async function getNeeds(status = "a_acheter") {
  const query = supabase.from("needs").select("*").order("created_at", { ascending: false });
  const { data, error } = status ? await query.eq("status", status) : await query;

  if (error) {
    const cached = await getCachedData<Need[]>(status ? `shopping:needs:${status}` : NEEDS_CACHE_KEY);

    if (cached) {
      return cached;
    }

    throwCatalogError(error);
  }

  const needs = ((data ?? []) as NeedRow[]).map(toNeed);
  await cacheData(status ? `shopping:needs:${status}` : NEEDS_CACHE_KEY, needs);
  return needs;
}

export async function addNeeds(items: NeedInput[]) {
  if (items.length === 0) {
    return [];
  }

  const payload = items.map(toNeedPayload);

  if (!isOnline()) {
    const optimisticNeeds = items.map((item, index) => ({
      id: `offline-${Date.now()}-${index}`,
      productId: item.productId,
      store: item.store,
      category: item.category,
      name: item.name,
      imageUrl: item.imageUrl,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
      status: "a_acheter",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })) satisfies Need[];
    const cached = await getCachedData<Need[]>(NEEDS_CACHE_KEY);
    await cacheData(NEEDS_CACHE_KEY, [...optimisticNeeds, ...(cached ?? [])]);
    await enqueueOfflineOperation({ type: "insertMany", table: "needs", payload });
    return optimisticNeeds;
  }

  const { data, error } = await supabase.from("needs").insert(payload).select("*");

  if (error) {
    if (isNetworkError(error)) {
      await enqueueOfflineOperation({ type: "insertMany", table: "needs", payload });
      notifyOfflineStatus();
      return items.map((item, index) => ({
        id: `offline-${Date.now()}-${index}`,
        productId: item.productId,
        store: item.store,
        category: item.category,
        name: item.name,
        imageUrl: item.imageUrl,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        status: "a_acheter",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    }

    throwCatalogError(error);
  }

  const inserted = ((data ?? []) as NeedRow[]).map(toNeed);
  const cached = await getCachedData<Need[]>(NEEDS_CACHE_KEY);
  await cacheData(NEEDS_CACHE_KEY, [...inserted, ...(cached ?? []).filter((item) => !item.id.startsWith("offline-"))]);
  return inserted;
}

export async function addOrIncrementNeed(item: NeedInput) {
  const needs = await getNeeds();
  const normalizedName = normalizeProductName(item.name);
  const existing = needs.find((need) => normalizeProductName(need.name) === normalizedName && need.status === "a_acheter");

  if (!existing) {
    const [created] = await addNeeds([item]);
    return created;
  }

  const nextQuantity = existing.quantity + item.quantity;
  const nextUnitPrice = existing.unitPrice ?? item.unitPrice;
  const nextTotal = nextUnitPrice === null ? null : nextQuantity * nextUnitPrice;
  const payload = {
    quantity: nextQuantity,
    unit_price: nextUnitPrice,
    total: nextTotal,
    updated_at: new Date().toISOString(),
  };

  if (!isOnline()) {
    const updatedNeed = {
      ...existing,
      quantity: nextQuantity,
      unitPrice: nextUnitPrice,
      total: nextTotal,
      updatedAt: new Date().toISOString(),
    } satisfies Need;
    const cached = await getCachedData<Need[]>(NEEDS_CACHE_KEY);
    await cacheData(
      NEEDS_CACHE_KEY,
      (cached ?? needs).map((need) => (need.id === existing.id ? updatedNeed : need)),
    );
    return updatedNeed;
  }

  const { data, error } = await supabase.from("needs").update(payload).eq("id", existing.id).select("*").single();

  if (error) {
    if (isNetworkError(error)) {
      notifyOfflineStatus();
      const updatedNeed = {
        ...existing,
        quantity: nextQuantity,
        unitPrice: nextUnitPrice,
        total: nextTotal,
        updatedAt: new Date().toISOString(),
      } satisfies Need;
      return updatedNeed;
    }

    throwCatalogError(error);
  }

  const updated = toNeed(data as NeedRow);
  const cached = await getCachedData<Need[]>(NEEDS_CACHE_KEY);
  await cacheData(
    NEEDS_CACHE_KEY,
    (cached ?? needs).map((need) => (need.id === existing.id ? updated : need)),
  );
  return updated;
}

export async function markNeedAsTaken(id: string) {
  const { data, error } = await supabase
    .from("needs")
    .update({ status: "pris", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throwCatalogError(error);
  }

  return toNeed(data as NeedRow);
}

export async function deleteNeed(id: string) {
  const { error } = await supabase.from("needs").delete().eq("id", id);

  if (error) {
    throwCatalogError(error);
  }
}

export function subscribeToNeeds(onChange: () => void) {
  const channel = supabase
    .channel("financiero-needs")
    .on("postgres_changes", { event: "*", schema: "public", table: "needs" }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function saveRecipeIngredientProduct(input: RecipeIngredientProductInput) {
  const payload = {
    recipe_key: input.recipeKey,
    ingredient_name: input.ingredientName,
    name: input.ingredientName,
    product_id: input.productId,
    updated_at: new Date().toISOString(),
  };
  const { error: deleteError } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("recipe_key", input.recipeKey)
    .eq("ingredient_name", input.ingredientName);

  if (deleteError) {
    throwCatalogError(deleteError);
  }

  const { error } = await supabase.from("recipe_ingredients").insert(payload);

  if (error) {
    throwCatalogError(error);
  }
}

export function subscribeToProducts(onChange: () => void) {
  const channel = supabase
    .channel("financiero-products")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
