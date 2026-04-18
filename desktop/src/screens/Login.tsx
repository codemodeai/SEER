/**
 * Login Screen — browser-based "Sign in with SEER" flow.
 *
 *  1. User clicks the button → we open www.seermcp.com/authorize?state=<rand>
 *     in the system browser. If they're not logged in on the website, it
 *     redirects them to /login first, then back to /authorize.
 *  2. After they click "Authorize", the website redirects to
 *     seer://auth/callback#access_token=...&refresh_token=...&state=...
 *  3. Windows hands that URL to this app via tauri-plugin-deep-link.
 *  4. We verify the state, install the session into the Supabase client,
 *     fetch the SEER API key, and log in.
 */

import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { onOpenUrl, getCurrent as getCurrentDeepLink } from "@tauri-apps/plugin-deep-link";
import { supabase, getApiKey } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

// Always point at the production website so an existing prod session works
// even when running the desktop in dev mode.
const SEER_BASE = "https://www.seermcp.com";
const STATE_KEY = "seer.authorize.state";

interface LoginProps {
  onLogin: (session: Session, apiKey: string) => void;
}

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function Login({ onLogin }: LoginProps) {
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  // Clear any stale auth state left over from a previous aborted sign-in.
  useEffect(() => {
    localStorage.removeItem(STATE_KEY);
  }, []);

  useEffect(() => {
    const consumeCallback = async (raw: string) => {
      console.log("[SEER] deep-link callback:", raw);
      // Windows sometimes percent-encodes the `?` to `%3F` when launching a
      // custom-protocol URL. Try the raw string first; if no separator is
      // found, decode once and try again.
      let candidate = raw;
      let sepIdx = candidate.search(/[?#]/);
      if (sepIdx === -1) {
        try { candidate = decodeURIComponent(raw); } catch { /* keep raw */ }
        sepIdx = candidate.search(/[?#]/);
      }
      if (sepIdx === -1) {
        setError(`Empty callback. URL received: ${raw}`);
        setWaiting(false);
        return;
      }
      const params = new URLSearchParams(candidate.slice(sepIdx + 1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const returnedState = params.get("state");
      const expectedState = localStorage.getItem(STATE_KEY);

      if (!accessToken || !refreshToken) {
        setError(params.get("error_description") ?? "Authorization failed");
        setWaiting(false);
        return;
      }

      // State check only fires for desktop-initiated flows (we stored a state).
      // Website-initiated flows (user clicks "Open desktop app" in the nav)
      // have no local state, so we skip the check in that case.
      if (expectedState && returnedState !== expectedState) {
        setError("Authorization state mismatch — please try again");
        setWaiting(false);
        return;
      }
      if (expectedState) localStorage.removeItem(STATE_KEY);

      const { data, error: setErr } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (setErr || !data.session) {
        setError(setErr?.message ?? "Failed to install session");
        setWaiting(false);
        return;
      }

      const apiKey = await getApiKey(data.session.user.id);
      if (!apiKey) {
        setError("No SEER API key found on your account. Please contact support.");
        setWaiting(false);
        return;
      }
      onLogin(data.session, apiKey);
    };

    let unlisten: (() => void) | null = null;
    (async () => {
      // Cold-start: the app was launched BY the deep link.
      const initial = await getCurrentDeepLink();
      if (initial && initial.length > 0) await consumeCallback(initial[0]);

      // Running: app already open, OS delivers the URL.
      unlisten = await onOpenUrl((urls) => {
        if (urls.length > 0) void consumeCallback(urls[0]);
      });
    })();

    return () => { if (unlisten) unlisten(); };
  }, [onLogin]);

  async function handleSignIn() {
    setError(null);
    setWaiting(true);
    const state = randomState();
    localStorage.setItem(STATE_KEY, state);
    const url = `${SEER_BASE}/authorize?state=${encodeURIComponent(state)}`;
    await open(url);
  }

  function handleCancel() {
    localStorage.removeItem(STATE_KEY);
    setWaiting(false);
    setError(null);
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>SEER</h1>
        <p style={styles.subtitle}>Master Control Protocol</p>

        <button style={styles.primaryBtn} onClick={handleSignIn} disabled={waiting}>
          {waiting ? "Waiting for browser…" : "Sign in with SEER"}
        </button>

        {waiting && (
          <>
            <p style={styles.hint}>
              Finish signing in on the website. You'll be sent back here automatically.
            </p>
            <button style={styles.cancelBtn} onClick={handleCancel}>
              Cancel and try again
            </button>
          </>
        )}

        {error && <p style={styles.error}>{error}</p>}

        <p style={styles.signupLink}>
          No account?{" "}
          <span style={styles.link} onClick={() => open(`${SEER_BASE}/signup`)}>
            Create one at seer.ai
          </span>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0a0a" },
  card: { background: "#111", borderRadius: 16, padding: 40, width: 380, border: "1px solid #222", textAlign: "center" },
  logo: { color: "#fff", fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: -1 },
  subtitle: { color: "#666", fontSize: 13, marginTop: 4, marginBottom: 32 },
  primaryBtn: { width: "100%", padding: "14px 0", background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  cancelBtn: { marginTop: 10, background: "transparent", border: "none", color: "#888", fontSize: 12, cursor: "pointer", textDecoration: "underline" },
  hint: { color: "#888", fontSize: 12, lineHeight: 1.6, marginTop: 18, marginBottom: 0 },
  error: { color: "#f87171", fontSize: 13, marginTop: 16, marginBottom: 0 },
  signupLink: { color: "#666", fontSize: 13, marginTop: 28, marginBottom: 0 },
  link: { color: "#6366f1", cursor: "pointer" },
};
