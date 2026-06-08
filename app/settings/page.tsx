export default function SettingsPage() {
  return (
    <section className="card">
      <h1>Settings</h1>
      <p className="muted">Company settings for Wulfzx.underground.</p>
      <form className="grid" style={{ marginTop: 24 }}>
        <input defaultValue="Wulfzx.underground" />
        <input defaultValue="WZX" />
        <input defaultValue="USD" />
        <input placeholder="Default tax rate" />
        <textarea placeholder="Company address" />
        <button type="button">Save Settings</button>
      </form>
    </section>
  );
}
