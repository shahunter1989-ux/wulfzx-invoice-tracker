import type { SupabaseClient } from "@supabase/supabase-js";

export async function logAuditEvent(
  supabase: SupabaseClient,
  params: {
    workspaceId: string;
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  await supabase.from("audit_events").insert({
    workspace_id: params.workspaceId,
    actor_id: params.actorId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? {}
  });
}
