"use client";

import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";

type VideoButtonProps = {
  href: string;
  videoSrc: string;
  children: ReactNode;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  className?: string;
};

export function VideoButton({
  href,
  videoSrc,
  children,
  icon: Icon,
  className = "",
}: VideoButtonProps) {
  return (
    <Link
      href={href}
      className={`
        group relative flex min-h-11 items-center gap-2
        overflow-hidden rounded-lg px-4 py-2
        font-semibold text-white
        transition-transform duration-300
        hover:scale-[1.02]
        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-primary
        ${className}
      `}
    >
      {/* Fundo com vídeo e máscaras */}
      <span
        aria-hidden="true"
        className="
          pointer-events-none absolute inset-0
          opacity-100
          transition-opacity duration-700 ease-out
          md:opacity-0
          md:group-hover:opacity-100
          md:group-focus-visible:opacity-100
        "
      >
        <video
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="
            absolute inset-0
            h-full w-full
            object-cover object-center
          "
        />

        {/* Máscara marrom */}
        <span className="absolute inset-0 bg-[#3b2418]/35" />

        {/* Vinheta */}
        <span
          className="
            absolute inset-0
            bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(20,10,5,0.25)_60%,rgba(8,4,2,0.85)_100%)]
          "
        />
      </span>

      {/* Conteúdo acima do fundo */}
      <span className="relative z-10 flex items-center gap-2">
        {Icon && <Icon className="size-5 shrink-0" aria-hidden="true" />}
        <span>{children}</span>
      </span>
    </Link>
  );
}
