import { useId, type InputHTMLAttributes, type ReactNode } from "react";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
}

export function Input({ label, error, hint, className = "", ...props }: InputProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {props.required && (
          <span className="ml-1 text-signal" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error ? errorId : null, hint ? hintId : null]
          .filter(Boolean)
          .join(" ") || undefined}
        className={[
          "h-11 rounded-[6px] border bg-paper px-3 text-sm text-ink",
          "placeholder:text-muted/60",
          "transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-volt",
          error ? "border-signal" : "border-hairline hover:border-muted/50",
          "disabled:cursor-not-allowed disabled:bg-shell disabled:text-muted",
          className,
        ].join(" ")}
        {...props}
      />

      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-signal">
          {error}
        </p>
      )}
    </div>
  );
}
