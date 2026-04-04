"use client";

import FeatureGate from "@/components/agency/FeatureGate";
import { useAgency } from "@/lib/agency-context";
import {
  FolderKanban,
  Plus,
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  Archive,
  AlertTriangle,
  ArrowUpRight,
  X,
  Loader2,
  RefreshCw,
  Brain,
  Users,
  FileText,
  Circle,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

interface CloudProject {
  id: string;
  name: string;
  hash: string;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
}

interface PMProject {
  id: string;
  name: string;
  description: string;
  status: "active" | "archived" | "completed";
  priority: "low" | "medium" | "high" | "urgent";
  creatorEmail: string;
  taskCount: number;
  tasksDone: number;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

interface MergedProject {
  cloudProject: CloudProject | null;
  pmProject: PMProject | null;
  name: string;
  lastUpdated: string;
  hasMemory: boolean;
  hasTasks: boolean;
}

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "bg-gray-500/15 text-gray-400 border-gray-500/25" },
  medium: { label: "Medium", color: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
  high: { label: "High", color: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  urgent: { label: "Urgent", color: "bg-red-500/15 text-red-400 border-red-500/25" },
};

export default function ProjectsPage() {
  const { agency, role } = useAgency();
  const [cloudProjects, setCloudProjects] = useState<CloudProject[]>([]);
  const [pmProjects, setPmProjects] = useState<PMProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchAll() {
    if (!agency) return;
    try {
      const [memRes, pmRes] = await Promise.all([
        fetch(`/api/agency/${agency.slug}/memory`),
        fetch(`/api/agency/${agency.slug}/projects`),
      ]);

      if (memRes.ok) {
        const memData = await memRes.json();
        setCloudProjects(memData.projects ?? []);
      }
      if (pmRes.ok) {
        const pmData = await pmRes.json();
        setPmProjects(pmData.projects ?? []);
      }
      setLastRefresh(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // Real-time polling every 10 seconds
    pollRef.current = setInterval(fetchAll, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [agency]);

  if (!agency) return null;

  if (!agency.enabledFeatures?.project_management) {
    return (
      <FeatureGate feature="project_management" featureLabel="Project Management" addonPrice="$5/mo">
        <></>
      </FeatureGate>
    );
  }

  // Merge cloud memory projects with PM projects by name
  const merged: MergedProject[] = [];
  const seen = new Set<string>();

  for (const cp of cloudProjects) {
    const normalName = cp.name.toLowerCase().trim();
    seen.add(normalName);
    const matchingPM = pmProjects.find(
      (p) => p.name.toLowerCase().trim() === normalName
    );
    merged.push({
      cloudProject: cp,
      pmProject: matchingPM ?? null,
      name: cp.name,
      lastUpdated: matchingPM
        ? new Date(cp.updatedAt) > new Date(matchingPM.updated_at)
          ? cp.updatedAt
          : matchingPM.updated_at
        : cp.updatedAt,
      hasMemory: true,
      hasTasks: !!matchingPM && matchingPM.taskCount > 0,
    });
  }

  // Add PM projects that don't have cloud memory
  for (const pm of pmProjects) {
    if (!seen.has(pm.name.toLowerCase().trim())) {
      merged.push({
        cloudProject: null,
        pmProject: pm,
        name: pm.name,
        lastUpdated: pm.updated_at,
        hasMemory: false,
        hasTasks: pm.taskCount > 0,
      });
    }
  }

  // Sort by last updated
  merged.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());

  const filtered = merged.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const canManage = role === "owner" || role === "admin";
  const activeMemoryProjects = cloudProjects.length;
  const totalTasks = pmProjects.reduce((s, p) => s + p.taskCount, 0);
  const totalDone = pmProjects.reduce((s, p) => s + p.tasksDone, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
            <FolderKanban size={20} className="text-terracotta" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-charcoal dark:text-white">Projects</h1>
            <p className="text-muted text-sm mt-0.5">
              Real-time project memory &amp; task management.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted">
            <Circle size={6} className="text-emerald-400 fill-emerald-400 animate-pulse" />
            Live
          </div>
          {canManage && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors"
            >
              <Plus size={16} />
              New Project
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-ivory dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted">Projects</p>
          <p className="text-2xl font-display text-charcoal dark:text-white mt-1">{merged.length}</p>
        </div>
        <div className="bg-ivory dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted">Live Memory</p>
          <p className="text-2xl font-display text-blue-400 mt-1">{activeMemoryProjects}</p>
        </div>
        <div className="bg-ivory dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted">Total Tasks</p>
          <p className="text-2xl font-display text-charcoal dark:text-white mt-1">{totalTasks}</p>
        </div>
        <div className="bg-ivory dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted">Completed</p>
          <p className="text-2xl font-display text-emerald-400 mt-1">{totalDone}</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-ivory dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl text-sm text-charcoal dark:text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/30"
          />
        </div>
        <span className="text-[10px] text-muted">
          Updated {lastRefresh.toLocaleTimeString()}
        </span>
      </div>

      {/* Project cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin text-muted" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <FolderKanban size={32} className="text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-muted">
            {search ? "No projects match your search." : "No projects yet."}
          </p>
          <p className="text-xs text-muted/60 mt-1">
            Projects appear automatically when team members use SEER, or create one manually.
          </p>
          {canManage && !search && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors"
            >
              <Plus size={14} />
              Create project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((proj) => (
            <ProjectCard
              key={proj.name}
              project={proj}
              agencySlug={agency.slug}
            />
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreate && (
        <CreateProjectModal
          agencySlug={agency.slug}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); setLoading(true); fetchAll(); }}
        />
      )}
    </div>
  );
}

function ProjectCard({ project, agencySlug }: { project: MergedProject; agencySlug: string }) {
  const pm = project.pmProject;
  const cloud = project.cloudProject;
  const progress = pm && pm.taskCount > 0 ? Math.round((pm.tasksDone / pm.taskCount) * 100) : 0;
  const isOverdue = pm?.due_date && new Date(pm.due_date) < new Date() && pm.status === "active";

  // Link to PM project detail if it exists, otherwise to cloud memory view
  const href = pm
    ? `/agency/${agencySlug}/projects/${pm.id}`
    : `/agency/${agencySlug}/memory?project=${encodeURIComponent(project.name)}`;

  return (
    <Link
      href={href}
      className="group bg-ivory dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-2xl p-5 hover:border-terracotta/30 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-charcoal dark:text-white group-hover:text-terracotta transition-colors line-clamp-1">
          {project.name}
        </h3>
        <ArrowUpRight size={14} className="text-muted group-hover:text-terracotta transition-colors shrink-0 mt-0.5" />
      </div>

      {pm?.description && (
        <p className="text-xs text-muted line-clamp-2 mb-3">{pm.description}</p>
      )}

      {/* Status badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {project.hasMemory && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-purple-500/15 text-purple-400 border-purple-500/25">
            <Brain size={10} />
            Memory v{cloud?.version ?? 1}
          </span>
        )}
        {project.hasTasks && pm && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-blue-500/15 text-blue-400 border-blue-500/25">
            <FileText size={10} />
            {pm.taskCount} tasks
          </span>
        )}
        {pm && PRIORITY_CONFIG[pm.priority] && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${PRIORITY_CONFIG[pm.priority].color}`}>
            {PRIORITY_CONFIG[pm.priority].label}
          </span>
        )}
        {isOverdue && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-red-500/15 text-red-400 border-red-500/25">
            <AlertTriangle size={10} />
            Overdue
          </span>
        )}
      </div>

      {/* Progress bar (if tasks exist) */}
      {pm && pm.taskCount > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted">{pm.tasksDone}/{pm.taskCount} done</span>
            <span className="text-[10px] font-medium text-charcoal dark:text-white">{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-sand/60 dark:bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-terracotta transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-muted">
        <span>
          {cloud?.updatedBy
            ? `by ${cloud.updatedBy.split("@")[0]}`
            : pm?.creatorEmail
              ? `by ${pm.creatorEmail.split("@")[0]}`
              : ""}
        </span>
        <span>
          {new Date(project.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
          {new Date(project.lastUpdated).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </Link>
  );
}

function CreateProjectModal({
  agencySlug,
  onClose,
  onCreated,
}: {
  agencySlug: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/agency/${agencySlug}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          priority,
          dueDate: dueDate || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create project");
        setSaving(false);
        return;
      }

      onCreated();
    } catch {
      setError("Something went wrong");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-ivory dark:bg-charcoal border border-sand/60 dark:border-white/10 rounded-2xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-charcoal dark:text-white">New Project</h2>
          <button onClick={onClose} className="text-muted hover:text-charcoal dark:hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-charcoal dark:text-white mb-1">Project Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Website Redesign"
              className="w-full px-3 py-2 bg-cream dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl text-sm text-charcoal dark:text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              autoFocus
            />
            <p className="text-[10px] text-muted mt-1">
              Use the same name your team uses with SEER to auto-link memory.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-charcoal dark:text-white mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief project description..."
              rows={3}
              className="w-full px-3 py-2 bg-cream dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl text-sm text-charcoal dark:text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/30 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-charcoal dark:text-white mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 bg-cream dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl text-sm text-charcoal dark:text-white focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-charcoal dark:text-white mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-cream dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl text-sm text-charcoal dark:text-white focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted hover:text-charcoal dark:hover:text-white transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
