"use client";

import { useAgency } from "@/lib/agency-context";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface FeatureGateProps {
  feature: string;
  featureLabel: string;
  addonPrice?: string;
  children: React.ReactNode;
}

export default function FeatureGate({ feature, featureLabel, addonPrice = "$5/mo", children }: FeatureGateProps) {
  const { agency, role } = useAgency();
  const params = useParams();
  const slug = params?.slug as string;

  if (!agency) return null;

  const isEnabled = agency.enabledFeatures?.[feature] === true;

  if (isEnabled) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-sand/40 flex items-center justify-center mb-5">
        <Lock size={28} className="text-muted" />
      </div>
      <h2 className="font-display text-2xl text-charcoal mb-2">
        {featureLabel} is not enabled
      </h2>
      <p className="text-muted text-sm max-w-md mb-6">
        This feature requires the <span className="font-semibold text-charcoal">{featureLabel}</span> addon
        ({addonPrice}) to be activated for your agency.
      </p>
      {role === "owner" ? (
        <Link
          href={`/agency/${slug}/settings`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta text-white rounded-xl text-sm font-semibold hover:bg-terracotta/90 transition-all"
        >
          Enable in Settings
        </Link>
      ) : (
        <p className="text-xs text-muted">
          Ask your agency owner to enable this feature in Settings.
        </p>
      )}
    </div>
  );
}
