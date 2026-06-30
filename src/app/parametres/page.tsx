import { AppShell } from "@/components/AppShell";
import { expenseCategories } from "@/lib/finance-data";

export default function ParametresPage() {
  return (
    <AppShell title="Parametres" subtitle="Configurez le compte avant la future connexion Supabase.">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
          <h2 className="text-lg font-semibold text-white">Profil</h2>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm text-zinc-300">
              Nom
              <input className="h-11 rounded-lg border border-white/10 bg-black px-3 text-white outline-none focus:ring-4 focus:ring-emerald-400/30" placeholder="Votre nom" />
            </label>
            <label className="grid gap-2 text-sm text-zinc-300">
              Devise
              <input className="h-11 rounded-lg border border-white/10 bg-black px-3 text-white outline-none focus:ring-4 focus:ring-emerald-400/30" defaultValue="DH" />
            </label>
            <label className="grid gap-2 text-sm text-zinc-300">
              Langue
              <input className="h-11 rounded-lg border border-white/10 bg-black px-3 text-white outline-none focus:ring-4 focus:ring-emerald-400/30" defaultValue="Francais" />
            </label>
            <label className="grid gap-2 text-sm text-zinc-300">
              Objectif d&apos;epargne mensuel
              <input className="h-11 rounded-lg border border-white/10 bg-black px-3 text-white outline-none focus:ring-4 focus:ring-emerald-400/30" placeholder="0 DH" />
            </label>
          </div>
        </section>
        <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
          <h2 className="text-lg font-semibold text-white">Categories personnalisees</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {expenseCategories.map((category) => (
              <span key={category} className="rounded-full border border-white/10 bg-black px-3 py-2 text-sm text-zinc-300">{category}</span>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <input className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black px-3 text-sm text-white outline-none focus:ring-4 focus:ring-emerald-400/30" placeholder="Nouvelle categorie" />
            <button className="rounded-lg bg-emerald-400 px-4 py-3 text-sm font-bold text-black">Ajouter</button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
