export default function NewCustomerPage() {
  return (
    <section className="card">
      <h1>New Customer</h1>
      <p className="muted">Create a customer/client record before making invoices.</p>
      <form className="grid" style={{ marginTop: 24 }}>
        <input placeholder="Customer or client name" />
        <input placeholder="Contact name" />
        <input placeholder="Email" />
        <input placeholder="Phone" />
        <textarea placeholder="Address" />
        <textarea placeholder="Notes" />
        <button type="button">Save Customer</button>
      </form>
    </section>
  );
}
