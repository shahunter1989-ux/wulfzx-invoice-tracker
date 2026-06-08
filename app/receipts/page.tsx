import { createExpenseAction } from "../actions";
import { requireUser } from "../../lib/auth";
import { ensureUserDefaults } from "../../lib/data";
import { formatCurrency, formatDate } from "../../lib/format";

export const dynamic = "force-dynamic";

type ReceiptsPageProps = {
  searchParams: Promise<{ error?: string }>;
};

type Category = {
  id: string;
  name: string;
};

type Expense = {
  id: string;
  vendor: string | null;
  expense_date: string;
  amount: number | string;
  payment_method: string;
  receipt_url: string | null;
  expense_categories: { name: string } | null;
};

export default async function ReceiptsPage({ searchParams }: ReceiptsPageProps) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  await ensureUserDefaults(supabase, user);
  const { data: categories } = await supabase.from("expense_categories").select("id,name").order("name");
  const { data: expenses } = await supabase
    .from("expenses")
    .select("id,vendor,expense_date,amount,payment_method,receipt_url,expense_categories(name)")
    .order("expense_date", { ascending: false });

  return (
    <section className="grid">
      <div className="card">
        <h1>Receipts / Expenses</h1>
        <p className="muted">Track business spending, vendors, categories, and receipt links.</p>
        {params.error ? <div className="notice error">{params.error}</div> : null}
        <form action={createExpenseAction} className="grid form-grid">
          <div className="two-column">
            <label>
              Vendor
              <input name="vendor" />
            </label>
            <label>
              Category
              <select name="category_id">
                <option value="">Uncategorized</option>
                {((categories ?? []) as unknown as Category[]).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="two-column">
            <label>
              Expense date
              <input name="expense_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </label>
            <label>
              Amount
              <input name="amount" type="number" min="0" step="0.01" required />
            </label>
          </div>
          <div className="two-column">
            <label>
              Payment method
              <select name="payment_method" defaultValue="other">
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
              <input name="receipt_url" type="url" placeholder="https://..." />
            </label>
          </div>
          <label>
            Notes
            <textarea name="notes" rows={3} />
          </label>
          <button type="submit">Save Expense</button>
        </form>
      </div>

      <div className="card">
        <h2>Recent Expenses</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Vendor</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {((expenses ?? []) as unknown as Expense[]).map((expense) => (
                <tr key={expense.id}>
                  <td>{formatDate(expense.expense_date)}</td>
                  <td>{expense.vendor || "—"}</td>
                  <td>{expense.expense_categories?.name || "Uncategorized"}</td>
                  <td>{formatCurrency(expense.amount)}</td>
                  <td>{expense.payment_method.replace("_", " ")}</td>
                  <td>{expense.receipt_url ? <a href={expense.receipt_url}>Open</a> : "—"}</td>
                </tr>
              ))}
              {(expenses ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    No expenses recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
