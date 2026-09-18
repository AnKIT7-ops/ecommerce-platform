interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  max: number;
  disabled?: boolean;
  /** Describes what is being counted, for screen readers. */
  label: string;
}

export function QuantitySelector({
  value,
  onChange,
  max,
  disabled = false,
  label,
}: QuantitySelectorProps) {
  const clamp = (next: number) => Math.min(Math.max(next, 1), Math.max(max, 1));

  const stepClass =
    "flex h-9 w-9 items-center justify-center text-lg leading-none text-ink transition-colors hover:bg-shell disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="inline-flex items-center rounded-[6px] border border-hairline bg-paper">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= 1}
        aria-label={`Decrease quantity of ${label}`}
        className={`${stepClass} rounded-l-[6px]`}
      >
        &minus;
      </button>

      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={1}
        max={Math.max(max, 1)}
        disabled={disabled}
        aria-label={`Quantity of ${label}`}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          if (Number.isFinite(parsed)) onChange(clamp(parsed));
        }}
        className="tabular h-9 w-12 border-x border-hairline bg-paper text-center text-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-volt disabled:text-muted [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Increase quantity of ${label}`}
        className={`${stepClass} rounded-r-[6px]`}
      >
        +
      </button>
    </div>
  );
}
