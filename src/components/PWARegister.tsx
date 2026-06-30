"use client";

import { useEffect } from "react";
import { syncOfflineQueue } from "@/lib/offline-sync";

export function PWARegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.warn("Service Worker non enregistre", error);
      });
    }

    function syncWhenOnline() {
      if (navigator.onLine) {
        void syncOfflineQueue().catch((error: unknown) => {
          console.warn("Synchronisation offline impossible", error);
        });
      }
    }

    window.addEventListener("online", syncWhenOnline);
    syncWhenOnline();

    return () => {
      window.removeEventListener("online", syncWhenOnline);
    };
  }, []);

  return null;
}
