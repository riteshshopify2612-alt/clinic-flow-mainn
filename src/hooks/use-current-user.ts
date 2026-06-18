import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "doctor" | "receptionist";

const ROLE_PRIORITY: AppRole[] = ["admin", "doctor", "receptionist"];

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data.user ?? null);
      if (!data.user) {
        setRole(null);
        setLoading(false);
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      if (!mounted) return;
      const roleSet = new Set((roles ?? []).map((entry) => entry.role as AppRole));
      setRole(ROLE_PRIORITY.find((candidate) => roleSet.has(candidate)) ?? null);
      setLoading(false);
    }
    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, role, loading, isAdmin: role === "admin" };
}
