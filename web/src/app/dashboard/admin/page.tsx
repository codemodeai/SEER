"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ArrowLeft,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Loader2,
  XCircle,
  ChevronDown,
} from "lucide-react";

interface Ticket {
  id: string;
  user_id: string;
  email: string;
  subject: string;
  message: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Reply {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_staff: boolean;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "waiting", label: "Awaiting Reply" },
  { value: "replied", label: "Replied" },
  { value: "closed", label: "Closed" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: "Open", color: "bg-blue-100 text-blue-700 border-blue-200", icon: AlertCircle },
  waiting: { label: "Awaiting Reply", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  replied: { label: "Replied", color: "bg-accent-sage/15 text-accent-sage border-accent-sage/20", icon: CheckCircle2 },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-500 border-gray-200", icon: XCircle },
};

export default function AdminPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [filter, setFilter] = useState("all");

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tickets");
      if (res.status === 403) {
        setError("You don't have admin access.");
        setLoading(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets);
      }
    } catch {
      setError("Failed to load tickets.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  async function openTicket(ticket: Ticket) {
    setSelectedTicket(ticket);
    setRepliesLoading(true);
    try {
      const res = await fetch(`/api/admin/tickets/${ticket.id}/reply`);
      if (res.ok) {
        const data = await res.json();
        setReplies(data.replies);
      }
    } catch {
      // silent
    }
    setRepliesLoading(false);
  }

  async function handleReply() {
    if (!replyText.trim() || !selectedTicket) return;
    setSendingReply(true);
    try {
      const res = await fetch(`/api/admin/tickets/${selectedTicket.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText }),
      });
      if (res.ok) {
        const data = await res.json();
        setReplies((prev) => [...prev, data.reply]);
        setReplyText("");
        // Update ticket status locally
        setSelectedTicket((t) => t ? { ...t, status: "replied" } : null);
        fetchTickets();
      }
    } catch {
      alert("Failed to send reply.");
    }
    setSendingReply(false);
  }

  async function updateStatus(ticketId: string, status: string) {
    try {
      await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, status }),
      });
      setSelectedTicket((t) => t ? { ...t, status } : null);
      fetchTickets();
    } catch {
      alert("Failed to update status.");
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  const filtered = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);
  const openCount = tickets.filter((t) => t.status === "open" || t.status === "waiting").length;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Shield size={40} className="text-muted/30" />
        <p className="text-sm text-muted">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-terracotta" />
            <h1 className="font-display text-3xl md:text-4xl text-charcoal tracking-tight">
              Admin — Tickets
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted">
            {openCount} ticket{openCount !== 1 ? "s" : ""} need attention
          </p>
        </div>
        {selectedTicket && (
          <button
            onClick={() => setSelectedTicket(null)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-cream-dark hover:bg-sand text-charcoal text-sm font-medium transition-all border border-sand"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!selectedTicket ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            {/* Filter tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1">
              {[
                { value: "all", label: `All (${tickets.length})` },
                { value: "open", label: `Open` },
                { value: "waiting", label: `Waiting` },
                { value: "replied", label: `Replied` },
                { value: "closed", label: `Closed` },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setFilter(tab.value)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all shrink-0 ${
                    filter === tab.value
                      ? "bg-charcoal text-white border-charcoal"
                      : "bg-cream-dark text-warm-brown-light border-sand hover:border-charcoal/30"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-muted" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-ivory rounded-2xl border border-sand/60 flex flex-col items-center justify-center py-16 gap-2">
                <CheckCircle2 size={32} className="text-accent-sage/40" />
                <p className="text-sm text-muted">No tickets to show</p>
              </div>
            ) : (
              <div className="bg-ivory rounded-2xl border border-sand/60 overflow-hidden divide-y divide-sand/30">
                {filtered.map((ticket) => {
                  const sc = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
                  const Icon = sc.icon;
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => openTicket(ticket)}
                      className="w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 hover:bg-cream-dark/30 transition-colors text-left"
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        ticket.status === "open" || ticket.status === "waiting"
                          ? "bg-terracotta"
                          : "bg-sand"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-charcoal truncate">
                          {ticket.subject}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {ticket.email}
                          <span className="mx-1.5 text-sand">|</span>
                          {ticket.category}
                          <span className="mx-1.5 text-sand">|</span>
                          {timeAgo(ticket.created_at)}
                        </p>
                      </div>
                      <span className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${sc.color}`}>
                        <Icon size={11} />
                        <span className="hidden sm:inline">{sc.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="detail"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            {/* Ticket header */}
            <div className="bg-ivory rounded-2xl border border-sand/60 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="font-display text-xl text-charcoal">
                    {selectedTicket.subject}
                  </h3>
                  <p className="text-xs text-muted mt-1">
                    From: <span className="font-medium text-charcoal">{selectedTicket.email}</span>
                    <span className="mx-1.5 text-sand">|</span>
                    {formatDate(selectedTicket.created_at)}
                    <span className="mx-1.5 text-sand">|</span>
                    {selectedTicket.category}
                    <span className="mx-1.5 text-sand">|</span>
                    #{selectedTicket.id.substring(0, 8)}
                  </p>
                </div>

                {/* Status dropdown */}
                <div className="relative">
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => updateStatus(selectedTicket.id, e.target.value)}
                    className="appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-semibold border bg-cream-dark border-sand/60 text-charcoal cursor-pointer focus:outline-none focus:border-terracotta/40"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
              </div>

              {/* Original message */}
              <div className="mt-4 p-4 rounded-xl bg-cream-dark border border-sand/40">
                <p className="text-sm text-charcoal whitespace-pre-wrap leading-relaxed">
                  {selectedTicket.message}
                </p>
              </div>
            </div>

            {/* Replies */}
            <div className="bg-ivory rounded-2xl border border-sand/60 overflow-hidden">
              <div className="px-5 sm:px-6 py-4 border-b border-sand/40 flex items-center gap-2">
                <MessageSquare size={16} className="text-terracotta" />
                <h4 className="text-sm font-semibold text-charcoal">Conversation</h4>
              </div>

              {repliesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-muted" />
                </div>
              ) : replies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Clock size={24} className="text-muted/30" />
                  <p className="text-xs text-muted">No replies yet. Reply below.</p>
                </div>
              ) : (
                <div className="divide-y divide-sand/20">
                  {replies.map((reply) => (
                    <div
                      key={reply.id}
                      className={`px-5 sm:px-6 py-4 ${reply.is_staff ? "bg-terracotta/5" : ""}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            reply.is_staff
                              ? "bg-terracotta text-white"
                              : "bg-charcoal/10 text-charcoal"
                          }`}
                        >
                          {reply.is_staff ? "S" : "U"}
                        </div>
                        <span className="text-xs font-medium text-charcoal">
                          {reply.is_staff ? "SEER Support (You)" : "User"}
                        </span>
                        <span className="text-[10px] text-muted ml-auto">
                          {formatDate(reply.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-charcoal whitespace-pre-wrap leading-relaxed pl-8">
                        {reply.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Staff reply input */}
              <div className="px-5 sm:px-6 py-4 border-t border-sand/40 bg-terracotta/5">
                <p className="text-[10px] font-semibold tracking-widest uppercase text-terracotta mb-2">
                  Reply as SEER Support
                </p>
                <div className="flex gap-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply to the user..."
                    rows={3}
                    className="flex-1 px-4 py-3 rounded-xl bg-ivory border border-sand/60 text-sm text-charcoal placeholder:text-muted/50 focus:outline-none focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10 transition-all resize-none"
                  />
                  <button
                    onClick={handleReply}
                    disabled={sendingReply || !replyText.trim()}
                    className="self-end px-4 py-3 rounded-xl bg-terracotta hover:bg-terracotta-dark text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingReply ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
