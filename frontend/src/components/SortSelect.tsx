import type { ProductSort } from "../types";

const OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name_asc", label: "Name: A to Z" },
  { value: "name_desc", label: "Name: Z to A" },
];

interface SortSelectProps {
  value: ProductSort;
  onChange: (value: ProductSort) => void;
}

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="eyebrow whitespace-nowrap">
        Sort
      </label>
      <select
        id="sort"
        value={value}
        onChange={(event) => onChange(event.target.value as ProductSort)}
        className="h-10 rounded-[6px] border border-hairline bg-paper px-2.5 text-sm text-ink hover:border-muted/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-volt"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
