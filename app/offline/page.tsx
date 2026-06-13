import { PendingDrafts } from "../../components/PendingDrafts";
import { requireWorkspace } from "../../lib/workspace";

export const dynamic = "force-dynamic";

export default async function OfflineDraftsPage() {
  await requireWorkspace();
  return <PendingDrafts />;
}
