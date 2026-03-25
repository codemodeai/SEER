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
  Lock,
  ArrowRight,
  Terminal,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Star,
  Clock,
  Shield,
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
  category: "core" | "memory" | "utility";
  example: string;
  exampleOutput: string;
  tips: string[];
}

const TOOLS: Tool[] = [
  {
    id: "seer_run",
    name: "seer run",
    command: "seer <anything>",
    description: "Compress & optimize any prompt via AI",
    longDescription:
      "The core SEER tool. Send any prompt and SEER compresses it using Haiku AI — reducing tokens while preserving intent. Ideal for long, messy prompts that need tightening before sending to Claude, GPT, or Gemini.",
    icon: Zap,
    color: "text-terracotta",
    bgColor: "bg-terracotta/10",
    borderColor: "border-terracotta/20",
    cost: "1 call",
    plans: "All plans",
    category: "core",
    example: "seer build a login page with email and password fields using React and Tailwind with validation",
    exampleOutput:
      "Build React login form: email + password inputs, Tailwind styling, client-side validation (required fields, email format, min 8 chars). Include error states and submit handler.",
    tips: [
      "Works best with verbose, unstructured prompts",
      "The longer your input, the more tokens SEER saves",
      "Automatically logs usage for dashboard analytics",
    ],
  },
  {
    id: "seer_optimize",
    name: "seer optimize",
    command: "seer optimize <prompt>",
    description: "Model-specific prompt optimization",
    longDescription:
      "Tailors your prompt for a specific AI model (Claude, GPT, or Gemini). Returns the optimized text along with a quality score, token reduction percentage, and explanation of changes made.",
    icon: Sparkles,
    color: "text-accent-gold",
    bgColor: "bg-accent-gold/10",
    borderColor: "border-accent-gold/20",
    cost: "1 call",
    plans: "All plans",
    category: "core",
    example: "seer optimize explain quantum computing to a 5 year old in simple terms",
    exampleOutput:
      "Explain quantum computing for a 5-year-old: use everyday analogies (coins, boxes), avoid jargon, keep under 100 words, playful tone.",
    tips: [
      "Returns quality_score (0-100) for your optimized prompt",
      "Shows exact token reduction percentage",
      "Adapts style to target model's strengths",
    ],
  },
  {
    id: "seer_workflow",
    name: "seer workflow",
    command: "seer workflow <goal>",
    description: "Break goals into 3-7 executable steps",
    longDescription:
      "Give SEER a high-level goal and it decomposes it into 3-7 sequential, actionable steps — each with context and a focused prompt you can execute immediately. Perfect for complex projects.",
    icon: GitBranch,
    color: "text-purple-600",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
    cost: "1 call",
    plans: "Starter+",
    category: "core",
    example: "seer workflow build a full-stack e-commerce checkout flow",
    exampleOutput:
      "Step 1: Design DB schema (products, orders, cart)\nStep 2: Build cart API endpoints\nStep 3: Create checkout UI with Stripe\nStep 4: Add order confirmation email\nStep 5: Write integration tests",
    tips: [
      "Each step includes a ready-to-use prompt",
      "Steps are ordered by dependency",
      "Great for breaking down overwhelming tasks",
    ],
  },
  {
    id: "seer_memory",
    name: "seer memory",
    command: "seer memory <query>",
    description: "Semantic search across project memory",
    longDescription:
      "Search your project memory using natural language. SEER uses vector embeddings to find the top 5 most relevant entries from your .seer_memory.md file. Ask questions like \"what decisions did we make about auth?\" and get instant answers.",
    icon: Brain,
    color: "text-pink-600",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/20",
    cost: "1 call",
    plans: "Pro+",
    category: "memory",
    example: "seer memory what architecture decisions were made",
    exampleOutput:
      "Found 5 matches:\n1. Remote HTTP MCP on Vercel (not stdio) — relevance: 0.94\n2. Haiku ONLY for AI calls — relevance: 0.89\n3. Supabase for auth + database — relevance: 0.87",
    tips: [
      "Uses OpenAI text-embedding-3-small for vector search",
      "Returns relevance scores (0-1) for each result",
      "Requires .seer_memory.md to be initialized first",
    ],
  },
  {
    id: "seer_memory_run",
    name: "seer memory run",
    command: "seer memory run",
    description: "Initialize project memory file",
    longDescription:
      "Scans your project structure, package.json, README, and git history to create a comprehensive .seer_memory.md file. This file tracks your project overview, architecture decisions, open tasks, and session history.",
    icon: FolderOpen,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    cost: "1 call",
    plans: "All plans",
    category: "memory",
    example: "seer memory run",
    exampleOutput:
      "SEER memory initialized. Created .seer_memory.md with:\n- Project Overview (name, stack, goal)\n- Current Status & phase\n- Architecture Decisions (5 entries)\n- Open Tasks (3 detected)\n- Session Log started",
    tips: [
      "Run this once at the start of any new project",
      "Automatically detects stack from package.json",
      "Add .seer_memory.md to .gitignore for private use, or leave it for team sharing",
    ],
  },
  {
    id: "seer_session_read",
    name: "seer session read",
    command: "seer session read",
    description: "Capture session work to memory",
    longDescription:
      "Reads your entire conversation and summarizes what was built, decided, and completed — then writes it to .seer_memory.md. Use this at the end of a session to preserve context for next time.",
    icon: BookOpen,
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    cost: "1 call",
    plans: "All plans",
    category: "memory",
    example: "seer session read",
    exampleOutput:
      "Session captured. Built: login page with validation, forgot password flow. Decided: use Supabase for auth. Completed: auth module end-to-end. Next: dashboard layout.",
    tips: [
      "Use at the end of every coding session",
      "Also works for non-SEER sessions — captures everything",
      "Updates Open Tasks and Current Status automatically",
    ],
  },
  {
    id: "seer_continue",
    name: "seer continue",
    command: "seer continue",
    description: "Resume from where you left off",
    longDescription:
      "Reads your .seer_memory.md and gives you a brief on what was last completed, what's planned next, open tasks, and recent session activity. Perfect for starting a new session without losing context.",
    icon: RotateCcw,
    color: "text-cyan-600",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20",
    cost: "1 call",
    plans: "All plans",
    category: "utility",
    example: "seer continue",
    exampleOutput:
      "Welcome back! Here's where you left off:\n- Last completed: MFA enrollment page\n- Next planned: Dashboard performance optimization\n- Open tasks: 3 remaining\n- Last session: 2 hours ago",
    tips: [
      "Always start your session with this command",
      "Also works with: seer resume, seer where was i, seer what's next",
      "Zero AI cost — reads directly from memory file",
    ],
  },
  {
    id: "seer_recall",
    name: "seer recall",
    command: "seer recall / seer what did I do",
    description: "Natural language memory recall",
    longDescription:
      "Ask SEER anything about your project history in plain English. It reads .seer_memory.md and answers questions like \"what did I do yesterday?\", \"what's left to build?\", or \"show me open tasks\".",
    icon: MessageSquare,
    color: "text-orange-600",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    cost: "1 call",
    plans: "All plans",
    category: "utility",
    example: "seer what did I build last session",
    exampleOutput:
      "Last session (2026-03-25):\n- Built TOTP MFA enrollment page\n- Added suggestion skins (default, compact, focused)\n- Fixed QR code scanning issue\n- Wired auto-suggest toggle",
    tips: [
      "Works with natural phrasing — no exact syntax needed",
      "Also: seer recap, seer history, seer show tasks, seer what's left",
      "Zero AI cost — extracts from memory file directly",
    ],
  },
  {
    id: "seer_status",
    name: "seer status",
    command: "seer status",
    description: "Check plan, usage & remaining calls",
    longDescription:
      "Shows your current plan, how many calls you've used this month, your limit, remaining calls, and SEER version. Quick health check for your account.",
    icon: Activity,
    color: "text-accent-sage",
    bgColor: "bg-accent-sage/10",
    borderColor: "border-accent-sage/20",
    cost: "free",
    plans: "All plans",
    category: "utility",
    example: "seer status",
    exampleOutput:
      "SEER v1.1.0\nPlan: Starter\nUsage: 47 / 200 this month\nRemaining: 153 calls\nAI Preference: Claude",
    tips: [
      "Always free — never counts against your limit",
      "Check before starting a heavy session",
      "Shows your AI preference setting",
    ],
  },
  {
    id: "seer_tools",
    name: "seer tools",
    command: "seer tools",
    description: "List all available tools & features",
    longDescription:
      "Displays a complete table of every SEER tool with its cost, plan requirements, and a quick reference of all commands. Great for discovering what SEER can do.",
    icon: Wrench,
    color: "text-warm-brown",
    bgColor: "bg-warm-brown/10",
    borderColor: "border-warm-brown/20",
    cost: "free",
    plans: "All plans",
    category: "utility",
    example: "seer tools",
    exampleOutput:
      "SEER Tools:\n| Tool | Cost | Plans |\n| seer_run | 1 call | All |\n| seer_optimize | 1 call | All |\n| seer_workflow | 1 call | Starter+ |\n...",
    tips: [
      "Always free — use anytime to check available commands",
      "Also works with: seer help, seer features, seer list tools",
      "Shows plan-gated features clearly",
    ],
  },
];

