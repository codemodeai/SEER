"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Mail,
  Calendar,
  Activity,
  Filter,
} from "lucide-react";

interface UserData {
  id: string;
  email: string;
  name: string;
  plan: string;
  usage_this_month: number;
  created_at: string;
  country: string;
  mfa_verified: boolean;
  onboarding_completed: boolean;
  fs_access: boolean;
  actualUsage: number;
  subscription: {
    provider: string;
    plan: string;
    status: string;
    current_period_end: string;
  } | null;
}

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-100 text-gray-600 border-gray-200",
  starter: "bg-amber-50 text-amber-700 border-amber-200",
  pro: "bg-terracotta/10 text-terracotta border-terracotta/20",
  agency: "bg-charcoal/10 text-charcoal border-charcoal/20",
};

const PLAN_LIMITS: Record<string, number> = {
  free: 50,
  starter: 200,
  pro: 1000,
  agency: 99999,
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString() });
      if (search) params.set("search", search);
      if (planFilter) params.set("plan", planFilter);

      const res = await fetch(`/api/admin/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [page, search, planFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setPage(1);
  }, [search, planFilter]);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function timeAgo(d: string) {
    const diff = Date.now() - new Date(d).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }

  async function updatePlan(userId: string, plan: string) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, plan }),
    });
    fetchUsers();
    if (selectedUser?.id === userId) {
      setSelectedUser(prev => prev ? { ...prev, plan } : null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl text-charcoal">User Management</h1>
          <p className="text-sm text-muted mt-1">{total} total users</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-ivory border border-sand/60 text-sm text-charcoal placeholder:text-muted/50 focus:outline-none focus:border-terracotta/40"
          />
        </div>
        <div className="flex gap-1.5">
          {["", "free", "starter", "pro", "agency"].map(p => (
            <button
              key={p}
              onClick={() => setPlanFilter(p)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                planFilter === p
                  ? "bg-charcoal text-white border-charcoal"
                  : "bg-ivory text-warm-brown-light border-sand hover:border-charcoal/30"
              }`}
            >
              {p || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* User detail modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedUser(null)}>
          <div className="bg-ivory rounded-2xl border border-sand/60 p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl text-charcoal">User Details</h3>
              <button onClick={() => setSelectedUser(null)} className="text-muted hover:text-charcoal text-sm">Close</button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-terracotta/15 flex items-center justify-center">
                  <span className="text-terracotta font-bold text-lg">
                    {(selectedUser.name || selectedUser.email).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-charcoal">{selectedUser.name || "—"}</p>
                  <p className="text-sm text-muted">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-cream-dark rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted">Plan</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${PLAN_COLORS[selectedUser.plan]}`}>
                      {selectedUser.plan}
                    </span>
                    <select
                      value={selectedUser.plan}
                      onChange={e => updatePlan(selectedUser.id, e.target.value)}
                      className="text-xs bg-transparent border border-sand/60 rounded px-1 py-0.5 text-muted"
                    >
                      {["free", "starter", "pro", "agency"].map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="bg-cream-dark rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted">Usage</p>
                  <p className="text-lg font-display text-charcoal mt-1">
                    {selectedUser.actualUsage} / {PLAN_LIMITS[selectedUser.plan]?.toLocaleString() ?? "∞"}
                  </p>
                </div>
                <div className="bg-cream-dark rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted">Joined</p>
                  <p className="text-sm text-charcoal mt-1">{formatDate(selectedUser.created_at)}</p>
                </div>
                <div className="bg-cream-dark rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted">Country</p>
                  <p className="text-sm text-charcoal mt-1">{selectedUser.country || "Unknown"}</p>
                </div>
                <div className="bg-cream-dark rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted">MFA</p>
                  <p className="text-sm text-charcoal mt-1">{selectedUser.mfa_verified ? "Verified" : "Not set up"}</p>
                </div>
                <div className="bg-cream-dark rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted">Founder's Space</p>
                  <p className="text-sm text-charcoal mt-1">{selectedUser.fs_access ? "Active" : "No access"}</p>
                </div>
              </div>

              {selectedUser.subscription && (
                <div className="bg-cream-dark rounded-xl p-3 mt-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted">Subscription</p>
                  <p className="text-sm text-charcoal mt-1">
                    {selectedUser.subscription.provider} — {selectedUser.subscription.status}
                  </p>
                  {selectedUser.subscription.current_period_end && (
                    <p className="text-xs text-muted mt-0.5">
                      Renews: {formatDate(selectedUser.subscription.current_period_end)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Users table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-muted" />
        </div>
      ) : users.length === 0 ? (
        <div className="bg-ivory rounded-2xl border border-sand/60 flex flex-col items-center py-20 gap-2">
          <Users size={36} className="text-muted/20" />
          <p className="text-sm text-muted">No users found</p>
        </div>
      ) : (
        <>
          <div className="bg-ivory rounded-2xl border border-sand/60 overflow-hidden">
            {/* Header */}
            <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-5 py-3 border-b border-sand/40 bg-cream-dark/50">
              <span className="text-[10px] font-semibold tracking-widest uppercase text-muted">User</span>
              <span className="text-[10px] font-semibold tracking-widest uppercase text-muted">Plan</span>
              <span className="text-[10px] font-semibold tracking-widest uppercase text-muted">Usage</span>
              <span className="text-[10px] font-semibold tracking-widest uppercase text-muted">Joined</span>
              <span className="text-[10px] font-semibold tracking-widest uppercase text-muted">Status</span>
            </div>
            {/* Rows */}
            <div className="divide-y divide-sand/30">
              {users.map(u => {
                const limit = PLAN_LIMITS[u.plan] ?? 50;
                const pct = u.plan === "agency" ? 0 : Math.min((u.actualUsage / limit) * 100, 100);
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className="w-full sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr] flex flex-col gap-1 px-5 py-3.5 hover:bg-cream-dark/40 transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">{u.name || u.email}</p>
                      <p className="text-xs text-muted truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${PLAN_COLORS[u.plan]}`}>
                        {u.plan}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-charcoal">{u.actualUsage.toLocaleString()}</p>
                      {u.plan !== "agency" && (
                        <div className="w-16 h-1 rounded-full bg-sand mt-1">
                          <div className="h-full rounded-full bg-terracotta" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted">{timeAgo(u.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {u.subscription ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-sage/20 text-accent-sage border border-accent-sage/20">Active</span>
                      ) : u.plan !== "free" ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">No sub</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">Free</span>
                      )}
                      {u.mfa_verified && <Shield size={12} className="text-accent-sage" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 rounded-lg bg-ivory border border-sand/60 flex items-center justify-center text-muted hover:text-charcoal disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-muted">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 rounded-lg bg-ivory border border-sand/60 flex items-center justify-center text-muted hover:text-charcoal disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
