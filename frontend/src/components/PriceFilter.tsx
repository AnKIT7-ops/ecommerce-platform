import { useState } from "react";

import { Button } from "./ui";

interface PriceFilterProps {
  minPrice: string | undefined;
  maxPrice: string | undefined;
  onApply: (min: string | undefined, max: string | undefined) => void;
}

export function PriceFilter({ minPrice, maxPrice, onApply }: PriceFilterProps) {
  const [min, setMin] = useState(minPrice ?? "");
  const [max, setMax] = useState(maxPrice ?? "");
  const [error, setError] = useState<string | null>(null);
  const [lastBounds, setLastBounds] = useState({ minPrice, maxPrice });

  // Adopt bounds that changed in the URL (cleared filters, back button).
  if (lastBounds.minPrice !== minPrice || lastBounds.maxPrice !== maxPrice) {
    setLastBounds({ minPrice, maxPrice });
    setMin(minPrice ?? "");
    setMax(maxPrice ?? "");
  }

  function apply() {
    const lower = min.trim();
    const upper = max.trim();

    if (lower && upper && Number(lower) > Number(upper)) {
      setError("Lowest price must be below the highest.");
      return;
    }
    setError(null);
    onApply(lower || undefined, upper || undefined);
  }

  const inputClass =
    "tabular h-10 w-full min-w-0 rounded-[6px] border border-hairline bg-paper px-2.5 text-sm hover:border-muted/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-volt";

  return (
    <div>
      <h2 className="eyebrow label-narrow mb-3">Price</h2>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="1"
          inputMode="decimal"
          value={min}
          onChange={(event) => setMin(event.target.value)}
          placeholder="Min"
          aria-label="Lowest price"
          className={inputClass}
        />
        <span aria-hidden="true" className="text-muted">
          &ndash;
        </span>
        <input
          type="number"
          min="0"
          step="1"
          inputMode="decimal"
          value={max}
          onChange={(event) => setMax(event.target.value)}
          placeholder="Max"
          aria-label="Highest price"
          className={inputClass}
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-signal">
          {error}
        </p>
      )}
      <Button variant="secondary" size="sm" fullWidth className="mt-2" onClick={apply}>
        Apply price
      </Button>
    </div>
  );
}
