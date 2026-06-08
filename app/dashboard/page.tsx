import { StatCard } from "../../components/StatCard";

export default function DashboardPage() {
  return (
    <section>
      <h1>Dashboard</h1>
      <p className="muted">Overview of Wulfzx.underground sales, payments, and expenses.</p>

      <div className="grid grid-3" style={{ marginTop: 24 }}>
        <StatCard label="Total Sales" value="$0.00" />
        <StatCard label="Total Received" value="$0.00" />
        <StatCard label="Outstanding" value="$0.00" />
        <StatCard label="Overdue" value="0" />
        <StatCard label="Expenses" value="$0.00" />
        <StatCard label="Estimated Net" value="$0.00" />
      </div>
    </section>
  );
}
