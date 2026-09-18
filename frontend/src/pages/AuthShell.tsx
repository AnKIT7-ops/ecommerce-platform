import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

/** Shared frame for the sign-in and registration pages. */
export function AuthShell({ eyebrow, title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
      <Link
        to="/"
        className="mx-auto flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-ink text-sm font-bold text-paper"
        >
          A
        </span>
        Ampere
      </Link>

      <div className="mt-10 rounded-[6px] border border-hairline bg-paper p-6 sm:p-8">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
        <p className="mt-1.5 text-sm text-muted">{subtitle}</p>

        <div className="mt-7">{children}</div>
      </div>

      <p className="mt-6 text-center text-sm text-muted">{footer}</p>
    </div>
  );
}
