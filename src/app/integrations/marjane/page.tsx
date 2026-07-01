import { AppShell } from "@/components/AppShell";
import { MarjaneConnectClient } from "@/components/integrations/MarjaneConnectClient";

export default function MarjaneConnectPage() {
  return (
    <AppShell title="Marjane Connect" subtitle="Import manuel JSON ou URL API autorisee par le navigateur.">
      <MarjaneConnectClient />
    </AppShell>
  );
}
