"use client";

import { useDashboard } from "@/lib/dashboard-context";
import { Megaphone, Pin, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  authorEmail: string;
  created_at: string;
}

export default function AgencyAnnouncements() {
  const { agencyName, agencyRole, loading } = useDashboard();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (loading || !agencyName) {
      setFetching(false);
      return;
    }

    async function fetchAnnouncements() {
      try {
        const res = await fetch("/api/dashboard/announcements");
        if (!res.ok) {
          setFetching(false);
          return;
        }
        const data = await res.json();
        setAnnouncements(data.announcements ?? []);
      } catch {
        // Silently fail — announcements are non-critical
      } finally {
        setFetching(false);
      }
    }
    fetchAnnouncements();
  }, [loading, agencyName]);

  // Don't render if not in an agency or still loading context
  if (loading || !agencyName) return null;

  const pinned = announcements.filter((a) => a.pinned);
  const regular = announcements.filter((a) => !a.pinned);
  const visibleRegular = showAll ? regular : regular.slice(0, 2);

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div className="bg-ivory dark:bg-charcoal/50 border border-sand/60 dark:border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-sand/40 dark:border-white/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-terracotta/10 flex items-center justify-center">
          <Megaphone size={16} className="text-terracotta" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-charcoal dark:text-white">
            Announcements
          </h3>
          <p className="text-[11px] text-muted">
            From {agencyName}
          </p>
        </div>
        {announcements.length > 0 && (
          <span className="ml-auto text-[10px] font-medium bg-terracotta/10 text-terracotta px-2 py-0.5 rounded-full">
            {announcements.length}
          </span>
        )}
      </div>

      {/* Loading state */}
      {fetching && (
        <div className="px-5 py-6 text-center">
          <p className="text-xs text-muted animate-pulse">Loading announcements...</p>
        </div>
      )}

      {/* Empty state */}
      {!fetching && announcements.length === 0 && (
        <div className="px-5 py-6 text-center">
          <Megaphone size={20} className="text-muted/30 mx-auto mb-2" />
          <p className="text-xs text-muted">No announcements yet</p>
          <p className="text-[10px] text-muted/60 mt-0.5">
            Your agency admin will post updates here.
          </p>
        </div>
      )}

      {/* Pinned announcements */}
      {pinned.map((a) => (
        <div
          key={a.id}
          className="px-5 py-3.5 border-b border-sand/30 dark:border-white/5 bg-amber-50/50 dark:bg-amber-500/5"
        >
          <div className="flex items-start gap-2.5">
            <Pin size={13} className="text-amber-500 mt-0.5 shrink-0 rotate-45" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-charcoal dark:text-white">
                {a.title}
              </p>
              {a.body && (
                <p className="text-xs text-muted mt-1 leading-relaxed whitespace-pre-line line-clamp-3">
                  {a.body}
                </p>
              )}
              <p className="text-[10px] text-muted/60 mt-1.5">
                {a.authorEmail.split("@")[0]} &middot; {formatDate(a.created_at)}
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* Regular announcements */}
      {visibleRegular.map((a) => (
        <div
          key={a.id}
          className="px-5 py-3.5 border-b border-sand/30 dark:border-white/5 last:border-b-0"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-charcoal dark:text-white">
              {a.title}
            </p>
            {a.body && (
              <p className="text-xs text-muted mt-1 leading-relaxed whitespace-pre-line line-clamp-2">
                {a.body}
              </p>
            )}
            <p className="text-[10px] text-muted/60 mt-1.5">
              {a.authorEmail.split("@")[0]} &middot; {formatDate(a.created_at)}
            </p>
          </div>
        </div>
      ))}

      {/* Show more/less toggle */}
      {regular.length > 2 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full px-5 py-2.5 text-xs text-terracotta font-medium hover:bg-terracotta/5 transition-colors flex items-center justify-center gap-1"
        >
          {showAll ? (
            <>Show less <ChevronUp size={12} /></>
          ) : (
            <>Show all {regular.length} announcements <ChevronDown size={12} /></>
          )}
        </button>
      )}
    </div>
  );
}
