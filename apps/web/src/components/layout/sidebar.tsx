"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useWorkspaceStore } from "@/stores/workspace";
import { useChatStore } from "@/stores/chat";
import { useAuthStore } from "@/stores/auth";

type Mode = "chats" | "projects";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [mode, setMode] = useState<Mode>("chats");
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { projects, activeWorkspace, ensureDefaultProject, createProject } = useWorkspaceStore();
  const { threads, ensureDefaultThread } = useChatStore();
  const user = useAuthStore((s) => s.user);

  const navigate = (path: string) => {
    router.push(path);
    onNavigate?.();
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      if (mode === "chats") {
        const project = await ensureDefaultProject();
        if (!project) return;
        const thread = await ensureDefaultThread(project.id);
        navigate(`/chat/${thread.id}`);
      } else {
        if (!activeWorkspace) return;
        const project = await createProject(activeWorkspace.id, {
          name: `Project ${projects.length + 1}`,
          language: "typescript",
        });
        navigate(`/project/${project.id}`);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <svg viewBox="0 0 32 32" fill="none" className="h-6 w-6 flex-shrink-0">
          <path d="M6 24L16 4L26 24H6Z" stroke="#f97316" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
          <path d="M11 18H21" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
          <path d="M13 22H19" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="text-lg font-bold">
          Manti<span className="text-accent">code</span>
        </span>
      </div>

      {/* Mode toggle */}
      <div className="mx-4 mb-3 flex rounded-xl bg-bg-tertiary p-1">
        {(["chats", "projects"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-medium transition-all",
              mode === m
                ? "bg-surface-elevated text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            {m === "chats" ? "Chats" : "Projects"}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="scrollbar-hide flex-1 overflow-y-auto px-2">
        {mode === "chats" ? (
          threads.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs text-text-tertiary">No chats yet</p>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/chat/${t.id}`)}
                className={cn(
                  "mb-0.5 flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition-colors",
                  pathname === `/chat/${t.id}` ? "bg-accent-soft" : "hover:bg-white/[0.03]",
                )}
              >
                <span className="truncate text-sm text-text-primary">{t.title}</span>
                <span className="mt-0.5 text-[10px] text-text-tertiary">
                  {t.messageCount ?? 0} messages
                </span>
              </button>
            ))
          )
        ) : projects.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-text-tertiary">No projects yet</p>
        ) : (
          projects.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/project/${p.id}`)}
              className={cn(
                "mb-0.5 flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition-colors",
                pathname === `/project/${p.id}` ? "bg-accent-soft" : "hover:bg-white/[0.03]",
              )}
            >
              <span className="truncate text-sm text-text-primary">{p.name}</span>
              {p.language && (
                <span className="mt-0.5 text-[10px] text-text-tertiary">{p.language}</span>
              )}
            </button>
          ))
        )}
      </div>

      {/* New button */}
      <div className="p-3">
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-light bg-surface py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:opacity-50"
        >
          {creating ? "Creating..." : `+ New ${mode === "chats" ? "Chat" : "Project"}`}
        </button>
      </div>

      {/* User */}
      {user && (
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center gap-2">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                {user.displayName[0]}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-text-primary">{user.displayName}</p>
              {user.username && (
                <p className="truncate text-[10px] text-text-tertiary">@{user.username}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
