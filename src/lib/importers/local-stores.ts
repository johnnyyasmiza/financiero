import { copyFile, mkdir, readdir, readFile, stat } from "fs/promises";
import path from "path";
import { calculatePricePerBaseUnit, extractUnitInfo, normalizeProductName } from "@/lib/price-comparison";
import { supabase } from "@/lib/supabase";

const IMPORTS_ROOT = path.join(process.cwd(), "imports");
const PUBLIC_IMPORTS_ROOT = path.join(process.cwd(), "public", "imported");

const STORE_NAMES: Record<string, string> = {
  marjane: "Marjane",
  carrefour: "Carrefour",
  "boucherie-amsterdam": "Boucherie Amsterdam",
  "boucherie amsterdam": "Boucherie Amsterdam",
  boucherie_amsterdam: "Boucherie Amsterdam",
  amsterdam: "Boucherie Amsterdam",
  hri: "HRI",
  swika: "Swika",
};

const EXPECTED_STORE_KEYS = ["marjane", "carrefour", "boucherie-amsterdam", "hri", "swika"] as const;
const STORE_DIR_ALIASES: Record<(typeof EXPECTED_STORE_KEYS)[number], string[]> = {
  marjane: ["marjane"],
  carrefour: ["carrefour"],
  "boucherie-amsterdam": ["boucherie-amsterdam", "boucherie-amsterdam", "amsterdam"],
  hri: ["hri"],
  swika: ["swika"],
};

const STORE_ORIGINS: Record<string, string> = {
  Marjane: "https://www.marjane.ma",
  Carrefour: "https://www.bringo.ma",
  "Boucherie Amsterdam": "https://boucherieamsterdam.com",
  HRI: "https://example.com",
  Swika: "https://example.com",
};

const EXPECTED_CATEGORIES = [
  { keys: ["bebe"], categoryKey: "bebe", label: "Bébé" },
  { keys: ["charcutrie", "charcuterie"], categoryKey: "charcuterie", label: "Charcuterie" },
  { keys: ["epicerie"], categoryKey: "epicerie", label: "Épicerie" },
  { keys: ["fromage"], categoryKey: "fromage", label: "Fromage" },
  { keys: ["fruits"], categoryKey: "fruits", label: "Fruits" },
  { keys: ["legumes"], categoryKey: "legumes", label: "Légumes" },
  { keys: ["viande", "viandes"], categoryKey: "viande", label: "Viande" },
  { keys: ["volaille", "volailles", "poulet", "poulets", "dinde", "dindes"], categoryKey: "volaille", label: "Volaille" },
] as const;

type LocalProduct = {
  store: string;
  category: string;
  name: string;
  normalized_name: string;
  price: number;
  unit: string;
  unit_quantity: number | null;
  unit_base: string | null;
  price_per_base_unit: number | null;
  image_url: string | null;
  source_url: string;
};

type ImportContext = {
  store: string;
  storeKey: string;
  storeDir: string;
  category: string;
  categoryKey: string;
  categoryDir: string;
  htmlPath: string;
  filesDir: string | null;
};

export type AllStoresImportResult = {
  success: boolean;
  total: number;
  imported: number;
  updated: number;
  errors: string[];
  stores: Array<{
    store: string;
    found: number;
    imported: number;
    updated: number;
  }>;
  categories: Array<{
    store: string;
    category: string;
    found: number;
    imported: number;
    updated: number;
  }>;
  diagnostics: ImportDiagnostic[];
};

export type ImportDiagnostic = {
  store: string;
  storeKey: string;
  category: string;
  categoryKey: string;
  ok: boolean;
  folderExists: boolean;
  hasHtml: boolean;
  hasFiles: boolean;
  message: string;
};

type ImportDiagnosticWithContext = ImportDiagnostic & {
  context: ImportContext | null;
};

type ProductPayload = {
  store: string;
  category: string;
  name: string;
  normalized_name: string;
  price: number;
  unit: string;
  unit_quantity: number | null;
  unit_base: string | null;
  price_per_base_unit: number | null;
  image_url: string | null;
  source_url: string;
  updated_at: string;
};

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)));
}

