import { useState, type FormEvent } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Renders as a form that submits on Enter, for the header. */
  onSubmit?: (value: string) => void;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search products",
  onSubmit,
  className = "",
}: SearchBarProps) {
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);

  // Keep in step when the URL changes underneath (back button, category click).
  // Adjusting during render rather than in an effect avoids a second render
  // pass and a flash of the stale term.
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit?.(draft);
  }

  function handleChange(next: string) {
    setDraft(next);
    if (!onSubmit) onChange(next);
  }

  return (
    <form role="search" onSubmit={handleSubmit} className={`relative ${className}`}>
      <label htmlFor="product-search" className="sr-only">
        Search products
      </label>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
      >
        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
        <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        id="product-search"
        type="search"
        value={draft}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-[6px] border border-hairline bg-paper pr-3 pl-9 text-sm text-ink transition-colors placeholder:text-muted/60 hover:border-muted/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-volt"
      />
    </form>
  );
}
