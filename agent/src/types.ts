// Shared types for the SEER Local Agent

export interface IPCMessage {
  id: string;
  type: IPCMessageType;
  payload: unknown;
}

export type IPCMessageType =
  | "task"
  | "cancel"
  | "status"
  | "restore-model"
  | "connect-tool"
  | "invalidate-cache"
  | "ping";

export interface IPCResponse {
  id: string;
  type: IPCResponseType;
  payload: unknown;
}

export type IPCResponseType =
  | "progress"
  | "output"
  | "next-steps"
  | "error"
  | "status"
  | "network-status"
  | "update-available"
  | "pong";

export interface TaskPayload {
  text: string;
  projectName?: string;
  apiKey: string;
  userId: string;
}

export interface ConnectToolPayload {
  tool: AITool;
  mcpUrl: string;
  apiKey: string;
}

export type AITool =
  | "claude-cli"
  | "claude-desktop"
  | "vscode"
  | "codex"
  | "cursor"
  | "windsurf"
  | "antigravity"
  | "lovable";

export interface MCPInstruction {
  model: string;
  mode: string;
  tokens: number;
  instruction: string;
  steps: string[];
}

export interface AgentSession {
  userId: string;
  apiKey: string;
  plan: string;
  email: string;
}

export interface CacheEntry {
  instruction: MCPInstruction;
  createdAt: number;
  ttlMs: number;
}
