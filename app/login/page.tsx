import { signInAction } from "../actions";
import { hasSupabaseConfig } from "../../lib/supabase/config";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; setup?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const missingConfig = params.setup === "missing-env" || !hasSupabaseConfig();

  return (
    <section className="card narrow-card">
      <h1>Owner Login</h1>
      <p className="muted">Sign in with the owner account created in Supabase Auth.</p>

      {missingConfig ? (
        <div className="notice warning">
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> locally and in Vercel before using the app.
        </div>
      ) : null}

      {params.error ? <div className="notice error">{params.error}</div> : null}

      <form action={signInAction} className="grid form-grid">
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit" disabled={missingConfig}>
          Sign In
        </button>
      </form>
    </section>
  );
}
