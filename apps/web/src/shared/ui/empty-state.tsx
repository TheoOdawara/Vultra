export interface EmptyStateProps {
  filtered: boolean;
  emptyMessage: string;
  filteredMessage: string;
  action?: React.ReactNode;
}

export function EmptyState({ filtered, emptyMessage, filteredMessage, action }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className="flex flex-col items-center gap-4 px-6 py-12 text-center"
    >
      <p className="text-sm text-muted">{filtered ? filteredMessage : emptyMessage}</p>
      {filtered ? null : action}
    </div>
  );
}
