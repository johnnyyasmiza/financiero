import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { formatMoney } from "@/lib/utils";

export default function RapportsPage() {
  return (
    <AppShell title="Rapports" subtitle="Les rapports mensuels seront generes a partir de vos propres donnees.">
      <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-300">Rapport mensuel</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Aucune donnee</h2>
            <p className="mt-2 text-zinc-400">Votre rapport apparaitra apres vos premieres saisies.</p>
          </div>
          <button className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-sm font-bold text-emerald-200">
            Exporter PDF
          </button>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-black p-5"><p className="text-sm text-zinc-500">Revenus</p><p className="mt-3 text-2xl font-semibold text-emerald-300">{formatMoney(0)}</p></div>
          <div className="rounded-lg bg-black p-5"><p className="text-sm text-zinc-500">Depenses</p><p className="mt-3 text-2xl font-semibold text-white">{formatMoney(0)}</p></div>
          <div className="rounded-lg bg-black p-5"><p className="text-sm text-zinc-500">Epargne</p><p className="mt-3 text-2xl font-semibold text-emerald-300">{formatMoney(0)}</p></div>
        </div>
      </section>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
          <h2 className="text-lg font-semibold text-white">Top categories</h2>
          <div className="mt-5">
            <EmptyState title="Aucune categorie" description="Les categories les plus importantes apparaitront lorsque vous aurez ajoute des depenses." />
          </div>
        </section>
        <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
          <h2 className="text-lg font-semibold text-white">Conseils IA</h2>
          <div className="mt-5">
            <EmptyState title="Aucun conseil" description="Les conseils IA seront calcules uniquement a partir de vos donnees reelles." />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
