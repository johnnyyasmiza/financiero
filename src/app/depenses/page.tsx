import { AppShell } from "@/components/AppShell";
import { ExpensesClient } from "@/components/ExpensesClient";

export default function DepensesPage() {
  return (
    <AppShell title="Depenses" subtitle="Ajoutez, classez et analysez uniquement vos propres sorties d'argent.">
      <ExpensesClient />
    </AppShell>
  );
}
