import { CaisseProductsPage } from "@/components/caisse/CaisseProductsPage";

export default async function ProduitsPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; category?: string }>;
}) {
  const { store, category } = await searchParams;
  return <CaisseProductsPage storeKey={store ?? ""} categoryKey={category ?? ""} />;
}
