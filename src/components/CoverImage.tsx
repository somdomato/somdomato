"use client";

import Image, { type ImageProps } from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_COVER } from "@/lib/cover-constants";

const DEFAULT_FALLBACK = DEFAULT_COVER;
const LOAD_TIMEOUT_MS = 8000;

/**
 * Drop-in replacement for next/image that shows a circular loader
 * until the image is fully loaded, then fades it in.
 *
 * If the image fails to load or doesn't finish within LOAD_TIMEOUT_MS,
 * falls back to `fallbackSrc` instead of leaving the spinner stuck.
 *
 * Sempre `unoptimized`: as capas usadas aqui são sempre arquivos locais
 * já resolvidos em `public/covers` (ou o placeholder). Rodar essas imagens
 * pelo otimizador do Next (sharp, sob demanda) na VPS de produção — que
 * tem só 1.9GB de RAM dividida com Liquidsoap/Icecast/bot/outro app Next —
 * gera latência bem inconsistente entre requisições concorrentes: algumas
 * capas aparecem na hora, outras demoram, e as que passam de
 * LOAD_TIMEOUT_MS caem no fallback permanentemente (sem retry). Servir o
 * arquivo estático direto evita esse gargalo de CPU/memória.
 *
 * Requirements:
 * - Parent element MUST have `position: relative` and `overflow: hidden`.
 */
export default function CoverImage({
  onLoad,
  onError,
  className,
  src,
  fallbackSrc = DEFAULT_FALLBACK,
  ...props
}: ImageProps & { fallbackSrc?: string }) {
  const srcKey = useMemo(() => {
    if (typeof src === "string") return src;
    if (src && typeof src === "object" && "src" in src) {
      return src.src;
    }
    return String(src);
  }, [src]);

  const [currentSrc, setCurrentSrc] = useState(srcKey);
  const [loaded, setLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLoadTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Marca como carregado e, em caso de falha, troca para a capa padrão
  // (em vez de deixar o spinner girando indefinidamente).
  const handleFailure = useCallback(() => {
    clearLoadTimeout();
    setCurrentSrc((current) => {
      if (current !== fallbackSrc) return fallbackSrc;
      setLoaded(true);
      return current;
    });
  }, [fallbackSrc, clearLoadTimeout]);

  useEffect(() => {
    setCurrentSrc(srcKey);

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

    // Safety net: if neither load nor error fires within the timeout
    // (slow network, stale optimizer cache, etc.), fall back to the
    // default cover so the spinner never spins forever.
    timeoutRef.current = setTimeout(handleFailure, LOAD_TIMEOUT_MS);

    return () => {
      img?.removeEventListener("abort", handleAbort);
      clearLoadTimeout();
    };
  }, [srcKey, handleFailure, clearLoadTimeout]);

  const handleRef = useCallback((node: HTMLImageElement | null) => {
    imageRef.current = node;
    if (node?.complete) {
      setLoaded(true);
    }
  }, []);

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      clearLoadTimeout();
      setLoaded(true);
      if (typeof onLoad === "function") onLoad(e);
    },
    [onLoad, clearLoadTimeout],
  );

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      handleFailure();
      if (typeof onError === "function") onError(e);
    },
    [onError, handleFailure],
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
        key={currentSrc}
        {...props}
        unoptimized
        ref={handleRef}
        src={currentSrc}
        className={`${className ?? ""} transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </>
  );
}
