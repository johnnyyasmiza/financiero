"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { TransactionList } from "@/components/TransactionList";
import { getAssets, getExpenses, getRevenues, subscribeToFinanceTable } from "@/lib/finance-db";
import { type Asset, type Expense, type Income, type Stat, type Transaction } from "@/lib/finance-data";
import { getNeeds, subscribeToNeeds, type Need } from "@/lib/shopping-catalog";
import { formatMoney } from "@/lib/utils";

const quickActions = [
  { href: "/revenus", label: "Ajouter un revenu" },
  { href: "/depenses", label: "Ajouter une depense" },
  { href: "/patrimoine", label: "Ajouter un actif" },
  { href: "/factures", label: "Ajouter une facture" },
];

function isCurrentMonth(date: string) {
  if (!date) {
    return false;
  }

  const value = new Date(`${date}T00:00:00`);
  const now = new Date();

  return !Number.isNaN(value.getTime()) && value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth();
}

export function DashboardClient() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [revenues, setRevenues] = useState<Income[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    function loadDashboard(showLoading = false) {
      if (showLoading) {
        setIsLoading(true);
      }

      Promise.all([getExpenses(), getRevenues(), getAssets(), getNeeds()])
      .then(([nextExpenses, nextRevenues, nextAssets, nextNeeds]) => {
        setExpenses(nextExpenses);
        setRevenues(nextRevenues);
        setAssets(nextAssets);
        setNeeds(nextNeeds);
        setError("");
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger le dashboard.");
      })
      .finally(() => setIsLoading(false));
    }

    loadDashboard(true);

    const unsubscribers = [
      subscribeToFinanceTable("expenses", () => loadDashboard()),
      subscribeToFinanceTable("revenues", () => loadDashboard()),
      subscribeToFinanceTable("assets", () => loadDashboard()),
      subscribeToNeeds(() => loadDashboard()),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const monthlyExpenses = expenses.filter((expense) => isCurrentMonth(expense.date));
  const monthlyRevenues = revenues.filter((revenue) => isCurrentMonth(revenue.date));
  const totalExpenses = expenses.reduce((total, expense) => total + expense.amount, 0);
  const totalRevenues = revenues.reduce((total, revenue) => total + revenue.amount, 0);
  const monthlyExpenseTotal = monthlyExpenses.reduce((total, expense) => total + expense.amount, 0);
  const monthlyIncomeTotal = monthlyRevenues.reduce((total, revenue) => total + revenue.amount, 0);
  const totalBalance = totalRevenues - totalExpenses;
  const monthlySavings = monthlyIncomeTotal - monthlyExpenseTotal;
  const netWorth = assets.reduce((total, asset) => total + asset.value, 0);
  const needsCount = needs.reduce((total, need) => total + need.quantity, 0);
  const needsTotal = needs.reduce((total, need) => total + (need.total ?? 0), 0);
  const stats: Stat[] = [
    { label: "Solde total", value: totalBalance, tone: "emerald" },
    { label: "Revenus du mois", value: monthlyIncomeTotal, tone: "blue" },
    { label: "Depenses du mois", value: monthlyExpenseTotal, tone: "amber" },
    { label: "Epargne du mois", value: monthlySavings, tone: "emerald" },
    { label: "Patrimoine net", value: netWorth, tone: "violet" },
  ];
  const transactions: Transaction[] = [
    ...revenues.map((revenue) => ({
      id: revenue.id,
      title: revenue.source,
      category: "Revenu",
      amount: revenue.amount,
      date: revenue.date,
    })),
    ...expenses.map((expense) => ({
      id: expense.id,
      title: expense.merchant ?? expense.category,
      category: expense.category,
      amount: -expense.amount,
      date: expense.date,
    })),
  ].sort((first, second) => second.date.localeCompare(first.date));
  const categoryTotals = monthlyExpenses.reduce<Record<string, number>>((totals, expense) => {
    totals[expense.category] = (totals[expense.category] ?? 0) + expense.amount;
    return totals;
  }, {});
  const categories = Object.entries(categoryTotals).sort(([, first], [, second]) => second - first);

  return (
    <>
      {error ? <p className="mb-4 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p> : null}
      {isLoading ? <p className="mb-4 rounded-lg border border-white/10 bg-black/40 p-4 text-sm text-zinc-300">Chargement du dashboard...</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <Link href="/besoins" className="mt-4 block rounded-lg border border-blue-100 bg-white p-5 shadow-sm transition hover:border-blue-400 hover:shadow-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase text-blue-600">Besoins</p>
            <p className="mt-2 text-3xl font-black text-zinc-950">{needsCount}</p>
            <p className="mt-1 text-sm text-zinc-500">produit(s) encore a acheter</p>
          </div>
          <div className="rounded-lg bg-emerald-50 px-4 py-3 text-right">
            <p className="text-xs font-black uppercase text-emerald-700">Total estime</p>
            <p className="text-xl font-black text-emerald-900">{formatMoney(needsTotal)}</p>
          </div>
        </div>
      </Link>

      {!isLoading && expenses.length === 0 && revenues.length === 0 && assets.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Bienvenue sur Financiero"
            description="Commencez par ajouter votre premier revenu ou votre premiere depense."
            actions={quickActions}
          />
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <TransactionList transactions={transactions} />
        <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
          <h2 className="text-lg font-semibold text-white">Repartition des depenses</h2>
          {categories.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-white/15 bg-black/40 p-6 text-center">
              <p className="font-medium text-white">Aucune depense enregistree</p>
              <p className="mt-2 text-sm text-zinc-500">Les categories apparaitront apres vos premieres depenses.</p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {categories.map(([category, total]) => {
                const width = monthlyExpenseTotal > 0 ? `${Math.max((total / monthlyExpenseTotal) * 100, 6)}%` : "0%";

                return (
                  <div key={category}>
                    <div className="mb-2 flex justify-between text-sm">
                      <span className="text-zinc-300">{category}</span>
                      <span className="text-zinc-500">{formatMoney(total)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full bg-emerald-400" style={{ width }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-white/10 bg-zinc-950/70 p-5">
        <h2 className="text-lg font-semibold text-white">Alertes IA</h2>
        <div className="mt-4 rounded-lg border border-dashed border-white/15 bg-black/40 p-6 text-center">
          <p className="font-medium text-white">Aucune alerte pour le moment</p>
          <p className="mt-2 text-sm text-zinc-500">Financiero analysera vos tendances lorsque vous aurez ajoute vos donnees.</p>
        </div>
      </section>
    </>
  );
}
