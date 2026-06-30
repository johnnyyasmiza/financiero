import { CaisseCategoriesPage } from "@/components/caisse/CaisseCategoriesPage";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const { store } = await searchParams;
  return <CaisseCategoriesPage storeKey={store ?? ""} />;
}
