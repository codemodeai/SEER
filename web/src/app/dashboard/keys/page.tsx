"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Copy, Check, RefreshCw, Eye, EyeOff, AlertTriangle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

export default function APIKeysPage() {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);

  useEffect(() => {
    async function fetchKey() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Ensure user record exists
      await fetch("/api/auth/setup-user", { method: "POST" });

      const { data } = await supabase
        .from("users").select("seer_api_key").eq("id", user.id).single();

      if (data) setApiKey(data.seer_api_key);
      setLoading(false);
    }
    fetchKey();
  }, []);

  const maskedKey = apiKey ? `${apiKey.slice(0, 8)}${"•".repeat(Math.max(0, apiKey.length - 8))}` : "";

  function handleCopy() {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl md:text-4xl text-charcoal tracking-tight">API Keys</h1>
        <p className="mt-1 text-sm text-muted">Manage your SEER API key for MCP server authentication.</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-ivory rounded-2xl border border-sand/60 p-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-muted mb-1">SEER API Key</p>
        <p className="text-xs text-muted mb-4">This key identifies your account. It is NOT an Anthropic API key.</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-cream-dark px-4 py-3 rounded-xl font-mono text-sm text-charcoal border border-sand/50 overflow-x-auto">
            {revealed ? apiKey : maskedKey}
          </code>
          <button onClick={() => setRevealed(!revealed)}
            className="p-3 rounded-xl bg-cream-dark border border-sand/50 text-muted hover:text-charcoal transition-colors" title={revealed ? "Hide" : "Reveal"}>
            {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button onClick={handleCopy}
            className="p-3 rounded-xl bg-cream-dark border border-sand/50 text-muted hover:text-charcoal transition-colors" title="Copy">
            {copied ? <Check size={16} className="text-accent-sage" /> : <Copy size={16} />}
          </button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-ivory rounded-2xl border border-sand/60 p-6">
        <h3 className="text-sm font-semibold text-charcoal">Rotate Key</h3>
        <p className="mt-1 text-xs text-muted">
          Generate a new key. The old key will stop working immediately. You&apos;ll need to update all your MCP configurations.
        </p>
        {!showRotateConfirm ? (
          <button onClick={() => setShowRotateConfirm(true)}
            className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-sand/60 text-sm font-medium text-warm-brown-light hover:text-charcoal hover:border-sand transition-all">
            <RefreshCw size={15} /> Rotate API Key
          </button>
        ) : (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Are you sure?</p>
                <p className="text-xs text-red-600 mt-1">Your current key will be invalidated immediately.</p>
                <div className="mt-3 flex items-center gap-2">
                  <button className="px-4 py-2 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors">
                    Yes, rotate key
                  </button>
                  <button onClick={() => setShowRotateConfirm(false)}
                    className="px-4 py-2 rounded-lg bg-white border border-red-200 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
