import type { ReactNode } from "react";

interface EmptyStateProps {
  readonly title: string;
  readonly body?: ReactNode;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly eyebrow?: string;
  readonly variant?: "default" | "warm" | "cool";
}

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  eyebrow,
  variant = "default",
}: EmptyStateProps) {
  return (
    <div className={`workspace-empty workspace-empty--${variant}`}>
      {eyebrow ? <span className="workspace-empty__eyebrow">{eyebrow}</span> : null}
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
      {actionLabel && onAction ? (
        <button className="action-button" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
