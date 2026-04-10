"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Sparkles,
  GitBranch,
  Brain,
  Activity,
  BookOpen,
  FolderOpen,
  Wrench,
  MessageSquare,
  RotateCcw,
  Terminal,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Star,
  Clock,
  Shield,
  Lock,
  Briefcase,
} from "lucide-react";

/* ─── Tool data ─── */

interface Tool {
  id: string;
  name: string;
  command: string;
  description: string;
  longDescription: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  cost: "free" | "1 call";
  plans: string;
  category: "core" | "memory" | "workspace" | "utility";
  example: string;
  exampleOutput: string;
}

const TOOLS: Tool[] = [
  {
    id: "seer_run",
    name: "seer run",
    command: "seer <anything>",
    description: "Compress & optimize any prompt via AI",
    longDescription:
      "The core SEER tool. Send any prompt and SEER compresses it using AI — reducing tokens while preserving intent.",
    icon: Zap,
    color: "text-terracotta",
    bgColor: "bg-terracotta/10",
    borderColor: "border-terracotta/20",
    cost: "1 call",
    plans: "All plans",
    category: "core",
    example: "seer build a login page with email and password using React and Tailwind with validation",
    exampleOutput:
      "Build React login form: email + password inputs, Tailwind styling, client-side validation (required, email format, min 8 chars). Include error states and submit handler.",
  },
  {
    id: "seer_optimize",
    name: "seer optimize",
    command: "seer optimize <prompt>",
    description: "Model-specific prompt optimization",
    longDescription:
      "Tailors your prompt for a specific AI model. Returns optimized text, quality score, token reduction %, and explanation.",
    icon: Sparkles,
    color: "text-accent-gold",
    bgColor: "bg-accent-gold/10",
    borderColor: "border-accent-gold/20",
    cost: "1 call",
    plans: "All plans",
    category: "core",
    example: "seer optimize explain quantum computing to a 5 year old",
    exampleOutput:
      "Explain quantum computing for a 5-year-old: use everyday analogies (coins, boxes), avoid jargon, keep under 100 words, playful tone.",
  },
  {
    id: "seer_workflow",
    name: "seer workflow",
    command: "seer workflow <goal>",
    description: "Break goals into 3-7 executable steps",
    longDescription:
      "Decomposes a high-level goal into sequential, actionable steps — each with context and a focused prompt you can execute immediately.",
    icon: GitBranch,
    color: "text-purple-600",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
    cost: "1 call",
    plans: "Starter+",
    category: "core",
    example: "seer workflow build a full-stack e-commerce checkout",
    exampleOutput:
      "Step 1: Design DB schema (products, orders, cart)\nStep 2: Build cart API endpoints\nStep 3: Create checkout UI with Stripe\nStep 4: Add order confirmation email\nStep 5: Write integration tests",
  },
  {
    id: "seer_memory",
    name: "seer memory",
    command: "seer memory <query>",
    description: "Semantic search across project memory",
    longDescription:
      "Search your project memory using natural language. Uses vector embeddings to find the top 5 most relevant entries from your memory file.",
    icon: Brain,
    color: "text-pink-600",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/20",
    cost: "1 call",
    plans: "Pro+",
    category: "memory",
    example: "seer memory what architecture decisions were made",
    exampleOutput:
      "Found 5 matches:\n1. Architecture: serverless MCP transport — relevance: 0.94\n2. AI optimization pipeline design — relevance: 0.89\n3. Auth + database setup — relevance: 0.87",
  },
  {
    id: "seer_memory_run",
    name: "seer memory run",
    command: "seer memory run",
    description: "Initialize project memory file",
    longDescription:
      "Scans your project structure, package.json, README, and git history to create a comprehensive .seer_memory.md tracking file.",
    icon: FolderOpen,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    cost: "1 call",
    plans: "All plans",
    category: "memory",
    example: "seer memory run",
    exampleOutput:
      "SEER memory initialized. Created .seer_memory.md with:\n- Project Overview, Current Status\n- Architecture Decisions (5 entries)\n- Open Tasks (3 detected)",
  },
  {
    id: "seer_session_read",
    name: "seer session read",
    command: "seer session read",
    description: "Capture session work to memory",
    longDescription:
      "Reads your entire conversation and summarizes what was built, decided, and completed — then writes it to .seer_memory.md.",
    icon: BookOpen,
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    cost: "1 call",
    plans: "All plans",
    category: "memory",
    example: "seer session read",
    exampleOutput:
      "Session captured. Built: login page with validation, forgot password flow. Decided: use Supabase for auth. Next: dashboard layout.",
  },
  {
    id: "seer_continue",
    name: "seer continue",
    command: "seer continue",
    description: "Resume from where you left off",
    longDescription:
      "Reads your .seer_memory.md and gives you a brief on what was last completed, what's next, open tasks, and recent activity.",
    icon: RotateCcw,
    color: "text-cyan-600",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20",
    cost: "1 call",
    plans: "All plans",
    category: "utility",
    example: "seer continue",
    exampleOutput:
      "Welcome back! Last completed: MFA enrollment page\nNext planned: Dashboard optimization\nOpen tasks: 3 remaining",
  },
  {
    id: "seer_recall",
    name: "seer recall",
    command: "seer recall / seer what did I do",
    description: "Natural language memory recall",
    longDescription:
      "Ask SEER anything about your project history in plain English. Reads memory and answers questions about what you've done.",
    icon: MessageSquare,
    color: "text-orange-600",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    cost: "1 call",
    plans: "All plans",
    category: "utility",
    example: "seer what did I build last session",
    exampleOutput:
      "Last session:\n- Built TOTP MFA enrollment page\n- Added suggestion skins (default, compact, focused)\n- Fixed QR code scanning issue",
  },
  {
    id: "seer_status",
    name: "seer status",
    command: "seer status",
    description: "Check plan, usage & remaining calls",
    longDescription:
      "Shows your current plan, calls used this month, limit, remaining calls, and SEER version. Always free.",
    icon: Activity,
    color: "text-accent-sage",
    bgColor: "bg-accent-sage/10",
    borderColor: "border-accent-sage/20",
    cost: "free",
    plans: "All plans",
    category: "utility",
    example: "seer status",
    exampleOutput:
      "SEER v1.1.0 | Plan: Starter\nUsage: 47 / 200 this month\nRemaining: 153 calls",
  },
  {
    id: "seer_space",
    name: "seer space",
    command: "seer space <action> [--project NAME]",
    description: "Founder's Space — tasks, credentials, docs, notes",
    longDescription:
      "Your operational workspace accessible from the terminal. Manage tasks, save encrypted credentials, track documents, and take notes — all scoped to projects. Supports 8 actions: add task, tasks, save key, key, docs, note, projects, new project.",
    icon: Briefcase,
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    cost: "1 call",
    plans: "Starter+ ($1 addon) / Pro+",
    category: "workspace",
    example: "seer space add task --project SEER \"Build email notifications\"",
    exampleOutput:
      "Task created: Build email notifications\nProject: SEER | Status: open | Due: —",
  },
  {
    id: "seer_tools",
    name: "seer tools",
    command: "seer tools",
    description: "List all available tools & features",
    longDescription:
      "Displays a complete table of every SEER tool with cost, plan requirements, and a quick reference. Always free.",
    icon: Wrench,
    color: "text-warm-brown",
    bgColor: "bg-warm-brown/10",
    borderColor: "border-warm-brown/20",
    cost: "free",
    plans: "All plans",
    category: "utility",
    example: "seer tools",
    exampleOutput:
      "SEER Tools:\n| seer run — 1 call — All plans |\n| seer optimize — 1 call — All plans |\n| seer workflow — 1 call — Starter+ |",
  },
];

