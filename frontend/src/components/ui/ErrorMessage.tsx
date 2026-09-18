import { Button } from "./Button";

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

/**
 * Errors state what went wrong and what to do about it. They do not apologise
 * and they are never vague.
 */
export function ErrorMessage({ title = "Something went wrong", message, onRetry }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className="rounded-[6px] border border-signal/25 bg-signal-tint px-5 py-4"
    >
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
