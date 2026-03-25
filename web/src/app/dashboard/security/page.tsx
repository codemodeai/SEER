"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { Shield, ShieldCheck, Loader2, Copy, Check, AlertTriangle } from "lucide-react";

type Step = "loading" | "status" | "enroll" | "verify" | "done";

export default function SecurityPage() {
  const [step, setStep] = useState<Step>("loading");
  const [mfaVerified, setMfaVerified] = useState(false);
  const [promptCount, setPromptCount] = useState(0);
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchStatus() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("users")
        .select("mfa_verified, prompt_count")
        .eq("id", user.id)
        .single();

      if (data) {
        setMfaVerified(data.mfa_verified ?? false);
        setPromptCount(data.prompt_count ?? 0);
      }
      setStep("status");
    }
    fetchStatus();
  }, []);

  async function handleEnroll() {
    setError("");
    setStep("enroll");

    try {
      const res = await fetch("/api/auth/mfa/enroll", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to start enrollment");
        setStep("status");
        return;
      }

      setFactorId(data.factorId);
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep("verify");
    } catch {
      setError("Network error. Please try again.");
      setStep("status");
    }
  }

  async function handleVerify() {
    if (code.length !== 6) {
      setError("Enter a 6-digit code");
      return;
    }

    setVerifying(true);
    setError("");

    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factorId, code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed");
        setVerifying(false);
        return;
      }

      setMfaVerified(true);
      setStep("done");
    } catch {
      setError("Network error. Please try again.");
    }
    setVerifying(false);
  }

  function copySecret() {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (step === "loading") {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-terracotta/30 border-t-terracotta rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl text-charcoal tracking-tight">
          Security
        </h1>
        <p className="mt-1 text-sm text-muted">
          Protect your SEER account with two-factor authentication.
        </p>
      </div>

      {/* MFA Status Card */}
      <div className={`rounded-2xl border p-4 sm:p-6 ${
        mfaVerified
          ? "bg-emerald-50 border-emerald-200"
          : "bg-ivory border-sand/60"
      }`}>
        <div className="flex items-center gap-3 mb-3">
          {mfaVerified ? (
            <ShieldCheck size={22} className="text-emerald-600" />
          ) : (
            <Shield size={22} className="text-terracotta" />
          )}
          <h2 className="font-display text-lg text-charcoal">
            Two-Factor Authentication (TOTP)
          </h2>
        </div>

        {mfaVerified ? (
          <div>
            <p className="text-sm text-emerald-700">
              MFA is enabled. Your account is protected with an authenticator app.
            </p>
            <p className="text-xs text-emerald-600/70 mt-2">
              SEER will never interrupt your workflow with authentication prompts.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-warm-brown-light">
              MFA is not enabled. Set up an authenticator app to secure your account
              and unlock uninterrupted SEER usage.
            </p>
            {promptCount > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                <AlertTriangle size={14} className="text-amber-500" />
                <span>
                  {promptCount >= 20
                    ? "SEER is blocked until you enable MFA."
                    : `${promptCount}/20 prompts used. SEER will require MFA at 20.`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enroll / Verify Flow */}
      {step === "status" && !mfaVerified && (
        <div className="bg-ivory rounded-2xl border border-sand/60 p-4 sm:p-6">
          <h3 className="font-display text-base text-charcoal mb-3">Set Up Authenticator</h3>
          <p className="text-sm text-muted mb-4">
            Use an app like Google Authenticator, Authy, or 1Password to scan a QR code.
            This is a one-time setup — after enabling, SEER will never ask again.
          </p>
          <button
            onClick={handleEnroll}
            className="px-5 py-2.5 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta/90 transition-all"
          >
            Begin Setup
          </button>
          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        </div>
      )}

      {step === "verify" && (
        <div className="bg-ivory rounded-2xl border border-sand/60 p-4 sm:p-6 space-y-5">
          <div>
            <h3 className="font-display text-base text-charcoal mb-1">
              Step 1 — Scan QR Code
            </h3>
            <p className="text-xs text-muted mb-4">
              Open your authenticator app and scan this QR code.
            </p>
            {qrCode && (
              <div className="flex justify-center">
                <div className="bg-white rounded-xl p-5 border border-sand/40 inline-block">
                  <img
                    src={qrCode}
                    alt="TOTP QR Code"
                    width={250}
                    height={250}
                    className="block"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Manual secret */}
          <div>
            <p className="text-xs text-muted mb-2">
              Can&apos;t scan? Enter this code manually:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-cream-dark border border-sand/50 text-xs text-charcoal font-mono break-all select-all">
                {secret}
              </code>
              <button
                onClick={copySecret}
                className="p-2 rounded-lg border border-sand/50 text-muted hover:text-terracotta hover:border-terracotta/30 transition-all shrink-0"
                title="Copy secret"
              >
                {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          {/* Verify code */}
          <div>
            <h3 className="font-display text-base text-charcoal mb-1">
              Step 2 — Enter Verification Code
            </h3>
            <p className="text-xs text-muted mb-3">
              Enter the 6-digit code from your authenticator app.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(val);
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                placeholder="000000"
                className="w-36 px-4 py-2.5 rounded-xl border border-sand/60 text-center text-lg font-mono tracking-[0.3em] text-charcoal bg-cream placeholder:text-muted/40 focus:outline-none focus:border-terracotta/40"
              />
              <button
                onClick={handleVerify}
                disabled={verifying || code.length !== 6}
                className="px-5 py-2.5 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {verifying ? (
                  <><Loader2 size={14} className="animate-spin" /> Verifying...</>
                ) : (
                  "Verify & Enable"
                )}
              </button>
            </div>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          </div>

          {/* Cancel */}
          <button
            onClick={() => { setStep("status"); setError(""); setCode(""); }}
            className="text-xs text-muted hover:text-charcoal transition-colors"
          >
            Cancel setup
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 sm:p-6 text-center space-y-3">
          <ShieldCheck size={40} className="text-emerald-600 mx-auto" />
          <h3 className="font-display text-xl text-charcoal">MFA Enabled</h3>
          <p className="text-sm text-emerald-700">
            Your account is now protected. SEER will never interrupt your workflow again.
          </p>
        </div>
      )}

      {/* Info section */}
      <div className="bg-ivory rounded-2xl border border-sand/60 p-4 sm:p-6">
        <h3 className="font-display text-base text-charcoal mb-3">How it works</h3>
        <div className="space-y-2 text-sm text-warm-brown-light">
          <p>
            <span className="font-medium text-charcoal">Prompts 1–19:</span>{" "}
            You&apos;ll see a gentle reminder every 5 commands to set up MFA.
          </p>
          <p>
            <span className="font-medium text-charcoal">Prompt 20:</span>{" "}
            SEER pauses until MFA is enabled. This is a one-time gate.
          </p>
          <p>
            <span className="font-medium text-charcoal">After MFA:</span>{" "}
            No more prompts, no more blocks — full uninterrupted access, forever.
          </p>
        </div>
      </div>
    </div>
  );
}
