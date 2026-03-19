// ─── User ────────────────────────────────────────────
export interface User {
  id: string;
  telegramId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

// ─── Workspace ───────────────────────────────────────
export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export type WorkspaceRole = "owner" | "editor" | "viewer";

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user?: User;
}

// ─── Project ─────────────────────────────────────────
export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  language: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── File ────────────────────────────────────────────
export interface ProjectFile {
  id: string;
  projectId: string;
  path: string;
  content: string;
  language: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileVersion {
  id: string;
  fileId: string;
  content: string;
  version: number;
  createdById: string;
  createdAt: string;
}

// ─── Chat ────────────────────────────────────────────
export type MessageRole = "user" | "assistant" | "system";

export interface ChatThread {
  id: string;
  projectId: string;
  title: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  role: MessageRole;
  content: string;
  thinking: string | null;
  createdAt: string;
}

// ─── Patches ─────────────────────────────────────────
export type PatchStatus = "pending" | "approved" | "rejected" | "applied";
export type PatchAction = "create" | "modify" | "delete";

export interface PatchProposal {
  id: string;
  projectId: string;
  threadId: string;
  messageId: string;
  title: string;
  status: PatchStatus;
  createdAt: string;
  createdById: string;
  changes?: PatchFileChange[];
}

export interface PatchFileChange {
  id: string;
  patchId: string;
  fileId: string | null;
  filePath: string;
  action: PatchAction;
  diff: string;
  newContent: string;
}

// ─── Activity ────────────────────────────────────────
export type ActivityType =
  | "message_sent"
  | "file_created"
  | "file_updated"
  | "patch_proposed"
  | "patch_approved"
  | "patch_rejected"
  | "patch_applied"
  | "member_joined";

export interface ActivityEvent {
  id: string;
  workspaceId: string;
  projectId: string | null;
  userId: string;
  type: ActivityType;
  metadata: Record<string, unknown>;
  createdAt: string;
  user?: User;
}

// ─── SSE ─────────────────────────────────────────────
export type SSEEventType = "delta" | "thinking" | "patch" | "done" | "error";

export interface SSEEvent {
  type: SSEEventType;
  data: string;
}

// ─── API ─────────────────────────────────────────────
export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface UsageRecord {
  id: string;
  userId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  createdAt: string;
}

// ─── AI Provider ─────────────────────────────────────
export type AIProvider = "openai" | "anthropic";

export interface AIConfig {
  provider: AIProvider;
  model: string;
  maxTokens: number;
}
