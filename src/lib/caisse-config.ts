import type { ShoppingProduct } from "@/lib/shopping-catalog";

export const caisseStores = [
  { name: "Marjane", key: "marjane", logo: "/logo/marjane.jpg", accent: "border-blue-500", bg: "from-blue-50 to-white", button: "bg-blue-600 text-white hover:bg-blue-700" },
  { name: "Carrefour", key: "carrefour", logo: "/logo/carrefour.svg", accent: "border-blue-600", bg: "from-blue-50 via-white to-red-50", button: "bg-blue-600 text-white hover:bg-red-600" },
  { name: "Boucherie Amsterdam", key: "boucherie-amsterdam", logo: "/logo/boucherie-amsterdam.png", accent: "border-red-500", bg: "from-red-50 to-white", button: "bg-red-600 text-white hover:bg-red-700" },
  { name: "HRI", key: "hri", logo: "/logo/hri.png", accent: "border-yellow-500", bg: "from-yellow-50 to-white", button: "bg-yellow-400 text-black hover:bg-yellow-300" },
  { name: "Swika", key: "swika", logo: "/logo/swika.png", accent: "border-emerald-500", bg: "from-emerald-50 to-white", button: "bg-emerald-500 text-black hover:bg-emerald-400" },
] as const;

export const caisseCategories = [
  { name: "Bébé", key: "bebe", logo: "/logo/bebe.png", accent: "border-blue-400", bg: "from-blue-50 to-white" },
  { name: "Charcuterie", key: "charcutrie", logo: "/logo/charcutrie.png", accent: "border-red-500", bg: "from-red-50 to-white" },
  { name: "Épicerie", key: "epicerie", logo: "/logo/epicerie.png", accent: "border-yellow-500", bg: "from-yellow-50 to-white" },
  { name: "Fromage", key: "fromage", logo: "/logo/fromage.png", accent: "border-yellow-400", bg: "from-yellow-50 to-white" },
  { name: "Fruits", key: "fruits", logo: "/logo/fruits.png", accent: "border-emerald-500", bg: "from-emerald-50 to-white" },
  { name: "Légumes", key: "legumes", logo: "/logo/legumes.png", accent: "border-green-500", bg: "from-green-50 to-white" },
  { name: "Viande", key: "viande", logo: "/logo/viande.png", accent: "border-red-600", bg: "from-red-50 to-white" },
  { name: "Volaille", key: "volaille", logo: "/logo/volaille.png", accent: "border-red-400", bg: "from-red-50 to-white" },
] as const;

export function formatCaissePrice(value: number | null) {
  if (!value || value <= 0) {
    return "Prix à définir";
  }

  return `${new Intl.NumberFormat("fr-MA", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)} DH`;
}

export function normalizeCaisseKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/s$/g, "")
    .replace("charcuterie", "charcutrie")
    .replace(/[^a-z0-9]+/g, "");
}

export function getStoreByKey(key: string | null | undefined) {
  return caisseStores.find((store) => store.key === key) ?? null;
}

export function getStoreByName(name: string | null | undefined) {
  return caisseStores.find((store) => store.name === name) ?? null;
}

export function getCategoryByKey(key: string | null | undefined) {
  return caisseCategories.find((category) => category.key === key) ?? null;
}

export function productMatchesRoute(product: ShoppingProduct, storeKey: string, categoryKey: string) {
  const store = getStoreByKey(storeKey);
  return Boolean(store && product.store === store.name && normalizeCaisseKey(product.category) === categoryKey);
}
