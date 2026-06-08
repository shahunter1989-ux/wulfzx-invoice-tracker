export default function NewInvoicePage() {
  return (
    <section className="card">
      <h1>New Invoice</h1>
      <p className="muted">Create Wulfzx.underground invoices using the WZX invoice prefix.</p>
      <form className="grid" style={{ marginTop: 24 }}>
        <input placeholder="Invoice number, example: WZX-2026-0001" />
        <input placeholder="Client/customer" />
        <input type="date" />
        <input type="date" />
        <textarea placeholder="Line items will be added here" />
        <input placeholder="Discount amount" />
        <input placeholder="Tax amount" />
        <textarea placeholder="Notes / terms" />
        <button type="button">Save Invoice</button>
      </form>
    </section>
  );
}
