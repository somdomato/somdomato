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
    <div className="bg-background-alt border-2 border-primary/20 rounded p-3">
      <h3 className="flex items-center font-semibold mb-3">
        {Icon ? <Icon className="inline-block mr-2 w-6 h-6" /> : null}
        {title}
      </h3>
      {children}
    </div>
  );
}
