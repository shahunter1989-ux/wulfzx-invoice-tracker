"use client";

export type OfflineDraftType = "customer" | "invoice" | "payment" | "expense";

export type OfflineDraftPayload = Record<string, string | string[]>;

export type OfflineDraft = {
  id: string;
  type: OfflineDraftType;
  payload: OfflineDraftPayload;
  createdAt: string;
  error?: string | null;
};

const DB_NAME = "wulfzx-invoice-tracker";
const DB_VERSION = 1;
const STORE_NAME = "offline_drafts";
const CHANGE_EVENT = "wulfzx-offline-drafts-changed";

function getIndexedDB(): IDBFactory {
  if (!("indexedDB" in window)) {
    throw new Error("This browser does not support offline draft storage.");
  }
  return window.indexedDB;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = getIndexedDB().open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline draft storage."));
  });
}

async function withStore<T>(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = callback(store);

    if (request) {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Offline draft storage request failed."));
    } else {
      transaction.oncomplete = () => resolve(undefined);
    }

    transaction.onerror = () => reject(transaction.error ?? new Error("Offline draft storage transaction failed."));
    transaction.oncomplete = () => {
      if (!request) resolve(undefined);
      db.close();
    };
  });
}

function emitDraftChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function onOfflineDraftsChange(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

export function formDataToPayload(formData: FormData): OfflineDraftPayload {
  const payload: OfflineDraftPayload = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const existing = payload[key];
    if (Array.isArray(existing)) {
      existing.push(value);
    } else if (typeof existing === "string") {
      payload[key] = [existing, value];
    } else {
      payload[key] = value;
    }
  }

  return payload;
}

export async function addOfflineDraft(type: OfflineDraftType, payload: OfflineDraftPayload): Promise<OfflineDraft> {
  const draft: OfflineDraft = {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
    error: null
  };

  await withStore("readwrite", (store) => store.add(draft));
  emitDraftChange();
  return draft;
}

export async function getOfflineDrafts(): Promise<OfflineDraft[]> {
  const drafts = (await withStore<OfflineDraft[]>("readonly", (store) => store.getAll())) ?? [];
  return drafts.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function deleteOfflineDraft(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
  emitDraftChange();
}

export async function updateOfflineDraftError(id: string, error: string | null): Promise<void> {
  const draft = await withStore<OfflineDraft>("readonly", (store) => store.get(id));
  if (!draft) return;
  await withStore("readwrite", (store) => store.put({ ...draft, error }));
  emitDraftChange();
}

export async function getOfflineDraftCount(): Promise<number> {
  const count = await withStore<number>("readonly", (store) => store.count());
  return count ?? 0;
}

export async function syncOfflineDrafts(): Promise<{ synced: number; failed: number }> {
  if (!navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const drafts = await getOfflineDrafts();
  if (drafts.length === 0) {
    return { synced: 0, failed: 0 };
  }

  const response = await fetch("/api/offline/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drafts })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Could not sync offline drafts.");
  }

  const result = (await response.json()) as {
    results: Array<{ id: string; ok: boolean; error?: string }>;
  };

  let synced = 0;
  let failed = 0;

  for (const draftResult of result.results) {
    if (draftResult.ok) {
      await deleteOfflineDraft(draftResult.id);
      synced += 1;
    } else {
      await updateOfflineDraftError(draftResult.id, draftResult.error || "Sync failed.");
      failed += 1;
    }
  }

  emitDraftChange();
  return { synced, failed };
}