const CATEGORIES = [
  { id: "all", label: "All Tools", count: TOOLS.length },
  { id: "core", label: "Core AI", count: TOOLS.filter((t) => t.category === "core").length },
  { id: "memory", label: "Memory", count: TOOLS.filter((t) => t.category === "memory").length },
  { id: "utility", label: "Utility", count: TOOLS.filter((t) => t.category === "utility").length },
];

/* ─── Copy button ─── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded-md hover:bg-white/10 transition-colors"
      title="Copy command"
    >
      {copied ? (
        <Check size={13} className="text-accent-sage" />
      ) : (
        <Copy size={13} className="text-white/50 hover:text-white/80" />
      )}
    </button>
  );
}

/* ─── Tool card ─── */

function ToolCard({ tool, index }: { tool: Tool; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = tool.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className={`bg-ivory rounded-2xl border ${tool.borderColor} overflow-hidden hover:shadow-lg hover:shadow-charcoal/5 transition-all`}
    >
      {/* Header */}
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-xl ${tool.bgColor} flex items-center justify-center shrink-0`}
          >
            <Icon size={22} className={tool.color} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display text-lg text-charcoal">{tool.name}</h3>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  tool.cost === "free"
                    ? "bg-accent-sage/15 text-accent-sage"
                    : "bg-terracotta/10 text-terracotta"
                }`}
              >
                {tool.cost === "free" ? (
                  <>
                    <Star size={9} />
                    Free
                  </>
                ) : (
                  <>
                    <Clock size={9} />
                    1 Call
                  </>
                )}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sand/50 text-muted">
                <Shield size={9} />
                {tool.plans}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{tool.description}</p>
          </div>
        </div>

        {/* Command bar */}
        <div className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-charcoal text-white font-mono text-sm">
          <Terminal size={14} className="text-terracotta shrink-0" />
          <code className="flex-1 truncate text-white/90">{tool.command}</code>
          <CopyButton text={tool.command} />
        </div>
      </div>

      {/* Expandable details */}
      <div className="border-t border-sand/40">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-5 sm:px-6 py-3 flex items-center justify-between text-xs font-semibold text-muted hover:text-charcoal transition-colors"
        >
          <span>{expanded ? "Hide details" : "Show example & tips"}</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.2 }}
            className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-4"
          >
            {/* Long description */}
            <p className="text-sm text-warm-brown leading-relaxed">
              {tool.longDescription}
            </p>

            {/* Example input/output */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                Example
              </p>
              <div className="rounded-xl bg-charcoal overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
                  </div>
                  <span className="text-[10px] text-white/40 font-mono">terminal</span>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold text-terracotta/80 uppercase tracking-wider mb-1">
                      Input
                    </p>
                    <code className="text-xs text-white/80 font-mono leading-relaxed block">
                      $ {tool.example}
                    </code>
                  </div>
                  <div className="border-t border-white/10 pt-3">
                    <p className="text-[10px] font-semibold text-accent-sage/80 uppercase tracking-wider mb-1">
                      Output
                    </p>
                    <pre className="text-xs text-white/70 font-mono leading-relaxed whitespace-pre-wrap">
                      {tool.exampleOutput}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                Tips
              </p>
              <div className="space-y-1.5">
                {tool.tips.map((tip, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-xs text-warm-brown"
                  >
                    <ArrowRight
                      size={12}
                      className={`${tool.color} shrink-0 mt-0.5`}
                    />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Quick reference table ─── */

function QuickReference() {
  return (
    <div className="bg-ivory rounded-2xl border border-sand/60 overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-sand/60">
        <h3 className="font-display text-lg text-charcoal">Quick Reference</h3>
        <p className="text-xs text-muted mt-0.5">
          All commands at a glance. Copy any command to get started.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-sand/60 bg-cream-dark/50">
              <th className="text-left text-[10px] font-semibold tracking-widest uppercase text-muted px-5 sm:px-6 py-3">
                Command
              </th>
              <th className="text-left text-[10px] font-semibold tracking-widest uppercase text-muted px-4 py-3">
                What it does
              </th>
              <th className="text-center text-[10px] font-semibold tracking-widest uppercase text-muted px-4 py-3">
                Cost
              </th>
              <th className="text-center text-[10px] font-semibold tracking-widest uppercase text-muted px-4 py-3">
                Plans
              </th>
            </tr>
          </thead>
          <tbody>
            {TOOLS.map((tool) => (
              <tr
                key={tool.id}
                className="border-b border-sand/30 last:border-0 hover:bg-cream-dark/30 transition-colors"
              >
                <td className="px-5 sm:px-6 py-3">
                  <code className="text-xs font-mono font-semibold text-charcoal bg-cream-dark px-2 py-1 rounded-md">
                    {tool.command.split(" ").slice(0, 2).join(" ")}
                  </code>
                </td>
                <td className="px-4 py-3 text-xs text-warm-brown">
                  {tool.description}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      tool.cost === "free"
                        ? "bg-accent-sage/15 text-accent-sage"
                        : "bg-terracotta/10 text-terracotta"
                    }`}
                  >
                    {tool.cost === "free" ? "Free" : "1 call"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-[10px] font-medium text-muted">
                  {tool.plans}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Feature highlights ─── */

function FeatureHighlights() {
  const features = [
    {
      icon: Brain,
      title: "Project Memory",
      description:
        "SEER remembers your project context across sessions. Initialize once with seer memory run, capture work with seer session read, and resume anytime with seer continue.",
      color: "text-pink-600",
      bg: "bg-pink-500/10",
    },
    {
      icon: Sparkles,
      title: "Auto-Suggestions",
      description:
        "After every command, SEER suggests 3-5 intelligent next steps based on your project memory and what you just did. Choose a skin: default (5), compact (3), or focused (1).",
      color: "text-accent-gold",
      bg: "bg-accent-gold/10",
    },
    {
      icon: Shield,
      title: "MFA Security",
      description:
        "One-time TOTP setup keeps your account secure. Soft reminders start at 5 calls, with a one-time verification at 20. After that, SEER never interrupts again.",
      color: "text-blue-600",
      bg: "bg-blue-500/10",
    },
    {
      icon: GitBranch,
      title: "Mark Done Detection",
      description:
        "When your work matches an open task in memory, SEER automatically asks if you'd like to mark it complete. Stay organized without manual tracking.",
      color: "text-purple-600",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {features.map((feat, i) => {
        const Icon = feat.icon;
        return (
          <motion.div
            key={feat.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.08 }}
            className="bg-ivory rounded-2xl border border-sand/60 p-5 sm:p-6 hover:shadow-md hover:shadow-charcoal/3 transition-shadow"
          >
            <div className={`w-10 h-10 rounded-xl ${feat.bg} flex items-center justify-center mb-3`}>
              <Icon size={20} className={feat.color} />
            </div>
            <h4 className="font-display text-base text-charcoal">{feat.title}</h4>
            <p className="mt-1.5 text-xs text-muted leading-relaxed">
              {feat.description}
            </p>
          </motion.div>
        );
      })}
    </div>
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
    <div className="bg-ivory rounded-2xl border border-sand/60 p-5 sm:p-6">
      <h3 className="font-display text-lg text-charcoal mb-1">Recommended Workflow</h3>
      <p className="text-xs text-muted mb-6">
        Follow this cycle for maximum productivity with SEER.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-0">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="flex items-center gap-3 sm:gap-0 sm:flex-1">
              <div className="flex flex-col items-center text-center">
                <div
                  className={`w-14 h-14 rounded-2xl ${step.color} flex items-center justify-center shadow-md`}
                >
                  <Icon size={22} className="text-white" />
                </div>
                <p className="mt-2 text-xs font-semibold text-charcoal">
                  {step.label}
                </p>
                <code className="text-[10px] text-muted font-mono mt-0.5">
                  {step.cmd}
                </code>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden sm:flex flex-1 items-center justify-center px-2">
                  <div className="h-px flex-1 bg-sand" />
                  <ArrowRight size={14} className="text-sand mx-1 shrink-0" />
                  <div className="h-px flex-1 bg-sand" />
                </div>
              )}
              {i < steps.length - 1 && (
                <div className="sm:hidden">
                  <ArrowRight size={14} className="text-sand rotate-90" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Loop arrow hint */}
      <div className="mt-4 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cream-dark text-[10px] font-medium text-muted">
          <RotateCcw size={10} />
          Repeat every session for continuous context
        </span>
      </div>
    </div>
  );
}

/* ─── Main page ─── */

export default function DocsPage() {
  const [activeCategory, setActiveCategory] = useState("all");

  const filtered =
    activeCategory === "all"
      ? TOOLS
      : TOOLS.filter((t) => t.category === activeCategory);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl md:text-4xl text-charcoal tracking-tight">
          Documentation
        </h1>
        <p className="mt-1 text-sm text-muted">
          Everything you need to know about SEER tools, features, and workflows.
        </p>
      </div>

      {/* Workflow visual */}
      <WorkflowVisual />

      {/* Feature highlights */}
      <div>
        <h2 className="font-display text-xl text-charcoal mb-4">Key Features</h2>
        <FeatureHighlights />
      </div>

      {/* Quick reference */}
      <QuickReference />

      {/* Tools section */}
      <div>
        <h2 className="font-display text-xl text-charcoal mb-4">All Tools</h2>

        {/* Category filters */}
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
                activeCategory === cat.id
                  ? "bg-terracotta text-white shadow-sm"
                  : "bg-ivory border border-sand/60 text-warm-brown-light hover:bg-cream-dark"
              }`}
            >
              {cat.label}
              <span
                className={`ml-1.5 text-[10px] ${
                  activeCategory === cat.id ? "text-white/70" : "text-muted"
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Tool cards grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {filtered.map((tool, i) => (
            <ToolCard key={tool.id} tool={tool} index={i} />
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="bg-terracotta/5 border border-terracotta/15 rounded-2xl p-6 text-center space-y-3">
        <h3 className="font-display text-lg text-charcoal">Ready to start?</h3>
        <p className="text-sm text-warm-brown max-w-lg mx-auto">
          Open your terminal or Claude Desktop and type{" "}
          <code className="px-2 py-0.5 rounded-md bg-charcoal text-white text-xs font-mono">
            seer status
          </code>{" "}
          to verify your connection. Then try{" "}
          <code className="px-2 py-0.5 rounded-md bg-charcoal text-white text-xs font-mono">
            seer memory run
          </code>{" "}
          to initialize your project memory.
        </p>
      </div>
    </div>
  );
}
