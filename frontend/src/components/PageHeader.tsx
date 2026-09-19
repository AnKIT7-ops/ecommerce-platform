import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Two-digit index shown to the left, as on a drawing sheet. */
  index?: string;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  /** Counts and other readouts, placed under the description. */
  meta?: ReactNode;
  action?: ReactNode;
  /** `h1` for a page, `h2` for a section within one. */
  level?: "h1" | "h2";
  className?: string;
}

/**
 * The store's heading block: optional sheet index, condensed eyebrow, and the
 * title set on Archivo's expanded axis. Every page uses this so the type scale
 * and the rule beneath it stay identical across the catalogue, cart, orders
 * and account.
 */
export function PageHeader({
  index,
  eyebrow,
  title,
  description,
  meta,
  action,
  level = "h1",
  className = "",
}: PageHeaderProps) {
  const Title = level;
  const titleSize =
    level === "h1" ? "text-[1.75rem] sm:text-[2.25rem]" : "text-2xl sm:text-[2rem]";

  return (
    <header
      className={`mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-5 ${className}`}
    >
      <div className="flex min-w-0 gap-4 sm:gap-6">
        {index && (
          <span className="eyebrow label-narrow shrink-0 pt-1.5 text-muted/60">{index}</span>
        )}
        <div className="min-w-0">
          <p className="eyebrow label-narrow">{eyebrow}</p>
          <Title
            className={`display-wide mt-2 leading-[1.05] font-extrabold text-ink ${titleSize}`}
          >
            {title}
          </Title>
          {description && <p className="mt-2 max-w-xl text-sm text-muted">{description}</p>}
          {meta && <p className="mt-2 text-sm text-muted">{meta}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}
