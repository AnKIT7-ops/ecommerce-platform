import { useState } from "react";

interface ProductImageProps {
  src: string | null;
  alt: string;
  className?: string;
}

/** Up to two initials from the product name, e.g. "Solace Desk Lamp" -> "SD". */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

/** Stable hue per product, so a given item always gets the same tile. */
function hueOf(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 360;
  }
  return hash;
}

/**
 * Product photo, with a branded placeholder when there is no image.
 *
 * Photos are served from an external CDN, so a missing `image_url`, a blocked
 * request or an offline machine all have to degrade to something that looks
 * deliberate. The fallback is a deterministic tinted tile carrying the
 * product's initials rather than a broken-image icon or a collapsed card.
 */
export function ProductImage({ src, alt, className = "" }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    const hue = hueOf(alt);
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden ${className}`}
        style={{
          backgroundImage: `linear-gradient(145deg, hsl(${hue} 32% 94%), hsl(${(hue + 40) % 360} 28% 88%))`,
        }}
        role="img"
        aria-label={`${alt}. Product photo not available.`}
      >
        <span
          aria-hidden="true"
          className="tabular text-3xl font-bold tracking-tight"
          style={{ color: `hsl(${hue} 30% 38%)` }}
        >
          {initialsOf(alt)}
        </span>
        <span
          aria-hidden="true"
          className="eyebrow absolute bottom-2 text-[9px]"
          style={{ color: `hsl(${hue} 20% 50%)` }}
        >
          Photo pending
        </span>
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
