import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";

const suggestions = [
  "Combien ai-je depense ce mois-ci ?",
  "Combien coute mon bebe par mois ?",
  "Puis-je faire un nouvel achat ?",
  "Ou part mon argent ?",
];

export default function AssistantPage() {
  return (
    <AppShell title="Assistant IA" subtitle="L'assistant analysera vos donnees lorsque vous les aurez ajoutees.">
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
          <h2 className="text-lg font-semibold text-white">Suggestions</h2>
          <div className="mt-5 grid gap-3">
            {suggestions.map((suggestion) => (
              <button key={suggestion} className="rounded-lg border border-white/10 bg-black px-4 py-3 text-left text-sm text-zinc-200 hover:border-emerald-400/40 hover:text-emerald-200">
                {suggestion}
              </button>
            ))}
          </div>
        </aside>
        <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
          <EmptyState
            title="Assistant en attente de donnees"
            description="Ajoutez un revenu, une depense, un actif ou une facture pour permettre a Financiero de produire une analyse personnelle."
          />
          <div className="mt-6 flex gap-3 rounded-lg border border-white/10 bg-black p-2">
            <input className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-zinc-600" placeholder="Demandez une analyse financiere..." />
            <button className="rounded-lg bg-emerald-400 px-5 py-3 text-sm font-bold text-black">Envoyer</button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
