import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

/**
 * Shared frame for the sign-in and registration pages. The card is headed by a
 * lit panel carrying the title, so the two auth screens read as part of the
 * same instrument family as the storefront rather than as bare forms.
 */
export function AuthShell({ eyebrow, title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
      <Link
        to="/"
        className="display-wide mx-auto flex items-center gap-2 text-lg font-extrabold text-ink"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-ink text-sm font-bold text-paper"
        >
          A
        </span>
        Ampere
      </Link>

      <div className="mt-10 overflow-hidden rounded-[6px] border border-hairline bg-paper">
        <div className="graticule grain relative bg-panel px-6 py-7 text-paper sm:px-8">
          <p className="eyebrow label-narrow relative flex items-center gap-2 text-paper/50">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-volt shadow-[0_0_10px_2px_var(--color-volt)]" />
            {eyebrow}
          </p>
          <h1 className="display-wide relative mt-2.5 text-[1.75rem] leading-[1.05] font-extrabold">
            {title}
          </h1>
          <p className="relative mt-2 text-sm leading-relaxed text-paper/60">{subtitle}</p>
        </div>

        <div className="p-6 sm:p-8">{children}</div>
      </div>

      <p className="mt-6 text-center text-sm text-muted">{footer}</p>
    </div>
  );
}
