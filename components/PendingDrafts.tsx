"use client";

import { useEffect, useState } from "react";
import { deleteOfflineDraft, getOfflineDrafts, onOfflineDraftsChange, syncOfflineDrafts, type OfflineDraft } from "../lib/offline-drafts";

function summarizeDraft(draft: OfflineDraft): string {
  const payload = draft.payload;
  if (draft.type === "customer") return String(payload.name || "Unnamed customer");
  if (draft.type === "invoice") return `Invoice draft for ${String(payload.customer_id || "selected customer")}`;
  if (draft.type === "payment") return `Payment ${String(payload.amount || "")}`;
  if (draft.type === "expense") return `${String(payload.vendor || "Expense")} ${String(payload.amount || "")}`;
  return draft.type;
}

export function PendingDrafts() {
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setDrafts(await getOfflineDrafts());
  }

  async function runSync() {
    if (!navigator.onLine) {
      setMessage("You are offline. Sync will be available when internet returns.");
      return;
    }
    setSyncing(true);
    try {
      const result = await syncOfflineDrafts();
      setMessage(`${result.synced} synced${result.failed ? `, ${result.failed} failed` : ""}.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    void refresh();
    return onOfflineDraftsChange(() => void refresh());
  }, []);

  return (
    <section className="card">
      <div className="page-header">
        <div>
          <h1>Pending Offline Drafts</h1>
          <p className="muted">Drafts stay on this device until internet returns. Owner drafts create records; submitter drafts enter owner review.</p>
        </div>
        <button type="button" onClick={() => void runSync()} disabled={syncing || drafts.length === 0}>
          {syncing ? "Syncing" : "Sync Now"}
        </button>
      </div>

      {message ? <div className="notice success">{message}</div> : null}
      <div className="notice warning">Do not clear browser storage while drafts are pending. Unsynced drafts are not visible on other devices.</div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Draft</th>
              <th>Created</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((draft) => (
              <tr key={draft.id}>
                <td>{draft.type}</td>
                <td>{summarizeDraft(draft)}</td>
                <td>{new Date(draft.createdAt).toLocaleString()}</td>
                <td>{draft.error ? <span className="danger-button">{draft.error}</span> : "Pending"}</td>
                <td>
                  <button type="button" className="secondary-button danger-button compact-action" onClick={() => void deleteOfflineDraft(draft.id)}>
                    Remove local draft
                  </button>
                </td>
              </tr>
            ))}
            {drafts.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-cell">
                  No offline drafts waiting to sync.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
