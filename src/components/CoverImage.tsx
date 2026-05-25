"use client";

import Image, { type ImageProps } from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Drop-in replacement for next/image that shows a circular loader
 * until the image is fully loaded, then fades it in.
 *
 * Requirements:
 * - Parent element MUST have `position: relative` and `overflow: hidden`.
 */
export default function CoverImage({
  onLoad,
  onError,
  className,
  src,
  ...props
}: ImageProps) {
  const srcKey = useMemo(() => {
    if (typeof src === "string") return src;
    if (src && typeof src === "object" && "src" in src) {
      return src.src;
    }
    return String(src);
  }, [src]);

  const [loaded, setLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!srcKey) {
      setLoaded(true);
      return;
    }

    setLoaded(false);

    // Handles cached images that may skip the load callback timing.
    const img = imageRef.current;
    if (img?.complete) {
      setLoaded(true);
    }

    // NS_BINDING_ABORTED (and similar browser aborts) don't fire React's
    // onLoad/onError — add a native listener so the spinner never gets stuck.
    const handleAbort = () => setLoaded(true);
    img?.addEventListener("abort", handleAbort);
    return () => img?.removeEventListener("abort", handleAbort);
  }, [srcKey]);

  const handleRef = useCallback((node: HTMLImageElement | null) => {
    imageRef.current = node;
    if (node?.complete) {
      setLoaded(true);
    }
  }, []);

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setLoaded(true);
      if (typeof onLoad === "function") onLoad(e);
    },
    [onLoad],
  );

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      // Mark as loaded to hide loader even on error.
      setLoaded(true);
      if (typeof onError === "function") onError(e);
    },
    [onError],
  );

  return (
    <>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-black/25 transition-opacity duration-300 ${
          loaded ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
      <Image
        key={srcKey}
        {...props}
        ref={handleRef}
        src={src}
        className={`${className ?? ""} transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </>
  );
}
