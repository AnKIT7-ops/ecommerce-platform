import { Link } from "react-router-dom";

import { Button } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function NotFoundPage() {
  useDocumentTitle("Page not found");

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center sm:px-6">
      <p className="eyebrow">Error 404</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink">
        That page is not here
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        The link may be out of date, or the product may have been retired. The catalogue is the
        best place to pick up from.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/products">
          <Button size="lg">Browse products</Button>
        </Link>
        <Link to="/">
          <Button variant="secondary" size="lg">
            Go home
          </Button>
        </Link>
      </div>
    </div>
  );
}
