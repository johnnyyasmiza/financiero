"use client";

import { type FormEvent } from "react";
import { getTodayDate } from "@/lib/utils";

type Field = {
  label: string;
  name: string;
  type?: "text" | "number" | "date";
  options?: string[];
  placeholder?: string;
};

export function FinanceForm({
  title,
  fields,
  submitLabel,
  isSubmitting = false,
  onSubmit,
}: {
  title: string;
  fields: Field[];
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit?: (values: Record<string, string>) => void | Promise<void>;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!onSubmit) {
      return;
    }

    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    void Promise.resolve(
      onSubmit(
        Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])),
      ),
    ).then(() => {
      form.reset();
      form.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach((input) => {
        input.value = getTodayDate();
      });
    })
      .catch(() => undefined);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
      <h2 className="mb-5 text-lg font-semibold text-white">{title}</h2>
      <div className="grid gap-4">
        {fields.map((field) => (
          <label key={field.name} className="grid gap-2 text-sm text-zinc-300">
            {field.label}
            {field.options ? (
              <select name={field.name} className="h-11 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4">
                {field.options.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input
                name={field.name}
                type={field.type ?? "text"}
                defaultValue={field.type === "date" ? getTodayDate() : undefined}
                placeholder={field.type === "date" ? undefined : field.placeholder}
                className="h-11 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 placeholder:text-zinc-600 focus:ring-4"
              />
            )}
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-5 w-full rounded-lg bg-emerald-400 px-4 py-3 text-sm font-bold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
      >
        {isSubmitting ? "Enregistrement..." : submitLabel}
      </button>
    </form>
  );
}
