"use client";

import { useAgency } from "@/lib/agency-context";
import {
  BookOpen,
  Users,
  Key,
  Cloud,
  Activity,
  BarChart3,
  Megaphone,
  Settings,
  ChevronDown,
  ChevronRight,
  Zap,
  Shield,
  FolderKanban,
} from "lucide-react";
import { useState } from "react";

interface GuideSection {
  id: string;
  title: string;
  icon: any;
  steps: { title: string; description: string }[];
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Zap,
    steps: [
      {
        title: "Welcome to your Agency Portal",
        description:
          "Your agency portal is a centralized dashboard where you can manage your team, API keys, shared memory, and track real-time activity across all team members. Everything is organized in the sidebar on the left.",
      },
      {
        title: "Understanding roles",
        description:
          "There are three roles:\n• Owner — full access to the portal, billing, and settings\n• Admin — can access the portal, manage users, keys, and announcements\n• Member — gets unlimited SEER access via their API key, but cannot see the agency portal. They see their own personal dashboard with a banner showing they belong to your agency.",
      },
      {
        title: "Your first steps",
        description:
          '1. Click "Add User" under Users to invite team members by email\n2. They receive an invite email with a link to accept\n3. Once accepted, they get unlimited SEER access and an auto-generated API key\n4. Members start using SEER — you see everything in Activity & Analytics',
      },
    ],
  },
  {
    id: "user-management",
    title: "Managing Users",
    icon: Users,
    steps: [
      {
        title: "Inviting a team member",
        description:
          'Go to Users → click "Add User" → enter their email address (any email works — no existing SEER account required). Choose their role (Admin or Member). They\'ll receive an invite email with a link to join. If they don\'t have an account yet, they can sign up through the invite link.',
      },
      {
        title: "Invite flow for new users",
        description:
          "When a user clicks the invite link:\n1. If not logged in — they see invite details and a login/signup button (email pre-filled)\n2. After login — they see an acceptance page with your agency name and their role\n3. On accept — they join the agency with unlimited access and are redirected to the portal or their dashboard",
      },
      {
        title: "Unlimited access for all members",
        description:
          "All agency members automatically get unlimited SEER access (Agency plan). There is no per-user plan selection — your agency subscription covers everyone. The seat limit is set during your plan purchase and shown in Settings.",
      },
      {
        title: "Editing a member",
        description:
          "Click Edit next to any member to change their role (Member or Admin). Only the owner can promote someone to admin. Role changes take effect immediately.",
      },
      {
        title: "Removing a member",
        description:
          "Click Remove and confirm. Their API key is revoked instantly and they lose agency access. Their personal SEER account reverts to the free plan.",
      },
    ],
  },
  {
    id: "api-keys",
    title: "API Key Management",
    icon: Key,
    steps: [
      {
        title: "How API keys work",
        description:
          'Each member gets a unique API key (sk-seer-...) when added to the agency. This key is what they use in their Claude Code configuration. All usage is tracked per key.',
      },
      {
        title: "Regenerating a key",
        description:
          "If a key is compromised, go to API Keys → click Regenerate. The old key stops working immediately. Share the new key with the member securely.",
      },
      {
        title: "Revoking a key",
        description:
          "Revoke a key to block a member's API access without removing them from the agency. Useful for temporary suspensions.",
      },
    ],
  },
  {
    id: "cloud-memory",
    title: "Cloud Memory Sync",
    icon: Cloud,
    steps: [
      {
        title: "What is cloud memory?",
        description:
          "Cloud memory lets your team share .seer_memory.md files across projects. When one member pushes their project memory, others can pull it — keeping everyone in sync on project context.",
      },
      {
        title: "Pushing memory",
        description:
          'Go to Cloud Memory → click "Push Memory". Enter the project name and paste the .seer_memory.md content. A SHA-256 hash is computed automatically for integrity verification.',
      },
      {
        title: "Version conflicts",
        description:
          "If two members push at the same time, the system detects version conflicts. The second push will warn about the mismatch. They can review the latest version and push again.",
      },
    ],
  },
  {
    id: "activity-tracking",
    title: "Activity Tracking",
    icon: Activity,
    steps: [
      {
        title: "Real-time activity feed",
        description:
          "The Activity page shows what each team member is working on right now. Members send heartbeats that include their project name and feature/module. The feed auto-refreshes every 30 seconds.",
      },
      {
        title: "Smart conflict detection",
        description:
          "If two members are working on the same feature (e.g., both on 'authentication'), the system shows a conflict warning. It also suggests available features nobody is working on yet.",
      },
      {
        title: "Auto-idle",
        description:
          "Members automatically go idle after 10 minutes of no heartbeat. This prevents stale 'active' statuses and keeps the feed accurate.",
      },
    ],
  },
  {
    id: "analytics",
    title: "Analytics Dashboard",
    icon: BarChart3,
    steps: [
      {
        title: "Viewing team metrics",
        description:
          "Analytics shows total API calls, tokens saved, active members, and more. Use the date range filter (7d / 30d / 90d) to see trends over time.",
      },
      {
        title: "Daily usage chart",
        description:
          "The bar chart shows call volume per day. Hover over any bar to see the exact count. Use this to identify peak usage days and team activity patterns.",
      },
      {
        title: "Tool breakdown & top users",
        description:
          "See which SEER tools (seer_run, seer_optimize, seer_workflow, etc.) are used most. The top users table shows who is most active — useful for identifying power users and underutilizers.",
      },
    ],
  },
  {
    id: "announcements",
    title: "Announcements",
    icon: Megaphone,
    steps: [
      {
        title: "Posting an announcement",
        description:
          'Go to Announcements → click "New Announcement". Add a title, body text, and optionally pin it to the top. All agency members will see it.',
      },
      {
        title: "Pinned announcements",
        description:
          "Pinned announcements appear as a banner on the Overview page so nobody misses them. You can have up to 3 pinned at once. Great for sprint goals, merge freezes, or policy changes.",
      },
      {
        title: "Managing announcements",
        description:
          "Edit or delete any announcement at any time. Only owners and admins can manage announcements. Members can read but not create them.",
      },
    ],
  },
  {
    id: "settings",
    title: "Agency Settings",
    icon: Settings,
    steps: [
      {
        title: "Editing agency info",
        description:
          "Go to Settings to change your agency name. Only the owner can edit settings. The seat limit (max users) is locked — it was set during your plan purchase and cannot be changed here.",
      },
      {
        title: "Feature toggles",
        description:
          "Your enabled features (Announcements, Project Management, etc.) are configured during agency setup. To change your feature set, contact support.",
      },
      {
        title: "Agency slug",
        description:
          "Your agency slug (in the URL) is auto-generated during setup and cannot be changed. Share the portal URL with your team: /agency/your-slug",
      },
    ],
  },
];

