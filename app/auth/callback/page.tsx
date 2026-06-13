"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

type WorkspaceRole = "owner" | "employee" | "intern";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Completing invite...");

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function completeInvite() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const next = params.get("next");
      const nextPath = next?.startsWith("/") ? next : "/submit";

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error && !error.message.toLowerCase().includes("pkce code verifier")) {
          window.location.replace(`/login?error=${encodeURIComponent(error.message)}`);
          return;
        }
      }

      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        window.location.replace("/login?error=Invalid%20or%20expired%20invite%20link");
        return;
      }

      const { data: member, error: memberError } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (memberError || !member) {
        window.location.replace("/login?error=No%20workspace%20access");
        return;
      }

      const role = member.role as WorkspaceRole;
      window.location.replace(role === "employee" || role === "intern" ? nextPath : "/dashboard");
    }

    completeInvite().catch((error) => {
      if (isMounted) {
        setMessage(error instanceof Error ? error.message : "Could not complete invite.");
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="card narrow-card">
      <h1>Completing Invite</h1>
      <p className="muted">{message}</p>
    </section>
  );
}
