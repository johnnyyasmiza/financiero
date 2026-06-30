"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addExpense } from "@/lib/finance-db";
import { expenseCategories, paymentMethods } from "@/lib/finance-data";
import { readImageText } from "@/lib/ocr";
import { parseReceiptText, type ParsedReceipt } from "@/lib/receipt-parser";
import { cn, getTodayDate } from "@/lib/utils";

const acceptedTypes = ["image/png", "image/jpeg", "image/webp"];

export function ScanReceiptClient() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ParsedReceipt | null>(null);

  function handleFile(file: File) {
    setError("");
    setResult(null);
    setOcrText("");

    if (!acceptedTypes.includes(file.type)) {
      setError("Format non supporté. Importez une image png, jpg, jpeg ou webp.");
      return;
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextPreviewUrl;
    setSelectedFile(file);
    setPreviewUrl(nextPreviewUrl);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      handleFile(file);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      handleFile(file);
    }
  }

  async function analyzeReceipt() {
    if (!selectedFile) {
      setError("Importez une image avant de lancer l'analyse.");
      return;
    }

    setError("");
    setIsAnalyzing(true);

    try {
      const text = await readImageText(selectedFile);
      setOcrText(text);
      setResult(parseReceiptText(text));
    } catch {
      setError("Lecture impossible. Essayez une image plus nette ou mieux cadrée.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function updateResult(field: keyof ParsedReceipt, value: string) {
    setResult((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [field]: field === "montant" ? (value === "" ? "" : Number(value)) : value,
      };
    });
  }

  async function confirmExpense() {
    if (!result) {
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      await addExpense({
        merchant: result.marchand.trim(),
        amount: result.montant === "" ? 0 : result.montant,
        date: result.date || getTodayDate(),
        category: result.categorie,
        payment: result.moyenPaiement,
        note: result.note,
      });
      router.push("/depenses?scan=success");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d'enregistrer la depense.");
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
        <h2 className="text-lg font-semibold text-white">Importer une facture</h2>
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "mt-5 grid min-h-72 place-items-center rounded-lg border border-dashed p-6 text-center transition",
            isDragging ? "border-emerald-400 bg-emerald-400/10" : "border-white/15 bg-black/40",
          )}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Aperçu de la facture importée" className="max-h-80 w-full rounded-lg object-contain" />
          ) : (
            <div>
              <p className="font-medium text-white">Glissez une image ici</p>
              <p className="mt-2 text-sm text-zinc-500">PNG, JPG, JPEG ou WEBP</p>
            </div>
          )}
        </div>

        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleInputChange} className="hidden" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-white/10 px-4 py-3 text-sm font-bold text-zinc-100 transition hover:border-emerald-400/40 hover:text-emerald-200"
          >
            Importer une image
          </button>
          <button
            type="button"
            onClick={() => void analyzeReceipt()}
            disabled={!selectedFile || isAnalyzing}
            className="rounded-lg bg-emerald-400 px-4 py-3 text-sm font-bold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            Analyser la facture
          </button>
        </div>

        {isAnalyzing ? <p className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">Lecture de la facture en cours...</p> : null}
        {error ? <p className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p> : null}

        {ocrText ? (
          <details className="mt-5 rounded-lg border border-white/10 bg-black/50 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-200">Texte détecté</summary>
            <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs leading-5 text-zinc-400">{ocrText}</pre>
          </details>
        ) : null}
      </section>

      <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
        <h2 className="text-lg font-semibold text-white">Dépense à confirmer</h2>
        {result ? (
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm text-zinc-300">
              Montant
              <input
                type="number"
                min="0"
                value={result.montant}
                onChange={(event) => updateResult("montant", event.target.value)}
                className="h-11 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4"
              />
            </label>
            <label className="grid gap-2 text-sm text-zinc-300">
              Date
              <input
                type="date"
                value={result.date || getTodayDate()}
                onChange={(event) => updateResult("date", event.target.value)}
                className="h-11 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4"
              />
            </label>
            <label className="grid gap-2 text-sm text-zinc-300">
              Marchand
              <input
                value={result.marchand}
                onChange={(event) => updateResult("marchand", event.target.value)}
                className="h-11 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4"
              />
            </label>
            <label className="grid gap-2 text-sm text-zinc-300">
              Catégorie
              <select
                value={result.categorie}
                onChange={(event) => updateResult("categorie", event.target.value)}
                className="h-11 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4"
              >
                {expenseCategories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-zinc-300">
              Moyen de paiement
              <select
                value={result.moyenPaiement}
                onChange={(event) => updateResult("moyenPaiement", event.target.value)}
                className="h-11 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4"
              >
                {paymentMethods.map((paymentMethod) => (
                  <option key={paymentMethod}>{paymentMethod}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-zinc-300">
              Note
              <textarea
                value={result.note}
                onChange={(event) => updateResult("note", event.target.value)}
                className="min-h-24 rounded-lg border border-white/10 bg-black px-3 py-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4"
              />
            </label>
            <button
              type="button"
              onClick={() => void confirmExpense()}
              disabled={isSaving}
              className="rounded-lg bg-emerald-400 px-4 py-3 text-sm font-bold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {isSaving ? "Enregistrement..." : "Confirmer et ajouter la dépense"}
            </button>
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed border-white/15 bg-black/40 p-6 text-center">
            <p className="font-medium text-white">Aucune facture analysée</p>
            <p className="mt-2 text-sm text-zinc-500">Importez une image, puis lancez l&apos;analyse avant confirmation.</p>
          </div>
        )}
      </section>
    </div>
  );
}
