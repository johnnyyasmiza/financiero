"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { FinanceForm } from "@/components/FinanceForm";
import { addAsset, deleteAsset, getAssets, subscribeToFinanceTable, updateAsset } from "@/lib/finance-db";
import { assetTypes, type Asset } from "@/lib/finance-data";
import { formatMoney } from "@/lib/utils";

export default function PatrimoinePage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const netWorth = assets.reduce((total, asset) => total + asset.value, 0);

  useEffect(() => {
    function loadAssets() {
      getAssets()
      .then((nextAssets) => {
        setAssets(nextAssets);
        setError("");
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger le patrimoine.");
      })
      .finally(() => setIsLoading(false));
    }

    loadAssets();

    return subscribeToFinanceTable("assets", loadAssets);
  }, []);

  async function handleAddAsset(values: Record<string, string>) {
    setError("");
    setIsSubmitting(true);

    try {
      const asset = await addAsset({
        name: values.name,
        value: Number(values.value),
      });
      setAssets((current) => [...current, asset].sort((first, second) => first.name.localeCompare(second.name)));
      setSuccess("Element ajoute au patrimoine.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Impossible d'ajouter au patrimoine.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteAsset(id: string) {
    setError("");

    try {
      await deleteAsset(id);
      setAssets((current) => current.filter((asset) => asset.id !== id));
      setSuccess("Element supprime.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Impossible de supprimer cet element.");
    }
  }

  async function handleUpdateAsset(asset: Asset, values: Record<string, string>) {
    setError("");
    setIsSubmitting(true);

    try {
      const updatedAsset = await updateAsset(asset.id, {
        name: values.name,
        value: Number(values.value),
      });
      setAssets((current) => current.map((item) => (item.id === asset.id ? updatedAsset : item)).sort((first, second) => first.name.localeCompare(second.name)));
      setEditingId("");
      setSuccess("Element modifie.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Impossible de modifier cet element.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell title="Patrimoine" subtitle="Ajoutez vos actifs et dettes pour calculer votre patrimoine net.">
      <section className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-6">
        <p className="text-sm font-medium text-emerald-200">Patrimoine net calcule</p>
        <p className="mt-3 text-4xl font-semibold text-white">{formatMoney(netWorth)}</p>
        <p className="mt-2 max-w-2xl text-sm text-zinc-300">Actifs moins dettes, base uniquement sur vos donnees saisies.</p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <FinanceForm
          title="Ajouter un actif ou une dette"
          submitLabel="Ajouter au patrimoine"
          isSubmitting={isSubmitting}
          onSubmit={handleAddAsset}
          fields={[
            { label: "Type", name: "name", options: assetTypes },
            { label: "Valeur", name: "value", type: "number", placeholder: "0" },
          ]}
        />
        <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
          <h2 className="text-lg font-semibold text-white">Actifs et dettes</h2>
          {success ? <p className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{success}</p> : null}
          {error ? <p className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p> : null}
          <div className="mt-5">
            {isLoading ? (
              <p className="rounded-lg border border-white/10 bg-black/40 p-4 text-sm text-zinc-300">Chargement du patrimoine...</p>
            ) : assets.length === 0 ? (
              <EmptyState title="Aucun actif" description="Ajoutez votre premier actif ou une dette pour construire votre patrimoine net." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {assets.map((asset) => (
                  <article key={asset.id} className="rounded-lg border border-white/10 bg-black p-5">
                    {editingId === asset.id ? (
                      <form onSubmit={(event) => {
                        event.preventDefault();
                        const values = Object.fromEntries(new FormData(event.currentTarget).entries());
                        void handleUpdateAsset(asset, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])));
                      }} className="grid gap-3">
                        <select name="name" defaultValue={asset.name} className="h-10 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4">
                          {assetTypes.map((type) => (
                            <option key={type}>{type}</option>
                          ))}
                        </select>
                        <input name="value" type="number" defaultValue={asset.value} className="h-10 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4" />
                        <div className="flex gap-3 text-sm font-semibold">
                          <button type="submit" disabled={isSubmitting} className="text-emerald-300 transition hover:text-emerald-200 disabled:text-zinc-500">Enregistrer</button>
                          <button type="button" onClick={() => setEditingId("")} className="text-zinc-400 transition hover:text-zinc-200">Annuler</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className="text-sm text-zinc-400">{asset.name}</p>
                        <p className={asset.value < 0 ? "mt-3 text-2xl font-semibold text-rose-300" : "mt-3 text-2xl font-semibold text-white"}>
                          {formatMoney(asset.value)}
                        </p>
                        <div className="mt-4 flex gap-3 text-sm font-semibold">
                          <button type="button" onClick={() => setEditingId(asset.id)} className="text-emerald-300 transition hover:text-emerald-200">
                            Modifier
                          </button>
                          <button type="button" onClick={() => void handleDeleteAsset(asset.id)} className="text-rose-300 transition hover:text-rose-200">
                            Supprimer
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
