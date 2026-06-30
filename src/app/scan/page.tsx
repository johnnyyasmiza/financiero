import { AppShell } from "@/components/AppShell";
import { ScanReceiptClient } from "@/components/ScanReceiptClient";

export default function ScanPage() {
  return (
    <AppShell title="Scan facture" subtitle="Importez une image et confirmez les champs avant enregistrement.">
      <ScanReceiptClient />
    </AppShell>
  );
}
