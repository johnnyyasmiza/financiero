"use client";

import { cn } from "@/lib/utils";

export type ToastState = {
  type: "success" | "error";
  message: string;
};

export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed left-4 right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-50 mx-auto max-w-md rounded-lg border px-4 py-3 text-sm font-bold shadow-2xl backdrop-blur sm:left-auto sm:right-6 sm:mx-0",
        toast.type === "success"
          ? "border-emerald-300/70 bg-emerald-500 text-black shadow-emerald-900/20"
          : "border-red-300/70 bg-red-500 text-white shadow-red-900/20",
      )}
    >
      {toast.message}
    </div>
  );
}
