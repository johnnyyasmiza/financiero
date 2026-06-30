import { AppShell } from "@/components/AppShell";
import { DashboardClient } from "@/components/DashboardClient";

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard" subtitle="Votre espace financier demarre vide et se remplit avec vos propres donnees.">
      <DashboardClient />
    </AppShell>
  );
}
