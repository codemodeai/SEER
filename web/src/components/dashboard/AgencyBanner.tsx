"use client";

import { useDashboard } from "@/lib/dashboard-context";
import { Building2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function AgencyBanner() {
  const { agencySlug, agencyName, agencyRole, plan } = useDashboard();

  // Only show for agency members (not owners on agency plan — they already know)
  if (!agencySlug || !agencyName || agencyRole === "owner") return null;

  return (
    <div className="bg-gradient-to-r from-terracotta/5 to-amber-50 border border-terracotta/20 rounded-2xl px-5 py-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center flex-shrink-0">
        <Building2 size={20} className="text-terracotta" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-charcoal">
          You&apos;re part of <strong>{agencyName}</strong>
        </p>
        <p className="text-xs text-muted mt-0.5">
          You&apos;ve been added as {agencyRole === "admin" ? "an admin" : "a member"}.
          {plan !== "agency" && " Your API key and plan are managed by the agency."}
        </p>
      </div>
      <Link
        href={`/agency/${agencySlug}`}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors flex-shrink-0"
      >
        Open Portal
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}
