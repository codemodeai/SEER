"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";

interface AgencyData {
  agency: {
    id: string;
    name: string;
    slug: string;
    status: string;
    maxUsers: number;
    logoUrl: string | null;
    memberCount: number;
    createdAt: string;
  } | null;
  role: "owner" | "admin" | "member";
  userId: string;
  loading: boolean;
  error: string | null;
}

const AgencyContext = createContext<AgencyData>({
  agency: null,
  role: "member",
  userId: "",
  loading: true,
  error: null,
});

export function useAgency() {
  return useContext(AgencyContext);
}

export function AgencyProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const slug = params?.slug as string;

  const [data, setData] = useState<AgencyData>({
    agency: null,
    role: "member",
    userId: "",
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!slug) return;

    async function fetchAgency() {
      try {
        const res = await fetch(`/api/agency/${slug}`);
        if (!res.ok) {
          const err = await res.json();
          setData((prev) => ({
            ...prev,
            loading: false,
            error: err.error || "Failed to load agency",
          }));
          return;
        }

        const result = await res.json();
        setData({
          agency: result.agency,
          role: result.role,
          userId: result.userId,
          loading: false,
          error: null,
        });
      } catch (err) {
        console.error("Agency context fetch error:", err);
        setData((prev) => ({
          ...prev,
          loading: false,
          error: "Failed to load agency",
        }));
      }
    }

    fetchAgency();
  }, [slug]);

  return (
    <AgencyContext.Provider value={data}>
      {children}
    </AgencyContext.Provider>
  );
}
