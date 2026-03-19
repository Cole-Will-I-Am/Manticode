"use client";

import { useRef, useEffect } from "react";
import type { ChatMessage } from "@manticode/shared";
import { MessageRow } from "./message-row";
import { StreamingContent } from "./streaming-content";

interface MessageListProps {
  messages: ChatMessage[];
  streaming: boolean;
  streamingContent: string;
  streamingThinking: string;
}

export function MessageList({ messages, streaming, streamingContent, streamingThinking }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <div className="scrollbar-hide flex-1 overflow-y-auto px-4 py-3">
      <div className="mx-auto max-w-3xl space-y-3">
        {messages.map((msg) => (
          <MessageRow key={msg.id} message={msg} />
        ))}

        {streaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3">
              {streamingThinking && (
                <details className="mb-2">
                  <summary className="tracking-label cursor-pointer text-text-tertiary">Thinking</summary>
                  <p className="mt-1 text-xs text-text-tertiary">{streamingThinking}</p>
                </details>
              )}
              <StreamingContent content={streamingContent} />
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent" />
            </div>
          </div>
        )}

        {streaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-tertiary [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-tertiary [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-tertiary [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
