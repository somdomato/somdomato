"use client";

import Image, { type ImageProps } from "next/image";
import { useCallback, useState } from "react";

/**
 * Drop-in replacement for next/image that shows a shimmer skeleton
 * until the image is fully loaded, then fades it in.
 *
 * Requirements:
 * - Parent element MUST have `position: relative` and `overflow: hidden`.
 */
export default function CoverImage({
  onLoad,
  className,
  src,
  ...props
}: ImageProps) {
  const [loadedSrc, setLoadedSrc] = useState<ImageProps["src"] | null>(null);
  const loaded = loadedSrc === src;

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setLoadedSrc(src);
      if (typeof onLoad === "function") onLoad(e);
    },
    [onLoad, src],
  );

  return (
    <>
      <div
        aria-hidden
        className={`absolute inset-0 rounded-[inherit] bg-white/[0.06] transition-opacity duration-300 ${
          loaded ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <div className="absolute inset-0 rounded-[inherit] shimmer" />
      </div>
      <Image
        {...props}
        src={src}
        className={`${className ?? ""} transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={handleLoad}
      />
    </>
  );
}
