"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { ShieldAlert, ArrowRight, X } from "lucide-react";

export default function MfaBanner() {
  const [show, setShow] = useState(false);
  const [promptCount, setPromptCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function checkMfa() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("users")
        .select("mfa_verified, prompt_count")
        .eq("id", user.id)
        .single();

      if (data && !data.mfa_verified) {
        setShow(true);
        setPromptCount(data.prompt_count ?? 0);
      }
    }
    checkMfa();
  }, []);

  if (!show || dismissed) return null;

  const remaining = Math.max(0, 20 - promptCount);
  const urgent = remaining <= 5;

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 ${
      urgent
        ? "bg-red-50 border-red-200"
        : "bg-amber-50 border-amber-200"
    }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        urgent ? "bg-red-100" : "bg-amber-100"
      }`}>
        <ShieldAlert size={20} className={urgent ? "text-red-600" : "text-amber-600"} />
      </div>

      <div className="flex-1 min-w-0">
        <h3 className={`text-sm font-semibold ${urgent ? "text-red-800" : "text-amber-800"}`}>
          {urgent
            ? `MFA required — only ${remaining} SEER call${remaining !== 1 ? "s" : ""} remaining`
            : "Set up two-factor authentication"
          }
        </h3>
        <p className={`text-xs mt-0.5 ${urgent ? "text-red-600" : "text-amber-600"}`}>
          {promptCount >= 20
            ? "SEER is blocked until you enable MFA. Complete setup to resume."
            : `Secure your account to unlock uninterrupted SEER access. ${promptCount}/20 calls used.`
          }
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
        <Link
          href="/dashboard/security"
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white transition-all ${
            urgent
              ? "bg-red-600 hover:bg-red-700"
              : "bg-amber-600 hover:bg-amber-700"
          }`}
        >
          Enable MFA
          <ArrowRight size={14} />
        </Link>
        {!urgent && (
          <button
            onClick={() => setDismissed(true)}
            className="p-2 rounded-lg text-amber-400 hover:text-amber-600 transition-colors"
            title="Dismiss for now"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
