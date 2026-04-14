"use client";

import { useState, useRef, type DragEvent } from "react";
import {
  Circle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Trash2,
  Zap,
  User,
  FolderOpen,
  GripVertical,
} from "lucide-react";

/* ---------- Types ---------- */

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

interface Project {
  id: string;
  name: string;
  created_at: string;
}

/* ---------- Constants ---------- */

const STATUSES = ["open", "in_progress", "done", "blocked"] as const;

const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; border: string; dropBg: string; icon: typeof Circle }
> = {
  open: {
    label: "Open",
    color: "text-blue-600",
    bg: "bg-blue-50/50",
    border: "border-blue-200",
    dropBg: "bg-blue-100/60",
    icon: Circle,
  },
  in_progress: {
    label: "In Progress",
    color: "text-amber-600",
    bg: "bg-amber-50/50",
    border: "border-amber-200",
    dropBg: "bg-amber-100/60",
    icon: Clock,
  },
  done: {
    label: "Done",
    color: "text-emerald-600",
    bg: "bg-emerald-50/50",
    border: "border-emerald-200",
    dropBg: "bg-emerald-100/60",
    icon: CheckCircle2,
  },
  blocked: {
    label: "Blocked",
    color: "text-red-600",
    bg: "bg-red-50/50",
    border: "border-red-200",
    dropBg: "bg-red-100/60",
    icon: AlertTriangle,
  },
};

/* ---------- Helpers ---------- */

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
  });
}

/* ---------- Board Card ---------- */

function BoardCard({
  task,
  projectName,
  teamMode,
  onDelete,
  onDragStart,
}: {
  task: Task;
  projectName: string | null;
  teamMode: boolean;
  onDelete: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
}) {
  const isDone = task.status === "done";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`bg-white rounded-xl border border-sand/60 p-3 space-y-2 group cursor-grab active:cursor-grabbing
        hover:border-terracotta/30 hover:shadow-sm transition-all ${isDone ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="mt-0.5 shrink-0 text-muted/40 group-hover:text-muted/70 transition-all" />
        <p className={`text-sm text-charcoal flex-1 leading-snug ${isDone ? "line-through" : ""}`}>
          {task.title}
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 transition-all"
          title="Delete task"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pl-6">
        {task.due_date && (
          <span className={`text-[11px] flex items-center gap-0.5 ${dueDateColor(task.due_date)}`}>
            <Calendar size={10} />
            {formatDate(task.due_date)}
          </span>
        )}
        {task.created_via && task.created_via !== "dashboard" && (
          <span className="text-[11px] bg-cream-dark px-1.5 py-0.5 rounded text-muted flex items-center gap-0.5">
            <Zap size={9} />
            {task.created_via}
          </span>
        )}
        {projectName && (
          <span className="text-[11px] bg-cream-dark px-1.5 py-0.5 rounded-full text-muted flex items-center gap-0.5">
            <FolderOpen size={9} />
            {projectName}
          </span>
        )}
        {teamMode && task.users?.email && (
          <span className="text-[11px] flex items-center gap-0.5 bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
            <User size={9} />
            {task.users.email.split("@")[0]}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- Board Column ---------- */

function BoardColumn({
  status,
  tasks,
  projectName,
  teamMode,
  onDelete,
  onDragStart,
  onDrop,
}: {
  status: string;
  tasks: Task[];
  projectName: (id: string | null) => string | null;
  teamMode: boolean;
  onDelete: (id: string) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, taskId: string) => void;
  onDrop: (status: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const meta = STATUS_META[status] ?? STATUS_META.open;
  const StatusIcon = meta.icon;

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    onDrop(status);
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col rounded-2xl border transition-all min-h-[200px] ${
        dragOver
          ? `${meta.dropBg} ${meta.border} border-2 shadow-inner`
          : `bg-ivory/50 border-sand/40`
      }`}
    >
      {/* Column header */}
      <div className={`flex items-center gap-2 px-4 py-3 border-b ${meta.border} ${meta.bg} rounded-t-2xl`}>
        <StatusIcon size={15} className={meta.color} />
        <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
        <span className="text-xs text-muted bg-white/70 rounded-full px-2 py-0.5 ml-auto font-medium">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-360px)]">
        {tasks.map((task) => (
          <BoardCard
            key={task.id}
            task={task}
            projectName={projectName(task.project_id)}
            teamMode={teamMode}
            onDelete={() => onDelete(task.id)}
            onDragStart={(e) => onDragStart(e, task.id)}
          />
        ))}
        {tasks.length === 0 && (
          <div className={`rounded-xl border border-dashed ${meta.border} p-6 text-center transition-all ${
            dragOver ? "border-2" : ""
          }`}>
            <p className="text-xs text-muted/50">
              {dragOver ? "Drop here" : "No tasks"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Main Task Board ---------- */

export default function TaskBoard({
  tasks,
  projects,
  teamMode,
  onStatusChange,
  onDelete,
}: {
  tasks: Task[];
  projects: Project[];
  teamMode: boolean;
  onStatusChange: (taskId: string, newStatus: string) => void;
  onDelete: (taskId: string) => void;
}) {
  const draggedTaskId = useRef<string | null>(null);

  function handleDragStart(e: DragEvent<HTMLDivElement>, taskId: string) {
    draggedTaskId.current = taskId;
    e.dataTransfer.effectAllowed = "move";
    // Make the drag image slightly transparent
    if (e.currentTarget) {
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    }
  }

  function handleDrop(newStatus: string) {
    const taskId = draggedTaskId.current;
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) {
      draggedTaskId.current = null;
      return;
    }

    onStatusChange(taskId, newStatus);
    draggedTaskId.current = null;
  }

  function projectName(id: string | null): string | null {
    if (!id) return null;
    return projects.find((p) => p.id === id)?.name ?? null;
  }

  const tasksByStatus = STATUSES.reduce(
    (acc, s) => {
      acc[s] = tasks.filter((t) => t.status === s);
      return acc;
    },
    {} as Record<string, Task[]>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {STATUSES.map((status) => (
        <BoardColumn
          key={status}
          status={status}
          tasks={tasksByStatus[status]}
          projectName={projectName}
          teamMode={teamMode}
          onDelete={onDelete}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
        />
      ))}
    </div>
  );
}
