"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { grantAdminAccess, useAdminAccess } from "@/lib/admin-access-store";

const ADMIN_CODE = "19831983";

export function AdminAccessForm() {
  const router = useRouter();
  const hasAccess = useAdminAccess();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (hasAccess) {
      router.replace("/dashboard");
    }
  }, [hasAccess, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (code.trim() === ADMIN_CODE) {
      grantAdminAccess();
      router.push("/dashboard");
      return;
    }

    setError("Code incorrect");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-black px-4 py-10 text-white">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg border border-white/10 bg-zinc-950/80 p-6 shadow-2xl shadow-emerald-950/20">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-lg bg-emerald-400 font-black text-black">F</span>
          <div>
            <p className="text-xl font-semibold tracking-tight">Financiero</p>
            <p className="text-sm text-emerald-300">Acces prive</p>
          </div>
        </div>

        <label className="mt-8 grid gap-2 text-sm font-medium text-zinc-300">
          Code admin
          <input
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setError("");
            }}
            className="h-12 rounded-lg border border-white/10 bg-black px-4 text-white outline-none ring-emerald-400/30 transition placeholder:text-zinc-600 focus:ring-4"
            placeholder="Code admin"
            type="password"
          />
        </label>

        {error ? <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

        <button type="submit" className="mt-5 h-12 w-full rounded-lg bg-emerald-400 px-4 text-sm font-bold text-black transition hover:bg-emerald-300">
          Entrer
        </button>

        <p className="mt-5 text-center text-xs leading-5 text-zinc-500">
          Protection locale personnelle pour la V1.
        </p>
      </form>
    </main>
  );
}
