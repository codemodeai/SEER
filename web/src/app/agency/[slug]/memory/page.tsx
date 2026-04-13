"use client";

import { useAgency } from "@/lib/agency-context";
import { AspectMemoryViewer } from "@/components/AspectMemoryViewer";

export default function AgencyMemoryPage() {
  const { agency } = useAgency();
  if (!agency) return null;
  return (
    <AspectMemoryViewer
      scope={agency.slug}
      title="Team Memory"
      subtitle="Shared aspect memory for your agency — kept in sync across every member."
    />
  );
}
