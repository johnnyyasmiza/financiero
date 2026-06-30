import { type Transaction } from "@/lib/finance-data";
import { formatDate, formatMoney } from "@/lib/utils";

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Dernieres transactions</h2>
        <span className="text-xs font-medium text-emerald-300">Compte neuf</span>
      </div>
      {transactions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/15 bg-black/40 p-6 text-center">
          <p className="font-medium text-white">Aucune transaction pour le moment</p>
          <p className="mt-2 text-sm text-zinc-500">Vos mouvements apparaitront ici apres votre premiere saisie.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between gap-4 rounded-lg bg-white/[0.03] p-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-100">{transaction.title}</p>
                <p className="text-sm text-zinc-500">
                  {transaction.category} - {formatDate(transaction.date)}
                </p>
              </div>
              <p className={transaction.amount > 0 ? "font-semibold text-emerald-300" : "font-semibold text-zinc-100"}>
                {formatMoney(transaction.amount)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
