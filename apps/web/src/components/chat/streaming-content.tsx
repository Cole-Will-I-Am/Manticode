"use client";

import { useMemo } from "react";
import { CodeBlock } from "./code-block";

interface ContentSegment {
  type: "text" | "code";
  content: string;
  language?: string;
  filePath?: string;
}

function parseContent(raw: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const regex = /```(\w+)?(?:\s*\/\/\s*(.+?))?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: raw.slice(lastIndex, match.index) });
    }
    segments.push({
      type: "code",
      content: match[3].trimEnd(),
      language: match[1],
      filePath: match[2],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < raw.length) {
    segments.push({ type: "text", content: raw.slice(lastIndex) });
  }
  return segments;
}

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-surface px-1 py-0.5 font-mono text-xs text-accent">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export function StreamingContent({ content }: { content: string }) {
  const segments = useMemo(() => parseContent(content), [content]);

  return (
    <div className="text-sm leading-relaxed text-text-primary">
      {segments.map((seg, i) => {
        if (seg.type === "code") {
          return <CodeBlock key={i} code={seg.content} language={seg.language} filePath={seg.filePath} />;
        }
        return (
          <div key={i} className="whitespace-pre-wrap">
            {seg.content.split("\n\n").map((para, j) => (
              <p key={j} className="mb-2 last:mb-0">{renderInline(para)}</p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
