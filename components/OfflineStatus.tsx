"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getOfflineDraftCount, onOfflineDraftsChange, syncOfflineDrafts } from "../lib/offline-drafts";

export function OfflineStatus() {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      setPendingCount(await getOfflineDraftCount());
    } catch {
      setPendingCount(0);
    }
  }, []);

  const runSync = useCallback(async () => {
    if (!navigator.onLine || syncing) return;
    setSyncing(true);
    try {
      const result = await syncOfflineDrafts();
      if (result.synced > 0 || result.failed > 0) {
        setMessage(`${result.synced} synced${result.failed ? `, ${result.failed} failed` : ""}.`);
      }
      await refreshCount();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }, [refreshCount, syncing]);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refreshCount();

    const handleOnline = () => {
      setOnline(true);
      void runSync();
    };
    const handleOffline = () => setOnline(false);
    const unsubscribe = onOfflineDraftsChange(() => void refreshCount());

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", runSync);

    return () => {
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", runSync);
    };
  }, [refreshCount, runSync]);

  useEffect(() => {
    if (online && pendingCount > 0) {
      void runSync();
    }
  }, [online, pendingCount, runSync]);

  return (
    <div className="offline-status no-print">
      <span className={online ? "online-dot" : "offline-dot"} />
      <span>{online ? "Online" : "Offline"}</span>
      <Link href="/offline">Pending: {pendingCount}</Link>
      {pendingCount > 0 ? (
        <button type="button" className="secondary-button compact-action" onClick={() => void runSync()} disabled={!online || syncing}>
          {syncing ? "Syncing" : "Sync"}
        </button>
      ) : null}
      {message ? <span className="muted small-note">{message}</span> : null}
    </div>
  );
}
