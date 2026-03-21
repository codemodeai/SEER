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
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

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
  waiting: { label: "Awaiting", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  replied: { label: "Replied", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-500 border-gray-200", icon: XCircle },
};

export default function AdminTicketsPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [filter, setFilter] = useState("all");

  // Check admin auth
  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email?.toLowerCase() === "support@codemodeai.com") {
        setAuthed(true);
      }
      setChecking(false);
    }
    checkAdmin();
  }, []);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tickets");
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authed) fetchTickets();
  }, [authed, fetchTickets]);

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

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
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
    return `${Math.floor(hrs / 24)}d ago`;
  }

  // Loading state
  if (checking) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-terracotta" />
      </div>
    );
  }

  // Not admin
  if (!authed) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="text-center">
          <Shield size={48} className="text-muted/20 mx-auto mb-4" />
          <h1 className="font-display text-2xl text-charcoal">Access Denied</h1>
          <p className="text-sm text-muted mt-2">This page is restricted to SEER admins only.</p>
          <a
            href="/"
            className="mt-6 inline-block px-6 py-2.5 rounded-full bg-terracotta text-white text-sm font-semibold hover:bg-terracotta-dark transition-all"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  const filtered = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);
  const openCount = tickets.filter((t) => t.status === "open" || t.status === "waiting").length;

  return (
    <div className="min-h-screen bg-cream">
      {/* Top bar */}
      <header className="bg-charcoal text-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-terracotta flex items-center justify-center">
              <span className="text-white font-display font-bold text-xs">S</span>
            </div>
            <span className="font-display text-lg tracking-tight">SEER Admin</span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-semibold tracking-wider uppercase text-white/50">
              Support Tickets
            </span>
          </div>
          <div className="flex items-center gap-4">
            {openCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-terracotta text-white text-xs font-bold">
                {openCount} open
              </span>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <AnimatePresence mode="wait">
          {!selectedTicket ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              {/* Header + Filters */}
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <h2 className="font-display text-2xl text-charcoal">
                  All Tickets
                  <span className="text-muted text-lg ml-2">({tickets.length})</span>
                </h2>
                <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                  {[
                    { value: "all", label: "All" },
                    { value: "open", label: "Open" },
                    { value: "waiting", label: "Waiting" },
                    { value: "replied", label: "Replied" },
                    { value: "closed", label: "Closed" },
                  ].map((tab) => (
                    <button
                      key={tab.value}
                      onClick={() => setFilter(tab.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all shrink-0 ${
                        filter === tab.value
                          ? "bg-charcoal text-white border-charcoal"
                          : "bg-ivory text-warm-brown-light border-sand hover:border-charcoal/30"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={24} className="animate-spin text-muted" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="bg-ivory rounded-2xl border border-sand/60 flex flex-col items-center justify-center py-20 gap-2">
                  <CheckCircle2 size={36} className="text-accent-sage/30" />
                  <p className="text-sm text-muted">No tickets to show</p>
                </div>
              ) : (
                <div className="bg-ivory rounded-2xl border border-sand/60 overflow-hidden divide-y divide-sand/30">
                  {filtered.map((ticket) => {
                    const sc = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
                    const Icon = sc.icon;
                    const isUrgent = ticket.status === "open" || ticket.status === "waiting";
                    return (
                      <button
                        key={ticket.id}
                        onClick={() => openTicket(ticket)}
                        className={`w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 hover:bg-cream-dark/40 transition-colors text-left ${
                          isUrgent ? "bg-terracotta/[0.02]" : ""
                        }`}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          isUrgent ? "bg-terracotta animate-pulse" : "bg-sand"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isUrgent ? "text-charcoal" : "text-warm-brown-light"}`}>
                            {ticket.subject}
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            <span className="font-medium text-charcoal/70">{ticket.email}</span>
                            <span className="mx-1.5 text-sand">|</span>
                            {ticket.category}
                            <span className="mx-1.5 text-sand">|</span>
                            {timeAgo(ticket.created_at)}
                          </p>
                        </div>
                        <span className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${sc.color}`}>
                          <Icon size={11} />
                          {sc.label}
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
              {/* Back + Status */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <button
                  onClick={() => { setSelectedTicket(null); setReplies([]); }}
                  className="flex items-center gap-2 text-sm text-muted hover:text-charcoal transition-colors"
                >
                  <ArrowLeft size={16} />
                  Back to tickets
                </button>
                <div className="relative">
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => updateStatus(selectedTicket.id, e.target.value)}
                    className="appearance-none pl-3 pr-8 py-2 rounded-lg text-xs font-semibold border bg-ivory border-sand/60 text-charcoal cursor-pointer focus:outline-none focus:border-terracotta/40"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
              </div>

              {/* Ticket info */}
              <div className="bg-ivory rounded-2xl border border-sand/60 p-5 sm:p-6">
                <h3 className="font-display text-xl text-charcoal">
                  {selectedTicket.subject}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted">
                  <span>From: <span className="font-medium text-charcoal">{selectedTicket.email}</span></span>
                  <span className="text-sand">|</span>
                  <span>{selectedTicket.category}</span>
                  <span className="text-sand">|</span>
                  <span>{formatDate(selectedTicket.created_at)}</span>
                  <span className="text-sand">|</span>
                  <span className="font-mono">#{selectedTicket.id.substring(0, 8)}</span>
                </div>

                <div className="mt-4 p-4 rounded-xl bg-cream-dark border border-sand/40">
                  <p className="text-sm text-charcoal whitespace-pre-wrap leading-relaxed">
                    {selectedTicket.message}
                  </p>
                </div>
              </div>

              {/* Conversation */}
              <div className="bg-ivory rounded-2xl border border-sand/60 overflow-hidden">
                <div className="px-5 sm:px-6 py-4 border-b border-sand/40 flex items-center gap-2">
                  <MessageSquare size={16} className="text-terracotta" />
                  <h4 className="text-sm font-semibold text-charcoal">Conversation</h4>
                  <span className="text-xs text-muted ml-auto">{replies.length} replies</span>
                </div>

                {repliesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={20} className="animate-spin text-muted" />
                  </div>
                ) : replies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <MessageSquare size={24} className="text-muted/20" />
                    <p className="text-xs text-muted">No replies yet. Send the first reply below.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-sand/20 max-h-[50vh] overflow-y-auto">
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
                            {reply.is_staff ? "You (SEER Support)" : "User"}
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

                {/* Reply box */}
                <div className="px-5 sm:px-6 py-4 border-t border-sand/40 bg-charcoal/[0.02]">
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-terracotta mb-2">
                    Reply as SEER Support
                  </p>
                  <div className="flex gap-3">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your response..."
                      rows={3}
                      className="flex-1 px-4 py-3 rounded-xl bg-ivory border border-sand/60 text-sm text-charcoal placeholder:text-muted/50 focus:outline-none focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10 transition-all resize-none"
                    />
                    <button
                      onClick={handleReply}
                      disabled={sendingReply || !replyText.trim()}
                      className="self-end px-5 py-3 rounded-xl bg-terracotta hover:bg-terracotta-dark text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {sendingReply ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <>
                          <Send size={14} />
                          <span className="hidden sm:inline text-sm font-medium">Send</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
