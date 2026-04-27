"use client";

import { useMemo, useState } from "react";
import { PantryItem } from "../lib/types";

type Props = {
  items: PantryItem[];
  onTap: (item: PantryItem) => void;
  onDelete: (id: string) => void;
};

export default function PantryList({ items, onTap, onDelete }: Props) {
  const [filter, setFilter] = useState("");

  const sorted = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = [...items].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
    if (!f) return list;
    return list.filter(
      (it) =>
        it.name.toLowerCase().includes(f) ||
        (it.brand ?? "").toLowerCase().includes(f),
    );
  }, [items, filter]);

  if (items.length === 0) {
    return (
      <div className="mt-3 rounded-2xl border border-dashed border-ink/15 p-5 text-center">
        <p className="text-sm text-ink/60">
          Your pantry is empty. Tap <span className="font-medium">+ Add food</span>{" "}
          to scan a barcode or search for an ingredient — it&apos;ll live here for
          one-tap logging.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      {items.length > 4 && (
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter pantry…"
          className="mb-3 w-full rounded-full border border-ink/15 bg-white/60 px-4 py-2 text-sm"
        />
      )}
      <ul className="space-y-2">
        {sorted.map((it) => (
          <li
            key={it.id}
            className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white/60 p-3"
          >
            <button
              onClick={() => onTap(it)}
              className="flex flex-1 items-center gap-3 text-left"
            >
              {it.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.thumbnail}
                  alt=""
                  className="h-12 w-12 flex-none rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-ink/5 text-lg">
                  {sourceEmoji(it.source)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {it.brand ? `${it.brand} · ` : ""}
                  {it.name}
                </div>
                <div className="text-xs text-ink/50">
                  {Math.round(it.per100g.kcal)} kcal · P{" "}
                  {Math.round(it.per100g.protein_g)} · C{" "}
                  {Math.round(it.per100g.carbs_g)} · F {Math.round(it.per100g.fat_g)}
                  <span className="text-ink/30"> / 100g</span>
                </div>
              </div>
            </button>
            <button
              onClick={() => onDelete(it.id)}
              aria-label="Remove from pantry"
              className="text-xs text-ink/40 hover:text-ink"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function sourceEmoji(s: PantryItem["source"]): string {
  switch (s) {
    case "barcode":
      return "📦";
    case "search":
      return "🔎";
    case "scan":
      return "🍽️";
    default:
      return "🥗";
  }
}
