import { ConfirmSubmitButton } from "../../components/ConfirmSubmitButton";
import { formatDate } from "../../lib/format";
import { requireOwner } from "../../lib/workspace";
import { inviteTeamMemberAction, removeTeamMemberAction, updateTeamMemberRoleAction } from "../actions";

export const dynamic = "force-dynamic";

type TeamPageProps = {
  searchParams: Promise<{ error?: string; invited?: string; removed?: string; saved?: string }>;
};

type Member = {
  user_id: string;
  role: string;
  status: string;
  created_at: string;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
};

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const params = await searchParams;
  const { supabase, user, workspace } = await requireOwner();
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("workspace_members").select("user_id,role,status,created_at").eq("workspace_id", workspace.id).order("created_at", { ascending: true }),
    supabase.from("workspace_invites").select("id,email,role,status,created_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(40)
  ]);

  const memberRows = (members ?? []) as Member[];
  const inviteRows = (invites ?? []) as Invite[];

  return (
    <section className="grid">
      <div className="page-header">
        <div>
          <h1>Team</h1>
          <p className="muted">Invite employees or interns as submit-only users. They cannot view records, reports, settings, or history.</p>
        </div>
      </div>

      {params.error ? <div className="notice error">{params.error}</div> : null}
      {params.invited ? <div className="notice success">Invite sent. The user will land on the submit-only view after signing in.</div> : null}
      {params.saved ? <div className="notice success">Team member role updated.</div> : null}
      {params.removed ? <div className="notice success">Team member access removed.</div> : null}

      <section className="card narrow-card">
        <h2>Invite Submitter</h2>
        <form action={inviteTeamMemberAction} className="grid form-grid">
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Role
            <select name="role" defaultValue="employee">
              <option value="employee">Employee</option>
              <option value="intern">Intern</option>
            </select>
          </label>
          <button type="submit">Send Invite</button>
        </form>
        <p className="muted small-note">Public signup should stay disabled in Supabase. Team access is invite-only.</p>
      </section>

      <section className="card">
        <h2>Members</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {memberRows.map((member) => (
                <tr key={member.user_id}>
                  <td>{member.user_id === user.id ? "You" : shortId(member.user_id)}</td>
                  <td>{member.role}</td>
                  <td>{member.status}</td>
                  <td>{formatDate(member.created_at.slice(0, 10))}</td>
                  <td>
                    {member.role === "owner" ? (
                      <span className="muted small-note">Owner access</span>
                    ) : (
                      <div className="action-row">
                        <form action={updateTeamMemberRoleAction} className="action-row">
                          <input type="hidden" name="member_user_id" value={member.user_id} />
                          <select name="role" defaultValue={member.role} aria-label="Role">
                            <option value="employee">Employee</option>
                            <option value="intern">Intern</option>
                          </select>
                          <button type="submit" className="secondary-button compact-action">
                            Save role
                          </button>
                        </form>
                        <form action={removeTeamMemberAction}>
                          <input type="hidden" name="member_user_id" value={member.user_id} />
                          <ConfirmSubmitButton className="secondary-button danger-button compact-action" confirmMessage="Remove this team member's access?">
                            Remove
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Recent Invites</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {inviteRows.map((invite) => (
                <tr key={invite.id}>
                  <td>{invite.email}</td>
                  <td>{invite.role}</td>
                  <td>{invite.status}</td>
                  <td>{formatDate(invite.created_at.slice(0, 10))}</td>
                </tr>
              ))}
              {inviteRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-cell">
                    No invites sent yet.
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

function shortId(value: string) {
  return `${value.slice(0, 8)}...`;
}
