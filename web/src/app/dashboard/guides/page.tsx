"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PlayCircle, Clock, Tag } from "lucide-react";

interface Video {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  duration: string;
  category: "getting-started" | "how-to" | "updates";
}

const VIDEOS: Video[] = [
  {
    id: "1",
    title: "Install SEER on Claude Desktop",
    description: "Step-by-step walkthrough to connect SEER with Claude Desktop app using MCP.",
    youtubeId: "fVIV-L49eBs",
    duration: "3:20",
    category: "getting-started",
  },
  // Add more videos here as you create them:
  // {
  //   id: "2",
  //   title: "Install SEER on VS Code",
  //   description: "Set up SEER with Claude in VS Code using .mcp.json config.",
  //   youtubeId: "",
  //   duration: "2:45",
  //   category: "getting-started",
  // },
  // {
  //   id: "3",
  //   title: "How to Use seer_optimize",
  //   description: "Learn how SEER compresses your prompts to save tokens.",
  //   youtubeId: "",
  //   duration: "4:10",
  //   category: "how-to",
  // },
];

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "getting-started", label: "Getting Started" },
  { id: "how-to", label: "How to Use" },
  { id: "updates", label: "Updates" },
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl text-charcoal tracking-tight">
          Guides
        </h1>
        <p className="mt-1 text-sm text-muted">
          Video tutorials to help you get the most out of SEER.
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
          {filtered.map((video, i) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-ivory rounded-xl sm:rounded-2xl border border-sand/60 overflow-hidden hover:shadow-md hover:shadow-charcoal/4 transition-shadow"
            >
              {/* Video player / Thumbnail */}
              <div className="aspect-video bg-black relative">
                {playingVideo === video.id ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?rel=0&modestbranding=1&autoplay=1`}
                    title={video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                ) : (
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
          ))}
        </div>
      )}

      {/* Coming soon hint */}
      <div className="bg-terracotta/5 border border-terracotta/15 rounded-2xl p-5 text-center">
        <p className="text-sm text-warm-brown">
          <span className="font-semibold text-terracotta">More coming soon!</span>{" "}
          New tutorials are added regularly. Check back for the latest guides.
        </p>
      </div>
    </div>
  );
}
