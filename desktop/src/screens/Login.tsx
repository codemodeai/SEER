/**
 * Login Screen
 * - Email/password via Supabase auth
 * - Google/GitHub OAuth via system browser (Tauri open_url)
 * - Deep link callback: seer://auth/callback?access_token=...
 */

import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { onOpenUrl, getCurrent as getCurrentDeepLink } from "@tauri-apps/plugin-deep-link";
import { supabase, getApiKey } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

const SEER_BASE = "https://www.seermcp.com";

interface LoginProps {
  onLogin: (session: Session, apiKey: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Handle deep-link callback from OAuth browser flow (PKCE).
  // URL is seer://auth/callback?code=... — we exchange the code for a session.
  useEffect(() => {
    const consumeCallbackUrl = async (raw: string) => {
      const queryIdx = raw.indexOf("?");
      if (queryIdx === -1) return;
      const params = new URLSearchParams(raw.slice(queryIdx + 1));
      const code = params.get("code");
      if (!code) {
        const authError = params.get("error_description") ?? params.get("error");
        if (authError) setError(authError);
        return;
      }

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data.session) { setError(error?.message ?? "Auth failed"); return; }
      await finalizeLogin(data.session);
    };

    let unlisten: (() => void) | null = null;
    (async () => {
      // Cold-start case: the app was launched BY the deep link.
      const initial = await getCurrentDeepLink();
      if (initial && initial.length > 0) await consumeCallbackUrl(initial[0]);

      // Running case: app already open, browser sends us a URL.
      unlisten = await onOpenUrl((urls) => {
        if (urls.length > 0) void consumeCallbackUrl(urls[0]);
      });
    })();

    return () => { if (unlisten) unlisten(); };
  }, []);

  async function finalizeLogin(session: Session) {
    const apiKey = await getApiKey(session.user.id);
    if (!apiKey) { setError("No SEER API key found. Please contact support."); return; }
    onLogin(session, apiKey);
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) await finalizeLogin(data.session);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "github") {
    // Open the Supabase OAuth URL in the system browser.
    // After auth, Supabase redirects to seer://auth/callback which Tauri catches.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: "seer://auth/callback",
        skipBrowserRedirect: true,
      },
    });
    if (error) { setError(error.message); return; }
    if (data.url) await open(data.url);
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>SEER</h1>
        <p style={styles.subtitle}>Master Control Protocol</p>

        <div style={styles.oauthRow}>
          <button style={styles.oauthBtn} onClick={() => handleOAuth("google")}>
            Sign in with Google
          </button>
          <button style={styles.oauthBtn} onClick={() => handleOAuth("github")}>
            Sign in with GitHub
          </button>
        </div>

        <div style={styles.divider}><span>or</span></div>

        <form onSubmit={handleEmailLogin} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={styles.signupLink}>
          No account?{" "}
          <span
            style={styles.link}
            onClick={() => open(`${SEER_BASE}/signup`)}
          >
            Create one at seer.ai
          </span>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0a0a" },
  card: { background: "#111", borderRadius: 16, padding: 40, width: 380, border: "1px solid #222" },
  logo: { color: "#fff", fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: -1 },
  subtitle: { color: "#666", fontSize: 13, marginTop: 4, marginBottom: 32 },
  oauthRow: { display: "flex", gap: 12, marginBottom: 24 },
  oauthBtn: { flex: 1, padding: "10px 0", background: "#1a1a1a", color: "#fff", border: "1px solid #333", borderRadius: 8, cursor: "pointer", fontSize: 13 },
  divider: { textAlign: "center", color: "#444", marginBottom: 24, position: "relative" },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  input: { padding: "10px 14px", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#fff", fontSize: 14 },
  error: { color: "#f87171", fontSize: 13, margin: 0 },
  submitBtn: { padding: "12px 0", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  signupLink: { color: "#666", fontSize: 13, textAlign: "center", marginTop: 24 },
  link: { color: "#6366f1", cursor: "pointer" },
};
