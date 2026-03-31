"use client";

import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

export default function SongBlock({
  icon: Icon,
  title,
  children,
}: {
  icon?: ComponentType<LucideProps>;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-background-alt border-2 border-primary/20 rounded-xl p-4 flex flex-col h-full">
      <h3 className="flex items-center gap-2 font-semibold text-base mb-3 m-0 pb-2.5 border-b border-black/30">
        {Icon ? (
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/20">
            <Icon className="w-4 h-4 text-primary" />
          </span>
        ) : null}
        {title}
      </h3>
      {children}
    </div>
  );
}
