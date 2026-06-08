type StatCardProps = {
  label: string;
  value: string;
};

export function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="card">
      <p className="muted" style={{ margin: 0 }}>{label}</p>
      <h2 style={{ marginBottom: 0 }}>{value}</h2>
    </div>
  );
}
