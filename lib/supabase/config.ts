export function hasSupabaseConfig(): boolean {
  return Boolean(cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL) && cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
}

export function getSupabaseConfig() {
  const supabaseUrl = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function cleanEnvValue(value: string | undefined): string {
  return (value ?? "").replace(/\uFEFF/g, "").trim();
}