export default function AgencyGuidePage() {
  const { agency } = useAgency();
  const [expanded, setExpanded] = useState<string>("getting-started");

  if (!agency) return null;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
            <BookOpen size={20} className="text-terracotta" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-charcoal">Portal Guide</h1>
            <p className="text-muted text-sm mt-0.5">
              Everything you need to run your agency portal effectively.
            </p>
          </div>
        </div>
      </div>

      {/* Quick tips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-terracotta/10 border border-terracotta/20 rounded-2xl px-5 py-4">
          <Shield size={16} className="text-terracotta mb-2" />
          <p className="text-xs font-semibold text-charcoal">Security Tip</p>
          <p className="text-[11px] text-muted mt-1">
            Never share API keys in public channels. Use direct messages or a password manager.
          </p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl px-5 py-4">
          <FolderKanban size={16} className="text-blue-400 mb-2" />
          <p className="text-xs font-semibold text-charcoal">Organization Tip</p>
          <p className="text-[11px] text-muted mt-1">
            Use consistent project names across your team so cloud memory and activity sync properly.
          </p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-5 py-4">
          <Zap size={16} className="text-emerald-400 mb-2" />
          <p className="text-xs font-semibold text-charcoal">Productivity Tip</p>
          <p className="text-[11px] text-muted mt-1">
            Check Activity before starting work to avoid stepping on a teammate&apos;s active feature.
          </p>
        </div>
      </div>

      {/* Accordion sections */}
      <div className="flex flex-col gap-3">
        {GUIDE_SECTIONS.map((section) => {
          const isExpanded = expanded === section.id;
          const Icon = section.icon;
          return (
            <div
              key={section.id}
              className="bg-ivory border border-sand/60 rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => setExpanded(isExpanded ? "" : section.id)}
                className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-cream-dark/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-terracotta/10 flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-terracotta" />
                </div>
                <span className="flex-1 text-sm font-medium text-charcoal">
                  {section.title}
                </span>
                {isExpanded ? (
                  <ChevronDown size={16} className="text-muted" />
                ) : (
                  <ChevronRight size={16} className="text-muted" />
                )}
              </button>

              {isExpanded && (
                <div className="px-6 pb-5 flex flex-col gap-4">
                  {section.steps.map((step, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-terracotta/10 text-terracotta text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-charcoal">
                          {step.title}
                        </h4>
                        <p className="text-xs text-muted mt-1 leading-relaxed whitespace-pre-line">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
