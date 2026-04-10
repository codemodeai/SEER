"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
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
  ArrowLeft,
  Star,
  Clock,
  Shield,
  Lock,
  Play,
  Send,
  Loader2,
  Briefcase,
  ScanSearch,
  type LucideIcon,
} from "lucide-react";

/* ═══════════════════════════════════════════
   Tool data
   ═══════════════════════════════════════════ */

interface Tool {
  id: string;
  name: string;
  command: string;
  description: string;
  longDescription: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
  cost: "free" | "1 call";
  plans: string;
  category: "core" | "memory" | "workspace" | "utility";
  example: string;
  exampleOutput: string;
  tips: string[];
  playgroundPlaceholder: string;
  simulateOutput: (input: string) => string;
}

function simulateRun(input: string): string {
  const words = input.trim().split(/\s+/);
  const compressed = words
    .filter((_, i) => {
      if (words.length <= 6) return true;
      const fillers = ["a", "the", "an", "with", "and", "that", "this", "very", "really", "just", "also", "please", "can", "you"];
      return !fillers.includes(words[i].toLowerCase());
    })
    .join(" ");
  const saved = Math.max(0, input.length - compressed.length);
  const pct = input.length > 0 ? Math.round((saved / input.length) * 100) : 0;
  return `Optimized prompt:\n"${compressed}"\n\n Token reduction: ${pct}% (${input.length} → ${compressed.length} chars)\n Quality score: 92/100`;
}

function simulateOptimize(input: string): string {
  const words = input.trim().split(/\s+/);
  const optimized = words
    .filter((w) => !["please", "can", "you", "i", "want", "need", "the", "a", "an", "just"].includes(w.toLowerCase()))
    .join(" ");
  return `Model: Claude (auto-detected)\n\nOptimized:\n"${optimized}. Be concise, structured output."\n\n Quality: 94/100 | Tokens: -${Math.round(Math.random() * 20 + 25)}%`;
}

function simulateWorkflow(input: string): string {
  const goal = input || "build a feature";
  return `Goal: ${goal}\n\nStep 1: Define requirements and data schema\n  → "Design the data model for ${goal}"\n\nStep 2: Build backend API endpoints\n  → "Create REST API with CRUD operations"\n\nStep 3: Implement frontend UI components\n  → "Build responsive UI with form validation"\n\nStep 4: Add tests and error handling\n  → "Write unit + integration tests"\n\nStep 5: Deploy and verify\n  → "Deploy to staging, run smoke tests"`;
}

function simulateMemory(input: string): string {
  return `Query: "${input}"\n\nFound 3 matches:\n\n1. [0.94] Architecture: Remote HTTP MCP on Vercel\n   "Decided on StreamableHTTP transport for serverless..."\n\n2. [0.89] Decision: Haiku for AI calls only\n   "Max 800 tokens per call, ~$0.001 cost..."\n\n3. [0.85] Stack: TypeScript / Next.js / Supabase\n   "Supabase for auth + database with RLS..."`;
}

