"use client";

import { useState } from "react";
import { PantryItem } from "../lib/types";

type Props = {
  item: PantryItem;
  onCancel: () => void;
  onConfirm: (grams: number) => void;
  confirmLabel?: string;
};

const PRESETS = [50, 100, 150, 200, 250, 300];

export default function GramsEntry({ item, onCancel, onConfirm, confirmLabel = "Log it" }: Props) {
  const [grams, setGrams] = useState<number>(item.defaultGrams ?? 100);
  const factor = grams / 100;
  const kcal = Math.round(item.per100g.kcal * factor);
  const protein = Math.round(item.per100g.protein_g * factor * 10) / 10;
  const carbs = Math.round(item.per100g.carbs_g * factor * 10) / 10;
  const fat = Math.round(item.per100g.fat_g * factor * 10) / 10;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-md rounded-t-3xl bg-paper p-5 pb-8">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink/15" />
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="truncate font-display text-2xl">
              {item.brand ? `${item.brand} · ` : ""}
              {item.name}
            </h2>
            <p className="text-xs text-ink/60">
              {item.per100g.kcal} kcal · {item.per100g.protein_g}P /{" "}
              {item.per100g.carbs_g}C / {item.per100g.fat_g}F per 100 g
            </p>
          </div>
          <button onClick={onCancel} className="text-sm text-ink/60">
            Close
          </button>
        </div>

        <div className="mt-5 rounded-2xl bg-ink/5 p-4">
          <div className="flex items-baseline justify-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={grams}
              min={0}
              onChange={(e) => {
                const v = Number(e.target.value);
                setGrams(Number.isFinite(v) && v >= 0 ? v : 0);
              }}
              className="w-32 bg-transparent text-center font-display text-5xl tabular-nums focus:outline-none"
            />
            <span className="text-lg text-ink/60">g</span>
          </div>
          <div className="mt-2 text-center font-display text-3xl tabular-nums">
            {kcal}
            <span className="ml-1 text-base text-ink/50">kcal</span>
          </div>
          <div className="mt-1 text-center text-xs text-ink/60">
            P {protein}g · C {carbs}g · F {fat}g
          </div>
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {PRESETS.map((g) => (
            <button
              key={g}
              onClick={() => setGrams(g)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                grams === g
                  ? "border-ink bg-ink text-paper"
                  : "border-ink/15 text-ink"
              }`}
            >
              {g}g
            </button>
          ))}
          <div className="flex gap-1">
            <button
              onClick={() => setGrams(Math.max(0, grams - 10))}
              className="rounded-full border border-ink/15 px-3 py-1.5 text-xs"
            >
              −10
            </button>
            <button
              onClick={() => setGrams(grams + 10)}
              className="rounded-full border border-ink/15 px-3 py-1.5 text-xs"
            >
              +10
            </button>
          </div>
        </div>

        <button
          onClick={() => onConfirm(grams)}
          disabled={grams <= 0}
          className="mt-5 w-full rounded-full bg-ink py-3 text-sm font-medium text-paper disabled:opacity-40"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
