"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { caisseStores } from "@/lib/caisse-config";
import { useCaisseCart } from "@/components/caisse/CaisseCartProvider";
import { cn } from "@/lib/utils";

type ImportDiagnostic = {
  store: string;
  category: string;
  ok: boolean;
  message: string;
};

type ImportResult = {
  total: number;
  imported: number;
  updated: number;
  errors: string[];
  stores: Array<{ store: string; found: number }>;
  diagnostics: ImportDiagnostic[];
};

export function CaisseStorePage() {
  const { reloadProducts } = useCaisseCart();
  const [diagnostics, setDiagnostics] = useState<ImportDiagnostic[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/import/status")
      .then((response) => response.json())
      .then((payload: { diagnostics: ImportDiagnostic[] }) => setDiagnostics(payload.diagnostics ?? []))
      .catch(() => setDiagnostics([]));
  }, []);

  async function syncStores() {
    setIsImporting(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/import/all-stores", { method: "POST" });
      const payload = (await response.json()) as ImportResult;

      setResult(payload);
      setDiagnostics(payload.diagnostics ?? []);
      reloadProducts();

      if (payload.errors.length > 0) {
        setError(payload.errors.slice(0, 6).join("\n") + (payload.errors.length > 6 ? `\n${payload.errors.length - 6} autres erreurs.` : ""));
      }
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Impossible de synchroniser les magasins.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase text-blue-600">Caisse tactile</p>
            <h2 className="mt-1 text-3xl font-black text-zinc-950">Choisir le magasin</h2>
          </div>
          <button type="button" onClick={() => void syncStores()} disabled={isImporting} className="h-14 rounded-lg bg-blue-600 px-6 text-base font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-300">
            {isImporting ? "Synchronisation..." : "Synchroniser les magasins"}
          </button>
        </div>
      </section>

      {error ? <p className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}
      {result ? (
        <div className="grid gap-3 rounded-lg border border-blue-100 bg-white p-4 text-sm text-zinc-700 shadow-sm sm:grid-cols-4">
          {result.stores.map((store) => (
            <span key={store.store}>
              {store.store} : <strong className="text-zinc-950">{store.found}</strong>
            </span>
          ))}
          <span>Total : <strong className="text-zinc-950">{result.total}</strong></span>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {caisseStores.map((store) => (
          <Link
            key={store.key}
            href={`/caisse/categories?store=${store.key}`}
            className={cn("group min-h-64 rounded-lg border-2 bg-gradient-to-br p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl active:scale-[0.98]", store.accent, store.bg)}
          >
            <div className="grid h-36 place-items-center rounded-lg bg-white p-4 shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={store.logo} alt={store.name} className="max-h-28 max-w-full object-contain" />
            </div>
            <h3 className="mt-5 text-xl font-black text-zinc-950">{store.name}</h3>
          </Link>
        ))}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-zinc-950">État des imports</h2>
          <span className="text-xs font-bold text-zinc-500">{diagnostics.filter((item) => item.ok).length}/{diagnostics.length} OK</span>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {diagnostics.length === 0 ? (
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-500">Diagnostic indisponible.</p>
          ) : (
            diagnostics.map((item) => (
              <div key={`${item.store}-${item.category}`} className={cn("rounded-lg border p-3 text-sm", item.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800")}>
                <span className="font-black">{item.ok ? "OK" : "ERREUR"} {item.store} / {item.category}</span>
                <span className="ml-2 text-xs opacity-80">{item.message}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
