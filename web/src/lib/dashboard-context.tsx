"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase-browser";

interface DashboardData {
  userId: string;
  userName: string;
  plan: string;
  usage: number;
  mfaVerified: boolean;
  promptCount: number;
  loading: boolean;
}

const DashboardContext = createContext<DashboardData>({
  userId: "",
  userName: "",
  plan: "free",
  usage: 0,
  mfaVerified: false,
  promptCount: 0,
  loading: true,
});

export function useDashboard() {
  return useContext(DashboardContext);
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DashboardData>({
    userId: "",
    userName: "",
    plan: "free",
    usage: 0,
    mfaVerified: false,
    promptCount: 0,
    loading: true,
  });

  useEffect(() => {
    async function fetchAll() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setData((prev) => ({ ...prev, loading: false }));
        return;
      }

      const displayName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "User";

      // Run setup-user + fetch user data + fetch usage in parallel
      const [, userData, usageData] = await Promise.all([
        fetch("/api/auth/setup-user", { method: "POST" }),
        supabase
          .from("users")
          .select("plan, mfa_verified, prompt_count")
          .eq("id", user.id)
          .single(),
        supabase
          .from("seer_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("timestamp", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      ]);

      if (userData.error) {
        console.error("Dashboard: failed to fetch user data", userData.error);
      }
      if (usageData.error) {
        console.error("Dashboard: failed to fetch usage data", usageData.error);
      }

      setData({
        userId: user.id,
        userName: displayName,
        plan: userData.data?.plan ?? "free",
        usage: usageData.count ?? 0,
        mfaVerified: userData.data?.mfa_verified ?? false,
        promptCount: userData.data?.prompt_count ?? 0,
        loading: false,
      });
    }
    fetchAll();
  }, []);

  return (
    <DashboardContext.Provider value={data}>
      {children}
    </DashboardContext.Provider>
  );
}
