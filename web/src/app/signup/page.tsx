"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Mail, Lock, User, ArrowRight } from "lucide-react";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? "free";
  const redirect = searchParams.get("redirect") ?? "";
  const prefillEmail = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect || "/dashboard")}`,
        data: { name, plan },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  async function handleGoogleSignup() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect || "/dashboard")}`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  }

  async function handleGithubSignup() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect || "/dashboard")}`,
      },
    });
  }

  if (success) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent-sage/10 flex items-center justify-center mx-auto mb-6">
            <Mail size={28} className="text-accent-sage" />
          </div>
          <h1 className="font-display text-3xl text-charcoal">
            Check your email
          </h1>
          <p className="mt-3 text-warm-brown-light">
            We sent a confirmation link to{" "}
            <span className="font-medium text-charcoal">{email}</span>. Click it
            to activate your account.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-block text-sm text-terracotta hover:text-terracotta-dark font-medium"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Left side — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-charcoal items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-terracotta/10 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-accent-gold/10 blur-3xl" />
        </div>
        <div className="relative z-10 max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-terracotta flex items-center justify-center">
              <span className="text-white font-display font-bold text-lg">S</span>
            </div>
            <span className="font-display text-2xl text-white tracking-tight">
              SEER
            </span>
          </div>
          <h2 className="font-display text-4xl text-white leading-tight">
            Every prompt,
            <br />
            <span className="text-terracotta-light">perfected.</span>
          </h2>
          <p className="mt-4 text-white/50 leading-relaxed">
            Optimize prompts, generate workflows, inject project memory — all
            before Claude Code starts thinking.
          </p>
          <div className="mt-10 flex items-center gap-4">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-white/10 border-2 border-charcoal"
                />
              ))}
            </div>
            <p className="text-xs text-white/40">
              Join developers saving 40% on tokens
            </p>
          </div>
        </div>
      </div>

      {/* Right side — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-sm w-full">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="w-8 h-8 rounded-lg bg-terracotta flex items-center justify-center">
              <span className="text-white font-display font-bold text-sm">S</span>
            </div>
            <span className="font-display text-xl text-charcoal tracking-tight">
              SEER
            </span>
          </div>

          <h1 className="font-display text-3xl text-charcoal tracking-tight">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-muted">
            Start with 50 free calls. No credit card required.
          </p>

          {plan !== "free" && (
            <div className="mt-4 px-3 py-2 rounded-lg bg-terracotta/8 text-xs font-medium text-terracotta">
              Selected plan: {plan.charAt(0).toUpperCase() + plan.slice(1)}
            </div>
          )}

          {/* OAuth buttons */}
          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={handleGoogleSignup}
              className="flex items-center justify-center gap-3 w-full py-3 rounded-full border border-sand bg-ivory hover:bg-cream-dark text-sm font-medium text-charcoal transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>
            <button
              onClick={handleGithubSignup}
              className="flex items-center justify-center gap-3 w-full py-3 rounded-full border border-sand bg-ivory hover:bg-cream-dark text-sm font-medium text-charcoal transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Continue with GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-sand" />
            <span className="text-xs text-muted">or</span>
            <div className="flex-1 h-px bg-sand" />
          </div>

          {/* Email form */}
          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-charcoal mb-1.5 block">
                Name
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-sand bg-ivory text-sm text-charcoal placeholder:text-muted/60 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/10 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-charcoal mb-1.5 block">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-sand bg-ivory text-sm text-charcoal placeholder:text-muted/60 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/10 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-charcoal mb-1.5 block">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-sand bg-ivory text-sm text-charcoal placeholder:text-muted/60 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/10 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex items-center justify-center gap-2 w-full py-3.5 rounded-full bg-terracotta hover:bg-terracotta-dark text-white font-semibold text-sm transition-all shadow-md shadow-terracotta/20 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Create account
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-terracotta hover:text-terracotta-dark font-medium"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