const CATEGORIES = [
  { id: "all", label: "All Tools", count: TOOLS.length },
  { id: "core", label: "Core AI", count: TOOLS.filter((t) => t.category === "core").length },
  { id: "memory", label: "Memory", count: TOOLS.filter((t) => t.category === "memory").length },
  { id: "workspace", label: "Workspace", count: TOOLS.filter((t) => t.category === "workspace").length },
  { id: "utility", label: "Utility", count: TOOLS.filter((t) => t.category === "utility").length },
];

/* ─── Copy button ─── */

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1 rounded-md hover:bg-white/10 transition-colors"
      title="Copy command"
    >
      {copied ? <Check size={12} className="text-accent-sage" /> : <Copy size={12} className="text-white/50 hover:text-white/80" />}
    </button>
  );
}

/* ─── Tool card ─── */

function ToolCard({ tool, index }: { tool: Tool; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = tool.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className={`bg-ivory rounded-2xl border ${tool.borderColor} overflow-hidden hover:shadow-lg hover:shadow-charcoal/5 transition-all`}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className={`w-11 h-11 rounded-xl ${tool.bgColor} flex items-center justify-center shrink-0`}>
            <Icon size={20} className={tool.color} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display text-base sm:text-lg text-charcoal">{tool.name}</h3>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                tool.cost === "free"
                  ? "bg-accent-sage/15 text-accent-sage"
                  : "bg-terracotta/10 text-terracotta"
              }`}>
                {tool.cost === "free" ? <><Star size={8} /> Free</> : <><Clock size={8} /> 1 Call</>}
              </span>
              {tool.plans !== "All plans" && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-purple-500/10 text-purple-600">
                  <Lock size={8} /> {tool.plans}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs sm:text-sm text-warm-brown-light">{tool.description}</p>
          </div>
        </div>

        {/* Command bar */}
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-charcoal text-white font-mono text-xs sm:text-sm">
          <Terminal size={13} className="text-terracotta shrink-0" />
          <code className="flex-1 truncate text-white/90">{tool.command}</code>
          <CopyBtn text={tool.command} />
        </div>
      </div>

      {/* Expandable */}
      <div className="border-t border-sand/30">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-5 sm:px-6 py-2.5 flex items-center justify-between text-[11px] font-semibold text-muted hover:text-charcoal transition-colors"
        >
          <span>{expanded ? "Hide example" : "Show example"}</span>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-3"
          >
            <p className="text-xs text-warm-brown leading-relaxed">{tool.longDescription}</p>
            <div className="rounded-xl bg-charcoal overflow-hidden">
              <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400/70" />
                  <span className="w-2 h-2 rounded-full bg-yellow-400/70" />
                  <span className="w-2 h-2 rounded-full bg-green-400/70" />
                </div>
                <span className="text-[9px] text-white/40 font-mono">terminal</span>
              </div>
              <div className="p-3 space-y-2">
                <div>
                  <p className="text-[9px] font-semibold text-terracotta/80 uppercase tracking-wider mb-0.5">Input</p>
                  <code className="text-[11px] text-white/80 font-mono block">$ {tool.example}</code>
                </div>
                <div className="border-t border-white/10 pt-2">
                  <p className="text-[9px] font-semibold text-accent-sage/80 uppercase tracking-wider mb-0.5">Output</p>
                  <pre className="text-[11px] text-white/70 font-mono whitespace-pre-wrap">{tool.exampleOutput}</pre>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Workflow visual ─── */

function WorkflowVisual() {
  const steps = [
    { label: "Initialize", cmd: "seer memory run", icon: FolderOpen, color: "bg-emerald-500" },
    { label: "Build", cmd: "seer <task>", icon: Zap, color: "bg-terracotta" },
    { label: "Capture", cmd: "seer session read", icon: BookOpen, color: "bg-blue-500" },
    { label: "Resume", cmd: "seer continue", icon: RotateCcw, color: "bg-cyan-500" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6 }}
      className="bg-ivory rounded-2xl border border-sand/70 p-6 sm:p-8"
    >
      <h3 className="font-display text-xl text-charcoal mb-1">Recommended Workflow</h3>
      <p className="text-sm text-warm-brown-light mb-8">Follow this cycle for maximum productivity.</p>
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-0">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="flex items-center gap-4 sm:gap-0 sm:flex-1">
              <div className="flex flex-col items-center text-center">
                <div className={`w-16 h-16 rounded-2xl ${step.color} flex items-center justify-center shadow-lg`}>
                  <Icon size={24} className="text-white" />
                </div>
                <p className="mt-2.5 text-sm font-semibold text-charcoal">{step.label}</p>
                <code className="text-[11px] text-muted font-mono mt-0.5">{step.cmd}</code>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden sm:flex flex-1 items-center justify-center px-3">
                  <div className="h-px flex-1 bg-sand" />
                  <ArrowRight size={16} className="text-sand mx-1.5 shrink-0" />
                  <div className="h-px flex-1 bg-sand" />
                </div>
              )}
              {i < steps.length - 1 && (
                <div className="sm:hidden">
                  <ArrowRight size={16} className="text-sand rotate-90" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-6 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cream-dark text-[11px] font-medium text-muted">
          <RotateCcw size={11} /> Repeat every session for continuous context
        </span>
      </div>
    </motion.div>
  );
}

/* ─── Quick reference table ─── */

function QuickReference() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6 }}
      className="bg-ivory rounded-2xl border border-sand/70 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-sand/60">
        <h3 className="font-display text-xl text-charcoal">Quick Reference</h3>
        <p className="text-xs text-warm-brown-light mt-0.5">All commands at a glance.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[580px]">
          <thead>
            <tr className="border-b border-sand/60 bg-cream-dark/40">
              <th className="text-left text-[10px] font-semibold tracking-widest uppercase text-muted px-6 py-3">Command</th>
              <th className="text-left text-[10px] font-semibold tracking-widest uppercase text-muted px-4 py-3">Description</th>
              <th className="text-center text-[10px] font-semibold tracking-widest uppercase text-muted px-4 py-3">Cost</th>
              <th className="text-center text-[10px] font-semibold tracking-widest uppercase text-muted px-4 py-3">Plans</th>
            </tr>
          </thead>
          <tbody>
            {TOOLS.map((tool) => (
              <tr key={tool.id} className="border-b border-sand/30 last:border-0 hover:bg-cream-dark/30 transition-colors">
                <td className="px-6 py-3">
                  <code className="text-xs font-mono font-semibold text-charcoal bg-cream-dark px-2 py-1 rounded-md">
                    {tool.command.split(" ").slice(0, 2).join(" ")}
                  </code>
                </td>
                <td className="px-4 py-3 text-xs text-warm-brown">{tool.description}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    tool.cost === "free" ? "bg-accent-sage/15 text-accent-sage" : "bg-terracotta/10 text-terracotta"
                  }`}>
                    {tool.cost === "free" ? "Free" : "1 call"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-[10px] font-medium text-muted">{tool.plans}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

/* ─── Main Docs section ─── */

export default function Docs() {
  const [activeCategory, setActiveCategory] = useState("all");

  const filtered =
    activeCategory === "all"
      ? TOOLS
      : TOOLS.filter((t) => t.category === activeCategory);

  return (
    <section id="docs" className="py-28 md:py-36 relative">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          className="text-center max-w-2xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-xs font-semibold tracking-widest uppercase text-terracotta">
            Documentation
          </span>
          <h2 className="mt-4 font-display text-4xl md:text-5xl lg:text-6xl tracking-tight text-charcoal leading-[1.05]">
            Every tool,
            <br />
            <span className="text-warm-brown-light">explained</span>
          </h2>
          <p className="mt-5 text-warm-brown-light text-lg leading-relaxed">
            11 powerful tools to optimize prompts, manage memory, run your
            workspace, and supercharge your AI workflow. All via simple commands.
          </p>
        </motion.div>

        {/* Workflow */}
        <div className="mb-12">
          <WorkflowVisual />
        </div>

        {/* Quick reference */}
        <div className="mb-12">
          <QuickReference />
        </div>

        {/* Category filters */}
        <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === cat.id
                  ? "bg-terracotta text-white shadow-sm"
                  : "bg-ivory border border-sand/70 text-warm-brown-light hover:bg-cream-dark hover:text-charcoal"
              }`}
            >
              {cat.label}
              <span className={`ml-1.5 text-xs ${activeCategory === cat.id ? "text-white/70" : "text-muted"}`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Tool cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
          {filtered.map((tool, i) => (
            <ToolCard key={tool.id} tool={tool} index={i} />
          ))}
        </div>

        {/* Bottom hint */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-warm-brown-light">
            Get started in seconds —{" "}
            <code className="px-2 py-1 rounded-md bg-charcoal text-white text-xs font-mono">
              seer status
            </code>{" "}
            to verify your connection, then{" "}
            <code className="px-2 py-1 rounded-md bg-charcoal text-white text-xs font-mono">
              seer memory run
            </code>{" "}
            to initialize your project.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
