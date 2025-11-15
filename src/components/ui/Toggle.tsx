"use client";

import type { ReactNode } from "react";

type ToggleProps = {
  isChecked: boolean;
  onChange?: (checked: boolean) => void;
  leftLabel?: ReactNode;
  rightLabel?: ReactNode;
};

export default function Toggle({
  isChecked,
  onChange,
  leftLabel = "Opt1",
  rightLabel = "Opt2",
}: ToggleProps) {

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange?.(e.target.checked);
  };

  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        checked={isChecked}
        onChange={handleInputChange}
        className="peer sr-only"
        aria-checked={isChecked}
      />
      <div className="peer flex h-8 items-center gap-4 rounded-full bg-orange-600 px-3 after:absolute after:left-1 after:h-6 after:w-16 after:rounded-full after:bg-white/40 after:transition-all after:content-[''] peer-checked:bg-stone-600 peer-checked:after:translate-x-full peer-focus:outline-none dark:border-slate-600 dark:bg-slate-700 text-sm text-white">
        <button type="button" onClick={() => onChange?.(false)}>
          {leftLabel}
        </button>
        <button type="button" onClick={() => onChange?.(true)}>
          {rightLabel}
        </button>
      </div>
    </label>
  );
}
