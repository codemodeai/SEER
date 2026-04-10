"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, ArrowRight, Terminal, Loader2 } from "lucide-react";

const DEMO_API = "/api/demo";
const MAX_DEMOS = 2;
const STORAGE_KEY = "seer_demo_usage";

interface DemoResult {
  optimized: string;
  steps: string[];
  note: string;
  tokens: { before: number; after: number; saved: number; pct: number };
  remaining: number;
}

type Phase =
  | "idle"
  | "optimizing"
  | "typing-output"
  | "showing-steps"
  | "done"
  | "limit-reached";

function getUsage(): number {
  if (typeof window === "undefined") return 0;
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const now = Date.now();
    if (data.resetAt && now > data.resetAt) return 0;
    return data.count || 0;
  } catch {
    return 0;
  }
}

function incrementUsage() {
  const now = Date.now();
  const resetAt = now + 24 * 60 * 60 * 1000;
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (data.resetAt && now > data.resetAt) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: 1, resetAt }));
    } else {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ count: (data.count || 0) + 1, resetAt: data.resetAt || resetAt })
      );
    }
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: 1, resetAt }));
  }
}

export default function TerminalDemo() {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<DemoResult | null>(null);
  const [displayedOptimized, setDisplayedOptimized] = useState("");
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [error, setError] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [usageCount, setUsageCount] = useState(0);
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUsageCount(getUsage());
  }, []);

  const scrollToBottom = () => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  };

  useEffect(scrollToBottom, [phase, displayedOptimized, visibleSteps]);

  // Typing animation for optimized prompt
  useEffect(() => {
    if (phase !== "typing-output" || !result) return;
    const text = result.optimized;
    let i = 0;
    setDisplayedOptimized("");
    const interval = setInterval(() => {
      i++;
      setDisplayedOptimized(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setTimeout(() => setPhase("showing-steps"), 300);
      }
    }, 20);
    return () => clearInterval(interval);
  }, [phase, result]);

  // Step-by-step reveal
  useEffect(() => {
    if (phase !== "showing-steps" || !result) return;
    setVisibleSteps(0);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setVisibleSteps(step);
      if (step >= result.steps.length) {
        clearInterval(interval);
        setTimeout(() => setPhase("done"), 400);
      }
    }, 350);
    return () => clearInterval(interval);
  }, [phase, result]);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || phase !== "idle") return;

    if (usageCount >= MAX_DEMOS) {
      setPhase("limit-reached");
      return;
    }

    setError("");
    setResult(null);
    setDisplayedOptimized("");
    setVisibleSteps(0);
    setSubmittedPrompt(trimmed);
    setPhase("optimizing");

    try {
      const res = await fetch(DEMO_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "demo_limit") {
          incrementUsage();
          setUsageCount(MAX_DEMOS);
          setPhase("limit-reached");
          return;
        }
        throw new Error(data.error || "Request failed");
      }

      setResult(data);
      incrementUsage();
      setUsageCount((prev) => prev + 1);

      // Pause on "optimizing" for 1s then start typing
      setTimeout(() => setPhase("typing-output"), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("idle");
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleReset = () => {
    setPhase("idle");
    setInput("");
    setResult(null);
    setDisplayedOptimized("");
    setVisibleSteps(0);
    setError("");
    setSubmittedPrompt("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const isActive = phase !== "idle" && phase !== "limit-reached";

  return (
    <section className="relative py-20 px-6">
      <div className="max-w-[80vw] mx-auto">
        {/* Instructions */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="font-display text-3xl md:text-4xl text-charcoal mb-3">
            Try SEER — <span className="text-terracotta">live</span>
          </h2>
          <p className="text-warm-brown-light text-base md:text-lg max-w-xl mx-auto">
            Type any prompt below and watch SEER optimize it in real-time.{" "}
            <span className="text-muted text-sm">
              ({MAX_DEMOS - usageCount} of {MAX_DEMOS} free demos remaining)
            </span>
          </p>
        </motion.div>

        {/* Terminal */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="relative rounded-2xl overflow-hidden bg-charcoal shadow-2xl shadow-charcoal/20 border border-charcoal-light/30">
            {/* Title bar */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-red-400/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
              <div className="w-3 h-3 rounded-full bg-green-400/70" />
              <span className="ml-3 text-[11px] text-white/30 font-mono flex items-center gap-1.5">
                <Terminal size={11} />
                claude-code — seer demo
              </span>
            </div>

            {/* Terminal body */}
            <div
              ref={terminalRef}
              className="p-6 font-mono text-sm leading-relaxed min-h-[280px] max-h-[520px] overflow-y-auto"
            >
              {/* Input line */}
              {phase === "idle" && (
                <div className="flex items-center gap-2">
                  <span className="text-accent-sage shrink-0">$</span>
                  <span className="text-white/40 shrink-0">seer</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder="type your prompt here..."
                    maxLength={500}
                    className="flex-1 bg-transparent text-white/90 placeholder-white/20 outline-none caret-terracotta"
                    autoFocus
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={!input.trim()}
                    className="text-white/30 hover:text-terracotta transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}

              {/* Submitted prompt (shown during/after processing) */}
              {isActive && (
                <div className="text-white/40">
                  <span className="text-accent-sage">$</span> seer {submittedPrompt}
                </div>
              )}

              {/* Optimizing phase */}
              {isActive && (
                <motion.div
                  className="mt-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="text-white/60 flex items-center gap-2">
                    <span className="text-terracotta-light">SEER</span>
                    <span className="text-white/30">|</span>
                    {phase === "optimizing" ? (
                      <>
                        <Loader2 size={13} className="animate-spin text-terracotta-light" />
                        <span>Optimizing prompt...</span>
                      </>
                    ) : (
                      <span>Prompt optimized ✓</span>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Token stats */}
              {result && phase !== "optimizing" && (
                <motion.div
                  className="mt-1 text-white/60"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <span className="text-terracotta-light">SEER</span>{" "}
                  <span className="text-white/30">|</span> Tokens:{" "}
                  <span className="text-white/80">
                    {result.tokens.before} → {result.tokens.after}
                  </span>{" "}
                  <span className="text-accent-sage">(-{result.tokens.pct}%)</span>
                </motion.div>
              )}

              {/* Separator */}
              {result && phase !== "optimizing" && (
                <div className="mt-3 text-white/15">
                  {"─".repeat(50)}
                </div>
              )}

              {/* Optimized output with typing animation */}
              {(phase === "typing-output" || phase === "showing-steps" || phase === "done") && (
                <motion.div
                  className="mt-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-accent-gold text-xs uppercase tracking-wider">
                        Optimized Prompt
                      </span>
                      <p className="mt-1 text-white/90">
                        {displayedOptimized}
                        {phase === "typing-output" && (
                          <span className="inline-block w-[2px] h-4 bg-terracotta ml-0.5 animate-pulse align-middle" />
                        )}
                      </p>
                    </div>
                    {phase === "done" && result && (
                      <button
                        onClick={() => handleCopy(result.optimized, "optimized")}
                        className="shrink-0 mt-5 text-white/30 hover:text-white/70 transition-colors"
                        title="Copy optimized prompt"
                      >
                        {copiedField === "optimized" ? (
                          <Check size={14} className="text-accent-sage" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Workflow steps */}
              {(phase === "showing-steps" || phase === "done") &&
                result &&
                visibleSteps > 0 && (
                  <motion.div
                    className="mt-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-accent-gold text-xs uppercase tracking-wider">
                        Workflow — {result.steps.length} steps
                      </span>
                      {phase === "done" && (
                        <button
                          onClick={() =>
                            handleCopy(
                              result.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
                              "steps"
                            )
                          }
                          className="text-white/30 hover:text-white/70 transition-colors"
                          title="Copy workflow"
                        >
                          {copiedField === "steps" ? (
                            <Check size={14} className="text-accent-sage" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      )}
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {result.steps.slice(0, visibleSteps).map((step, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25 }}
                          className="flex items-start gap-2"
                        >
                          <span className="text-terracotta-light shrink-0 text-xs mt-0.5">
                            {i + 1}.
                          </span>
                          <span className="text-white/70">{step}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

              {/* Note */}
              {phase === "done" && result?.note && (
                <motion.div
                  className="mt-4 text-white/40 text-xs italic"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  💡 {result.note}
                </motion.div>
              )}

              {/* Done actions */}
              {phase === "done" && (
                <motion.div
                  className="mt-5 flex items-center gap-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {usageCount < MAX_DEMOS ? (
                    <button
                      onClick={handleReset}
                      className="text-xs text-white/40 hover:text-white/70 transition-colors border border-white/10 px-3 py-1.5 rounded-lg hover:border-white/20"
                    >
                      Try another prompt
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-white/40 text-xs">
                        Demo limit reached
                      </span>
                      <a
                        href="#pricing"
                        className="inline-flex items-center gap-1.5 text-xs bg-terracotta hover:bg-terracotta-dark text-white px-4 py-1.5 rounded-lg transition-colors font-medium"
                      >
                        Try Free in Claude
                        <ArrowRight size={12} />
                      </a>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Limit reached (before any call) */}
              <AnimatePresence>
                {phase === "limit-reached" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4"
                  >
                    <div className="text-white/50 mb-4">
                      <span className="text-terracotta-light">SEER</span>{" "}
                      <span className="text-white/30">|</span> You&apos;ve used all{" "}
                      {MAX_DEMOS} demo prompts. Sign up to get 50 free calls/month!
                    </div>
                    <a
                      href="#pricing"
                      className="inline-flex items-center gap-2 bg-terracotta hover:bg-terracotta-dark text-white px-5 py-2.5 rounded-lg transition-colors font-medium text-sm"
                    >
                      Try Free in Claude — 50 calls/mo
                      <ArrowRight size={14} />
                    </a>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error */}
              {error && (
                <motion.div
                  className="mt-3 text-red-400/80 text-xs"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  Error: {error}
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