function cleanText(value: string | null | undefined) {
  return decodeHtml(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getAttribute(markup: string, name: string) {
  const match = markup.match(new RegExp(`${name}="([^"]+)"`, "i"));
  return match ? decodeHtml(match[1]) : null;
}

function parsePrice(value: string | null | undefined) {
  const match = cleanText(value).match(/(\d+(?:[.,]\d{1,2})?)\s*(?:DH|Dh|DHS|MAD)\b/i);

  if (!match) {
    return null;
  }

  const price = Number(match[1].replace(",", "."));
  return Number.isFinite(price) ? price : null;
}

function detectUnit(name: string, extra = "") {
  const value = `${name} ${extra}`;
  const weight = value.match(/\b\d+(?:[.,]\d+)?\s*(?:kg|g|gr|grammes?|ml|cl|l|litres?)\b/i);

  if (weight) {
    return weight[0].replace(/\s+/g, "").replace(/kg/i, "Kg").replace(/gr\b/i, "g").replace(/grammes?/i, "g");
  }

  const suffix = value.match(/\/\s*(kg|g|pi[eè]ce|pcs?|paquet|barquette|litre|l)\b/i);

  if (suffix) {
    return suffix[1].replace(/kg/i, "Kg").replace(/^l$/i, "litre");
  }

  return "pièce";
}

function withUnitFields(product: Omit<LocalProduct, "unit_quantity" | "unit_base" | "price_per_base_unit">): LocalProduct {
  const info = extractUnitInfo(product.name, product.unit);
  return {
    ...product,
    unit_quantity: info.quantity,
    unit_base: info.baseUnit,
    price_per_base_unit: calculatePricePerBaseUnit(product.price, info.quantity, info.baseUnit),
  };
}

function absoluteUrl(value: string, store: string) {
  if (!value) {
    return "";
  }

  if (value.startsWith("http")) {
    return value;
  }

  return new URL(value.replace(/^\.?\//, "/"), STORE_ORIGINS[store] ?? "https://example.com").toString();
}

function localImageCandidate(src: string | null, filesDir: string | null) {
  if (!src || !filesDir || src.startsWith("http") || !src.includes("_files/")) {
    return null;
  }

  const fileName = path.basename(decodeURIComponent(src.split("_files/").pop() ?? ""));

  if (!fileName) {
    return null;
  }

  return path.join(filesDir, fileName);
}

async function copyImage(src: string | null, context: ImportContext) {
  const candidate = localImageCandidate(src, context.filesDir);

  if (!candidate) {
    return src || null;
  }

  const fileName = path.basename(candidate);
  const publicDir = path.join(PUBLIC_IMPORTS_ROOT, context.storeKey, context.categoryKey);
  const destination = path.join(/* turbopackIgnore: true */ publicDir, fileName);

  await mkdir(publicDir, { recursive: true });
  await copyFile(candidate, destination);

  return `/imported/${context.storeKey}/${context.categoryKey}/${encodeURIComponent(fileName)}`;
}

function productKey(product: LocalProduct) {
  return product.source_url || `${product.store}:${product.category}:${product.normalized_name}:${product.unit}`;
}

function uniqueProducts(products: LocalProduct[]) {
  const seen = new Set<string>();

  return products.filter((product) => {
    const key = productKey(product);

    if (!product.name || !product.source_url || !product.price || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function parseMarjane(html: string, context: ImportContext) {
  const products: LocalProduct[] = [];
  const cardRegex = /<div class="[^"]*product-card grid[^"]*">/g;
  let match: RegExpExecArray | null;

  while ((match = cardRegex.exec(html)) !== null) {
    const endIndex = html.indexOf("</li>", match.index);

    if (endIndex === -1) {
      continue;
    }

    const card = html.slice(match.index, endIndex);
    const name = cleanText(card.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1]);
    const price = parsePrice(card);
    const linkMarkup = card.match(/<a[^>]*href="[^"]+"[^>]*>/i)?.[0] ?? "";
    const imageMarkup = card.match(/<img[^>]*src="\.\/[^"]+_files\/[^"]+"[^>]*>/i)?.[0] ?? "";
    const sourceUrl = getAttribute(linkMarkup, "href");
    const imageSrc = getAttribute(imageMarkup, "src");

    if (!name || price === null || !sourceUrl) {
      continue;
    }

    products.push(withUnitFields({
      store: context.store,
      category: context.category,
      name,
      normalized_name: normalizeProductName(name),
      price,
      unit: detectUnit(name),
      image_url: await copyImage(imageSrc, context),
      source_url: absoluteUrl(sourceUrl, context.store),
    }));
  }

  return products;
}

async function parseCarrefour(html: string, context: ImportContext) {
  const products: LocalProduct[] = [];
  const cardRegex = /<div class="box-product"[\s\S]*?(?=<div class="col-product-listing-box"|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<script|$)/g;
  const matches = html.match(cardRegex) ?? [];

  for (const card of matches) {
    const wrapper = card.match(/<div class="box-product"[^>]*>/i)?.[0] ?? "";
    const name = cleanText(getAttribute(wrapper, "data-cnstrc-item-name") ?? card.match(/alt="([^"]+)"/i)?.[1]);
    const price = Number(getAttribute(wrapper, "data-cnstrc-item-price"));
    const linkMarkup = card.match(/<a[^>]*href="[^"]+"[^>]*>/i)?.[0] ?? "";
    const imageMarkup = card.match(/<img[^>]*class="[^"]*image-product[^"]*"[^>]*>|<img[^>]*src="\.\/[^"]+_files\/[^"]+"[^>]*>/i)?.[0] ?? "";
    const sourceUrl = getAttribute(linkMarkup, "href");
    const imageSrc = getAttribute(imageMarkup, "src");

    if (!name || !Number.isFinite(price) || !sourceUrl) {
      continue;
    }

    products.push(withUnitFields({
      store: context.store,
      category: context.category,
      name,
      normalized_name: normalizeProductName(name),
      price,
      unit: detectUnit(name, card),
      image_url: await copyImage(imageSrc, context),
      source_url: absoluteUrl(sourceUrl, context.store),
    }));
  }

  return products;
}

async function parseBoucherieAmsterdam(html: string, context: ImportContext) {
  const products: LocalProduct[] = [];
  const cardRegex = /<div class="bg-neutral-900\/60[\s\S]*?(?=<div class="bg-neutral-900\/60|<\/section>|$)/g;
  const matches = html.match(cardRegex) ?? [];

  for (const card of matches) {
    const name = cleanText(card.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1]);
    const price = parsePrice(card);
    const linkMarkup = card.match(/<a[^>]*href="[^"]+"[^>]*>/i)?.[0] ?? "";
    const imageMarkup = card.match(/<img[^>]*src="\.\/[^"]+_files\/[^"]+"[^>]*>/i)?.[0] ?? "";
    const sourceUrl = getAttribute(linkMarkup, "href");
    const imageSrc = getAttribute(imageMarkup, "src");

    if (!name || price === null || !sourceUrl) {
      continue;
    }

    products.push(withUnitFields({
      store: context.store,
      category: context.category,
      name,
      normalized_name: normalizeProductName(name),
      price,
      unit: detectUnit(name, card),
      image_url: await copyImage(imageSrc, context),
      source_url: absoluteUrl(sourceUrl, context.store),
    }));
  }

  return products;
}

async function parseProducts(html: string, context: ImportContext) {
  if (context.store === "Marjane") {
    return parseMarjane(html, context);
  }

  if (context.store === "Carrefour") {
    return parseCarrefour(html, context);
  }

  if (context.store === "Boucherie Amsterdam") {
    return parseBoucherieAmsterdam(html, context);
  }

  return parseMarjane(html, context);
}

function supabaseErrorMessage(error: unknown) {
  const value = error as { message?: string; details?: string; hint?: string; code?: string };
  const parts = [value.message, value.details, value.hint, value.code].filter(Boolean);

  if (value.code === "42501" || value.message?.toLowerCase().includes("row-level security")) {
    parts.unshift("RLS bloque l'import dans products. Désactive RLS ou ajoute une policy select/insert/update pour anon.");
  }

  return parts.join("\n") || "Erreur Supabase inconnue.";
}

async function findExistingProduct(product: LocalProduct) {
  const bySource = await supabase.from("products").select("id").eq("store", product.store).eq("source_url", product.source_url).limit(1).maybeSingle();

  if (bySource.error) {
    throw new Error(supabaseErrorMessage(bySource.error));
  }

  if (bySource.data?.id) {
    return bySource.data.id as string;
  }

  const byNameAndUnit = await supabase
    .from("products")
    .select("id")
    .eq("store", product.store)
    .eq("normalized_name", product.normalized_name)
    .eq("unit", product.unit)
    .limit(1)
    .maybeSingle();

  if (byNameAndUnit.error) {
    throw new Error(supabaseErrorMessage(byNameAndUnit.error));
  }

  return (byNameAndUnit.data?.id as string | undefined) ?? null;
}

async function saveProduct(product: LocalProduct) {
  const payload: ProductPayload = {
    store: product.store,
    category: product.category,
    name: product.name,
    normalized_name: product.normalized_name,
    price: product.price,
    unit: product.unit,
    unit_quantity: product.unit_quantity,
    unit_base: product.unit_base,
    price_per_base_unit: product.price_per_base_unit,
    image_url: product.image_url,
    source_url: product.source_url,
    updated_at: new Date().toISOString(),
  };
  const existingId = await findExistingProduct(product);

  if (existingId) {
    const { error } = await supabase.from("products").update(payload).eq("id", existingId);

    if (error) {
      throw new Error(supabaseErrorMessage(error));
    }

    return "updated" as const;
  }

  const { error } = await supabase.from("products").insert(payload);

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return "imported" as const;
}

async function pathExists(target: string) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function listDirectories(target: string) {
  if (!(await pathExists(target))) {
    return [];
  }

  const entries = await readdir(target, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory());
}

async function listEntries(target: string) {
  if (!(await pathExists(target))) {
    return [];
  }

  return readdir(target, { withFileTypes: true });
}

function getStatusMessage(folderExists: boolean, hasHtml: boolean, hasFiles: boolean) {
  if (!folderExists) {
    return "dossier catégorie manquant";
  }

  if (!hasHtml) {
    return "fichier HTML manquant";
  }

  if (!hasFiles) {
    return "dossier images manquant";
  }

  return "OK";
}

export async function getImportDiagnostics(): Promise<ImportDiagnostic[]> {
  const rows = await getImportDiagnosticsWithContexts();
  return rows.map((row) => ({
    store: row.store,
    storeKey: row.storeKey,
    category: row.category,
    categoryKey: row.categoryKey,
    ok: row.ok,
    folderExists: row.folderExists,
    hasHtml: row.hasHtml,
    hasFiles: row.hasFiles,
    message: row.message,
  }));
}

async function getImportDiagnosticsWithContexts(): Promise<ImportDiagnosticWithContext[]> {
  if (!(await pathExists(IMPORTS_ROOT))) {
    return [];
  }

  const storeDirs = await listDirectories(IMPORTS_ROOT);
  const storeByKey = new Map(storeDirs.map((entry) => [slug(entry.name), entry]));
  const diagnostics: ImportDiagnosticWithContext[] = [];

  for (const expectedStoreKey of EXPECTED_STORE_KEYS) {
    const resolvedStoreEntry = STORE_DIR_ALIASES[expectedStoreKey].map((alias) => storeByKey.get(alias)).find(Boolean);
    const storeKey = expectedStoreKey;
    const store = STORE_NAMES[storeKey] ?? resolvedStoreEntry?.name ?? storeKey;

    if (!resolvedStoreEntry) {
      diagnostics.push({
        store,
        storeKey,
        category: "Magasin",
        categoryKey: "store",
        ok: false,
        folderExists: false,
        hasHtml: false,
        hasFiles: false,
        message: "dossier magasin manquant",
        context: null,
      });
      continue;
    }

    const storeDir = path.join(IMPORTS_ROOT, resolvedStoreEntry.name);
    const categoryDirs = await listDirectories(storeDir);
    for (const categoryEntry of categoryDirs) {
      const rawCategoryKey = slug(categoryEntry.name);
      const expectedCategory = EXPECTED_CATEGORIES.find((category) => category.keys.some((key) => key === rawCategoryKey));
      const category = expectedCategory?.label ?? categoryEntry.name;
      const categoryKey = expectedCategory?.categoryKey ?? rawCategoryKey;

      const categoryDir = path.join(storeDir, categoryEntry.name);
      const children = await listEntries(categoryDir);
      const html = children.find((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".html"));
      const files = children.find((entry) => entry.isDirectory() && entry.name.toLowerCase().endsWith("_files"));
      const hasHtml = Boolean(html);
      const hasFiles = Boolean(files);
      const ok = hasHtml && hasFiles;

      diagnostics.push({
        store,
        storeKey,
        category,
        categoryKey,
        ok,
        folderExists: true,
        hasHtml,
        hasFiles,
        message: getStatusMessage(true, hasHtml, hasFiles),
        context:
          ok && html && files
            ? {
                store,
                storeKey,
                storeDir,
                category,
                categoryKey,
                categoryDir,
                htmlPath: path.join(/* turbopackIgnore: true */ categoryDir, html.name),
                filesDir: path.join(/* turbopackIgnore: true */ categoryDir, files.name),
              }
            : null,
      });
    }
  }

  return diagnostics;
}

async function discoverContexts() {
  const diagnostics = await getImportDiagnosticsWithContexts();
  return diagnostics.flatMap((diagnostic) => (diagnostic.context ? [diagnostic.context] : []));
}

export async function importAllLocalStores(): Promise<AllStoresImportResult> {
  const errors: string[] = [];
  const diagnostics = await getImportDiagnostics();
  const contexts = await discoverContexts();
  const stores = new Map<string, { store: string; found: number; imported: number; updated: number }>();
  const categories: AllStoresImportResult["categories"] = [];
  let total = 0;
  let imported = 0;
  let updated = 0;

  diagnostics
    .filter((diagnostic) => !diagnostic.ok)
    .forEach((diagnostic) => {
      errors.push(`${diagnostic.store} / ${diagnostic.category}: ${diagnostic.message}`);
    });

  for (const context of contexts) {
    const storeResult = stores.get(context.store) ?? { store: context.store, found: 0, imported: 0, updated: 0 };
    const categoryResult = { store: context.store, category: context.category, found: 0, imported: 0, updated: 0 };

    try {
      const html = await readFile(context.htmlPath, "utf8");
      const products = uniqueProducts(await parseProducts(html, context));
      categoryResult.found = products.length;
      storeResult.found += products.length;
      total += products.length;

      if (products.length === 0) {
        errors.push(`${context.store} / ${context.category}: aucun produit extrait depuis ${context.htmlPath}.`);
      }

      for (const product of products) {
        try {
          const result = await saveProduct(product);

          if (result === "updated") {
            updated += 1;
            storeResult.updated += 1;
            categoryResult.updated += 1;
          } else {
            imported += 1;
            storeResult.imported += 1;
            categoryResult.imported += 1;
          }
        } catch (error) {
          errors.push(`${product.store} / ${product.name}: ${error instanceof Error ? error.message : "Erreur Supabase inconnue."}`);
        }
      }
    } catch (error) {
      errors.push(`${context.store} / ${context.category}: ${error instanceof Error ? error.message : "Erreur import inconnue."}`);
    }

    stores.set(context.store, storeResult);
    categories.push(categoryResult);
  }

  return {
    success: errors.length === 0,
    total,
    imported,
    updated,
    errors,
    stores: Array.from(stores.values()).sort((first, second) => first.store.localeCompare(second.store)),
    categories,
    diagnostics,
  };
}
