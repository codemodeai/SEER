"use client";

import { useDashboard } from "@/lib/dashboard-context";
import { useState, useEffect, useCallback } from "react";
import {
  Briefcase,
  Lock,
  ArrowRight,
  Plus,
  Trash2,
  ChevronDown,
  Calendar,
  Clock,
  StickyNote,
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  FolderOpen,
  FileText,
  KeyRound,
  Zap,
  Users,
  User,
} from "lucide-react";
import Link from "next/link";
import CredentialsPanel from "./credentials-panel";
import DocumentsPanel from "./documents-panel";

/* ---------- Types ---------- */

interface Project {
  id: string;
  name: string;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  project_id: string | null;
  created_via: string;
  created_at: string;
  agency_id?: string | null;
  users?: { email: string } | null;
}

interface Note {
  id: string;
  body: string;
  project_id: string | null;
  created_at: string;
  agency_id?: string | null;
  users?: { email: string } | null;
}

type Tab = "tasks" | "notes" | "credentials" | "documents";

const STATUSES = ["open", "in_progress", "done", "blocked"] as const;

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: typeof Circle }> = {
  open: { label: "Open", color: "text-blue-600", bg: "bg-blue-50 border-blue-200", icon: Circle },
  in_progress: { label: "In Progress", color: "text-amber-600", bg: "bg-amber-50 border-amber-200", icon: Clock },
  done: { label: "Done", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
  blocked: { label: "Blocked", color: "text-red-600", bg: "bg-red-50 border-red-200", icon: AlertTriangle },
};

function nextStatus(current: string): string {
  const order = ["open", "in_progress", "done", "blocked"];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}

function dueDateColor(due: string | null): string {
  if (!due) return "";
  const now = new Date();
  const d = new Date(due + "T00:00:00");
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "text-red-600 font-semibold";
  if (diff < 3) return "text-amber-600 font-medium";
  return "text-muted";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ---------- Main Page ---------- */

export default function FoundersSpacePage() {
  const { plan, fsAccess, agencySlug, userId, loading: ctxLoading } = useDashboard();
  const isAgency = !!agencySlug;

  /* --- State --- */
  const [activeTab, setActiveTab] = useState<Tab>("tasks");
  const [teamMode, setTeamMode] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  // New project form
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  // New task form
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [newTaskProjectId, setNewTaskProjectId] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);

  // New note form
  const [newNoteBody, setNewNoteBody] = useState("");
  const [creatingNote, setCreatingNote] = useState(false);

  /* --- Data fetching --- */

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/founders-space/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const teamParam = teamMode ? "&team=true" : "";
      const projectParam = selectedProjectId ? `project_id=${selectedProjectId}` : "";
      const url = `/api/founders-space/tasks?${projectParam}${teamParam}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    }
  }, [selectedProjectId, teamMode]);

  const fetchNotes = useCallback(async () => {
    try {
      const teamParam = teamMode ? "&team=true" : "";
      const projectParam = selectedProjectId ? `project_id=${selectedProjectId}` : "";
      const url = `/api/founders-space/notes?${projectParam}${teamParam}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch notes:", err);
    }
  }, [selectedProjectId, teamMode]);

  useEffect(() => {
    if (!fsAccess || ctxLoading) return;
    setLoadingData(true);
    Promise.all([fetchProjects(), fetchTasks(), fetchNotes()]).finally(() =>
      setLoadingData(false)
    );
  }, [fsAccess, ctxLoading, fetchProjects, fetchTasks, fetchNotes]);

  /* --- Actions --- */

  async function createProject() {
    if (!newProjectName.trim() || creatingProject) return;
    setCreatingProject(true);
    try {
      const res = await fetch("/api/founders-space/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setProjects((p) => [data.project, ...p]);
        setNewProjectName("");
        setShowNewProject(false);
      }
    } catch (err) {
      console.error("Failed to create project:", err);
    } finally {
      setCreatingProject(false);
    }
  }

  async function createTask() {
    if (!newTaskTitle.trim() || creatingTask) return;
    setCreatingTask(true);
    try {
      const res = await fetch("/api/founders-space/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          project_id: newTaskProjectId || selectedProjectId || null,
          due_date: newTaskDue || null,
          status: "open",
          team: teamMode,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTasks((t) => [data.task, ...t]);
        setNewTaskTitle("");
        setNewTaskDue("");
        setShowNewTask(false);
      }
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setCreatingTask(false);
    }
  }

  async function cycleTaskStatus(task: Task) {
    const newStatus = nextStatus(task.status);
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );
    try {
      const res = await fetch(`/api/founders-space/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
        );
      }
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      );
    }
  }

  async function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await fetch(`/api/founders-space/tasks/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete task:", err);
      fetchTasks();
    }
  }

  async function createNote() {
    if (!newNoteBody.trim() || creatingNote) return;
    setCreatingNote(true);
    try {
      const res = await fetch("/api/founders-space/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: newNoteBody.trim(),
          project_id: selectedProjectId || null,
          team: teamMode,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setNotes((n) => [data.note, ...n]);
        setNewNoteBody("");
      }
    } catch (err) {
      console.error("Failed to create note:", err);
    } finally {
      setCreatingNote(false);
    }
  }

  /* --- Loading state --- */
  if (ctxLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-terracotta/30 border-t-terracotta rounded-full animate-spin" />
      </div>
    );
  }

  /* --- Plan gating --- */
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
          {plan === "starter" ? (
            <Link
              href="/payment/checkout?plan=fs_addon"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta/90 transition-all"
            >
              Enable Addon — $1/mo
              <ArrowRight size={16} />
            </Link>
          ) : plan === "pro" || plan === "agency" ? (
            <button
              onClick={async () => {
                const res = await fetch("/api/founders-space/addon-checkout", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId, email: "auto@enable", preferredProvider: "" }),
                });
                const data = await res.json();
                if (data.enabled) window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta/90 transition-all"
            >
              Activate Now (Included)
              <ArrowRight size={16} />
            </button>
          ) : (
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta/90 transition-all"
            >
              View Plans
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </div>
    );
  }

  /* --- Helpers for rendering --- */
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const tasksByStatus = STATUSES.reduce(
    (acc, s) => {
      acc[s] = tasks.filter((t) => t.status === s);
      return acc;
    },
    {} as Record<string, Task[]>
  );

  const projectName = (id: string | null) => {
    if (!id) return null;
    return projects.find((p) => p.id === id)?.name ?? null;
  };

  const tabs: { key: Tab; label: string; icon: typeof Briefcase }[] = [
    { key: "tasks", label: "Tasks", icon: CheckCircle2 },
    { key: "notes", label: "Notes", icon: StickyNote },
    { key: "credentials", label: "Credentials", icon: KeyRound },
    { key: "documents", label: "Documents", icon: FileText },
  ];

  /* --- Render --- */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-charcoal tracking-tight">
            Founder&apos;s Space
          </h1>
          <p className="mt-1 text-sm text-muted">
            Your operational workspace — tasks, credentials, documents, and notes.
          </p>
        </div>

        {/* Personal / Team toggle for agency users */}
        {isAgency && (
          <div className="flex items-center gap-1 bg-ivory rounded-xl border border-sand/60 p-1">
            <button
              onClick={() => setTeamMode(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                !teamMode
                  ? "bg-white text-charcoal shadow-sm border border-sand/60"
                  : "text-muted hover:text-charcoal"
              }`}
            >
              <User size={14} />
              Personal
            </button>
            <button
              onClick={() => setTeamMode(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                teamMode
                  ? "bg-white text-charcoal shadow-sm border border-sand/60"
                  : "text-muted hover:text-charcoal"
              }`}
            >
              <Users size={14} />
              Team
            </button>
          </div>
        )}
      </div>

      {/* Team mode banner */}
      {teamMode && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-700">
          <Users size={16} />
          <span>Viewing shared team items. Changes are visible to all agency members.</span>
        </div>
      )}

      {/* Project switcher */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setProjectDropdownOpen((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-ivory border border-sand/60 text-sm text-charcoal hover:bg-cream transition-all"
          >
            <FolderOpen size={16} className="text-terracotta" />
            <span>{selectedProject ? selectedProject.name : "All Projects"}</span>
            <ChevronDown size={14} className="text-muted" />
          </button>
          {projectDropdownOpen && (
            <div className="absolute z-20 top-full left-0 mt-1 w-56 bg-white rounded-xl border border-sand/60 shadow-lg py-1 max-h-64 overflow-y-auto">
              <button
                onClick={() => {
                  setSelectedProjectId(null);
                  setProjectDropdownOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-cream transition-all ${
                  !selectedProjectId ? "text-terracotta font-semibold" : "text-charcoal"
                }`}
              >
                All Projects
              </button>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProjectId(p.id);
                    setProjectDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-cream transition-all ${
                    selectedProjectId === p.id
                      ? "text-terracotta font-semibold"
                      : "text-charcoal"
                  }`}
                >
                  {p.name}
                </button>
              ))}
              {projects.length === 0 && (
                <p className="px-4 py-2 text-xs text-muted">No projects yet</p>
              )}
            </div>
          )}
        </div>

        {!showNewProject ? (
          <button
            onClick={() => setShowNewProject(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-terracotta hover:bg-terracotta/5 transition-all"
          >
            <Plus size={16} />
            New Project
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createProject()}
              placeholder="Project name..."
              autoFocus
              className="px-3 py-2 rounded-xl border border-sand/60 bg-ivory text-sm text-charcoal placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30 w-48"
            />
            <button
              onClick={createProject}
              disabled={creatingProject || !newProjectName.trim()}
              className="px-3 py-2 rounded-xl bg-terracotta text-white text-sm font-medium hover:bg-terracotta/90 disabled:opacity-50 transition-all"
            >
              {creatingProject ? <Loader2 size={14} className="animate-spin" /> : "Create"}
            </button>
            <button
              onClick={() => {
                setShowNewProject(false);
                setNewProjectName("");
              }}
              className="px-2 py-2 text-sm text-muted hover:text-charcoal transition-all"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Empty state — no projects yet */}
      {!loadingData && projects.length === 0 && !showNewProject && (
        <div className="bg-ivory rounded-2xl border border-sand/60 p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-terracotta/10 flex items-center justify-center mx-auto">
            <FolderOpen size={28} className="text-terracotta" />
          </div>
          <h2 className="font-display text-xl text-charcoal">
            Create your first project
          </h2>
          <p className="text-sm text-warm-brown-light max-w-md mx-auto">
            Projects organize your tasks, credentials, documents, and notes. Start by creating a project to get going.
          </p>
          <button
            onClick={() => setShowNewProject(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta/90 transition-all"
          >
            <Plus size={16} />
            New Project
          </button>
        </div>
      )}

      {/* Tab navigation */}
      <div className={`flex gap-1 border-b border-sand/60 ${!loadingData && projects.length === 0 && !showNewProject ? "hidden" : ""}`}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
              activeTab === tab.key
                ? "border-terracotta text-terracotta"
                : "border-transparent text-muted hover:text-charcoal"
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loadingData && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="text-terracotta animate-spin" />
        </div>
      )}

      {/* Tasks panel */}
      {!loadingData && activeTab === "tasks" && (
        <div className="space-y-4">
          {/* Add task button / form */}
          {!showNewTask ? (
            <button
              onClick={() => {
                setShowNewTask(true);
                setNewTaskProjectId(selectedProjectId);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta/90 transition-all"
            >
              <Plus size={16} />
              Add Task{teamMode ? " (Team)" : ""}
            </button>
          ) : (
            <div className="bg-ivory rounded-2xl border border-sand/60 p-4 space-y-3">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createTask()}
                placeholder="Task title..."
                autoFocus
                className="w-full px-3 py-2 rounded-xl border border-sand/60 bg-white text-sm text-charcoal placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              />
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-muted" />
                  <input
                    type="date"
                    value={newTaskDue}
                    onChange={(e) => setNewTaskDue(e.target.value)}
                    className="px-2 py-1.5 rounded-lg border border-sand/60 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-terracotta/30"
                  />
                </div>
                {projects.length > 0 && (
                  <select
                    value={newTaskProjectId ?? ""}
                    onChange={(e) => setNewTaskProjectId(e.target.value || null)}
                    className="px-2 py-1.5 rounded-lg border border-sand/60 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-terracotta/30"
                  >
                    <option value="">No project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
                {teamMode && (
                  <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                    <Users size={12} />
                    Shared with team
                  </span>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={createTask}
                    disabled={creatingTask || !newTaskTitle.trim()}
                    className="px-4 py-1.5 rounded-xl bg-terracotta text-white text-sm font-medium hover:bg-terracotta/90 disabled:opacity-50 transition-all"
                  >
                    {creatingTask ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      "Create"
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowNewTask(false);
                      setNewTaskTitle("");
                      setNewTaskDue("");
                    }}
                    className="px-3 py-1.5 text-sm text-muted hover:text-charcoal transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Kanban columns */}
          {tasks.length === 0 ? (
            <div className="bg-ivory rounded-2xl border border-sand/60 p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-terracotta/10 flex items-center justify-center mx-auto">
                <Briefcase size={24} className="text-terracotta" />
              </div>
              <h3 className="font-display text-lg text-charcoal">
                No {teamMode ? "team " : ""}tasks yet
              </h3>
              <p className="text-sm text-muted max-w-sm mx-auto">
                Create your first {teamMode ? "team " : ""}task to start organizing your work.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {STATUSES.map((status) => {
                const meta = STATUS_META[status];
                const StatusIcon = meta.icon;
                const columnTasks = tasksByStatus[status];
                return (
                  <div key={status} className="space-y-2">
                    <div className="flex items-center gap-2 px-1 pb-1">
                      <StatusIcon size={14} className={meta.color} />
                      <span className={`text-sm font-semibold ${meta.color}`}>
                        {meta.label}
                      </span>
                      <span className="text-xs text-muted bg-cream-dark rounded-full px-2 py-0.5">
                        {columnTasks.length}
                      </span>
                    </div>
                    <div className="space-y-2 min-h-[60px]">
                      {columnTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          projectName={projectName(task.project_id)}
                          teamMode={teamMode}
                          onCycleStatus={() => cycleTaskStatus(task)}
                          onDelete={() => deleteTask(task.id)}
                        />
                      ))}
                      {columnTasks.length === 0 && (
                        <div className="rounded-xl border border-dashed border-sand/60 p-4 text-center">
                          <p className="text-xs text-muted/50">No tasks</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Notes panel */}
      {!loadingData && activeTab === "notes" && (
        <div className="space-y-4">
          <div className="bg-ivory rounded-2xl border border-sand/60 p-4 space-y-3">
            <textarea
              value={newNoteBody}
              onChange={(e) => setNewNoteBody(e.target.value)}
              placeholder={teamMode ? "Write a team note..." : "Write a note..."}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-sand/60 bg-white text-sm text-charcoal placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30 resize-none"
            />
            <div className="flex items-center justify-between">
              {teamMode && (
                <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                  <Users size={12} />
                  Shared with team
                </span>
              )}
              <div className={teamMode ? "" : "ml-auto"}>
                <button
                  onClick={createNote}
                  disabled={creatingNote || !newNoteBody.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta/90 disabled:opacity-50 transition-all"
                >
                  {creatingNote ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <>
                      <Plus size={14} />
                      Add Note
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {notes.length === 0 ? (
            <div className="bg-ivory rounded-2xl border border-sand/60 p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-terracotta/10 flex items-center justify-center mx-auto">
                <StickyNote size={24} className="text-terracotta" />
              </div>
              <h3 className="font-display text-lg text-charcoal">
                No {teamMode ? "team " : ""}notes yet
              </h3>
              <p className="text-sm text-muted max-w-sm mx-auto">
                Add your first note above. Notes are append-only for an immutable log.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="bg-ivory rounded-2xl border border-sand/60 p-4 space-y-2"
                >
                  <p className="text-sm text-charcoal whitespace-pre-wrap">
                    {note.body}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span>{formatTimestamp(note.created_at)}</span>
                    {projectName(note.project_id) && (
                      <span className="bg-cream-dark px-2 py-0.5 rounded-full">
                        {projectName(note.project_id)}
                      </span>
                    )}
                    {teamMode && note.users?.email && (
                      <span className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                        <User size={10} />
                        {note.users.email.split("@")[0]}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Credentials tab */}
      {!loadingData && activeTab === "credentials" && <CredentialsPanel teamMode={teamMode} />}

      {/* Documents tab */}
      {!loadingData && activeTab === "documents" && <DocumentsPanel teamMode={teamMode} />}
    </div>
  );
}

/* ---------- Task Card Component ---------- */

function TaskCard({
  task,
  projectName,
  teamMode,
  onCycleStatus,
  onDelete,
}: {
  task: Task;
  projectName: string | null;
  teamMode: boolean;
  onCycleStatus: () => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[task.status] ?? STATUS_META.open;
  const StatusIcon = meta.icon;

  return (
    <div className="bg-ivory rounded-xl border border-sand/60 p-3 space-y-2 group">
      <div className="flex items-start gap-2">
        <button
          onClick={onCycleStatus}
          title={`Status: ${meta.label} — click to cycle`}
          className={`mt-0.5 shrink-0 ${meta.color} hover:opacity-70 transition-all`}
        >
          <StatusIcon size={16} />
        </button>
        <p className={`text-sm text-charcoal flex-1 ${task.status === "done" ? "line-through opacity-60" : ""}`}>
          {task.title}
        </p>
        <button
          onClick={onDelete}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 transition-all"
          title="Delete task"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-6">
        {task.due_date && (
          <span className={`text-xs flex items-center gap-1 ${dueDateColor(task.due_date)}`}>
            <Calendar size={11} />
            {formatDate(task.due_date)}
          </span>
        )}
        {task.created_via && task.created_via !== "dashboard" && (
          <span className="text-xs bg-cream-dark px-1.5 py-0.5 rounded text-muted flex items-center gap-1">
            <Zap size={10} />
            {task.created_via}
          </span>
        )}
        {projectName && (
          <span className="text-xs bg-cream-dark px-1.5 py-0.5 rounded-full text-muted">
            {projectName}
          </span>
        )}
        {teamMode && task.users?.email && (
          <span className="text-xs flex items-center gap-1 bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
            <User size={10} />
            {task.users.email.split("@")[0]}
          </span>
        )}
      </div>
    </div>
  );
}
