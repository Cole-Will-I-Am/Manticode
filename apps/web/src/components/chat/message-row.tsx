"use client";

import type { ChatMessage } from "@manticode/shared";
import { StreamingContent } from "./streaming-content";

export function MessageRow({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent/10 px-4 py-2.5 text-sm text-text-primary">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === "assistant") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3">
          {message.thinking && (
            <details className="mb-2">
              <summary className="tracking-label cursor-pointer text-text-tertiary">
                Thinking
              </summary>
              <p className="mt-1 text-xs text-text-tertiary">{message.thinking}</p>
            </details>
          )}
          <StreamingContent content={message.content} />
        </div>
      </div>
    );
  }

  return null;
}
