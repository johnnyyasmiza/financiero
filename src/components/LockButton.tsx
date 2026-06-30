"use client";

import { useRouter } from "next/navigation";
import { revokeAdminAccess } from "@/lib/admin-access-store";

export function LockButton() {
  const router = useRouter();

  function lockApp() {
    revokeAdminAccess();
    router.push("/");
  }

  return (
    <button
      type="button"
      onClick={lockApp}
      className="min-h-11 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-black text-blue-800 transition hover:border-blue-500 hover:bg-blue-50"
    >
      Verrouiller
    </button>
  );
}
