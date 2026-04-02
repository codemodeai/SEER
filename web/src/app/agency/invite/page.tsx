"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import {
  Building2,
  CheckCircle2,
  Loader2,
  XCircle,
  Users,
  ArrowRight,
  LogIn,
} from "lucide-react";
import Link from "next/link";

interface InviteData {
  email: string;
  role: string;
  assignedPlan: string;
  agencyName: string;
  agencySlug: string;
}

export default function InvitePage() {
  return (
    <Suspense>
      <InviteContent />
    </Suspense>
  );
}

function InviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [agencySlug, setAgencySlug] = useState("");

  // Check auth + fetch invite details
  useEffect(() => {
    async function init() {
      if (!token) {
        setError("No invite token provided.");
        setLoading(false);
        return;
      }

      // Check if user is logged in
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser?.email) {
        setUser({ email: authUser.email });
      }

      // Fetch invite details
      try {
        const res = await fetch(`/api/agency/invite?token=${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Invalid invite");
          setLoading(false);
          return;
        }

        setInvite(data.invite);
      } catch {
        setError("Failed to load invite. Please try again.");
      }

      setLoading(false);
    }

    init();
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch("/api/agency/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to accept invite");
        setAccepting(false);
        return;
      }

      setAccepted(true);
      setAgencySlug(data.agencySlug ?? "");
    } catch {
      setError("Network error. Please try again.");
      setAccepting(false);
    }
  }

  // Redirect URL for login — preserves the invite token
  const loginRedirect = `/agency/invite?token=${token}`;
  const loginUrl = `/login?redirect=${encodeURIComponent(loginRedirect)}&email=${encodeURIComponent(invite?.email ?? "")}`;
  const signupUrl = `/signup?redirect=${encodeURIComponent(loginRedirect)}&email=${encodeURIComponent(invite?.email ?? "")}`;

  // Email mismatch check
  const emailMismatch =
    user && invite && user.email.toLowerCase() !== invite.email.toLowerCase();

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-terracotta flex items-center justify-center">
              <span className="text-white font-display font-bold text-lg">S</span>
            </div>
            <span className="font-display text-2xl text-charcoal tracking-tight">
              SEER
            </span>
          </Link>
        </div>

        <div className="bg-ivory border border-sand/60 rounded-2xl p-8 shadow-sm">
          {/* Loading */}
          {loading && (
            <div className="text-center py-8">
              <Loader2 size={24} className="animate-spin text-terracotta mx-auto mb-3" />
              <p className="text-sm text-muted">Loading invite...</p>
            </div>
          )}

          {/* Error (no invite data) */}
          {!loading && error && !invite && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <XCircle size={28} className="text-red-500" />
              </div>
              <h2 className="font-display text-xl text-charcoal mb-2">
                Invite Not Valid
              </h2>
              <p className="text-sm text-muted mb-6">{error}</p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors"
              >
                Go to Login
              </Link>
            </div>
          )}

          {/* Success — invite accepted */}
          {accepted && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={28} className="text-green-500" />
              </div>
              <h2 className="font-display text-xl text-charcoal mb-2">
                Welcome to {invite?.agencyName}!
              </h2>
              <p className="text-sm text-muted mb-6">
                You&apos;ve successfully joined as {invite?.role === "admin" ? "an admin" : "a member"}.
                Your API key and plan are managed by the agency.
              </p>
              <Link
                href={agencySlug ? `/agency/${agencySlug}` : "/dashboard"}
                className="inline-flex items-center gap-2 px-6 py-3 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors"
              >
                <Building2 size={16} />
                Open Agency Dashboard
                <ArrowRight size={14} />
              </Link>
            </div>
          )}

          {/* Invite details — not yet accepted */}
          {!loading && invite && !accepted && (
            <>
              {/* Agency info */}
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-terracotta/10 flex items-center justify-center mx-auto mb-4">
                  <Building2 size={28} className="text-terracotta" />
                </div>
                <h2 className="font-display text-xl text-charcoal mb-1">
                  Agency Invitation
                </h2>
                <p className="text-sm text-muted">
                  You&apos;ve been invited to join
                </p>
              </div>

              {/* Invite card */}
              <div className="bg-cream-dark border border-sand/50 rounded-xl p-4 mb-6">
                <h3 className="font-display text-lg text-charcoal mb-3">
                  {invite.agencyName}
                </h3>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Role</span>
                    <span className="text-charcoal font-medium capitalize flex items-center gap-1.5">
                      <Users size={14} className="text-terracotta" />
                      {invite.role}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Plan</span>
                    <span className="text-charcoal font-medium capitalize">
                      {invite.assignedPlan}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Invited email</span>
                    <span className="text-charcoal font-medium text-xs">
                      {invite.email}
                    </span>
                  </div>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="px-4 py-2.5 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200 mb-4">
                  {error}
                </div>
              )}

              {/* Not logged in */}
              {!user && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted text-center mb-1">
                    Sign in with <strong>{invite.email}</strong> to accept
                  </p>
                  <a
                    href={loginUrl}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors w-full"
                  >
                    <LogIn size={16} />
                    Log In to Accept
                  </a>
                  <p className="text-xs text-muted text-center">
                    Don&apos;t have an account?{" "}
                    <a href={signupUrl} className="text-terracotta hover:underline font-medium">
                      Sign up
                    </a>
                  </p>
                </div>
              )}

              {/* Logged in but email mismatch */}
              {emailMismatch && (
                <div className="flex flex-col gap-3">
                  <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm">
                    <p className="text-amber-800 font-medium mb-1">Email mismatch</p>
                    <p className="text-amber-700 text-xs">
                      You&apos;re logged in as <strong>{user?.email}</strong>, but this invite is for{" "}
                      <strong>{invite.email}</strong>. Please log in with the correct email.
                    </p>
                  </div>
                  <a
                    href={loginUrl}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors w-full"
                  >
                    <LogIn size={16} />
                    Switch Account
                  </a>
                </div>
              )}

              {/* Logged in, email matches — accept button */}
              {user && !emailMismatch && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted text-center mb-1">
                    Signed in as <strong>{user.email}</strong>
                  </p>
                  <button
                    onClick={handleAccept}
                    disabled={accepting}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors w-full disabled:opacity-50"
                  >
                    {accepting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    {accepting ? "Joining..." : "Accept Invitation"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
