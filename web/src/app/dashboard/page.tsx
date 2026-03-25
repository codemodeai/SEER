import StatCards from "@/components/dashboard/StatCards";
import UsageGauge from "@/components/dashboard/UsageGauge";
import TokenChart from "@/components/dashboard/TokenChart";
import SavingsTrend from "@/components/dashboard/SavingsTrend";
import FeatureBreakdown from "@/components/dashboard/FeatureBreakdown";
import RecentCalls from "@/components/dashboard/RecentCalls";
import MfaBanner from "@/components/dashboard/MfaBanner";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl md:text-4xl text-charcoal tracking-tight">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted">
          Your SEER usage overview and analytics.
        </p>
      </div>

      {/* MFA Banner — shows until user completes MFA, then auto-hides */}
      <MfaBanner />

      {/* Stat cards */}
      <StatCards />

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: charts (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <SavingsTrend />
          <TokenChart />
        </div>

        {/* Right: gauge + breakdown */}
        <div className="space-y-6">
          <UsageGauge />
          <FeatureBreakdown />
        </div>
      </div>

      {/* Recent calls table */}
      <RecentCalls />
    </div>
  );
}
