import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getUserIfConfigured, requireUser } from "./auth";
import type { createClient } from "./supabase/server";

export type WorkspaceRole = "owner" | "employee" | "intern";

export type WorkspaceSummary = {
  id: string;
  name: string;
  owner_id: string;
};

export type WorkspaceContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  workspace: WorkspaceSummary;
  role: WorkspaceRole;
  isOwner: boolean;
  isSubmitter: boolean;
};

type MemberRow = {
  workspace_id: string;
  role: WorkspaceRole;
  workspaces: WorkspaceSummary | WorkspaceSummary[] | null;
};

export async function requireWorkspace(): Promise<WorkspaceContext> {
  const { supabase, user } = await requireUser();
  const context = await loadWorkspaceContext(supabase, user);

  if (!context) {
    redirect("/login?error=No%20workspace%20access");
  }

  return context;
}

export async function requireOwner(): Promise<WorkspaceContext> {
  const context = await requireWorkspace();
  if (!context.isOwner) {
    redirect("/submit");
  }
  return context;
}

export async function getWorkspaceIfConfigured(): Promise<WorkspaceContext | null> {
  const { supabase, user } = await getUserIfConfigured();
  if (!supabase || !user) return null;
  return loadWorkspaceContext(supabase, user);
}

async function loadWorkspaceContext(supabase: Awaited<ReturnType<typeof createClient>>, user: User): Promise<WorkspaceContext | null> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id,role,workspaces(id,name,owner_id)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as MemberRow;
  const workspaceValue = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
  if (!workspaceValue) return null;

  return {
    supabase,
    user,
    workspace: workspaceValue,
    role: row.role,
    isOwner: row.role === "owner",
    isSubmitter: row.role === "employee" || row.role === "intern"
  };
}

