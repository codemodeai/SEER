/**
 * SEER Chat Tab — Primary workspace.
 * Natural language input, @mention project resolution, step-by-step progress,
 * output display, and guided next steps. No "seer" prefix needed.
 */

import { useState, useRef, useEffect } from "react";
import { sendToAgent } from "@/lib/agent";
import type { AgentResponse } from "@/lib/agent";

interface Message {
  id: string;
  role: "user" | "agent" | "progress" | "error";
  text: string;
  nextSteps?: string[];
  timestamp: Date;
}

interface SeerChatProps {
  userId: string;
  apiKey: string;
}

export function SeerChat({ userId, apiKey }: SeerChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function parseProjectMention(text: string): { projectName?: string; cleanText: string } {
    const match = /@(\w[\w-]*)/.exec(text);
    if (match) {
      return {
        projectName: match[1],
        cleanText: text.replace(match[0], "").trim(),
      };
    }
    return { cleanText: text };
  }

  function addMessage(msg: Omit<Message, "timestamp">): void {
    setMessages((prev) => [...prev, { ...msg, timestamp: new Date() }]);
  }

  function appendProgress(id: string, text: string): void {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.id === id && last.role === "progress") {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
      }
      return [...prev, { id, role: "progress", text, timestamp: new Date() }];
    });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const raw = input.trim();
    if (!raw || sending) return;

    setInput("");
    setSending(true);

    const { projectName, cleanText } = parseProjectMention(raw);
    const msgId = `task-${Date.now()}`;

    addMessage({ id: msgId + "-user", role: "user", text: raw });

    sendToAgent(
      "task",
      { text: cleanText, projectName, apiKey, userId },
      (res: AgentResponse) => {
        if (res.type === "progress") {
          const { text } = res.payload as { text: string };
          appendProgress(msgId, text);
        } else if (res.type === "output") {
          const { text, nextSteps } = res.payload as { text: string; nextSteps: string[] };
          // Replace progress message with final output
          setMessages((prev) => {
            const filtered = prev.filter((m) => m.id !== msgId);
            return [...filtered, { id: msgId + "-out", role: "agent", text, nextSteps, timestamp: new Date() }];
          });
          setSending(false);
        } else if (res.type === "error") {
          const { message } = res.payload as { message: string };
          setMessages((prev) => {
            const filtered = prev.filter((m) => m.id !== msgId);
            return [...filtered, { id: msgId + "-err", role: "error", text: message, timestamp: new Date() }];
          });
          setSending(false);
        }
      }
    );
  }

  function handleNextStep(step: string) {
    setInput(step);
  }

  return (
    <div style={s.container}>
      <div style={s.messages}>
        {messages.length === 0 && (
          <div style={s.welcome}>
            <h2 style={s.welcomeTitle}>SEER Chat</h2>
            <p style={s.welcomeSub}>Type anything. Use @projectname to load project memory.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} style={{ ...s.bubble, ...bubbleStyle(msg.role) }}>
            {msg.role === "progress" ? (
              <pre style={s.progressText}>{msg.text}</pre>
            ) : (
              <p style={s.msgText}>{msg.text}</p>
            )}

            {msg.nextSteps && msg.nextSteps.length > 0 && (
              <div style={s.nextSteps}>
                <p style={s.nextStepsLabel}>What's next?</p>
                {msg.nextSteps.map((step, i) => (
                  <button key={i} style={s.nextStepBtn} onClick={() => handleNextStep(step)}>
                    {i + 1}. {step}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={s.inputRow}>
        <input
          style={s.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a task or @mention a project…"
          disabled={sending}
          autoFocus
        />
        <button style={s.sendBtn} type="submit" disabled={sending || !input.trim()}>
          {sending ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}

function bubbleStyle(role: Message["role"]): React.CSSProperties {
  switch (role) {
    case "user": return { alignSelf: "flex-end", background: "#3730a3", border: "none" };
    case "agent": return { alignSelf: "flex-start", background: "#111", borderColor: "#222" };
    case "progress": return { alignSelf: "flex-start", background: "#0a0a0a", borderColor: "#1a1a1a" };
    case "error": return { alignSelf: "flex-start", background: "#1a0a0a", borderColor: "#3f1515" };
  }
}

const s: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" },
  messages: { flex: 1, overflowY: "auto", padding: "24px 32px", display: "flex", flexDirection: "column", gap: 16 },
  welcome: { textAlign: "center", marginTop: 80 },
  welcomeTitle: { color: "#fff", fontSize: 24, fontWeight: 700 },
  welcomeSub: { color: "#555", fontSize: 14 },
  bubble: { maxWidth: "80%", padding: "12px 16px", borderRadius: 12, border: "1px solid #333" },
  msgText: { color: "#e5e5e5", fontSize: 14, margin: 0, lineHeight: 1.6 },
  progressText: { color: "#888", fontSize: 12, margin: 0, whiteSpace: "pre-wrap", fontFamily: "monospace" },
  nextSteps: { marginTop: 16, borderTop: "1px solid #222", paddingTop: 12 },
  nextStepsLabel: { color: "#666", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" },
  nextStepBtn: { display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "#1a1a1a", color: "#a5b4fc", border: "1px solid #2d2d2d", borderRadius: 6, cursor: "pointer", fontSize: 13, marginBottom: 4 },
  inputRow: { display: "flex", gap: 10, padding: "16px 32px", borderTop: "1px solid #1a1a1a" },
  input: { flex: 1, padding: "12px 16px", background: "#111", border: "1px solid #2a2a2a", borderRadius: 10, color: "#fff", fontSize: 14 },
  sendBtn: { padding: "12px 24px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600 },
};
