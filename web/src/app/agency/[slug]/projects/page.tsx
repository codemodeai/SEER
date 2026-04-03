"use client";

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
} from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Project {
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

const STATUS_CONFIG = {
  active: { label: "Active", icon: Clock, color: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
  completed: { label: "Completed", icon: CheckCircle2, color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  archived: { label: "Archived", icon: Archive, color: "bg-gray-500/15 text-gray-400 border-gray-500/25" },
};

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "bg-gray-500/15 text-gray-400 border-gray-500/25" },
  medium: { label: "Medium", color: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
  high: { label: "High", color: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  urgent: { label: "Urgent", color: "bg-red-500/15 text-red-400 border-red-500/25" },
};

export default function ProjectsPage() {
  const { agency, role } = useAgency();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "archived">("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  async function fetchProjects() {
    if (!agency) return;
    try {
      const url = filter === "all"
        ? `/api/agency/${agency.slug}/projects`
        : `/api/agency/${agency.slug}/projects?status=${filter}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProjects();
  }, [agency, filter]);

  if (!agency) return null;

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  const canManage = role === "owner" || role === "admin";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
            <FolderKanban size={20} className="text-terracotta" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-charcoal">Projects</h1>
            <p className="text-muted text-sm mt-0.5">
              Manage your team&apos;s projects and track progress.
            </p>
          </div>
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-ivory dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl text-sm text-charcoal dark:text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/30"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "active", "completed", "archived"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setFilter(s); setLoading(true); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === s
                  ? "bg-terracotta/10 text-terracotta"
                  : "text-muted hover:bg-cream-dark dark:hover:bg-white/5"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-ivory dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted">Total</p>
          <p className="text-2xl font-display text-charcoal dark:text-white mt-1">{projects.length}</p>
        </div>
        <div className="bg-ivory dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted">Active</p>
          <p className="text-2xl font-display text-blue-400 mt-1">{projects.filter(p => p.status === "active").length}</p>
        </div>
        <div className="bg-ivory dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted">Completed</p>
          <p className="text-2xl font-display text-emerald-400 mt-1">{projects.filter(p => p.status === "completed").length}</p>
        </div>
        <div className="bg-ivory dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted">Total Tasks</p>
          <p className="text-2xl font-display text-charcoal dark:text-white mt-1">{projects.reduce((s, p) => s + p.taskCount, 0)}</p>
        </div>
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
          {canManage && !search && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors"
            >
              <Plus size={14} />
              Create your first project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project) => {
            const statusCfg = STATUS_CONFIG[project.status];
            const priorityCfg = PRIORITY_CONFIG[project.priority];
            const StatusIcon = statusCfg.icon;
            const progress = project.taskCount > 0 ? Math.round((project.tasksDone / project.taskCount) * 100) : 0;
            const isOverdue = project.due_date && new Date(project.due_date) < new Date() && project.status === "active";

            return (
              <Link
                key={project.id}
                href={`/agency/${agency.slug}/projects/${project.id}`}
                className="group bg-ivory dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-2xl p-5 hover:border-terracotta/30 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-semibold text-charcoal dark:text-white group-hover:text-terracotta transition-colors line-clamp-1">
                    {project.name}
                  </h3>
                  <ArrowUpRight size={14} className="text-muted group-hover:text-terracotta transition-colors shrink-0 mt-0.5" />
                </div>

                {project.description && (
                  <p className="text-xs text-muted line-clamp-2 mb-3">{project.description}</p>
                )}

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${statusCfg.color}`}>
                    <StatusIcon size={10} />
                    {statusCfg.label}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${priorityCfg.color}`}>
                    {priorityCfg.label}
                  </span>
                  {isOverdue && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-red-500/15 text-red-400 border-red-500/25">
                      <AlertTriangle size={10} />
                      Overdue
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted">{project.tasksDone}/{project.taskCount} tasks</span>
                    <span className="text-[10px] font-medium text-charcoal dark:text-white">{progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-sand/60 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-terracotta transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[10px] text-muted">
                  <span>{project.creatorEmail.split("@")[0]}</span>
                  {project.due_date && (
                    <span className="flex items-center gap-1">
                      <Calendar size={10} />
                      {new Date(project.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreate && (
        <CreateProjectModal
          agencySlug={agency.slug}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); setLoading(true); fetchProjects(); }}
        />
      )}
    </div>
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
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted hover:text-charcoal dark:hover:text-white transition-colors"
            >
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
