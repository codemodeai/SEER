"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  PlayCircle,
  Clock,
  Tag,
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
  Download,
  Monitor,
  Code2,
  Globe,
  type LucideIcon,
} from "lucide-react";

interface Video {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  duration: string;
  category: "getting-started" | "how-to" | "updates";
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
}

const VIDEOS: Video[] = [
  // ─── Getting Started ───
  {
    id: "gs-1",
    title: "Install SEER on Claude Desktop",
    description: "Step-by-step walkthrough to connect SEER with Claude Desktop app using MCP.",
    youtubeId: "fVIV-L49eBs",
    duration: "3:20",
    category: "getting-started",
    icon: Monitor,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/20",
  },
  {
    id: "gs-2",
    title: "Install SEER on VS Code",
    description: "Set up SEER with Claude in VS Code using .mcp.json config file.",
    youtubeId: "",
    duration: "2:45",
    category: "getting-started",
    icon: Code2,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-600/20",
  },
  {
    id: "gs-3",
    title: "Install SEER on Terminal CLI",
    description: "Configure SEER for Claude Code CLI with your API key in minutes.",
    youtubeId: "",
    duration: "2:00",
    category: "getting-started",
    icon: Download,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-600/20",
  },
  {
    id: "gs-4",
    title: "Install SEER on Claude.ai Web",
    description: "Use SEER directly in Claude.ai web interface via MCP integration.",
    youtubeId: "",
    duration: "1:50",
    category: "getting-started",
    icon: Globe,
    iconColor: "text-purple-600",
    iconBg: "bg-purple-600/20",
  },

  // ─── How to Use: Core Tools ───
  {
    id: "ht-run",
    title: "How to Use: seer run",
    description: "Compress any messy prompt into a clean, token-efficient version. See real before/after examples.",
    youtubeId: "",
    duration: "4:30",
    category: "how-to",
    icon: Zap,
    iconColor: "text-terracotta",
    iconBg: "bg-terracotta/20",
  },
  {
    id: "ht-optimize",
    title: "How to Use: seer optimize",
    description: "Optimize prompts for specific AI models — Claude, GPT, or Gemini. Quality scores and reduction stats.",
    youtubeId: "",
    duration: "3:50",
    category: "how-to",
    icon: Sparkles,
    iconColor: "text-accent-gold",
    iconBg: "bg-accent-gold/20",
  },
  {
    id: "ht-workflow",
    title: "How to Use: seer workflow",
    description: "Break complex goals into 3-7 actionable steps, each with a ready-to-use prompt.",
    youtubeId: "",
    duration: "5:10",
    category: "how-to",
    icon: GitBranch,
    iconColor: "text-purple-600",
    iconBg: "bg-purple-500/20",
  },
  {
    id: "ht-memory",
    title: "How to Use: seer memory",
    description: "Semantic search across your project memory. Ask natural questions, get instant context.",
    youtubeId: "",
    duration: "4:00",
    category: "how-to",
    icon: Brain,
    iconColor: "text-pink-600",
    iconBg: "bg-pink-500/20",
  },

  // ─── How to Use: Memory Tools ───
  {
    id: "ht-memory-run",
    title: "How to Use: seer memory run",
    description: "Initialize your project memory file — auto-scans structure, stack, and git history.",
    youtubeId: "",
    duration: "3:15",
    category: "how-to",
    icon: FolderOpen,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-500/20",
  },
  {
    id: "ht-session-read",
    title: "How to Use: seer session read",
    description: "Capture an entire session to memory — what was built, decided, and what's next.",
    youtubeId: "",
    duration: "3:00",
    category: "how-to",
    icon: BookOpen,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-500/20",
  },
  {
    id: "ht-continue",
    title: "How to Use: seer continue",
    description: "Resume any session from where you left off. Get a brief on last work, next steps, and open tasks.",
    youtubeId: "",
    duration: "2:30",
    category: "how-to",
    icon: RotateCcw,
    iconColor: "text-cyan-600",
    iconBg: "bg-cyan-500/20",
  },
  {
    id: "ht-recall",
    title: "How to Use: seer recall",
    description: "Ask about your project history in plain English — \"what did I do?\", \"what's left?\"",
    youtubeId: "",
    duration: "2:45",
    category: "how-to",
    icon: MessageSquare,
    iconColor: "text-orange-600",
    iconBg: "bg-orange-500/20",
  },

  // ─── How to Use: Utility Tools ───
  {
    id: "ht-status",
    title: "How to Use: seer status",
    description: "Check your plan, usage, remaining calls, and SEER version — always free.",
    youtubeId: "",
    duration: "1:30",
    category: "how-to",
    icon: Activity,
    iconColor: "text-accent-sage",
    iconBg: "bg-accent-sage/20",
  },
  {
    id: "ht-tools",
    title: "How to Use: seer tools",
    description: "List all available SEER tools with costs, plan requirements, and quick reference.",
    youtubeId: "",
    duration: "1:45",
    category: "how-to",
    icon: Wrench,
    iconColor: "text-warm-brown",
    iconBg: "bg-warm-brown/20",
  },
];

