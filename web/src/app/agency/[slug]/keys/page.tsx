"use client";

import { useAgency } from "@/lib/agency-context";
import { useEffect, useState, useCallback } from "react";
import {
  Key,
  RefreshCw,
  Trash2,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  Shield,
} from "lucide-react";

interface MemberKey {
  user_id: string;
  email: string;
  role: string;
  api_key_masked: string | null;
  has_api_key: boolean;
}

export default function AgencyKeysPage() {
  const { agency, role } = useAgency();
  const [members, setMembers] = useState<MemberKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    userId: string;
    email: string;
    action: "regenerate" | "revoke";
  } | null>(null);

  const canManage = role === "owner" || role === "admin";

  const fetchMembers = useCallback(async () => {
    if (!agency) return;
    try {
      const res = await fetch(`/api/agency/${agency.slug}/users`);
      if (res.ok) {
        const data = await res.json();
        setMembers(
          (data.members ?? []).map((m: any) => ({
            user_id: m.user_id,
            email: m.email,
            role: m.role,
            api_key_masked: m.api_key_masked,
            has_api_key: m.has_api_key,
          }))
        );
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

  function handleCopy(masked: string) {
    navigator.clipboard.writeText(masked);
    setCopiedKey(masked);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function handleKeyAction(userId: string, action: "regenerate" | "revoke") {
    setActionLoading(userId);
    setConfirmAction(null);

    try {
      const res = await fetch(`/api/agency/${agency!.slug}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, action }),
      });

      if (res.ok) {
        const data = await res.json();
        setMembers((prev) =>
          prev.map((m) =>
            m.user_id === userId
              ? {
                  ...m,
                  api_key_masked: action === "revoke" ? null : data.api_key_masked ?? m.api_key_masked,
                  has_api_key: action !== "revoke",
                }
              : m
          )
        );
      }
    } catch (err) {
      console.error("Key action error:", err);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div>
      {/* Confirm modal */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="bg-ivory border border-sand/60 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  confirmAction.action === "revoke"
                    ? "bg-red-100"
                    : "bg-amber-100"
                }`}
              >
                {confirmAction.action === "revoke" ? (
                  <Trash2 size={20} className="text-red-600" />
                ) : (
                  <RefreshCw size={20} className="text-amber-600" />
                )}
              </div>
              <div>
                <h2 className="font-display text-xl text-charcoal">
                  {confirmAction.action === "revoke" ? "Revoke API Key" : "Regenerate API Key"}
                </h2>
                <p className="text-xs text-muted">This cannot be undone.</p>
              </div>
            </div>

            <p className="text-sm text-muted mb-5">
              {confirmAction.action === "revoke" ? (
                <>
                  This will permanently revoke the API key for{" "}
                  <strong className="text-charcoal">{confirmAction.email}</strong>. They will no
                  longer be able to use SEER until a new key is generated.
                </>
              ) : (
                <>
                  This will generate a new API key for{" "}
                  <strong className="text-charcoal">{confirmAction.email}</strong>. Their current
                  key will stop working immediately.
                </>
              )}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 px-4 py-2.5 bg-cream-dark border border-sand/60 text-charcoal rounded-xl text-sm font-medium hover:bg-sand/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleKeyAction(confirmAction.userId, confirmAction.action)
                }
                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-medium transition-colors ${
                  confirmAction.action === "revoke"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {confirmAction.action === "revoke" ? "Revoke Key" : "Regenerate Key"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl text-charcoal">API Keys</h1>
        <p className="text-muted text-sm mt-1">
          Manage API keys for all agency members. Each member gets a unique SEER API key.
        </p>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
        <Shield size={16} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700">
          API keys are shown masked for security. Only regenerate or revoke keys when necessary.
          Revoking a key immediately blocks the member from using SEER.
        </p>
      </div>

      {/* Keys table */}
      <div className="bg-ivory border border-sand/60 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-muted" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-16">
            <Key size={32} className="text-muted mx-auto mb-3" />
            <p className="text-sm text-muted">No members yet. Add users to manage their API keys.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sand/60">
                  <th className="text-left px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-muted">
                    Member
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-muted">
                    Role
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-muted">
                    API Key
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-muted">
                    Status
                  </th>
                  {canManage && (
                    <th className="text-right px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-muted">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr
                    key={member.user_id}
                    className="border-b border-sand/30 last:border-b-0 hover:bg-cream-dark/50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-terracotta/15 flex items-center justify-center">
                          <span className="text-terracotta font-semibold text-xs">
                            {member.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-charcoal font-medium truncate max-w-[200px]">
                          {member.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="capitalize text-muted text-xs">{member.role}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {member.api_key_masked ? (
                        <div className="flex items-center gap-1.5">
                          <code className="text-[11px] text-muted font-mono bg-cream-dark px-2 py-0.5 rounded">
                            {member.api_key_masked}
                          </code>
                          <button
                            onClick={() => handleCopy(member.api_key_masked!)}
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
                        <span className="text-[11px] text-muted/50 italic">No key assigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {member.has_api_key ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-green-100 text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-100 text-red-600">
                          Revoked
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {actionLoading === member.user_id ? (
                            <Loader2 size={14} className="animate-spin text-muted" />
                          ) : (
                            <>
                              <button
                                onClick={() =>
                                  setConfirmAction({
                                    userId: member.user_id,
                                    email: member.email,
                                    action: "regenerate",
                                  })
                                }
                                className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
                                title="Regenerate API key"
                              >
                                <RefreshCw size={12} />
                                Regenerate
                              </button>
                              {member.has_api_key && (
                                <button
                                  onClick={() =>
                                    setConfirmAction({
                                      userId: member.user_id,
                                      email: member.email,
                                      action: "revoke",
                                    })
                                  }
                                  className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                                  title="Revoke API key"
                                >
                                  <Trash2 size={12} />
                                  Revoke
                                </button>
                              )}
                            </>
                          )}
                        </div>
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
