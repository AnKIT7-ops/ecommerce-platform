interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
}

const SIZES = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-9 w-9 border-[3px]",
} as const;

export function Spinner({ size = "md", label }: SpinnerProps) {
  return (
    <span
      className="inline-flex items-center gap-2"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className={`${SIZES[size]} animate-spin rounded-full border-current border-t-transparent opacity-70`}
      />
      <span className={label ? "text-sm text-muted" : "sr-only"}>{label ?? "Loading"}</span>
    </span>
  );
}
