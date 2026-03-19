"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/layout/empty-state";
import { useWorkspaceStore } from "@/stores/workspace";
import { useChatStore } from "@/stores/chat";

export default function ChatHomePage() {
  const router = useRouter();
  const ensureDefaultProject = useWorkspaceStore((s) => s.ensureDefaultProject);
  const ensureDefaultThread = useChatStore((s) => s.ensureDefaultThread);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        const project = await ensureDefaultProject();
        if (!project) {
          if (mounted) { setError("No workspace found."); setLoading(false); }
          return;
        }
        const thread = await ensureDefaultThread(project.id);
        if (mounted) router.replace(`/chat/${thread.id}`);
      } catch (e) {
        if (mounted) { setError((e as Error).message); setLoading(false); }
      }
    };
    void bootstrap();
    return () => { mounted = false; };
  }, [ensureDefaultProject, ensureDefaultThread, router]);

  if (loading) {
    return (
      <EmptyState
        title="Preparing your chat"
        description="Setting up your workspace..."
        className="h-full"
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Could not start chat"
        description={error}
        className="h-full"
        action={{ label: "Retry", onClick: () => router.refresh() }}
      />
    );
  }

  return (
    <EmptyState
      title="Start a conversation"
      description="Select a chat from the sidebar or create a new one."
      className="h-full"
    />
  );
}
