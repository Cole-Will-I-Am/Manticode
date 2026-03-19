"use client";

import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 p-6 text-center", className)}>
      {icon && <div className="text-text-tertiary">{icon}</div>}
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {description && <p className="mt-1 text-xs text-text-secondary">{description}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-lg bg-surface px-4 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
