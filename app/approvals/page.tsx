import { formatDate } from "../../lib/format";
import { requireOwner } from "../../lib/workspace";
import { reviewSubmissionAction } from "../actions";

export const dynamic = "force-dynamic";

type ApprovalsPageProps = {
  searchParams: Promise<{ error?: string; reviewed?: string }>;
};

type SubmissionPayload = Record<string, string | string[]>;

type Submission = {
  id: string;
  submission_type: string;
  payload: SubmissionPayload;
  status: string;
  review_note: string | null;
  created_at: string;
  submitted_by: string;
};

export default async function ApprovalsPage({ searchParams }: ApprovalsPageProps) {
  const params = await searchParams;
  const { supabase, workspace } = await requireOwner();
  const { data } = await supabase
    .from("submission_queue")
    .select("id,submission_type,payload,status,review_note,created_at,submitted_by")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(80);

  const submissions = (data ?? []) as unknown as Submission[];
  const pending = submissions.filter((submission) => submission.status === "pending");
  const reviewed = submissions.filter((submission) => submission.status !== "pending");

  return (
    <section className="grid">
      <div className="page-header">
        <div>
          <h1>Approvals</h1>
          <p className="muted">Review submit-only work before it becomes official business data.</p>
        </div>
      </div>

      {params.error ? <div className="notice error">{params.error}</div> : null}
      {params.reviewed ? <div className="notice success">Submission reviewed. Official records and reports were updated only if approved.</div> : null}

      <section className="card">
        <h2>Pending Review</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Type</th>
                <th>Submitted by</th>
                <th>Details</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((submission) => (
                <tr key={submission.id}>
                  <td>{formatDate(submission.created_at.slice(0, 10))}</td>
                  <td>{submission.submission_type}</td>
                  <td>{shortId(submission.submitted_by)}</td>
                  <td>{summarizePayload(submission.submission_type, submission.payload)}</td>
                  <td>
                    <form action={reviewSubmissionAction} className="grid" style={{ minWidth: 260 }}>
                      <input type="hidden" name="submission_id" value={submission.id} />
                      <label>
                        Owner note
                        <textarea name="review_note" rows={2} placeholder="Optional note for rejected/correction-needed submissions" />
                      </label>
                      <div className="action-row">
                        <button type="submit" name="decision" value="approved" className="compact-action">
                          Approve
                        </button>
                        <button type="submit" name="decision" value="needs_correction" className="secondary-button compact-action">
                          Needs correction
                        </button>
                        <button type="submit" name="decision" value="rejected" className="secondary-button danger-button compact-action">
                          Reject
                        </button>
                      </div>
                    </form>
                  </td>
                </tr>
              ))}
              {pending.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    No submissions waiting for review.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Reviewed Submissions</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Type</th>
                <th>Status</th>
                <th>Details</th>
                <th>Owner note</th>
              </tr>
            </thead>
            <tbody>
              {reviewed.slice(0, 40).map((submission) => (
                <tr key={submission.id}>
                  <td>{formatDate(submission.created_at.slice(0, 10))}</td>
                  <td>{submission.submission_type}</td>
                  <td>
                    <span className="status-pill">{submission.status.replace("_", " ")}</span>
                  </td>
                  <td>{summarizePayload(submission.submission_type, submission.payload)}</td>
                  <td>{submission.review_note || "-"}</td>
                </tr>
              ))}
              {reviewed.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    No reviewed submissions yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function summarizePayload(type: string, payload: SubmissionPayload) {
  if (type === "customer") return getText(payload, "name") || "Customer submission";
  if (type === "invoice") {
    const descriptions = getArray(payload, "description").filter(Boolean);
    return `${descriptions.length || 1} invoice line item${descriptions.length === 1 ? "" : "s"}`;
  }
  if (type === "payment") return `Payment ${getText(payload, "amount") || ""}`;
  if (type === "expense") return `${getText(payload, "vendor") || "Expense"} ${getText(payload, "amount") || ""}`;
  return type;
}

function getText(payload: SubmissionPayload, key: string) {
  const value = payload[key];
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

function getArray(payload: SubmissionPayload, key: string) {
  const value = payload[key];
  if (Array.isArray(value)) return value.map((entry) => String(entry));
  if (typeof value === "string") return [value];
  return [];
}

function shortId(value: string) {
  return `${value.slice(0, 8)}...`;
}
