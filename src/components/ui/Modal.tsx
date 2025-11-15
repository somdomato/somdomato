"use client";

import { useRouter } from "next/navigation";

export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div
      className="fixed inset-0 z-50 grid place-content-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modalTitle"
    >
      <div className="w-2xl rounded-lg bg-background border-2 border-black/70 p-6 shadow-lg">
        {children}
        <footer className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => {
              router.back();
            }}
            type="button"
            className="rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}
