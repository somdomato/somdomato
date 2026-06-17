"use client";

import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";

type VideoButtonProps = {
  href: string;
  videoSrc: string;
  children: ReactNode;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  onClick?: () => void;
  className?: string;
};

export function VideoButton({
  href,
  videoSrc,
  children,
  icon: Icon,
  onClick,
  className = "",
}: VideoButtonProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`
        group relative isolate flex min-h-11 items-center gap-2
        overflow-hidden rounded-lg px-4 py-2
        font-semibold text-white
        transition-[transform,color,background-color] duration-300
        hover:scale-[1.02]
        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-primary
        focus-visible:ring-offset-2
        focus-visible:ring-offset-black
        ${className}
      `}
    >
      <video
        src={videoSrc}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="
          pointer-events-none absolute inset-0 -z-20
          h-full w-full object-cover object-center
          opacity-100
          transition-opacity duration-700 ease-out
          md:opacity-0
          md:group-hover:opacity-100
          md:group-focus-visible:opacity-100
        "
      />

      <span
        aria-hidden="true"
        className="
          pointer-events-none absolute inset-0 -z-10
          bg-black/50 opacity-100
          transition-opacity duration-700 ease-out
          md:opacity-0
          md:group-hover:opacity-100
          md:group-focus-visible:opacity-100
        "
      />

      {Icon && <Icon className="size-5 shrink-0" aria-hidden="true" />}

      <span className="relative z-10">{children}</span>
    </Link>
  );
}