import { AppShell } from "@/components/AppShell";
import { NeedsClient } from "@/components/needs/NeedsClient";

export default async function BesoinsPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string }>;
}) {
  const { added } = await searchParams;

  return (
    <AppShell title="Besoins" subtitle="Liste de courses moderne pour les produits encore a acheter.">
      <NeedsClient initialMessage={added ? "Produits ajoutes aux besoins" : ""} />
    </AppShell>
  );
}
