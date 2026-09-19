import type { CategoryWithCount } from "../types";

interface CategoryFilterProps {
  categories: CategoryWithCount[];
  selectedSlug: string | undefined;
  onSelect: (slug: string | undefined) => void;
}

export function CategoryFilter({ categories, selectedSlug, onSelect }: CategoryFilterProps) {
  const total = categories.reduce((sum, category) => sum + category.product_count, 0);

  return (
    <nav aria-label="Filter by category">
      <h2 className="eyebrow label-narrow mb-3">Category</h2>
      <ul className="flex flex-col gap-0.5">
        <li>
          <FilterButton
            isActive={selectedSlug === undefined}
            onClick={() => onSelect(undefined)}
            label="All products"
            count={total}
          />
        </li>
        {categories.map((category) => (
          <li key={category.id}>
            <FilterButton
              isActive={selectedSlug === category.slug}
              onClick={() => onSelect(category.slug)}
              label={category.name}
              count={category.product_count}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface FilterButtonProps {
  isActive: boolean;
  onClick: () => void;
  label: string;
  count: number;
}

function FilterButton({ isActive, onClick, label, count }: FilterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? "true" : undefined}
      className={[
        "flex w-full items-center justify-between rounded-[6px] px-3 py-2 text-left text-sm transition-colors",
        isActive ? "bg-volt-tint font-semibold text-volt-dark" : "text-ink hover:bg-shell",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className="tabular text-xs text-muted">{count}</span>
    </button>
  );
}
