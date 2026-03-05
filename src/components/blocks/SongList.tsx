"use client";

import Image from "next/image";

type Item = {
  id: number | string;
  [key: string]: unknown;
  reqId?: number;
  title: string;
  artist: string;
  cover?: string | null;
  count?: number;
};

export default function SongList({
  items,
  keyField = "id",
  renderRight,
}: {
  items: Item[];
  keyField?: string;
  renderRight?: (item: Item) => React.ReactNode;
}) {
  const hasRight = !!renderRight;

  return (
    <div className="overflow-hidden">
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col className="w-10" />
          <col />
          {hasRight && <col className="w-24" />}
        </colgroup>
        <tbody>
          {items.map((it) => {
            const rawKey = (it as Record<string, unknown>)[keyField];
            const key = String(rawKey ?? it.id);
            return (
              <tr key={key} className="border-t border-t-black/30">
                <td className="py-2 pr-3 align-top">
                  <div className="w-9 h-9 relative rounded overflow-hidden">
                    <Image
                      src={it.cover || "/images/logotipo.svg"}
                      width={36}
                      height={36}
                      alt={it.title}
                      className="rounded"
                    />
                  </div>
                </td>
                <td className="py-2 min-w-0">
                  <div className="font-medium truncate">{it.title}</div>
                  <div className="text-xs text-muted truncate">{it.artist}</div>
                </td>
                {hasRight && (
                  <td className="py-2 text-right text-xs text-muted pl-3">
                    {renderRight ? renderRight(it) : null}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
