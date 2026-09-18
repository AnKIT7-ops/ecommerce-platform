interface PaginationProps {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}

/** Windowed page numbers, so 40 pages does not render 40 buttons. */
function pageWindow(page: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);

  const wanted = new Set<number>([1, pages, page, page - 1, page + 1]);
  const sorted = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);

  const result: (number | "gap")[] = [];
  let previous = 0;
  for (const current of sorted) {
    if (previous && current - previous > 1) result.push("gap");
    result.push(current);
    previous = current;
  }
  return result;
}

export function Pagination({ page, pages, onChange }: PaginationProps) {
  if (pages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="h-9 rounded-[6px] border border-hairline bg-paper px-3 text-sm font-medium transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>

      {pageWindow(page, pages).map((entry, index) =>
        entry === "gap" ? (
          <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted">
            &hellip;
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => onChange(entry)}
            aria-current={entry === page ? "page" : undefined}
            aria-label={`Page ${entry}`}
            className={[
              "tabular h-9 min-w-9 rounded-[6px] border px-2 text-sm transition-colors",
              entry === page
                ? "border-volt bg-volt font-semibold text-white"
                : "border-hairline bg-paper hover:border-ink",
            ].join(" ")}
          >
            {entry}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
        className="h-9 rounded-[6px] border border-hairline bg-paper px-3 text-sm font-medium transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </nav>
  );
}