const TOOLS: Tool[] = [
  {
    id: "seer_run",
    name: "seer run",
    command: "seer <anything>",
    description: "Compress & optimize any prompt via AI",
    longDescription:
      "The core SEER tool. Send any prompt and SEER compresses it using Haiku AI — reducing tokens while preserving intent. Ideal for long, messy prompts that need tightening.",
    icon: Zap,
    color: "text-terracotta",
    bgColor: "bg-terracotta/10",
    borderColor: "border-terracotta/20",
    cost: "1 call",
    plans: "All plans",
    category: "core",
    example: "seer build a login page with email and password fields using React and Tailwind with validation",
    exampleOutput:
      "Build React login form: email + password inputs, Tailwind styling, client-side validation (required, email format, min 8 chars). Include error states and submit handler.",
    tips: [
      "Works best with verbose, unstructured prompts",
      "The longer your input, the more tokens SEER saves",
      "Automatically logs usage for dashboard analytics",
    ],
    playgroundPlaceholder: "Type a messy prompt to compress...",
    simulateOutput: simulateRun,
  },
  {
    id: "seer_optimize",
    name: "seer optimize",
    command: "seer optimize <prompt>",
    description: "Model-specific prompt optimization",
    longDescription:
      "Tailors your prompt for a specific AI model (Claude, GPT, or Gemini). Returns optimized text, quality score, token reduction %, and explanation.",
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
    playgroundPlaceholder: "Enter a prompt to optimize for your AI model...",
    simulateOutput: simulateOptimize,
  },
  {
    id: "seer_workflow",
    name: "seer workflow",
    command: "seer workflow <goal>",
    description: "Break goals into 3-7 executable steps",
    longDescription:
      "Give SEER a high-level goal and it decomposes it into 3-7 sequential, actionable steps — each with context and a focused prompt you can execute immediately.",
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
    playgroundPlaceholder: "Describe a goal to break into steps...",
    simulateOutput: simulateWorkflow,
  },
  {
    id: "seer_memory",
    name: "seer memory",
    command: "seer memory <query>",
    description: "Semantic search across project memory",
    longDescription:
      "Search your project memory using natural language. SEER uses vector embeddings to find the top 5 most relevant entries. Ask things like \"what decisions did we make about auth?\"",
    icon: Brain,
    color: "text-pink-600",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/20",
    cost: "1 call",
    plans: "Pro+",
    category: "memory",
    example: "seer memory what architecture decisions were made",
    exampleOutput:
      "Found 5 matches:\n1. Remote HTTP MCP on Vercel — relevance: 0.94\n2. Haiku ONLY for AI calls — relevance: 0.89\n3. Supabase for auth + DB — relevance: 0.87",
    tips: [
      "Uses OpenAI text-embedding-3-small for vector search",
      "Returns relevance scores (0-1) for each result",
      "Requires .seer_memory.md to be initialized first",
    ],
    playgroundPlaceholder: "Ask about your project history...",
    simulateOutput: simulateMemory,
  },
  {
    id: "seer_memory_run",
    name: "seer memory run",
    command: "seer memory run",
    description: "Initialize project memory file",
    longDescription:
      "Scans your project structure, package.json, README, and git history to create a comprehensive .seer_memory.md tracking file with 6 sections.",
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
      "Add .seer_memory.md to .gitignore for private use",
    ],
    playgroundPlaceholder: "This tool takes no input — just run it!",
    simulateOutput: () =>
      "Scanning project structure...\n\n .seer_memory.md created successfully!\n\nSections initialized:\n  1. Project Overview\n  2. Current Status\n  3. Architecture Decisions (4 found)\n  4. Open Tasks (2 detected from TODOs)\n  5. Session Log\n  6. Integrity\n\nUse `seer continue` to resume from this point.",
  },
  {
    id: "seer_session_read",
    name: "seer session read",
    command: "seer session read",
    description: "Capture session work to memory",
    longDescription:
      "Reads your entire conversation and summarizes what was built, decided, and completed — then writes it to .seer_memory.md for future sessions.",
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
      "Works for non-SEER sessions too — captures everything",
      "Updates Open Tasks and Current Status automatically",
    ],
    playgroundPlaceholder: "This tool reads your conversation — no input needed!",
    simulateOutput: () =>
      "Reading conversation...\n\nSession captured:\n  Built: user authentication, API routes, dashboard layout\n  Decided: Supabase for auth + database\n  Completed: Auth module end-to-end\n  Next: billing integration\n\n .seer_memory.md updated.",
  },
  {
    id: "seer_continue",
    name: "seer continue",
    command: "seer continue",
    description: "Resume from where you left off",
    longDescription:
      "Reads your .seer_memory.md and gives you a brief on what was last completed, what's planned next, open tasks, and recent session activity.",
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
      "Also works with: seer resume, seer where was i",
      "Zero AI cost — reads directly from memory file",
    ],
    playgroundPlaceholder: "No input needed — resumes from memory!",
    simulateOutput: () =>
      "Welcome back!\n\n Last completed: Authentication module\n Next planned: Dashboard analytics\n Open tasks: 3 remaining\n Last session: 45 minutes ago\n\nReady to pick up where you left off.",
  },
  {
    id: "seer_recall",
    name: "seer recall",
    command: "seer recall / seer what did I do",
    description: "Natural language memory recall",
    longDescription:
      "Ask SEER anything about your project history in plain English. It reads .seer_memory.md and answers questions like \"what's left to build?\" or \"show me open tasks\".",
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
      "Also: seer recap, seer history, seer show tasks",
      "Zero AI cost — extracts from memory file directly",
    ],
    playgroundPlaceholder: "Ask about your project history...",
    simulateOutput: (input: string) =>
      `Query: "${input || "what did I do"}"\n\nFrom your project memory:\n- Last session: Built auth module, API routes, dashboard\n- Decisions: Supabase for auth, Vercel for hosting\n- Open tasks: 3 remaining\n- Total sessions logged: 12`,
  },
  {
    id: "seer_status",
    name: "seer status",
    command: "seer status",
    description: "Check plan, usage & remaining calls",
    longDescription:
      "Shows your current plan, calls used this month, limit, remaining calls, and SEER version. Quick health check for your account.",
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
    playgroundPlaceholder: "No input needed — shows your account status!",
    simulateOutput: () =>
      "SEER v1.1.0\n\n Plan: Free\n Usage: 12 / 50 this month\n Remaining: 38 calls\n AI Preference: Claude\n MFA: Not configured",
  },
  {
    id: "seer_space",
    name: "seer space",
    command: "seer space <action> [--project NAME]",
    description: "Founder's Space — tasks, credentials, docs, notes",
    longDescription:
      "Your operational workspace accessible from the terminal. Manage tasks, save encrypted credentials (AES-256), track documents with expiry alerts, and take project notes. Supports 8 actions: add task, tasks, save key, key, docs, note, projects, new project. Use --team flag for agency shared items.",
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
    tips: [
      "8 actions: add task, tasks, save key, key, docs, note, projects, new project",
      "Credentials are AES-256 encrypted — never shown in plaintext in terminal",
      "Use --team flag to share items with your agency team",
    ],
    playgroundPlaceholder: "Try: add task --project MyApp \"Fix login bug\"",
    simulateOutput: (input: string) => {
      if (input.toLowerCase().includes("task")) {
        return `Task created: ${input.replace(/.*task\s*/i, "").replace(/--project\s+\S+\s*/i, "").trim() || "New task"}\nProject: MyProject | Status: open | Due: —`;
      }
      if (input.toLowerCase().includes("project")) {
        return `Projects:\n- SEER (created 4/7/2026)\n- MyApp (created 4/5/2026)`;
      }
      return `Founder's Space action completed.\nUse: add task, tasks, save key, key, docs, note, projects, new project`;
    },
  },
  {
    id: "seer_record_credentials",
    name: "seer record credentials",
    command: "seer record credentials",
    description: "Scan project files and batch-save credentials",
    longDescription:
      "Scans your project for credential files (.env, .env.local, .env.production, etc.), extracts API keys, tokens, passwords, and connection strings, then batch-saves them to your Founder's Space encrypted vault. Detects 30+ credential patterns including Stripe, AWS, OpenAI, Razorpay, Supabase, and more. Auto-detects environment (dev/staging/prod) from filename and value prefixes.",
    icon: ScanSearch,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    cost: "1 call",
    plans: "Starter+ ($1 addon) / Pro+",
    category: "workspace",
    example: "seer record credentials",
    exampleOutput:
      "Found 9 credentials across 1 file:\n\n # | Label                    | Env  | Source\n 1 | STRIPE_SECRET_KEY        | prod | .env\n 2 | DATABASE_URL             | dev  | .env.local\n 3 | RESEND_API_KEY           | dev  | .env.local\n\nSave all 9 to Founder's Space? (yes/no)",
    tips: [
      "Scans .env, .env.local, .env.production, .env.staging, and config files",
      "Skips placeholders, comments, and SEER's own API key",
      "Auto-detects environment from filename and value prefix (sk_test_ = dev)",
      "All credentials are AES-256-GCM encrypted before storage",
    ],
    playgroundPlaceholder: "No input needed — scans your project automatically!",
    simulateOutput: () =>
      "Found 5 credentials across 2 files:\n\n # | Label                    | Env         | Source\n 1 | STRIPE_SECRET_KEY        | production  | .env\n 2 | DATABASE_URL             | development | .env.local\n 3 | OPENAI_API_KEY           | production  | .env\n 4 | RESEND_API_KEY           | development | .env.local\n 5 | REDIS_URL                | development | .env.local\n\nSave all 5 to Founder's Space? (AES-256-GCM encrypted)\nType yes to save all, or specific numbers (e.g. 1,3,5)",
  },
  {
    id: "seer_tools",
    name: "seer tools",
    command: "seer tools",
    description: "List all available tools & features",
    longDescription:
      "Displays a complete table of every SEER tool with its cost, plan requirements, and a quick reference of all commands.",
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
      "Always free — use anytime",
      "Also: seer help, seer features, seer list tools",
      "Shows plan-gated features clearly",
    ],
    playgroundPlaceholder: "No input needed — lists all tools!",
    simulateOutput: () =>
      "SEER Tools (12 total):\n\n Tool                    Cost    Plans\n seer run                1 call  All\n seer optimize           1 call  All\n seer workflow            1 call  Starter+\n seer space              1 call  Starter+\n seer record credentials 1 call  Starter+\n seer memory             1 call  Pro+\n seer status             Free    All\n seer tools              Free    All\n ... and 4 more",
  },
];

