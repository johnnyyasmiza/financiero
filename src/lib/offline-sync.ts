"use client";

import { supabase } from "@/lib/supabase";
import { getOfflineQueue, isOnline, notifyOfflineStatus, removeOfflineOperation } from "@/lib/offline-store";

let syncPromise: Promise<number> | null = null;

export async function syncOfflineQueue() {
  if (!isOnline()) {
    return 0;
  }

  if (syncPromise) {
    return syncPromise;
  }

  syncPromise = (async () => {
    const queue = await getOfflineQueue();
    let synced = 0;

    for (const operation of queue) {
      if (!operation.id) {
        continue;
      }

      const payload = operation.type === "insertMany" ? operation.payload : operation.payload;
      const { error } = await supabase.from(operation.table).insert(payload);

      if (error) {
        throw new Error(error.message || "Synchronisation Supabase impossible.");
      }

      await removeOfflineOperation(operation.id);
      synced += operation.type === "insertMany" ? operation.payload.length : 1;
    }

    notifyOfflineStatus();
    return synced;
  })().finally(() => {
    syncPromise = null;
  });

  return syncPromise;
}
