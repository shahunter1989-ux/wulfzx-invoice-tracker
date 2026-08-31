import { PendingDrafts } from "../../components/PendingDrafts";
import { requireWorkspace } from "../../lib/workspace";

export const dynamic = "force-dynamic";

export default async function OfflineDraftsPage() {
  await requireWorkspace();
  return (
    <section className="grid">
      <div className="notice warning">
        Offline drafts are temporary device storage. They are not part of reports, dashboard totals, or backups until they sync to Supabase.
      </div>
      <PendingDrafts />
    </section>
  );
}
