"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { FinanceForm } from "@/components/FinanceForm";
import { addBill, deleteBill, getBills, subscribeToFinanceTable, updateBill } from "@/lib/finance-db";
import { billTypes, type Bill } from "@/lib/finance-data";
import { formatDate, formatMoney } from "@/lib/utils";

export default function FacturesPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    function loadBills() {
      getBills()
      .then((nextBills) => {
        setBills(nextBills);
        setError("");
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger les factures.");
      })
      .finally(() => setIsLoading(false));
    }

    loadBills();

    return subscribeToFinanceTable("bills", loadBills);
  }, []);

  async function handleAddBill(values: Record<string, string>) {
    setError("");
    setIsSubmitting(true);

    try {
      const bill = await addBill({
        name: values.name,
        amount: Number(values.amount),
        dueDate: values.dueDate,
        status: values.status as Bill["status"],
      });
      setBills((current) => [...current, bill].sort((first, second) => first.dueDate.localeCompare(second.dueDate)));
      setSuccess("Facture ajoutee.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Impossible d'ajouter la facture.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteBill(id: string) {
    setError("");

    try {
      await deleteBill(id);
      setBills((current) => current.filter((bill) => bill.id !== id));
      setSuccess("Facture supprimee.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Impossible de supprimer la facture.");
    }
  }

  async function handleUpdateBill(bill: Bill, values: Record<string, string>) {
    setError("");
    setIsSubmitting(true);

    try {
      const updatedBill = await updateBill(bill.id, {
        name: values.name,
        amount: Number(values.amount),
        dueDate: values.dueDate,
        status: values.status as Bill["status"],
      });
      setBills((current) =>
        current.map((item) => (item.id === bill.id ? updatedBill : item)).sort((first, second) => first.dueDate.localeCompare(second.dueDate)),
      );
      setEditingId("");
      setSuccess("Facture modifiee.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Impossible de modifier la facture.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell title="Factures" subtitle="Ajoutez vos echeances reelles pour suivre les paiements a venir.">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <FinanceForm
          title="Ajouter une facture"
          submitLabel="Ajouter la facture"
          isSubmitting={isSubmitting}
          onSubmit={handleAddBill}
          fields={[
            { label: "Type", name: "name", options: billTypes },
            { label: "Montant", name: "amount", type: "number", placeholder: "0" },
            { label: "Date d'echeance", name: "dueDate", type: "date" },
            { label: "Statut", name: "status", options: ["A payer", "Paye"] },
          ]}
        />
        <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
          <h2 className="text-lg font-semibold text-white">Echeances</h2>
          {success ? <p className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{success}</p> : null}
          {error ? <p className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p> : null}
          <div className="mt-5">
            {isLoading ? (
              <p className="rounded-lg border border-white/10 bg-black/40 p-4 text-sm text-zinc-300">Chargement des factures...</p>
            ) : bills.length === 0 ? (
              <EmptyState title="Aucune facture" description="Ajoutez votre premiere facture pour visualiser vos prochaines echeances." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {bills.map((bill) => (
                  <article key={bill.id} className="rounded-lg border border-white/10 bg-black p-5">
                    {editingId === bill.id ? (
                      <form onSubmit={(event) => {
                        event.preventDefault();
                        const values = Object.fromEntries(new FormData(event.currentTarget).entries());
                        void handleUpdateBill(bill, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])));
                      }} className="grid gap-3">
                        <select name="name" defaultValue={bill.name} className="h-10 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4">
                          {billTypes.map((type) => (
                            <option key={type}>{type}</option>
                          ))}
                        </select>
                        <input name="amount" type="number" defaultValue={bill.amount} className="h-10 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4" />
                        <input name="dueDate" type="date" defaultValue={bill.dueDate} className="h-10 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4" />
                        <select name="status" defaultValue={bill.status} className="h-10 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4">
                          <option>A payer</option>
                          <option>Paye</option>
                        </select>
                        <div className="flex gap-3 text-sm font-semibold">
                          <button type="submit" disabled={isSubmitting} className="text-emerald-300 transition hover:text-emerald-200 disabled:text-zinc-500">Enregistrer</button>
                          <button type="button" onClick={() => setEditingId("")} className="text-zinc-400 transition hover:text-zinc-200">Annuler</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-lg font-semibold text-white">{bill.name}</h3>
                          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">{bill.status}</span>
                        </div>
                        <p className="mt-5 text-3xl font-semibold">{formatMoney(bill.amount)}</p>
                        <p className="mt-2 text-sm text-zinc-500">Date d&apos;echeance: {formatDate(bill.dueDate)}</p>
                        <div className="mt-4 flex gap-3 text-sm font-semibold">
                          <button type="button" onClick={() => setEditingId(bill.id)} className="text-emerald-300 transition hover:text-emerald-200">
                            Modifier
                          </button>
                          <button type="button" onClick={() => void handleDeleteBill(bill.id)} className="text-rose-300 transition hover:text-rose-200">
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
