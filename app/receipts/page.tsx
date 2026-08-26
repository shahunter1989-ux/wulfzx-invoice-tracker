import Link from "next/link";
import { ConfirmSubmitButton } from "../../components/ConfirmSubmitButton";
import { OfflineForm } from "../../components/OfflineForm";
import { ensureUserDefaults } from "../../lib/data";
import { formatCurrency, formatDate } from "../../lib/format";
import { requireOwner } from "../../lib/workspace";
import { createExpenseAction, deleteExpenseAction } from "../actions";

export const dynamic = "force-dynamic";

type ReceiptsPageProps = {
  searchParams: Promise<{ deleted?: string; error?: string; saved?: string; q?: string; category?: string; method?: string }>;
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
  const { supabase, user, workspace } = await requireOwner();
  await ensureUserDefaults(supabase, user, workspace.id);
  const [{ data: categories }, { data: expenses }] = await Promise.all([
    supabase.from("expense_categories").select("id,name").eq("workspace_id", workspace.id).order("name"),
    supabase
      .from("expenses")
      .select("id,vendor,expense_date,amount,payment_method,receipt_url,expense_categories(name)")
      .eq("workspace_id", workspace.id)
      .order("expense_date", { ascending: false })
  ]);
  const categoryRows = (categories ?? []) as Category[];
  const expenseRows = ((expenses ?? []) as unknown as Expense[]).filter((expense) => {
    const query = String(params.q ?? "").trim().toLowerCase();
    const matchesQuery = !query || [expense.vendor, expense.expense_categories?.name, expense.payment_method].some((value) => String(value ?? "").toLowerCase().includes(query));
    const matchesCategory = !params.category || expense.expense_categories?.name === params.category;
    const matchesMethod = !params.method || expense.payment_method === params.method;
    return matchesQuery && matchesCategory && matchesMethod;
  });
  const monthStartText = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const expensesThisMonth = ((expenses ?? []) as unknown as Expense[]).filter((expense) => expense.expense_date >= monthStartText).reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const filteredTotal = expenseRows.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);

  return (
    <section className="grid">
      <div className="card">
        <h1>Receipts / Expenses</h1>
        <p className="muted">Track business spending, vendors, categories, and receipt links.</p>
        {params.error ? <div className="notice error">{params.error}</div> : null}
        {params.saved ? <div className="notice success">Expense updated. Dashboard and reports were recalculated.</div> : null}
        {params.deleted ? <div className="notice success">Expense deleted. Dashboard and reports were recalculated.</div> : null}
        <OfflineForm action={createExpenseAction} draftType="expense" className="grid form-grid">
          <div className="two-column">
            <label>
              Vendor
              <input name="vendor" />
            </label>
            <label>
              Category
              <select name="category_id">
                <option value="">Uncategorized</option>
                {categoryRows.map((category) => (
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
        </OfflineForm>
      </div>

      <div className="card">
        <div className="page-header">
          <div>
            <h2>Recent Expenses</h2>
            <p className="muted">
              This month: {formatCurrency(expensesThisMonth)} | Filtered total: {formatCurrency(filteredTotal)}
            </p>
          </div>
        </div>
        <form className="filter-bar">
          <label>
            Search
            <input name="q" defaultValue={params.q ?? ""} placeholder="Vendor, category, or method" />
          </label>
          <label>
            Category
            <select name="category" defaultValue={params.category ?? ""}>
              <option value="">All categories</option>
              {categoryRows.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <div className="action-row">
            <button type="submit" className="secondary-button compact-action">
              Filter
            </button>
            <Link className="secondary-link compact-action" href="/receipts">
              Clear
            </Link>
          </div>
        </form>
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenseRows.map((expense) => (
                <tr key={expense.id}>
                  <td>{formatDate(expense.expense_date)}</td>
                  <td>{expense.vendor || "-"}</td>
                  <td>{expense.expense_categories?.name || "Uncategorized"}</td>
                  <td>{formatCurrency(expense.amount)}</td>
                  <td>{expense.payment_method.replace("_", " ")}</td>
                  <td>{expense.receipt_url ? <a href={expense.receipt_url}>Open</a> : "-"}</td>
                  <td>
                    <div className="action-row">
                      <Link className="secondary-link compact-action" href={`/receipts/${expense.id}/edit`}>
                        Edit
                      </Link>
                      <form action={deleteExpenseAction}>
                        <input type="hidden" name="expense_id" value={expense.id} />
                        <ConfirmSubmitButton
                          className="secondary-button danger-button compact-action"
                          confirmMessage={`Delete ${expense.vendor || "this expense"} for ${formatCurrency(expense.amount)}? This cannot be undone.`}
                        >
                          Delete
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {expenseRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-cell">
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
