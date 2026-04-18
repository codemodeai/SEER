"use client";

/**
 * Authorize page — grants the SEER desktop app access to the user's account.
 *
 * Flow:
 *  1. Desktop app opens https://www.seermcp.com/authorize?state=<random>
 *  2. Middleware protects this route — unauthenticated users are bounced to
 *     /login?redirect=/authorize?state=... and sent back here after login.
 *  3. On Authorize click, we bundle the Supabase session into a seer:// URL
 *     and redirect to it — Windows hands the URL to the SEER app.
 */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { Loader2, ShieldCheck, Monitor, ArrowRight, X } from "lucide-react";

type Plan = "free" | "starter" | "pro" | "team" | "agency";

interface UserRow {
  email: string | null;
  name: string;
  plan: Plan;
}

export default function AuthorizePage() {
  return (
    <Suspense>
      <AuthorizeContent />
    </Suspense>
  );
}

function AuthorizeContent() {
  const searchParams = useSearchParams();
  const state = searchParams.get("state") ?? "";

  const [user, setUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorizing, setAuthorizing] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.user) {
        window.location.href = `/login?redirect=${encodeURIComponent(
          `/authorize?state=${encodeURIComponent(state)}`
        )}`;
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("plan")
        .eq("id", session.user.id)
        .single();

      const meta = session.user.user_metadata ?? {};
      setUser({
        email: session.user.email ?? null,
        name:
          (meta.full_name as string) ||
          (meta.name as string) ||
          session.user.email?.split("@")[0] ||
          "your account",
        plan: ((profile?.plan as Plan) ?? "free"),
      });
      setLoading(false);

      // Auto-authorize: the user is already signed in, so hand the session to
      // the desktop app right away. No extra click.
      fireCallback(session);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function fireCallback(session: {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
    token_type?: string;
  }) {
    setAuthorizing(true);
    const params = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: String(session.expires_in ?? 3600),
      token_type: session.token_type ?? "bearer",
      state,
    });
    // Tokens travel in the URL fragment — browsers don't send # to servers.
    window.location.href = `seer://auth/callback#${params.toString()}`;
    // Give the OS a moment to hand the URL to the desktop app.
    setTimeout(() => setSent(true), 600);
  }

  async function handleAuthorize() {
    setError(null);
    const supabase = createClient();
    const { data, error: sessionError } = await supabase.auth.getSession();
    const session = data.session;
    if (sessionError || !session) {
      setError("Session expired. Please log in again.");
      return;
    }
    fireCallback(session);
  }

  function handleDeny() {
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-ivory border border-sand rounded-2xl shadow-sm overflow-hidden">
        <div className="p-8 text-center border-b border-sand/70">
          <div className="w-14 h-14 rounded-2xl bg-terracotta/10 flex items-center justify-center mx-auto mb-5">
            <ShieldCheck size={26} className="text-terracotta" />
          </div>
          <h1 className="font-display text-2xl text-charcoal tracking-tight">
            Authorize SEER Desktop
          </h1>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            Grant the desktop app access to your SEER account so it can run
            local agents on your behalf.
          </p>
        </div>

        <div className="px-8 py-6 space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-cream-dark/50 border border-sand/60">
            <div className="w-9 h-9 rounded-full bg-terracotta text-white text-xs font-semibold flex items-center justify-center">
              {user?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-charcoal truncate">
                {user?.name}
              </p>
              <p className="text-xs text-muted truncate">{user?.email}</p>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-md bg-sand/70 text-charcoal">
              {user?.plan}
            </span>
          </div>

          <div className="text-xs text-muted leading-relaxed">
            <p className="font-medium text-charcoal mb-1.5">SEER Desktop will be able to:</p>
            <ul className="space-y-1">
              <li className="flex gap-2">
                <Monitor size={13} className="text-terracotta mt-0.5 shrink-0" />
                Run Claude agent sessions locally on this machine
              </li>
              <li className="flex gap-2">
                <Monitor size={13} className="text-terracotta mt-0.5 shrink-0" />
                Read and write to your SEER project memory
              </li>
              <li className="flex gap-2">
                <Monitor size={13} className="text-terracotta mt-0.5 shrink-0" />
                Submit usage events against your plan
              </li>
            </ul>
          </div>

          {user?.plan === "free" && (
            <div className="rounded-xl border border-accent-gold/30 bg-accent-gold/10 px-4 py-3 text-xs text-charcoal">
              You're on the <strong>Free</strong> plan. You can authorize the
              app, but some features require a paid plan.{" "}
              <Link href="/pricing" className="text-terracotta font-medium underline">
                View plans
              </Link>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        {sent ? (
          <div className="px-8 pb-8 pt-2 space-y-3 text-center">
            <p className="text-sm text-charcoal">
              Credentials sent to the SEER desktop app.
            </p>
            <p className="text-xs text-muted">
              Didn't open? Make sure SEER Desktop is installed, then{" "}
              <button
                onClick={handleAuthorize}
                className="text-terracotta font-medium underline"
              >
                try again
              </button>{" "}
              or{" "}
              <Link href="/download" className="text-terracotta font-medium underline">
                download it here
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="px-8 pb-8 pt-2 flex gap-3">
            <button
              onClick={handleDeny}
              disabled={authorizing}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full border border-sand hover:bg-cream-dark text-sm font-medium text-charcoal transition-all disabled:opacity-60"
            >
              <X size={15} />
              Cancel
            </button>
            <button
              onClick={handleAuthorize}
              disabled={authorizing}
              className="flex-[1.4] flex items-center justify-center gap-2 py-3 rounded-full bg-terracotta hover:bg-terracotta-dark text-white font-semibold text-sm transition-all shadow-md shadow-terracotta/20 disabled:opacity-60"
            >
              {authorizing ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Sending to SEER...
                </>
              ) : (
                <>
                  Authorize
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
