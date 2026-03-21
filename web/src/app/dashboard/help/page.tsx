"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HelpCircle,
  Plus,
  Send,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Loader2,
  Mail,
} from "lucide-react";

interface Ticket {
  id: string;
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

const CATEGORIES = [
  { id: "general", label: "General" },
  { id: "billing", label: "Billing" },
  { id: "technical", label: "Technical Issue" },
  { id: "feature", label: "Feature Request" },
  { id: "bug", label: "Bug Report" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: "Open", color: "bg-blue-100 text-blue-700 border-blue-200", icon: AlertCircle },
  waiting: { label: "Awaiting Reply", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  replied: { label: "Replied", color: "bg-accent-sage/15 text-accent-sage border-accent-sage/20", icon: CheckCircle2 },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-500 border-gray-200", icon: CheckCircle2 },
};

export default function HelpPage() {
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);

  // Create form
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");
  const [submitting, setSubmitting] = useState(false);

  // Reply form
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/tickets");
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
    fetchTickets();
  }, [fetchTickets]);

  async function handleCreate() {
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, category }),
      });
      if (res.ok) {
        setSubject("");
        setMessage("");
        setCategory("general");
        setView("list");
        fetchTickets();
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to create ticket");
      }
    } catch {
      alert("Network error. Please try again.");
    }
    setSubmitting(false);
  }

  async function openTicket(ticket: Ticket) {
    setSelectedTicket(ticket);
    setView("detail");
    setRepliesLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/replies`);
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
      const res = await fetch(`/api/tickets/${selectedTicket.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText }),
      });
      if (res.ok) {
        const data = await res.json();
        setReplies((prev) => [...prev, data.reply]);
        setReplyText("");
        fetchTickets();
      }
    } catch {
      alert("Failed to send reply.");
    }
    setSendingReply(false);
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-charcoal tracking-tight">
            Help & Support
          </h1>
          <p className="mt-1 text-sm text-muted">
            Create a ticket and we&apos;ll get back to you.
          </p>
        </div>
        {view === "list" && (
          <button
            onClick={() => setView("create")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-terracotta hover:bg-terracotta-dark text-white text-sm font-semibold transition-all shadow-sm"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Ticket</span>
          </button>
        )}
        {view !== "list" && (
          <button
            onClick={() => {
              setView("list");
              setSelectedTicket(null);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-cream-dark hover:bg-sand text-charcoal text-sm font-medium transition-all border border-sand"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* ===== TICKET LIST ===== */}
        {view === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            {/* Quick contact */}
            <div className="bg-ivory rounded-2xl border border-sand/60 p-4 sm:p-5 mb-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center shrink-0">
                <Mail size={20} className="text-terracotta" />
              </div>
              <div>
                <p className="text-sm font-medium text-charcoal">
                  Direct support: <a href="mailto:support@codemodeai.com" className="text-terracotta hover:underline">support@codemodeai.com</a>
                </p>
                <p className="text-xs text-muted mt-0.5">Or create a ticket below for tracked support</p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-muted" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="bg-ivory rounded-2xl border border-sand/60 flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-cream-dark flex items-center justify-center">
                  <HelpCircle size={28} className="text-muted/40" />
                </div>
                <p className="text-sm font-medium text-charcoal">No tickets yet</p>
                <p className="text-xs text-muted">Create a ticket to get help from our team.</p>
                <button
                  onClick={() => setView("create")}
                  className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-full bg-terracotta hover:bg-terracotta-dark text-white text-sm font-semibold transition-all"
                >
                  <Plus size={14} />
                  Create Ticket
                </button>
              </div>
            ) : (
              <div className="bg-ivory rounded-2xl border border-sand/60 overflow-hidden divide-y divide-sand/30">
                {tickets.map((ticket) => {
                  const statusConf = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
                  const StatusIcon = statusConf.icon;
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => openTicket(ticket)}
                      className="w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 hover:bg-cream-dark/30 transition-colors text-left"
                    >
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cream-dark flex items-center justify-center shrink-0">
                        <MessageSquare size={16} className="text-warm-brown-light" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-charcoal truncate">
                          {ticket.subject}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {formatDate(ticket.created_at)}
                          <span className="mx-1.5 text-sand">|</span>
                          {ticket.category}
                        </p>
                      </div>
                      <span className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${statusConf.color}`}>
                        <StatusIcon size={11} />
                        <span className="hidden sm:inline">{statusConf.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ===== CREATE TICKET ===== */}
        {view === "create" && (
          <motion.div
            key="create"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-ivory rounded-2xl border border-sand/60 overflow-hidden"
          >
            <div className="px-5 sm:px-6 py-4 border-b border-sand/40">
              <h3 className="text-sm font-semibold text-charcoal">Create New Ticket</h3>
            </div>
            <div className="p-5 sm:p-6 space-y-5">
              {/* Category */}
              <div>
                <label className="text-xs font-semibold tracking-widest uppercase text-muted block mb-2">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        category === cat.id
                          ? "bg-terracotta text-white border-terracotta"
                          : "bg-cream-dark text-warm-brown-light border-sand hover:border-terracotta/40"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="text-xs font-semibold tracking-widest uppercase text-muted block mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief description of your issue"
                  className="w-full px-4 py-3 rounded-xl bg-cream-dark border border-sand/60 text-sm text-charcoal placeholder:text-muted/50 focus:outline-none focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10 transition-all"
                />
              </div>

              {/* Message */}
              <div>
                <label className="text-xs font-semibold tracking-widest uppercase text-muted block mb-2">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue in detail..."
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl bg-cream-dark border border-sand/60 text-sm text-charcoal placeholder:text-muted/50 focus:outline-none focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10 transition-all resize-none"
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end">
                <button
                  onClick={handleCreate}
                  disabled={submitting || !subject.trim() || !message.trim()}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-terracotta hover:bg-terracotta-dark text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Submit Ticket
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ===== TICKET DETAIL ===== */}
        {view === "detail" && selectedTicket && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            {/* Ticket header */}
            <div className="bg-ivory rounded-2xl border border-sand/60 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl text-charcoal">
                    {selectedTicket.subject}
                  </h3>
                  <p className="text-xs text-muted mt-1">
                    {formatDate(selectedTicket.created_at)}
                    <span className="mx-1.5 text-sand">|</span>
                    {selectedTicket.category}
                    <span className="mx-1.5 text-sand">|</span>
                    #{selectedTicket.id.substring(0, 8)}
                  </p>
                </div>
                {(() => {
                  const sc = STATUS_CONFIG[selectedTicket.status] ?? STATUS_CONFIG.open;
                  const Icon = sc.icon;
                  return (
                    <span className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${sc.color}`}>
                      <Icon size={12} />
                      {sc.label}
                    </span>
                  );
                })()}
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
                  <p className="text-xs text-muted">No replies yet. Our team will respond soon.</p>
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
                          {reply.is_staff ? "S" : "Y"}
                        </div>
                        <span className="text-xs font-medium text-charcoal">
                          {reply.is_staff ? "SEER Support" : "You"}
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

              {/* Reply input */}
              {selectedTicket.status !== "closed" && (
                <div className="px-5 sm:px-6 py-4 border-t border-sand/40 bg-cream-dark/30">
                  <div className="flex gap-3">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply..."
                      rows={2}
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
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
