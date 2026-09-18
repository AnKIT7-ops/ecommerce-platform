import { useEffect } from "react";

const SUFFIX = "Ampere";

export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} — ${SUFFIX}` : `${SUFFIX} — components and gear`;
  }, [title]);
}
