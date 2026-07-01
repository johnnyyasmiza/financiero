"use client";

import { useState } from "react";
import { addOrIncrementNeed } from "@/lib/shopping-catalog";
import { calculateStockProgress, consumeFridgeItemById, deleteFridgeItem, estimateFridgeValue, formatFridgeQuantity, updateFridgeItemQuantity, type FridgeItem } from "@/lib/fridge";
import { cn, formatDate, formatMoney } from "@/lib/utils";

export function FridgeItemCard({
  item,
  onChanged,
}: {
  item: FridgeItem;
  onChanged: (message: string, tone?: "success" | "warning" | "error") => void;
}) {
  const progress = Math.round(calculateStockProgress(item));
  const value = estimateFridgeValue(item);
  const [isEditing, setIsEditing] = useState(false);
  const [quantity, setQuantity] = useState(String(item.quantity ?? item.quantityPieces ?? 1));
  const [totalQuantity, setTotalQuantity] = useState(String(item.totalQuantity ?? item.quantityWeight ?? ""));

  async function addToNeeds() {
    await addOrIncrementNeed({
      productId: null,
      store: "Frigo",
      category: "Courses",
      name: item.name,
      imageUrl: null,
      unit: "piece",
      quantity: 1,
      unitPrice: null,
      total: null,
    });
    onChanged(`${item.name} ajoute aux besoins`);
  }

  async function consumeOne() {
    try {
      const rawAmount = window.prompt("Quantite consommee", "1");
      if (rawAmount === null) return;
      const amount = Number(rawAmount.replace(",", "."));
      if (!Number.isFinite(amount) || amount <= 0) {
        onChanged("Quantite invalide.", "error");
        return;
      }
      const result = await consumeFridgeItemById(item.id, amount, item.unit || "piece");
      onChanged(result.alert ? `${result.item.name} retire. ${result.alert}` : `${result.item.name} retire du frigo`, result.alert ? "warning" : "success");
    } catch (error) {
      onChanged(error instanceof Error ? error.message : "Consommation impossible.", "error");
    }
  }

  async function saveQuantity() {
    const nextQuantity = Number(quantity);
    const nextTotalQuantity = totalQuantity ? Number(totalQuantity) : null;
    if (!Number.isFinite(nextQuantity) || nextQuantity < 0) {
      onChanged("Quantite invalide.", "error");
      return;
    }

    try {
      await updateFridgeItemQuantity(item.id, nextQuantity, Number.isFinite(nextTotalQuantity) ? nextTotalQuantity : null);
      setIsEditing(false);
      onChanged(`${item.name} mis a jour`);
    } catch (error) {
      onChanged(error instanceof Error ? error.message : "Modification impossible.", "error");
    }
  }

  async function removeItem() {
    try {
      await deleteFridgeItem(item.id);
      onChanged(`${item.name} supprime du frigo`);
    } catch (error) {
      onChanged(error instanceof Error ? error.message : "Suppression impossible.", "error");
    }
  }

  return (
    <article className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.name} className="size-16 shrink-0 rounded-lg border border-zinc-100 object-contain p-1" />
          ) : null}
          <div className="min-w-0">
          <h3 className="text-lg font-black text-zinc-950">{item.name}</h3>
          <p className="mt-1 text-sm font-semibold text-zinc-500">{formatFridgeQuantity(item)}</p>
          <p className="mt-1 text-xs font-bold text-zinc-400">{item.store || "Magasin non renseigne"}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-800">{item.category}</span>
          {item.status === "epuise" || progress <= 0 ? <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-black text-red-700">Epuise</span> : null}
        </div>
      </div>

      <div className="mt-4 h-3 rounded-full bg-zinc-100">
        <div className={cn("h-3 rounded-full", progress <= 0 ? "bg-red-500" : progress <= (item.lowStockThreshold ?? 20) ? "bg-yellow-400" : progress > 50 ? "bg-emerald-400" : "bg-orange-400")} style={{ width: `${Math.max(progress, progress > 0 ? 3 : 0)}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs font-bold text-zinc-500">
        <span>{progress}%</span>
        <span>{formatMoney(value)} restants</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-500">
        <p>Prix achat : {formatMoney(item.purchasePrice ?? item.totalPrice ?? 0)}</p>
        <p>Date achat : {formatDate(item.purchaseDate)}</p>
        <p>Restant : {formatFridgeQuantity(item)}</p>
        {item.pricePerGram ? <p>100 {item.unit === "ml" ? "ml" : "g"} : {formatMoney(item.pricePerGram * 100)}</p> : null}
        {item.pricePerPiece ? <p>Piece : {formatMoney(item.pricePerPiece)}</p> : null}
        {item.averageWeightPerPiece ? <p className="col-span-2">Poids moyen : {Math.round(item.averageWeightPerPiece)} g / piece</p> : null}
      </div>

      {isEditing ? (
        <div className="mt-4 grid gap-2 rounded-lg bg-blue-50 p-3">
          <input value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" min="0" step="0.01" className="h-10 rounded-lg border border-blue-100 px-3 text-sm font-semibold outline-none focus:border-blue-500" />
          <input value={totalQuantity} onChange={(event) => setTotalQuantity(event.target.value)} type="number" min="0" step="0.01" placeholder="Quantite totale restante" className="h-10 rounded-lg border border-blue-100 px-3 text-sm font-semibold outline-none focus:border-blue-500" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void saveQuantity()} className="h-10 rounded-lg bg-blue-600 px-2 text-xs font-black text-white">Enregistrer</button>
            <button type="button" onClick={() => setIsEditing(false)} className="h-10 rounded-lg border border-blue-100 bg-white px-2 text-xs font-black text-blue-800">Annuler</button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button type="button" onClick={() => setIsEditing(true)} className="h-10 rounded-lg border border-blue-100 px-2 text-xs font-black text-blue-800">
          Modifier
        </button>
        <button type="button" onClick={() => void consumeOne()} className="h-10 rounded-lg bg-zinc-950 px-2 text-xs font-black text-white">
          Consommer
        </button>
        <button type="button" onClick={() => void addToNeeds()} className="h-10 rounded-lg bg-yellow-100 px-2 text-xs font-black text-yellow-900">
          Besoins
        </button>
        <button type="button" onClick={() => void removeItem()} className="h-10 rounded-lg bg-red-50 px-2 text-xs font-black text-red-700">
          Supprimer
        </button>
      </div>
    </article>
  );
}
