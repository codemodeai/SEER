"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface DashboardData {
  userId: string;
  userName: string;
  plan: string;
  usage: number;
  mfaVerified: boolean;
  promptCount: number;
  agencySlug: string | null;
  loading: boolean;
}

const DashboardContext = createContext<DashboardData>({
  userId: "",
  userName: "",
  plan: "free",
  usage: 0,
  mfaVerified: false,
  promptCount: 0,
  agencySlug: null,
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
    agencySlug: null,
    loading: true,
  });

  useEffect(() => {
    async function fetchAll() {
      try {
        const res = await fetch("/api/auth/setup-user", { method: "POST" });
        if (!res.ok) {
          console.error("Dashboard: setup-user failed", res.status);
          setData((prev) => ({ ...prev, loading: false }));
          return;
        }

        const userData = await res.json();

        setData({
          userId: userData.userId ?? "",
          userName: userData.userName ?? "User",
          plan: userData.plan ?? "free",
          usage: userData.usage ?? 0,
          mfaVerified: userData.mfaVerified ?? false,
          promptCount: userData.promptCount ?? 0,
          agencySlug: userData.agencySlug ?? null,
          loading: false,
        });
      } catch (err) {
        console.error("Dashboard: failed to fetch data", err);
        setData((prev) => ({ ...prev, loading: false }));
      }
    }
    fetchAll();
  }, []);

  return (
    <DashboardContext.Provider value={data}>
      {children}
    </DashboardContext.Provider>
  );
}
