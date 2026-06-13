import { createClient } from "@supabase/supabase-js";
import { cleanEnvValue, getSupabaseConfig } from "./config";

export function createAdminClient() {
  const serviceRoleKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for team invitations.");
  }

  const { supabaseUrl } = getSupabaseConfig();
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
