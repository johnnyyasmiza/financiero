import type { ShoppingProduct } from "@/lib/shopping-catalog";

export type CaisseCategoryKey = "bebe" | "charcuterie" | "epicerie" | "fromage" | "fruits" | "legumes" | "viande" | "volaille";

export const caisseStores = [
  { name: "Marjane", key: "marjane", logo: "/logo/marjane.jpg", accent: "border-blue-500", bg: "from-blue-50 to-white", button: "bg-blue-600 text-white hover:bg-blue-700" },
  { name: "Carrefour", key: "carrefour", logo: "/logo/carrefour.svg", accent: "border-blue-600", bg: "from-blue-50 via-white to-red-50", button: "bg-blue-600 text-white hover:bg-red-600" },
  { name: "Boucherie Amsterdam", key: "boucherie-amsterdam", logo: "/logo/boucherie-amsterdam.png", accent: "border-red-500", bg: "from-red-50 to-white", button: "bg-red-600 text-white hover:bg-red-700" },
  { name: "HRI", key: "hri", logo: "/logo/hri.png", accent: "border-yellow-500", bg: "from-yellow-50 to-white", button: "bg-yellow-400 text-black hover:bg-yellow-300" },
  { name: "Swika", key: "swika", logo: "/logo/swika.png", accent: "border-emerald-500", bg: "from-emerald-50 to-white", button: "bg-emerald-500 text-black hover:bg-emerald-400" },
] as const;

export const caisseCategories = [
  { name: "Bebe", key: "bebe", logo: "/logo/bebe.png", accent: "border-blue-400", bg: "from-blue-50 to-white" },
  { name: "Charcuterie", key: "charcuterie", logo: "/logo/charcutrie.png", accent: "border-red-500", bg: "from-red-50 to-white" },
  { name: "Epicerie", key: "epicerie", logo: "/logo/epicerie.png", accent: "border-yellow-500", bg: "from-yellow-50 to-white" },
  { name: "Fromage", key: "fromage", logo: "/logo/fromage.png", accent: "border-yellow-400", bg: "from-yellow-50 to-white" },
  { name: "Fruits", key: "fruits", logo: "/logo/fruits.png", accent: "border-emerald-500", bg: "from-emerald-50 to-white" },
  { name: "Legumes", key: "legumes", logo: "/logo/legumes.png", accent: "border-green-500", bg: "from-green-50 to-white" },
  { name: "Viande", key: "viande", logo: "/logo/viande.png", accent: "border-red-600", bg: "from-red-50 to-white" },
  { name: "Volaille", key: "volaille", logo: "/logo/volaille.png", accent: "border-red-400", bg: "from-red-50 to-white" },
] as const;

const categoryAliases: Record<string, CaisseCategoryKey> = {
  bebe: "bebe",
  baby: "bebe",
  charcutrie: "charcuterie",
  charcuterie: "charcuterie",
  epicerie: "epicerie",
  fromage: "fromage",
  fruit: "fruits",
  fruits: "fruits",
  legume: "legumes",
  legumes: "legumes",
  viande: "viande",
  viandes: "viande",
  volaille: "volaille",
  volailles: "volaille",
};

const fallbackStoreCategories: Record<string, CaisseCategoryKey[]> = {
  marjane: ["bebe", "charcuterie", "epicerie", "fromage", "fruits", "legumes", "viande", "volaille"],
  carrefour: ["bebe", "charcuterie", "epicerie", "fromage", "fruits", "legumes", "viande", "volaille"],
};

const logoExtensions = [".png", ".jpg", ".jpeg", ".webp", ".svg"] as const;
const knownLogoFiles = new Set([
  "bebe.png",
  "charcutrie.png",
  "epicerie.png",
  "fromage.png",
  "fruits.png",
  "legumes.png",
  "viande.png",
  "volaille.png",
]);

export function formatCaissePrice(value: number | null) {
  if (!value || value <= 0) {
    return "Prix a definir";
  }

  return `${new Intl.NumberFormat("fr-MA", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)} DH`;
}

export function normalizeCaisseKey(value: string) {
  const compact = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  return categoryAliases[compact] ?? compact;
}

export function findLogo(categoryKey: string) {
  const key = normalizeCaisseKey(categoryKey);
  const fileName = key === "charcuterie" ? "charcutrie" : key;
  const match = logoExtensions.map((extension) => `${fileName}${extension}`).find((candidate) => knownLogoFiles.has(candidate));
  return `/logo/${match ?? `${fileName}.png`}`;
}

export function getStoreByKey(key: string | null | undefined) {
  return caisseStores.find((store) => store.key === key) ?? null;
}

export function getStoreByName(name: string | null | undefined) {
  return caisseStores.find((store) => store.name === name) ?? null;
}

export function getCategoryByKey(key: string | null | undefined) {
  const normalizedKey = key ? normalizeCaisseKey(key) : null;
  return caisseCategories.find((category) => category.key === normalizedKey) ?? null;
}

export function getFallbackCategoryKeys(storeKey: string): CaisseCategoryKey[] {
  return fallbackStoreCategories[storeKey] ?? [];
}

export function productMatchesRoute(product: ShoppingProduct, storeKey: string, categoryKey: string) {
  const store = getStoreByKey(storeKey);
  return Boolean(store && product.store === store.name && normalizeCaisseKey(product.category) === normalizeCaisseKey(categoryKey));
}
