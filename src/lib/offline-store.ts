"use client";

export type OfflineOperation =
  | {
      id?: number;
      type: "insert";
      table: "expenses" | "revenues";
      payload: Record<string, unknown>;
      createdAt: string;
    }
  | {
      id?: number;
      type: "insertMany";
      table: "needs";
      payload: Record<string, unknown>[];
      createdAt: string;
    };

const DB_NAME = "financiero-offline";
const DB_VERSION = 1;
const CACHE_STORE = "cache";
const QUEUE_STORE = "queue";
const STATUS_EVENT = "financiero-offline-status";

type CacheRecord<T> = {
  key: string;
  value: T;
  updatedAt: string;
};

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error("IndexedDB indisponible sur cet appareil."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Impossible d'ouvrir IndexedDB."));
  });
}

async function withStore<T>(
  storeName: typeof CACHE_STORE | typeof QUEUE_STORE,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openOfflineDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = action(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Operation IndexedDB impossible."));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("Transaction IndexedDB impossible."));
    };
  });
}

export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function notifyOfflineStatus() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STATUS_EVENT));
  }
}

export function subscribeOfflineStatus(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  window.addEventListener(STATUS_EVENT, listener);

  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
    window.removeEventListener(STATUS_EVENT, listener);
  };
}

export async function cacheData<T>(key: string, value: T) {
  if (!canUseIndexedDb()) {
    return;
  }

  await withStore<IDBValidKey>(CACHE_STORE, "readwrite", (store) =>
    store.put({ key, value, updatedAt: new Date().toISOString() }),
  );
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  if (!canUseIndexedDb()) {
    return null;
  }

  try {
    const record = await withStore<CacheRecord<T> | undefined>(CACHE_STORE, "readonly", (store) => store.get(key));
    return record?.value ?? null;
  } catch {
    return null;
  }
}

export async function enqueueOfflineOperation(operation: Omit<OfflineOperation, "createdAt">) {
  if (!canUseIndexedDb()) {
    throw new Error("Hors ligne: IndexedDB est indisponible, impossible de mettre en attente.");
  }

  await withStore<IDBValidKey>(QUEUE_STORE, "readwrite", (store) =>
    store.add({ ...operation, createdAt: new Date().toISOString() }),
  );
  notifyOfflineStatus();
}

export async function getOfflineQueue(): Promise<OfflineOperation[]> {
  if (!canUseIndexedDb()) {
    return [];
  }

  try {
    return await withStore<OfflineOperation[]>(QUEUE_STORE, "readonly", (store) => store.getAll());
  } catch {
    return [];
  }
}

export async function getPendingOfflineCount() {
  if (!canUseIndexedDb()) {
    return 0;
  }

  try {
    return await withStore<number>(QUEUE_STORE, "readonly", (store) => store.count());
  } catch {
    return 0;
  }
}

export async function removeOfflineOperation(id: number) {
  if (!canUseIndexedDb()) {
    return;
  }

  await withStore<undefined>(QUEUE_STORE, "readwrite", (store) => store.delete(id) as IDBRequest<undefined>);
  notifyOfflineStatus();
}

export function isNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|networkerror|load failed|fetch|offline|internet|network/i.test(message);
}
