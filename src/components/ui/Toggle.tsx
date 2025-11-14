"use client";

import { useState } from "react";

export default function Toggle() {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input type="checkbox" value="" checked className="peer sr-only" />
      <div className="peer flex h-8 items-center gap-4 rounded-full bg-orange-600 px-3 after:absolute after:left-1 after: after:h-6 after:w-16 after:rounded-full after:bg-white/40 after:transition-all after:content-[''] peer-checked:bg-stone-600 peer-checked:after:translate-x-full peer-focus:outline-none dark:border-slate-600 dark:bg-slate-700 text-sm text-white">
        <span>General</span>
        <span>Project</span>
      </div>
    </label>
  );
}
