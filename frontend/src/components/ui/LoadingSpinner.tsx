import { Spinner } from "./Spinner";

/** Full-block loading state for a page or panel. */
export function LoadingSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-60 items-center justify-center text-muted">
      <Spinner size="lg" label={label} />
    </div>
  );
}
