"use client";

import { AspectMemoryViewer } from "@/components/AspectMemoryViewer";

export default function DashboardMemoryPage() {
  return (
    <AspectMemoryViewer
      scope="auto"
      title="Project Memory"
      subtitle="6 structured aspects per project — overview, architecture, features, decisions, errors, session log."
    />
  );
}
