import { AppShell } from "@/components/AppShell";
import { FrigoClient } from "@/components/frigo/FrigoClient";

export default function FrigoPage() {
  return (
    <AppShell title="Mon Frigo" subtitle="Stock maison, recettes et alertes intelligentes.">
      <FrigoClient />
    </AppShell>
  );
}
