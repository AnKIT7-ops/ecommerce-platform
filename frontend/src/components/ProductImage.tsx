import { useState } from "react";

interface ProductImageProps {
  src: string | null;
  alt: string;
  className?: string;
}

/**
 * Product photo with a graceful fallback.
 *
 * Seed images come from a remote placeholder service, so a failed load is
 * expected offline. The fallback keeps the card's shape instead of collapsing.
 */
export function ProductImage({ src, alt, className = "" }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-shell ${className}`}
        role="img"
        aria-label={`${alt} (no photo available)`}
      >
        <span className="eyebrow">No photo</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`bg-shell object-cover ${className}`}
    />
  );
}
