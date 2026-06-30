"use client";

import { useEffect, useRef, useState } from "react";
import { getPendingOfflineCount, isOnline, subscribeOfflineStatus } from "@/lib/offline-store";
import { syncOfflineQueue } from "@/lib/offline-sync";

type SyncState = "idle" | "pending" | "syncing" | "synced" | "offline";

export function OfflineStatusBadge() {
  const [state, setState] = useState<SyncState>("idle");
  const [pending, setPending] = useState(0);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      const count = await getPendingOfflineCount();

      if (!mounted) {
        return;
      }

      setPending(count);

      if (!isOnline()) {
        setState("offline");
        return;
      }

      if (count > 0) {
        setState("pending");
        return;
      }

      setState((current) => (current === "syncing" ? "syncing" : "idle"));
    }

    const unsubscribe = subscribeOfflineStatus(() => {
      void refresh();
    });

    void refresh();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (state !== "pending" || !isOnline() || isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;
    void Promise.resolve()
      .then(() => {
        setState("syncing");
        return syncOfflineQueue();
      })
      .then(() => {
        setState("synced");
        return getPendingOfflineCount();
      })
      .then(setPending)
      .catch(() => setState("pending"))
      .finally(() => {
        isSyncingRef.current = false;
      });
  }, [state]);

  const label =
    state === "offline"
      ? "Hors ligne ⚠️"
      : state === "pending"
        ? `Synchronisation en attente${pending > 0 ? ` (${pending})` : ""}`
        : state === "syncing"
          ? "Synchronisation..."
          : state === "synced"
            ? "Synchronisé ✅"
            : "En ligne ✅";

  const classes =
    state === "offline"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : state === "pending" || state === "syncing"
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <span className={`inline-flex min-h-10 items-center rounded-lg border px-3 text-xs font-black sm:text-sm ${classes}`}>
      {label}
    </span>
  );
}