const CATEGORIES = [
  { id: "all", label: "All Tools", count: TOOLS.length },
  { id: "core", label: "Core AI", count: TOOLS.filter((t) => t.category === "core").length },
  { id: "memory", label: "Memory", count: TOOLS.filter((t) => t.category === "memory").length },
  { id: "workspace", label: "Workspace", count: TOOLS.filter((t) => t.category === "workspace").length },
  { id: "utility", label: "Utility", count: TOOLS.filter((t) => t.category === "utility").length },
];

/* ═══════════════════════════════════════════
   Copy button
   ═══════════════════════════════════════════ */

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
      title="Copy"
    >
      {copied ? <Check size={12} className="text-accent-sage" /> : <Copy size={12} className="text-white/50 hover:text-white/80" />}
    </button>
  );
}

/* ═══════════════════════════════════════════
   Interactive Playground
   ═══════════════════════════════════════════ */

function Playground() {
  const [selectedTool, setSelectedTool] = useState<Tool>(TOOLS[0]);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);

  function handleRun() {
    if (!input.trim() && !["seer_memory_run", "seer_session_read", "seer_continue", "seer_status", "seer_tools"].includes(selectedTool.id)) {
      return;
    }
    setRunning(true);
    setOutput("");

    // Simulate typing effect
    const result = selectedTool.simulateOutput(input);
    let i = 0;
    const interval = setInterval(() => {
      i += Math.floor(Math.random() * 3) + 2;
      if (i >= result.length) {
        setOutput(result);
        setRunning(false);
        clearInterval(interval);
      } else {
        setOutput(result.slice(0, i));
      }
    }, 15);
  }

  function handleTryExample() {
    setInput(selectedTool.example.replace(/^seer\s+(optimize|workflow|memory|run|session read|continue|status|tools|recall|what did I)\s*/i, "").replace(/^seer\s+/i, ""));
    setOutput("");
  }

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const noInputTools = ["seer_memory_run", "seer_session_read", "seer_continue", "seer_status", "seer_tools"];
  const needsInput = !noInputTools.includes(selectedTool.id);

  return (
    <div className="bg-ivory rounded-2xl border border-sand/70 overflow-hidden">
      <div className="px-6 py-5 border-b border-sand/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
            <Play size={18} className="text-terracotta" />
          </div>
          <div>
            <h3 className="font-display text-xl text-charcoal">Interactive Playground</h3>
            <p className="text-xs text-muted mt-0.5">
              Try any SEER tool with a simulated demo. No account needed.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-4">
        {/* Tool selector */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2 block">
            Select Tool
          </label>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const active = selectedTool.id === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => {
                    setSelectedTool(tool);
                    setInput("");
                    setOutput("");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                    active
                      ? "bg-charcoal text-white shadow-sm"
                      : "bg-cream-dark border border-sand/60 text-warm-brown-light hover:text-charcoal hover:bg-sand/30"
                  }`}
                >
                  <Icon size={13} className={active ? "text-terracotta" : ""} />
                  {tool.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected tool info */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${selectedTool.bgColor} border ${selectedTool.borderColor}`}>
          <selectedTool.icon size={18} className={selectedTool.color} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-charcoal">{selectedTool.name}</p>
            <p className="text-xs text-muted truncate">{selectedTool.description}</p>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
            selectedTool.cost === "free" ? "bg-accent-sage/15 text-accent-sage" : "bg-terracotta/10 text-terracotta"
          }`}>
            {selectedTool.cost === "free" ? "Free" : "1 Call"}
          </span>
        </div>

        {/* Terminal */}
        <div className="rounded-xl bg-charcoal overflow-hidden">
          {/* Terminal title bar */}
          <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
              </div>
              <span className="text-[10px] text-white/40 font-mono ml-1">seer playground</span>
            </div>
            <button
              onClick={handleTryExample}
              className="text-[10px] text-white/40 hover:text-white/70 font-medium transition-colors"
            >
              Load example
            </button>
          </div>

          {/* Input area */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-2 text-sm font-mono">
              <span className="text-terracotta shrink-0">$</span>
              <span className="text-white/50 shrink-0">
                {selectedTool.command.split(" ").slice(0, selectedTool.command.includes("<") ? selectedTool.command.split(" ").indexOf(selectedTool.command.split(" ").find(w => w.includes("<"))!) : 2).join(" ")}
              </span>
              {needsInput ? (
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRun()}
                  placeholder={selectedTool.playgroundPlaceholder}
                  className="flex-1 bg-transparent text-white/90 outline-none placeholder:text-white/20 font-mono text-sm min-w-0"
                />
              ) : (
                <span className="text-white/30 text-sm italic">no input required</span>
              )}
            </div>
          </div>

          {/* Run button */}
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handleRun}
                disabled={running}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-terracotta hover:bg-terracotta-dark disabled:opacity-50 text-white text-xs font-semibold transition-all"
              >
                {running ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    Run
                  </>
                )}
              </button>
              <span className="text-[10px] text-white/30">
                Press Enter or click Run
              </span>
            </div>
            {output && <CopyBtn text={output} />}
          </div>

          {/* Output area */}
          <div className="min-h-[160px] max-h-[320px] overflow-auto">
            {output ? (
              <pre
                ref={outputRef}
                className="p-4 text-xs text-white/80 font-mono whitespace-pre-wrap leading-relaxed"
              >
                {output}
                {running && <span className="inline-block w-1.5 h-4 bg-terracotta animate-pulse ml-0.5 align-text-bottom" />}
              </pre>
            ) : (
              <div className="p-4 flex items-center justify-center h-[160px]">
                <p className="text-xs text-white/20 font-mono">
                  Output will appear here...
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="text-[10px] text-muted text-center">
          This is a simulated demo. Actual SEER results use Haiku AI for real-time optimization.{" "}
          <Link href="/signup" className="text-terracotta hover:underline font-medium">
            Sign up free
          </Link>{" "}
          to try with real prompts.
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Tool card
   ═══════════════════════════════════════════ */

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
                tool.cost === "free" ? "bg-accent-sage/15 text-accent-sage" : "bg-terracotta/10 text-terracotta"
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
          <span>{expanded ? "Hide details" : "Show example & tips"}</span>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-4">
                <p className="text-xs text-warm-brown leading-relaxed">{tool.longDescription}</p>

                {/* Terminal example */}
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

                {/* Tips */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Tips</p>
                  {tool.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-warm-brown">
                      <ArrowRight size={11} className={`${tool.color} shrink-0 mt-0.5`} />
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   Workflow visual
   ═══════════════════════════════════════════ */

function WorkflowVisual() {
  const steps = [
    { label: "Initialize", cmd: "seer memory run", icon: FolderOpen, color: "bg-emerald-500" },
    { label: "Build", cmd: "seer <task>", icon: Zap, color: "bg-terracotta" },
    { label: "Capture", cmd: "seer session read", icon: BookOpen, color: "bg-blue-500" },
    { label: "Resume", cmd: "seer continue", icon: RotateCcw, color: "bg-cyan-500" },
  ];

  return (
    <div className="bg-ivory rounded-2xl border border-sand/70 p-6 sm:p-8">
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
    </div>
  );
}

/* ═══════════════════════════════════════════
   Quick reference
   ═══════════════════════════════════════════ */

function QuickReference() {
  return (
    <div className="bg-ivory rounded-2xl border border-sand/70 overflow-hidden">
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
    </div>
  );
}

/* ═══════════════════════════════════════════
   Feature highlights
   ═══════════════════════════════════════════ */

function FeatureHighlights() {
  const features = [
    { icon: Brain, title: "Project Memory", description: "SEER remembers your project context across sessions. Initialize, capture, and resume seamlessly.", color: "text-pink-600", bg: "bg-pink-500/10" },
    { icon: Sparkles, title: "Auto-Suggestions", description: "After every command, get 3-5 intelligent next steps based on your memory and recent work.", color: "text-accent-gold", bg: "bg-accent-gold/10" },
    { icon: Shield, title: "MFA Security", description: "One-time TOTP setup keeps your account secure. Quick setup, lifetime access.", color: "text-blue-600", bg: "bg-blue-500/10" },
    { icon: GitBranch, title: "Mark Done Detection", description: "When your work matches an open task, SEER automatically asks to mark it complete.", color: "text-purple-600", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {features.map((feat, i) => {
        const Icon = feat.icon;
        return (
          <motion.div
            key={feat.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="bg-ivory rounded-2xl border border-sand/60 p-5 sm:p-6 hover:shadow-md hover:shadow-charcoal/3 transition-shadow"
          >
            <div className={`w-10 h-10 rounded-xl ${feat.bg} flex items-center justify-center mb-3`}>
              <Icon size={20} className={feat.color} />
            </div>
            <h4 className="font-display text-base text-charcoal">{feat.title}</h4>
            <p className="mt-1.5 text-xs text-muted leading-relaxed">{feat.description}</p>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main page
   ═══════════════════════════════════════════ */

export default function DocsPage() {
  const [activeCategory, setActiveCategory] = useState("all");

  const filtered =
    activeCategory === "all"
      ? TOOLS
      : TOOLS.filter((t) => t.category === activeCategory);

  return (
    <div className="min-h-screen bg-cream">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-cream/80 backdrop-blur-xl border-b border-sand/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-terracotta flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                <span className="text-white font-display font-bold text-sm">S</span>
              </div>
              <span className="font-display text-xl text-charcoal tracking-tight">SEER</span>
            </Link>
            <div className="hidden sm:flex items-center gap-1 text-sm text-muted">
              <ArrowLeft size={14} />
              <Link href="/" className="hover:text-terracotta transition-colors">Home</Link>
              <span className="mx-1">/</span>
              <span className="text-charcoal font-medium">Documentation</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-warm-brown-light hover:text-charcoal transition-colors px-4 py-2 hidden sm:block"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold text-white bg-terracotta hover:bg-terracotta-dark px-5 py-2.5 rounded-full transition-all shadow-sm hover:shadow-md"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12 md:py-16 space-y-12">
        {/* Header */}
        <motion.div
          className="text-center max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-xs font-semibold tracking-widest uppercase text-terracotta">
            Documentation
          </span>
          <h1 className="mt-4 font-display text-4xl md:text-5xl lg:text-6xl tracking-tight text-charcoal leading-[1.05]">
            Every tool,{" "}
            <span className="text-warm-brown-light">explained</span>
          </h1>
          <p className="mt-5 text-warm-brown-light text-lg leading-relaxed">
            10 powerful tools to optimize your prompts, manage project memory,
            and supercharge your AI workflow.
          </p>
        </motion.div>

        {/* Playground — hero position */}
        <Playground />

        {/* Workflow */}
        <WorkflowVisual />

        {/* Feature highlights */}
        <div>
          <h2 className="font-display text-2xl text-charcoal mb-5">Key Features</h2>
          <FeatureHighlights />
        </div>

        {/* Quick reference */}
        <QuickReference />

        {/* All tools */}
        <div>
          <h2 className="font-display text-2xl text-charcoal mb-5">All Tools</h2>

          {/* Category filters */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
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
        </div>

        {/* Bottom CTA */}
        <div className="bg-terracotta/5 border border-terracotta/15 rounded-2xl p-8 text-center space-y-4">
          <h3 className="font-display text-2xl text-charcoal">Ready to optimize your prompts?</h3>
          <p className="text-sm text-warm-brown max-w-lg mx-auto">
            Start with 50 free calls per month. No credit card required.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-terracotta hover:bg-terracotta-dark text-white text-sm font-semibold transition-all shadow-sm hover:shadow-md"
            >
              Get Started Free
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/#pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-ivory border border-sand/70 text-charcoal text-sm font-medium hover:bg-cream-dark transition-all"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </main>

      {/* Simple footer */}
      <footer className="border-t border-sand/60 py-8 mt-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted">&copy; {new Date().getFullYear()} SEER. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-muted">
            <Link href="/" className="hover:text-charcoal transition-colors">Home</Link>
            <Link href="/#pricing" className="hover:text-charcoal transition-colors">Pricing</Link>
            <Link href="/dashboard" className="hover:text-charcoal transition-colors">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
