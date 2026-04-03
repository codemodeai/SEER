"use client";

import { useAgency } from "@/lib/agency-context";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  X,
  Loader2,
  Calendar,
  MessageSquare,
  User,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  MoreHorizontal,
  Trash2,
  Brain,
  Circle,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "in_review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  assigned_to: string | null;
  assigneeEmail: string | null;
  creatorEmail: string;
  due_date: string | null;
  commentCount: number;
  position: number;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  creatorEmail: string;
  created_at: string;
}

interface Member {
  userId: string;
  email: string;
  role: string;
}

interface CloudMemory {
  content: string;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
  integrityOk: boolean;
}

const COLUMNS = [
  { key: "todo" as const, label: "To Do", icon: Clock, color: "border-gray-400/40" },
  { key: "in_progress" as const, label: "In Progress", icon: AlertTriangle, color: "border-blue-400/40" },
  { key: "in_review" as const, label: "In Review", icon: Eye, color: "border-amber-400/40" },
  { key: "done" as const, label: "Done", icon: CheckCircle2, color: "border-emerald-400/40" },
];

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-gray-400",
  medium: "bg-blue-400",
  high: "bg-amber-400",
  urgent: "bg-red-400",
};

export default function ProjectDetailPage() {
  const { agency, role } = useAgency();
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memory, setMemory] = useState<CloudMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateTask, setShowCreateTask] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState<"board" | "memory">("board");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchData() {
    if (!agency) return;
    try {
      const res = await fetch(`/api/agency/${agency.slug}/projects/${projectId}/tasks`);
      if (!res.ok) {
        if (res.status === 404) router.push(`/agency/${agency.slug}/projects`);
        return;
      }
      const data = await res.json();
      setProject(data.project);
      setTasks(data.tasks ?? []);
      setMembers(data.members ?? []);

      // Fetch linked cloud memory
      if (data.project?.name) {
        fetchMemory(data.project.name);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function fetchMemory(projectName: string) {
    if (!agency) return;
    try {
      const res = await fetch(`/api/agency/${agency.slug}/memory?project=${encodeURIComponent(projectName)}`);
      if (res.ok) {
        const data = await res.json();
        setMemory({
          content: data.project.content,
          version: data.project.version,
          updatedBy: data.project.updatedBy,
          updatedAt: data.project.updatedAt,
          integrityOk: data.project.integrityOk,
        });
      } else {
        setMemory(null);
      }
    } catch {
      // silent
    }
  }

  useEffect(() => {
    fetchData();
    // Real-time polling every 10 seconds
    pollRef.current = setInterval(() => {
      if (project?.name) fetchMemory(project.name);
    }, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [agency, projectId]);

  // Restart memory poll when project name changes
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (project?.name) {
      pollRef.current = setInterval(() => fetchMemory(project.name), 10000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [project?.name]);

  async function handleStatusChange(taskId: string, newStatus: string) {
    if (!agency) return;
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus as Task["status"] } : t));
    await fetch(`/api/agency/${agency.slug}/projects/${projectId}/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId, status: newStatus }),
    });
  }

  async function handleDeleteTask(taskId: string) {
    if (!agency || !confirm("Delete this task?")) return;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`/api/agency/${agency.slug}/projects/${projectId}/tasks?task_id=${taskId}`, { method: "DELETE" });
  }

  if (!agency) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-muted" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-muted">Project not found.</p>
        <Link href={`/agency/${agency.slug}/projects`} className="text-terracotta text-sm mt-2 inline-block">
          Back to Projects
        </Link>
      </div>
    );
  }

  const canManage = role === "owner" || role === "admin";
  const doneCount = tasks.filter(t => t.status === "done").length;
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/agency/${agency.slug}/projects`}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-terracotta transition-colors mb-3"
        >
          <ArrowLeft size={14} />
          Back to Projects
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl sm:text-3xl text-charcoal dark:text-white">{project.name}</h1>
              {memory && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-purple-500/15 text-purple-400 border-purple-500/25">
                  <Brain size={10} />
                  Memory v{memory.version}
                </span>
              )}
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <Circle size={6} className="fill-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            {project.description && (
              <p className="text-sm text-muted mt-1 max-w-2xl">{project.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted">
              <span>by {project.creatorEmail.split("@")[0]}</span>
              {project.due_date && (
                <span className="flex items-center gap-1">
                  <Calendar size={11} />
                  Due {new Date(project.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
              <span>{tasks.length} tasks</span>
              <span>{doneCount} done</span>
            </div>
          </div>
        </div>

        {/* Progress */}
        {tasks.length > 0 && (
          <div className="mt-4 max-w-md">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted">Progress</span>
              <span className="text-[10px] font-medium text-charcoal dark:text-white">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-sand/60 dark:bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-terracotta transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-cream-dark/50 dark:bg-charcoal/30 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("board")}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
            activeTab === "board"
              ? "bg-ivory dark:bg-charcoal text-charcoal dark:text-white shadow-sm"
              : "text-muted hover:text-charcoal dark:hover:text-white"
          }`}
        >
          Task Board ({tasks.length})
        </button>
        <button
          onClick={() => setActiveTab("memory")}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === "memory"
              ? "bg-ivory dark:bg-charcoal text-charcoal dark:text-white shadow-sm"
              : "text-muted hover:text-charcoal dark:hover:text-white"
          }`}
        >
          <Brain size={12} />
          Project Memory
          {memory && <Circle size={5} className="text-emerald-400 fill-emerald-400" />}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "board" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const ColIcon = col.icon;
            const columnTasks = tasks
              .filter((t) => t.status === col.key)
              .sort((a, b) => a.position - b.position);

            return (
              <div key={col.key} className={`bg-cream/50 dark:bg-charcoal/30 border-t-2 ${col.color} rounded-xl p-3 min-h-[300px]`}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <ColIcon size={14} className="text-muted" />
                    <span className="text-xs font-semibold text-charcoal dark:text-white">{col.label}</span>
                    <span className="text-[10px] font-medium text-muted bg-sand/40 dark:bg-white/10 px-1.5 py-0.5 rounded-full">{columnTasks.length}</span>
                  </div>
                  <button
                    onClick={() => setShowCreateTask(col.key)}
                    className="w-6 h-6 rounded-lg hover:bg-terracotta/10 flex items-center justify-center text-muted hover:text-terracotta transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      canManage={canManage}
                      columns={COLUMNS}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDeleteTask}
                      onEdit={() => setEditingTask(task)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "memory" && (
        <MemoryPanel
          memory={memory}
          projectName={project.name}
          onRefresh={() => fetchMemory(project.name)}
        />
      )}

      {/* Create Task Modal */}
      {showCreateTask && (
        <CreateTaskModal
          agencySlug={agency.slug}
          projectId={projectId}
          defaultStatus={showCreateTask}
          members={members}
          onClose={() => setShowCreateTask(null)}
          onCreated={() => { setShowCreateTask(null); fetchData(); }}
        />
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <EditTaskModal
          agencySlug={agency.slug}
          projectId={projectId}
          task={editingTask}
          members={members}
          canManage={canManage}
          onClose={() => setEditingTask(null)}
          onUpdated={() => { setEditingTask(null); fetchData(); }}
          onDeleted={(id) => { setEditingTask(null); handleDeleteTask(id); }}
        />
      )}
    </div>
  );
}

/* ── Memory Panel ── */
function MemoryPanel({
  memory,
  projectName,
  onRefresh,
}: {
  memory: CloudMemory | null;
  projectName: string;
  onRefresh: () => void;
}) {
  if (!memory) {
    return (
      <div className="bg-ivory dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-2xl p-8 text-center">
        <Brain size={32} className="text-muted/30 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-charcoal dark:text-white mb-1">No memory synced yet</h3>
        <p className="text-xs text-muted max-w-md mx-auto">
          When team members use SEER on a project named &ldquo;{projectName}&rdquo;, the .seer_memory.md file
          will automatically sync here in real-time.
        </p>
      </div>
    );
  }

  // Parse memory sections
  const sections = parseMemory(memory.content);

  return (
    <div className="space-y-4">
      {/* Meta bar */}
      <div className="flex items-center justify-between bg-ivory dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl px-4 py-2.5">
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <Brain size={12} className="text-purple-400" />
            Version {memory.version}
          </span>
          {memory.updatedBy && <span>by {memory.updatedBy.split("@")[0]}</span>}
          <span>{new Date(memory.updatedAt).toLocaleString()}</span>
          {memory.integrityOk ? (
            <span className="text-emerald-400">Integrity OK</span>
          ) : (
            <span className="text-red-400">Integrity mismatch</span>
          )}
        </div>
        <button
          onClick={onRefresh}
          className="text-muted hover:text-terracotta transition-colors"
          title="Refresh memory"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Memory sections */}
      {sections.map((section, i) => (
        <div
          key={i}
          className="bg-ivory dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-2xl overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-sand/40 dark:border-white/10">
            <h3 className="text-xs font-semibold text-charcoal dark:text-white">{section.title}</h3>
          </div>
          <div className="px-5 py-4">
            <pre className="text-xs text-muted leading-relaxed whitespace-pre-wrap font-mono">{section.content}</pre>
          </div>
        </div>
      ))}

      {/* Raw fallback if no sections parsed */}
      {sections.length === 0 && (
        <div className="bg-ivory dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-2xl p-5">
          <pre className="text-xs text-muted leading-relaxed whitespace-pre-wrap font-mono">{memory.content}</pre>
        </div>
      )}
    </div>
  );
}

function parseMemory(content: string): { title: string; content: string }[] {
  const sections: { title: string; content: string }[] = [];
  const lines = content.split("\n");
  let currentTitle = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      if (currentTitle) {
        sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
      }
      currentTitle = headingMatch[1];
      currentContent = [];
    } else if (currentTitle) {
      currentContent.push(line);
    }
  }

  if (currentTitle) {
    sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
  }

  return sections;
}

/* ── Task Card ── */
function TaskCard({
  task,
  canManage,
  columns,
  onStatusChange,
  onDelete,
  onEdit,
}: {
  task: Task;
  canManage: boolean;
  columns: typeof COLUMNS;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onEdit: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";

  return (
    <div
      className="bg-ivory dark:bg-charcoal/60 border border-sand/50 dark:border-white/8 rounded-xl p-3 cursor-pointer hover:border-terracotta/20 transition-all group relative"
      onClick={onEdit}
    >
      <div className="flex items-start gap-2">
        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${PRIORITY_DOT[task.priority]}`} />
        <p className="text-xs font-medium text-charcoal dark:text-white line-clamp-2 flex-1">{task.title}</p>
        {canManage && (
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-muted hover:text-charcoal dark:hover:text-white transition-all shrink-0"
          >
            <MoreHorizontal size={12} />
          </button>
        )}
      </div>

      {menuOpen && (
        <div
          className="absolute right-2 top-8 z-10 bg-ivory dark:bg-charcoal border border-sand/60 dark:border-white/10 rounded-xl shadow-lg py-1 min-w-[140px]"
          onClick={(e) => e.stopPropagation()}
        >
          {columns.filter((c) => c.key !== task.status).map((c) => (
            <button
              key={c.key}
              onClick={() => { onStatusChange(task.id, c.key); setMenuOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-charcoal dark:text-white hover:bg-cream-dark dark:hover:bg-white/5 transition-colors"
            >
              Move to {c.label}
            </button>
          ))}
          <hr className="my-1 border-sand/40 dark:border-white/10" />
          <button
            onClick={() => { onDelete(task.id); setMenuOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/5 transition-colors"
          >
            <Trash2 size={11} className="inline mr-1.5" />
            Delete
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {task.assigneeEmail && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted">
            <User size={10} />
            {task.assigneeEmail.split("@")[0]}
          </span>
        )}
        {task.due_date && (
          <span className={`inline-flex items-center gap-1 text-[10px] ${isOverdue ? "text-red-400" : "text-muted"}`}>
            <Calendar size={10} />
            {new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
        {task.commentCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted">
            <MessageSquare size={10} />
            {task.commentCount}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Create Task Modal ── */
function CreateTaskModal({
  agencySlug,
  projectId,
  defaultStatus,
  members,
  onClose,
  onCreated,
}: {
  agencySlug: string;
  projectId: string;
  defaultStatus: string;
  members: Member[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/agency/${agencySlug}/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          priority,
          status: defaultStatus,
          assignedTo: assignedTo || null,
          dueDate: dueDate || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create task");
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
      <div className="bg-ivory dark:bg-charcoal border border-sand/60 dark:border-white/10 rounded-2xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-charcoal dark:text-white">New Task</h2>
          <button onClick={onClose} className="text-muted hover:text-charcoal dark:hover:text-white"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-charcoal dark:text-white mb-1">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" className="w-full px-3 py-2 bg-cream dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl text-sm text-charcoal dark:text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/30" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-charcoal dark:text-white mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add details..." rows={3} className="w-full px-3 py-2 bg-cream dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl text-sm text-charcoal dark:text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/30 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-charcoal dark:text-white mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-3 py-2 bg-cream dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl text-sm text-charcoal dark:text-white focus:outline-none focus:ring-2 focus:ring-terracotta/30">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-charcoal dark:text-white mb-1">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 bg-cream dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl text-sm text-charcoal dark:text-white focus:outline-none focus:ring-2 focus:ring-terracotta/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-charcoal dark:text-white mb-1">Assign To</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full px-3 py-2 bg-cream dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl text-sm text-charcoal dark:text-white focus:outline-none focus:ring-2 focus:ring-terracotta/30">
              <option value="">Unassigned</option>
              {members.map((m) => (<option key={m.userId} value={m.userId}>{m.email.split("@")[0]} ({m.role})</option>))}
            </select>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted hover:text-charcoal dark:hover:text-white transition-colors">Cancel</button>
            <button type="submit" disabled={saving || !title.trim()} className="px-4 py-2 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors disabled:opacity-50">{saving ? "Creating..." : "Create Task"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Edit Task Modal ── */
function EditTaskModal({
  agencySlug,
  projectId,
  task,
  members,
  canManage,
  onClose,
  onUpdated,
  onDeleted,
}: {
  agencySlug: string;
  projectId: string;
  task: Task;
  members: Member[];
  canManage: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: (id: string) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState(task.priority);
  const [status, setStatus] = useState(task.status);
  const [assignedTo, setAssignedTo] = useState(task.assigned_to ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/agency/${agencySlug}/projects/${projectId}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: task.id,
          title: title.trim(),
          description: description.trim(),
          priority,
          status,
          assignedTo: assignedTo || null,
          dueDate: dueDate || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to update task");
        setSaving(false);
        return;
      }

      onUpdated();
    } catch {
      setError("Something went wrong");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-ivory dark:bg-charcoal border border-sand/60 dark:border-white/10 rounded-2xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-charcoal dark:text-white">Edit Task</h2>
          <div className="flex items-center gap-2">
            {canManage && (
              <button onClick={() => onDeleted(task.id)} className="text-muted hover:text-red-400 transition-colors" title="Delete"><Trash2 size={16} /></button>
            )}
            <button onClick={onClose} className="text-muted hover:text-charcoal dark:hover:text-white"><X size={18} /></button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-charcoal dark:text-white mb-1">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 bg-cream dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl text-sm text-charcoal dark:text-white focus:outline-none focus:ring-2 focus:ring-terracotta/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-charcoal dark:text-white mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 bg-cream dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl text-sm text-charcoal dark:text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/30 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-charcoal dark:text-white mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as Task["status"])} className="w-full px-3 py-2 bg-cream dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl text-sm text-charcoal dark:text-white focus:outline-none focus:ring-2 focus:ring-terracotta/30">
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-charcoal dark:text-white mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Task["priority"])} className="w-full px-3 py-2 bg-cream dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl text-sm text-charcoal dark:text-white focus:outline-none focus:ring-2 focus:ring-terracotta/30">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-charcoal dark:text-white mb-1">Assign To</label>
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full px-3 py-2 bg-cream dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl text-sm text-charcoal dark:text-white focus:outline-none focus:ring-2 focus:ring-terracotta/30">
                <option value="">Unassigned</option>
                {members.map((m) => (<option key={m.userId} value={m.userId}>{m.email.split("@")[0]} ({m.role})</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-charcoal dark:text-white mb-1">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 bg-cream dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-xl text-sm text-charcoal dark:text-white focus:outline-none focus:ring-2 focus:ring-terracotta/30" />
            </div>
          </div>
          <div className="text-[10px] text-muted flex items-center gap-3">
            <span>Created by {task.creatorEmail.split("@")[0]}</span>
            <span>{new Date(task.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted hover:text-charcoal dark:hover:text-white transition-colors">Cancel</button>
            <button type="submit" disabled={saving || !title.trim()} className="px-4 py-2 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors disabled:opacity-50">{saving ? "Saving..." : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
