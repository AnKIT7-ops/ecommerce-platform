import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  /** Says what to do next. An empty screen is an invitation to act. */
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[6px] border border-dashed border-hairline bg-paper px-6 py-16 text-center">
      {icon && <div className="mb-4 text-muted">{icon}</div>}
      <p className="text-lg font-semibold text-ink">{title}</p>
      <p className="mt-2 max-w-md text-sm text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
