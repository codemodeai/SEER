"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDashboard } from "@/lib/dashboard-context";
import {
  Key,
  Terminal,
  Rocket,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

const STEPS = [
  { title: "Welcome", icon: Sparkles },
  { title: "API Key", icon: Key },
  { title: "Install", icon: Terminal },
  { title: "Ready!", icon: Rocket },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 hover:text-white text-xs font-medium transition-all"
    >
      {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
    </button>
  );
}

function CodeBlock({ code, highlight }: { code: string; highlight?: boolean }) {
  return (
    <div className={`relative rounded-xl overflow-hidden ${highlight ? "ring-2 ring-terracotta/30" : ""} bg-charcoal`}>
      <div className="absolute top-2 right-2 z-10">
        <CopyButton text={code} />
      </div>
      <pre className="p-4 pr-20 font-mono text-sm text-white/85 leading-relaxed overflow-x-auto whitespace-pre-wrap break-words">
        {code}
      </pre>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { userName, plan, loading, onboardingCompleted } = useDashboard();
  const [step, setStep] = useState(0);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState(true);
  const [completing, setCompleting] = useState(false);

  // Redirect if already completed
  useEffect(() => {
    if (!loading && onboardingCompleted) {
      router.replace("/dashboard");
    }
  }, [loading, onboardingCompleted, router]);

  // Fetch API key
  useEffect(() => {
    async function fetchKey() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const res = await fetch("/api/auth/setup-user", { method: "POST" });
        const data = await res.json();
        setApiKey(data.seerApiKey ?? null);
      } catch {
        // ignore
      } finally {
        setLoadingKey(false);
      }
    }
    fetchKey();
  }, []);

  async function handleComplete() {
    setCompleting(true);
    try {
      await fetch("/api/auth/complete-onboarding", { method: "POST" });
    } catch {
      // continue anyway
    }
    // Full reload so DashboardProvider refetches with onboarding_completed = true
    window.location.href = "/dashboard";
  }

  async function handleSkip() {
    try {
      await fetch("/api/auth/complete-onboarding", { method: "POST" });
    } catch {
      // continue anyway
    }
    window.location.href = "/dashboard";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-terracotta" size={32} />
      </div>
    );
  }

  const installCommand = apiKey
    ? `claude mcp add seer --transport http https://seermcp.com/mcp -H "Authorization: Bearer ${apiKey}"`
    : "Loading...";

  return (
    <div className="max-w-2xl mx-auto py-6">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.title} className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                i <= step
                  ? "bg-terracotta text-white"
                  : "bg-sand/60 text-muted"
              }`}
            >
              {i < step ? <CheckCircle2 size={16} /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i <= step ? "text-charcoal" : "text-muted"}`}>
              {s.title}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 rounded-full ${i < step ? "bg-terracotta" : "bg-sand/60"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-ivory rounded-2xl border border-sand/60 p-6 sm:p-8 min-h-[380px] flex flex-col">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-terracotta/10 flex items-center justify-center">
              <Sparkles size={32} className="text-terracotta" />
            </div>
            <div>
              <h1 className="font-display text-3xl text-charcoal tracking-tight">
                Welcome, {userName}!
              </h1>
              <p className="mt-2 text-muted text-sm max-w-md">
                SEER supercharges your Claude Code with smart prompt optimization,
                project memory, and team collaboration. Let&apos;s get you set up in under 2 minutes.
              </p>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-cream-dark border border-sand/50">
              <span className="text-xs font-semibold tracking-widest uppercase text-muted">Your plan</span>
              <span className="font-display text-lg text-charcoal capitalize">{plan}</span>
            </div>
          </div>
        )}

        {/* Step 1: API Key */}
        {step === 1 && (
          <div className="flex-1 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
                <Key size={20} className="text-terracotta" />
              </div>
              <div>
                <h2 className="font-display text-xl text-charcoal">Your SEER API Key</h2>
                <p className="text-xs text-muted">This key connects Claude Code to SEER</p>
              </div>
            </div>

            {loadingKey ? (
              <div className="flex items-center gap-2 text-muted text-sm">
                <Loader2 size={16} className="animate-spin" /> Loading your key...
              </div>
            ) : apiKey ? (
              <div>
                <CodeBlock code={apiKey} highlight />
                <p className="mt-3 text-xs text-muted">
                  Keep this key private. You can always find it in{" "}
                  <span className="text-terracotta font-medium">Dashboard &gt; API Keys</span>.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">Could not load your API key. Check the API Keys page.</p>
            )}

            <div className="mt-auto p-4 rounded-xl bg-cream-dark border border-sand/50">
              <p className="text-xs font-semibold text-charcoal mb-1">What does the API key do?</p>
              <p className="text-xs text-muted leading-relaxed">
                It authenticates your Claude Code session with SEER&apos;s optimization engine.
                Every <code className="px-1 py-0.5 rounded bg-sand/50 text-charcoal">seer</code> command
                you run uses this key to track usage and apply your plan limits.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Install */}
        {step === 2 && (
          <div className="flex-1 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
                <Terminal size={20} className="text-terracotta" />
              </div>
              <div>
                <h2 className="font-display text-xl text-charcoal">Install SEER in Claude Code</h2>
                <p className="text-xs text-muted">One command — paste this in your terminal</p>
              </div>
            </div>

            <CodeBlock code={installCommand} highlight />

            <div className="space-y-3">
              <p className="text-xs font-semibold text-charcoal">Then try your first command:</p>
              <CodeBlock code='seer build a landing page with hero section and pricing' />
            </div>

            <div className="mt-auto p-4 rounded-xl bg-cream-dark border border-sand/50">
              <p className="text-xs font-semibold text-charcoal mb-1">How it works</p>
              <p className="text-xs text-muted leading-relaxed">
                Every time you type <code className="px-1 py-0.5 rounded bg-sand/50 text-charcoal">seer</code> at
                the start of a message, Claude routes it through SEER&apos;s optimization engine.
                Your prompts get compressed, structured, and enhanced — saving tokens and getting better results.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Ready */}
        {step === 3 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <div>
              <h2 className="font-display text-2xl text-charcoal">You&apos;re all set!</h2>
              <p className="mt-2 text-muted text-sm max-w-md">
                SEER is ready to optimize your Claude Code workflow. Here are some commands to get started:
              </p>
            </div>

            <div className="w-full max-w-md space-y-2 text-left">
              {[
                { cmd: "seer build ...", desc: "Build any feature with optimized prompts" },
                { cmd: "seer optimize ...", desc: "Optimize a prompt for a specific model" },
                { cmd: "seer workflow ...", desc: "Break a goal into executable steps" },
                { cmd: "seer memory run", desc: "Initialize project memory for context" },
                { cmd: "seer continue", desc: "Resume from your last session" },
              ].map((item) => (
                <div key={item.cmd} className="flex items-start gap-3 px-4 py-2.5 rounded-xl bg-cream-dark border border-sand/50">
                  <code className="text-xs font-mono text-terracotta font-semibold whitespace-nowrap mt-0.5">{item.cmd}</code>
                  <span className="text-xs text-muted">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-sand/40">
          <div>
            {step > 0 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted hover:text-charcoal transition-colors"
              >
                <ArrowLeft size={16} /> Back
              </button>
            ) : (
              <button
                onClick={handleSkip}
                className="text-sm text-muted hover:text-charcoal transition-colors"
              >
                Skip setup
              </button>
            )}
          </div>

          <div>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta/90 transition-all"
              >
                Next <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={completing}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta/90 transition-all disabled:opacity-60"
              >
                {completing ? (
                  <><Loader2 size={16} className="animate-spin" /> Finishing...</>
                ) : (
                  <><Rocket size={16} /> Go to Dashboard</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
