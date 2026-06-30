import { AppShell } from "@/components/AppShell";
import { CaisseCartButton } from "@/components/caisse/CaisseCartButton";
import { CaisseCartProvider } from "@/components/caisse/CaisseCartProvider";

export default function CaisseLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell title="Caisse" subtitle="Parcours tactile pour préparer, comparer et valider vos courses.">
      <CaisseCartProvider>
        <div className="space-y-5">
          <div className="flex justify-end">
            <CaisseCartButton />
          </div>
          {children}
        </div>
      </CaisseCartProvider>
    </AppShell>
  );
}
