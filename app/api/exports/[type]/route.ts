import { requireOwner } from "../../../../lib/workspace";
import { logAuditEvent } from "../../../../lib/audit";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ type: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { type } = await context.params;
  const { supabase, user, workspace } = await requireOwner();
  let rows: Record<string, unknown>[] = [];

  if (type === "customers") {
    const { data, error } = await supabase
      .from("customers")
      .select("created_at,name,contact_name,email,phone,address,notes")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false });
    if (error) return new Response(error.message, { status: 500 });
    rows = (data ?? []) as Record<string, unknown>[];
  } else if (type === "invoices") {
    const { data, error } = await supabase
      .from("invoices")
      .select("created_at,invoice_number,status,issue_date,due_date,subtotal,discount_amount,tax_amount,total_amount,notes,terms,customers(name)")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false });
    if (error) return new Response(error.message, { status: 500 });
    rows = ((data ?? []) as unknown[]).map((row) => flattenNested(row as Record<string, unknown>));
  } else if (type === "payments") {
    const { data, error } = await supabase
      .from("payments")
      .select("created_at,payment_date,amount,payment_method,reference_number,notes,invoices(invoice_number,customers(name))")
      .eq("workspace_id", workspace.id)
      .order("payment_date", { ascending: false });
    if (error) return new Response(error.message, { status: 500 });
    rows = ((data ?? []) as unknown[]).map((row) => flattenNested(row as Record<string, unknown>));
  } else if (type === "expenses") {
    const { data, error } = await supabase
      .from("expenses")
      .select("created_at,expense_date,vendor,amount,payment_method,receipt_url,notes,expense_categories(name)")
      .eq("workspace_id", workspace.id)
      .order("expense_date", { ascending: false });
    if (error) return new Response(error.message, { status: 500 });
    rows = ((data ?? []) as unknown[]).map((row) => flattenNested(row as Record<string, unknown>));
  } else if (type === "submissions") {
    const { data, error } = await supabase
      .from("submission_queue")
      .select("created_at,submission_type,status,submitted_by,reviewed_by,reviewed_at,review_note,payload")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false });
    if (error) return new Response(error.message, { status: 500 });
    rows = ((data ?? []) as unknown[]).map((row) => flattenNested(row as Record<string, unknown>));
  } else {
    return new Response("Unknown export type", { status: 404 });
  }

  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "export", entityType: type });

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wulfzx-${type}-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}

function flattenNested(row: Record<string, unknown>) {
  const flat: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        flat[`${key}_${nestedKey}`] = nestedValue;
      }
    } else {
      flat[key] = value;
    }
  }

  return flat;
}

function toCsv(rows: Record<string, unknown>[]) {
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));

  if (headers.length === 0) {
    return "No records\n";
  }

  return [headers.join(","), ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(","))].join("\n");
}

function escapeCsv(value: unknown) {
  const text = typeof value === "string" ? value : value == null ? "" : JSON.stringify(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
