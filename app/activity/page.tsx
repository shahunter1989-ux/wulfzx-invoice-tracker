import { formatDate } from "../../lib/format";
import { requireOwner } from "../../lib/workspace";

export const dynamic = "force-dynamic";

type AuditEvent = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export default async function ActivityPage() {
  const { supabase, workspace } = await requireOwner();
  const { data } = await supabase
    .from("audit_events")
    .select("id,actor_id,action,entity_type,entity_id,metadata,created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(120);
  const events = (data ?? []) as unknown as AuditEvent[];

  return (
    <section className="card">
      <div className="page-header">
        <div>
          <h1>Activity</h1>
          <p className="muted">Owner-only audit log for team, approvals, records, settings, deletes, and exports.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Record</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{formatDate(event.created_at.slice(0, 10))}</td>
                <td>{event.actor_id ? shortId(event.actor_id) : "System"}</td>
                <td>{event.action.replace("_", " ")}</td>
                <td>
                  {event.entity_type}
                  {event.entity_id ? ` ${shortId(event.entity_id)}` : ""}
                </td>
                <td>
                  <code>{Object.keys(event.metadata ?? {}).length ? JSON.stringify(event.metadata) : "-"}</code>
                </td>
              </tr>
            ))}
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-cell">
                  No activity recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function shortId(value: string) {
  return `${value.slice(0, 8)}...`;
}
