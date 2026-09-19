import { Link } from "react-router-dom";

import { Button } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function NotFoundPage() {
  useDocumentTitle("Page not found");

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
      {/* The status code gets the instrument treatment: a fault readout rather
          than an apology. */}
      <div className="graticule grain relative overflow-hidden rounded-[6px] bg-panel px-6 py-12 text-paper sm:px-12 sm:py-16">
        <p className="eyebrow label-narrow relative flex items-center gap-2 text-paper/50">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_10px_2px_var(--color-signal)]" />
          Fault
        </p>

        <p className="tabular display-wide relative mt-4 text-[4.5rem] leading-none font-extrabold text-paper sm:text-[6rem]">
          404
        </p>

        <h1 className="display-wide relative mt-5 text-2xl leading-tight font-extrabold sm:text-3xl">
          That page is not here
        </h1>

        <p className="relative mt-3 max-w-md text-sm leading-relaxed text-paper/60">
          The link may be out of date, or the product may have been retired. The catalogue is
          the best place to pick up from.
        </p>

        <div className="relative mt-8 flex flex-wrap gap-3">
          <Link to="/products">
            <Button size="lg">Browse products</Button>
          </Link>
          <Link to="/">
            <Button
              size="lg"
              variant="secondary"
              className="border-paper/25 bg-transparent text-paper hover:border-paper hover:bg-paper/10"
            >
              Go home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