const CATEGORIES = [
  { id: "all", label: "All", count: VIDEOS.length },
  { id: "getting-started", label: "Getting Started", count: VIDEOS.filter((v) => v.category === "getting-started").length },
  { id: "how-to", label: "How to Use", count: VIDEOS.filter((v) => v.category === "how-to").length },
  { id: "updates", label: "Updates", count: VIDEOS.filter((v) => v.category === "updates").length },
];

export default function GuidesPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  const filtered =
    activeCategory === "all"
      ? VIDEOS
      : VIDEOS.filter((v) => v.category === activeCategory);

  const categoryLabel = (cat: string) =>
    cat === "getting-started"
      ? "Getting Started"
      : cat === "how-to"
        ? "How to Use"
        : "Update";

  const categoryColor = (cat: string) =>
    cat === "getting-started"
      ? "bg-blue-50 text-blue-600 border-blue-200"
      : cat === "how-to"
        ? "bg-emerald-50 text-emerald-600 border-emerald-200"
        : "bg-purple-50 text-purple-600 border-purple-200";

  const hasVideo = (v: Video) => v.youtubeId.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl text-charcoal tracking-tight">
          Guides
        </h1>
        <p className="mt-1 text-sm text-muted">
          Video tutorials for every SEER tool — from installation to advanced workflows.
        </p>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
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
            <span className={`ml-1.5 text-[10px] ${
              activeCategory === cat.id ? "text-white/70" : "text-muted"
            }`}>
              {cat.count}
            </span>
          </button>
        ))}
      </div>

      {/* Video grid */}
      {filtered.length === 0 ? (
        <div className="bg-ivory rounded-2xl border border-sand/60 p-6 sm:p-10 text-center space-y-3">
          <PlayCircle size={36} className="text-muted mx-auto" />
          <p className="text-sm text-muted">No videos in this category yet.</p>
          <p className="text-xs text-muted">Check back soon for new tutorials.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {filtered.map((video, i) => {
            const Icon = video.icon;
            return (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-ivory rounded-xl sm:rounded-2xl border border-sand/60 overflow-hidden hover:shadow-md hover:shadow-charcoal/4 transition-shadow"
              >
                {/* Video player / Thumbnail / Coming Soon */}
                <div className="aspect-video bg-charcoal relative">
                  {playingVideo === video.id && hasVideo(video) ? (
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?rel=0&modestbranding=1&autoplay=1`}
                      title={video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  ) : hasVideo(video) ? (
                    <button
                      onClick={() => setPlayingVideo(video.id)}
                      className="w-full h-full relative group cursor-pointer"
                    >
                      <img
                        src={`https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg`}
                        alt={video.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`;
                        }}
                      />
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/90 group-hover:bg-white group-hover:scale-110 transition-all flex items-center justify-center shadow-lg">
                          <PlayCircle size={24} className="sm:w-8 sm:h-8 text-terracotta ml-0.5" />
                        </div>
                      </div>
                      <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-black/70 text-white text-[10px] sm:text-xs font-medium">
                        <Clock size={10} className="sm:w-[11px] sm:h-[11px]" />
                        {video.duration}
                      </div>
                    </button>
                  ) : (
                    /* Coming Soon placeholder */
                    <div className="w-full h-full flex flex-col items-center justify-center relative">
                      {/* Background pattern */}
                      <div className="absolute inset-0 opacity-[0.03]" style={{
                        backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
                        backgroundSize: "20px 20px",
                      }} />

                      {/* Tool icon */}
                      {Icon && (
                        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl ${video.iconBg} flex items-center justify-center mb-3`}>
                          <Icon size={28} className={`sm:w-8 sm:h-8 ${video.iconColor}`} />
                        </div>
                      )}

                      {/* Coming soon badge */}
                      <span className="px-3 py-1 rounded-full bg-white/10 text-white/60 text-[10px] sm:text-xs font-semibold tracking-wide">
                        Coming Soon
                      </span>

                      {/* Duration badge */}
                      <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-white/10 text-white/40 text-[10px] sm:text-xs font-medium">
                        <Clock size={10} className="sm:w-[11px] sm:h-[11px]" />
                        ~{video.duration}
                      </div>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 sm:p-4 space-y-1.5 sm:space-y-2">
                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                    <h3 className="font-display text-sm sm:text-base text-charcoal leading-snug">
                      {video.title}
                    </h3>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold border ${categoryColor(video.category)}`}
                    >
                      <Tag size={8} className="sm:w-[9px] sm:h-[9px]" />
                      {categoryLabel(video.category)}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-muted leading-relaxed">
                    {video.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Coming soon hint */}
      <div className="bg-terracotta/5 border border-terracotta/15 rounded-2xl p-5 text-center">
        <p className="text-sm text-warm-brown">
          <span className="font-semibold text-terracotta">Videos are being recorded!</span>{" "}
          Tutorials for every tool are in production. Check back soon or follow updates.
        </p>
      </div>
    </div>
  );
}
