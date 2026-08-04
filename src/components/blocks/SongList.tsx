"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import CoverImage from "@/components/CoverImage";

type Item = {
  id: number | string;
  [key: string]: unknown;
  reqId?: number;
  title: string;
  artist: string;
  cover?: string | null;
  count?: number;
};

const ROW_TRANSITION = { duration: 0.45, ease: [0.22, 1, 0.36, 1] } as const;

export default function SongList({
  items,
  keyField = "id",
  renderRight,
  rightColClass = "w-24",
  numbered = false,
  animateRight = false,
}: {
  items: Item[];
  keyField?: string;
  renderRight?: (item: Item) => React.ReactNode;
  rightColClass?: string;
  numbered?: boolean;
  animateRight?: boolean;
}) {
  const hasRight = !!renderRight;

  return (
    <MotionConfig reducedMotion="user">
      <div className="overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((it, index) => {
            const rawKey = (it as Record<string, unknown>)[keyField];
            const key = String(rawKey ?? it.id);
            return (
              <motion.div
                key={key}
                layout
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={ROW_TRANSITION}
                className="flex items-center gap-3 py-2 border-t border-t-black/30"
              >
                {numbered && (
                  <div className="w-8 shrink-0 text-center text-sm font-bold text-primary">
                    {index + 1}º
                  </div>
                )}
                <div className="w-9 h-9 relative rounded overflow-hidden shrink-0">
                  <CoverImage
                    src={it.cover || "/images/logotipo.svg"}
                    fill
                    sizes="36px"
                    alt={it.title}
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{it.title}</div>
                  <div className="text-xs text-muted truncate">{it.artist}</div>
                </div>
                {hasRight && (
                  <div
                    className={`${rightColClass} shrink-0 text-right text-xs text-muted`}
                  >
                    {animateRight ? (
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={renderRight ? String(renderRight(it)) : ""}
                          initial={{ opacity: 0, y: -6, scale: 1.25 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{
                            duration: 0.3,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="inline-block text-primary font-semibold"
                        >
                          {renderRight ? renderRight(it) : null}
                        </motion.span>
                      </AnimatePresence>
                    ) : renderRight ? (
                      renderRight(it)
                    ) : null}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
