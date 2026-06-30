import { AppShell } from "@/components/AppShell";
import { ComparateurClient } from "@/components/ComparateurClient";

export default function ComparateurPage() {
  return (
    <AppShell title="Comparateur" subtitle="Comparez les prix saisis par produit et par magasin.">
      <ComparateurClient />
    </AppShell>
  );
}
