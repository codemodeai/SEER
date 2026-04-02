"use client";

import { useAgency } from "@/lib/agency-context";
import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Plus,
  Search,
  User,
  Loader2,
  Crown,
  X,
  Trash2,
  Pencil,
  AlertTriangle,
  Copy,
  Check,
  Key,
} from "lucide-react";

interface AgencyMember {
  user_id: string | null;
  email: string;
  role: string;
  assigned_plan: string;
  usage_this_month: number;
  joined_at: string;
  api_key_masked: string | null;
  has_api_key: boolean;
  status?: "active" | "pending";
  invite_id?: string;
}

// --- Add User Modal ---
function AddUserModal({
  slug,
  onClose,
  onAdded,
}: {
  slug: string;
  onClose: () => void;
  onAdded: (member: AgencyMember) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/agency/${slug}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to invite user");
        setSaving(false);
        return;
      }

      // Show success state
      if (data.emailSent) {
        setInviteSent(true);
      } else if (data.inviteUrl) {
        setInviteUrl(data.inviteUrl);
      }

      onAdded({
        user_id: null,
        email: data.member.email,
        role: data.member.role,
        assigned_plan: data.member.assigned_plan,
        usage_this_month: 0,
        joined_at: new Date().toISOString(),
        api_key_masked: null,
        has_api_key: false,
        status: "pending",
      });

      // Auto-close after email sent
      if (data.emailSent) {
        setTimeout(onClose, 2000);
      }
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  function handleCopyLink() {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-ivory border border-sand/60 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-charcoal">
            {inviteSent || inviteUrl ? "Invite Sent" : "Invite User"}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-charcoal transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Success: email sent */}
        {inviteSent && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center mx-auto mb-3">
              <Check size={24} className="text-green-500" />
            </div>
            <p className="text-sm text-charcoal font-medium">Invite sent to {email}</p>
            <p className="text-xs text-muted mt-1">They&apos;ll receive an email with a link to join.</p>
          </div>
        )}

        {/* Success: no email service — show link to copy */}
        {inviteUrl && (
          <div className="flex flex-col gap-3 py-2">
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
                <Key size={24} className="text-amber-500" />
              </div>
              <p className="text-sm text-charcoal font-medium mb-1">Invite created for {email}</p>
              <p className="text-xs text-muted">Email service not configured. Share this link manually:</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inviteUrl}
                readOnly
                className="flex-1 px-3 py-2 rounded-xl border border-sand/60 bg-cream-dark text-xs text-muted font-mono truncate"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-2 bg-terracotta text-white rounded-xl text-xs font-medium hover:bg-terracotta/90 transition-colors flex items-center gap-1.5"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {/* Invite form — only show if not yet submitted */}
        {!inviteSent && !inviteUrl && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-semibold tracking-widest uppercase text-muted mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              className="w-full px-4 py-2.5 rounded-xl border border-sand/60 bg-white text-sm text-charcoal placeholder:text-muted focus:outline-none focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10 transition-all"
            />
            <p className="text-[10px] text-muted mt-1">Works with any email — no existing account needed.</p>
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-semibold tracking-widest uppercase text-muted mb-1.5">
              Role
            </label>
            <div className="flex gap-2">
              {(["member", "admin"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                    role === r
                      ? "bg-terracotta/10 border-terracotta/40 text-terracotta"
                      : "bg-white border-sand/60 text-muted hover:border-sand"
                  }`}
                >
                  {r === "admin" ? "Admin" : "Member"}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-2.5 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {saving ? "Sending..." : "Send Invite"}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}

// --- Edit User Modal ---
function EditUserModal({
  slug,
  member,
  onClose,
  onUpdated,
}: {
  slug: string;
  member: AgencyMember;
  onClose: () => void;
  onUpdated: (userId: string | null, role: string) => void;
}) {
  const [role, setRole] = useState(member.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/agency/${slug}/users`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: member.user_id,
          role,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update user");
        setSaving(false);
        return;
      }

      onUpdated(member.user_id, role);
      onClose();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-ivory border border-sand/60 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-charcoal">Edit User</h2>
          <button onClick={onClose} className="text-muted hover:text-charcoal transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-5 px-3 py-2.5 bg-cream-dark rounded-xl">
          <div className="w-8 h-8 rounded-full bg-terracotta/15 flex items-center justify-center">
            <span className="text-terracotta font-semibold text-xs">
              {member.email.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-sm text-charcoal font-medium">{member.email}</span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Role */}
          <div>
            <label className="block text-xs font-semibold tracking-widest uppercase text-muted mb-1.5">
              Role
            </label>
            <div className="flex gap-2">
              {(["member", "admin"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                    role === r
                      ? "bg-terracotta/10 border-terracotta/40 text-terracotta"
                      : "bg-white border-sand/60 text-muted hover:border-sand"
                  }`}
                >
                  {r === "admin" ? "Admin" : "Member"}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-2.5 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Pencil size={16} />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- Remove Confirmation Modal ---
function RemoveUserModal({
  slug,
  member,
  onClose,
  onRemoved,
}: {
  slug: string;
  member: AgencyMember;
  onClose: () => void;
  onRemoved: (userId: string | null) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");

  async function handleRemove() {
    setRemoving(true);
    setError("");

    try {
      const res = await fetch(
        `/api/agency/${slug}/users?user_id=${member.user_id}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to remove user");
        setRemoving(false);
        return;
      }

      onRemoved(member.user_id);
      onClose();
    } catch {
      setError("Network error. Please try again.");
      setRemoving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-ivory border border-sand/60 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div>
            <h2 className="font-display text-xl text-charcoal">Remove User</h2>
            <p className="text-xs text-muted">This action cannot be undone.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-5 px-3 py-2.5 bg-cream-dark rounded-xl">
          <div className="w-8 h-8 rounded-full bg-terracotta/15 flex items-center justify-center">
            <span className="text-terracotta font-semibold text-xs">
              {member.email.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <span className="text-sm text-charcoal font-medium">{member.email}</span>
            <span className="text-xs text-muted ml-2 capitalize">{member.role}</span>
          </div>
        </div>

        <p className="text-sm text-muted mb-5">
          This will remove <strong className="text-charcoal">{member.email}</strong> from the agency.
          They will lose access to the agency portal immediately.
        </p>

        {error && (
          <div className="px-4 py-2.5 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200 mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-cream-dark border border-sand/60 text-charcoal rounded-xl text-sm font-medium hover:bg-sand/30 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {removing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {removing ? "Removing..." : "Remove User"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---
export default function AgencyUsersPage() {
  const { agency, role } = useAgency();
  const [members, setMembers] = useState<AgencyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal state
  const [showAdd, setShowAdd] = useState(false);
  const [editMember, setEditMember] = useState<AgencyMember | null>(null);
  const [removeMember, setRemoveMember] = useState<AgencyMember | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const canManage = role === "owner" || role === "admin";

  function handleCopyKey(masked: string) {
    navigator.clipboard.writeText(masked);
    setCopiedKey(masked);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  const fetchMembers = useCallback(async () => {
    if (!agency) return;
    try {
      const res = await fetch(`/api/agency/${agency.slug}/users`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch members:", err);
    } finally {
      setLoading(false);
    }
  }, [agency]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  if (!agency) return null;

  const filtered = members.filter((m) =>
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  function handleAdded(member: AgencyMember) {
    setMembers((prev) => [...prev, member]);
  }

  function handleUpdated(userId: string | null, newRole: string) {
    if (!userId) return;
    setMembers((prev) =>
      prev.map((m) =>
        m.user_id === userId ? { ...m, role: newRole } : m
      )
    );
  }

  function handleRemoved(userId: string | null) {
    if (!userId) return;
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
  }

  return (
    <div>
      {/* Modals */}
      {showAdd && (
        <AddUserModal slug={agency.slug} onClose={() => setShowAdd(false)} onAdded={handleAdded} />
      )}
      {editMember && (
        <EditUserModal
          slug={agency.slug}
          member={editMember}
          onClose={() => setEditMember(null)}
          onUpdated={handleUpdated}
        />
      )}
      {removeMember && (
        <RemoveUserModal
          slug={agency.slug}
          member={removeMember}
          onClose={() => setRemoveMember(null)}
          onRemoved={handleRemoved}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl text-charcoal">Users</h1>
          <p className="text-muted text-sm mt-1">
            {members.length} of {agency.maxUsers} seats used
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors"
          >
            <Plus size={16} />
            Add User
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="text"
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 pl-10 pr-4 py-2.5 rounded-xl border border-sand/60 bg-ivory text-sm text-charcoal placeholder:text-muted focus:outline-none focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10 transition-all"
        />
      </div>

      {/* Members table */}
      <div className="bg-ivory border border-sand/60 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-muted" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Users size={32} className="text-muted mx-auto mb-3" />
            <p className="text-sm text-muted">
              {search
                ? "No users match your search."
                : "No users yet. Add your first team member."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sand/60">
                  <th className="text-left px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-muted">
                    User
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-muted">
                    Role
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-muted">
                    Plan
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-muted">
                    Usage
                  </th>
                  {canManage && (
                    <th className="text-left px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-muted">
                      API Key
                    </th>
                  )}
                  <th className="text-left px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-muted">
                    Joined
                  </th>
                  {canManage && (
                    <th className="text-right px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-muted">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => (
                  <tr
                    key={member.user_id}
                    className="border-b border-sand/30 last:border-b-0 hover:bg-cream-dark/50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          member.status === "pending" ? "bg-amber-100" : "bg-terracotta/15"
                        }`}>
                          <span className={`font-semibold text-xs ${
                            member.status === "pending" ? "text-amber-600" : "text-terracotta"
                          }`}>
                            {member.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-charcoal font-medium truncate max-w-[200px]">
                            {member.email}
                          </span>
                          {member.status === "pending" && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 flex-shrink-0">
                              Invited
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                          member.role === "admin"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-blue-500/15 text-blue-400 border border-blue-500/25"
                        }`}
                      >
                        {member.role === "admin" ? (
                          <Crown size={10} />
                        ) : (
                          <User size={10} />
                        )}
                        {member.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                        Unlimited
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted">
                      {member.usage_this_month} calls
                    </td>
                    {canManage && (
                      <td className="px-5 py-3.5">
                        {member.api_key_masked ? (
                          <div className="flex items-center gap-1.5">
                            <code className="text-[11px] text-muted font-mono bg-cream-dark px-2 py-0.5 rounded">
                              {member.api_key_masked}
                            </code>
                            <button
                              onClick={() => handleCopyKey(member.api_key_masked!)}
                              className="w-6 h-6 rounded flex items-center justify-center text-muted hover:text-terracotta transition-colors"
                              title="Copy masked key"
                            >
                              {copiedKey === member.api_key_masked ? (
                                <Check size={12} className="text-accent-sage" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted/50 italic">No key</span>
                        )}
                      </td>
                    )}
                    <td className="px-5 py-3.5 text-muted">
                      {new Date(member.joined_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    {canManage && (
                      <td className="px-5 py-3.5 text-right">
                        {member.status === "pending" ? (
                          <span className="text-[10px] text-muted italic">Awaiting response</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditMember(member)}
                              className="text-xs text-terracotta hover:text-terracotta/70 font-medium transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setRemoveMember(member)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
