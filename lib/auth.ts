import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { hasSupabaseConfig } from "./supabase/config";

export async function requireUser() {
  if (!hasSupabaseConfig()) {
    redirect("/login?setup=missing-env");
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

export async function getUserIfConfigured() {
  if (!hasSupabaseConfig()) {
    return { supabase: null, user: null };
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return { supabase, user };
}
