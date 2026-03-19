"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useWorkspaceStore } from "@/stores/workspace";
import { useDrawer } from "@/components/layout/app-shell";
import { cn } from "@/lib/cn";

export default function ProjectClient() {
  const params = useParams<{ projectId: string[] }>();
  const projectId = params.projectId?.[0];
  const { files, activeFile, fetchFiles, setActiveFile } = useWorkspaceStore();
  const { toggle } = useDrawer();

  useEffect(() => {
    if (projectId) fetchFiles(projectId);
  }, [projectId, fetchFiles]);

  return (
    <div className="flex h-full flex-col bg-bg-primary">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={toggle} className="text-text-secondary hover:text-text-primary md:hidden">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <span className="text-sm font-medium">Files</span>
        <span className="text-xs text-text-tertiary">({files.length})</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* File list */}
        <div className="w-[220px] flex-shrink-0 overflow-y-auto border-r border-border bg-bg-secondary p-2">
          {files.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFile(f)}
              className={cn(
                "mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                activeFile?.id === f.id ? "bg-accent-soft text-text-primary" : "text-text-secondary hover:bg-white/[0.03]",
              )}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <span className="truncate font-mono">{f.path}</span>
            </button>
          ))}
          {files.length === 0 && (
            <p className="py-8 text-center text-xs text-text-tertiary">No files</p>
          )}
        </div>

        {/* Editor area */}
        <div className="flex-1 overflow-auto">
          {activeFile ? (
            <div className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="font-mono text-xs text-text-secondary">{activeFile.path}</span>
                {activeFile.language && (
                  <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-tertiary">
                    {activeFile.language}
                  </span>
                )}
              </div>
              <pre className="overflow-x-auto rounded-xl border border-border bg-bg-secondary p-4 font-mono text-xs leading-5 text-text-primary">
                {activeFile.content || "(empty file)"}
              </pre>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-text-tertiary">Select a file to view</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
