"use client";

import { useDashboard } from "@/lib/dashboard-context";
import { Briefcase, Lock, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function FoundersSpacePage() {
  const { plan, fsAccess, loading } = useDashboard();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-terracotta/30 border-t-terracotta rounded-full animate-spin" />
      </div>
    );
  }

  // Plan gating — show upgrade prompt for users without access
  if (!fsAccess) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-charcoal tracking-tight">
            Founder&apos;s Space
          </h1>
          <p className="mt-1 text-sm text-muted">
            Your operational workspace — tasks, credentials, documents, and notes.
          </p>
        </div>

        <div className="bg-ivory rounded-2xl border border-sand/60 p-6 sm:p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-terracotta/10 flex items-center justify-center mx-auto">
            <Lock size={28} className="text-terracotta" />
          </div>
          <h2 className="font-display text-xl text-charcoal">
            Unlock Founder&apos;s Space
          </h2>
          <p className="text-sm text-warm-brown-light max-w-md mx-auto">
            {plan === "free"
              ? "Founder's Space is available on Starter ($8/mo + $1/mo addon), Pro ($19/mo, included), and Agency ($39/mo, included) plans."
              : plan === "starter"
                ? "Add Founder's Space to your Starter plan for just $1/month."
                : "Founder's Space is included with your plan but hasn't been activated yet."}
          </p>
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta/90 transition-all"
          >
            {plan === "free" ? "View Plans" : "Enable Addon"}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  // Workspace shell — tabs will be built in Phase 2/3
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl text-charcoal tracking-tight">
          Founder&apos;s Space
        </h1>
        <p className="mt-1 text-sm text-muted">
          Your operational workspace — tasks, credentials, documents, and notes.
        </p>
      </div>

      {/* Tab navigation — panels built in Phase 2/3 */}
      <div className="flex gap-1 border-b border-sand/60">
        {["Tasks", "Notes", "Credentials", "Documents"].map((tab, i) => (
          <button
            key={tab}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
              i === 0
                ? "border-terracotta text-terracotta"
                : "border-transparent text-muted hover:text-charcoal"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Empty state — placeholder until Phase 2 builds the panels */}
      <div className="bg-ivory rounded-2xl border border-sand/60 p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-terracotta/10 flex items-center justify-center mx-auto">
          <Briefcase size={24} className="text-terracotta" />
        </div>
        <h3 className="font-display text-lg text-charcoal">
          Your workspace is ready
        </h3>
        <p className="text-sm text-muted max-w-sm mx-auto">
          Create your first project to start managing tasks, storing credentials,
          uploading documents, and taking notes.
        </p>
        <p className="text-xs text-muted/60">
          Also accessible from Claude Code via <code className="bg-cream-dark px-1.5 py-0.5 rounded text-charcoal">seer space</code>
        </p>
      </div>
    </div>
  );
}
