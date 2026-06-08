import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "../../../../lib/auth";
import { ensureUserDefaults } from "../../../../lib/data";
import { updateExpenseAction } from "../../../actions";

export const dynamic = "force-dynamic";

type EditExpensePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

type Category = {
  id: string;
  name: string;
};

type Expense = {
  id: string;
  category_id: string | null;
  vendor: string | null;
  expense_date: string;
  amount: number | string;
  payment_method: string;
  receipt_url: string | null;
  notes: string | null;
};

export default async function EditExpensePage({ params, searchParams }: EditExpensePageProps) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, user } = await requireUser();
  await ensureUserDefaults(supabase, user);

  const [{ data: categories }, { data: expense }] = await Promise.all([
    supabase.from("expense_categories").select("id,name").order("name"),
    supabase.from("expenses").select("id,category_id,vendor,expense_date,amount,payment_method,receipt_url,notes").eq("id", id).eq("user_id", user.id).single()
  ]);

  if (!expense) notFound();

  const detail = expense as Expense;

  return (
    <section className="card narrow-card">
      <div className="page-header">
        <div>
          <h1>Edit Expense</h1>
          <p className="muted">Update vendor, amount, category, receipt link, and notes.</p>
        </div>
        <Link className="secondary-link" href="/receipts">
          Back to receipts
        </Link>
      </div>

      {query.error ? <div className="notice error">{query.error}</div> : null}

      <form action={updateExpenseAction} className="grid form-grid">
        <input type="hidden" name="expense_id" value={detail.id} />
        <label>
          Vendor
          <input name="vendor" defaultValue={detail.vendor ?? ""} />
        </label>
        <label>
          Category
          <select name="category_id" defaultValue={detail.category_id ?? ""}>
            <option value="">Uncategorized</option>
            {((categories ?? []) as Category[]).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <div className="two-column">
          <label>
            Expense date
            <input name="expense_date" type="date" defaultValue={detail.expense_date} />
          </label>
          <label>
            Amount
            <input name="amount" type="number" min="0" step="0.01" defaultValue={String(detail.amount)} required />
          </label>
        </div>
        <label>
          Payment method
          <select name="payment_method" defaultValue={detail.payment_method}>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="card">Card</option>
            <option value="paypal">PayPal</option>
            <option value="zelle">Zelle</option>
            <option value="cash_app">Cash App</option>
            <option value="check">Check</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Receipt URL
          <input name="receipt_url" type="url" placeholder="https://..." defaultValue={detail.receipt_url ?? ""} />
        </label>
        <label>
          Notes
          <textarea name="notes" rows={3} defaultValue={detail.notes ?? ""} />
        </label>
        <button type="submit">Save Changes</button>
      </form>
    </section>
  );
}
