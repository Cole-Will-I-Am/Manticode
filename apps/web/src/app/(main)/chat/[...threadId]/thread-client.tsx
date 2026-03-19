"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import { useChatStore } from "@/stores/chat";
import { useDrawer } from "@/components/layout/app-shell";

export default function ThreadClient() {
  const params = useParams<{ threadId: string[] }>();
  const threadId = params.threadId?.[0];
  const { fetchMessages, setActiveThread, threads } = useChatStore();
  const { toggle } = useDrawer();

  useEffect(() => {
    const thread = threads.find((t) => t.id === threadId);
    if (thread) setActiveThread(thread);
    else if (threadId) fetchMessages(threadId);
  }, [threadId, threads, setActiveThread, fetchMessages]);

  return <ChatPanel threadId={threadId} onToggleSidebar={toggle} />;
}
