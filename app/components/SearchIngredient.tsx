"use client";

import { useState } from "react";
import { PantryItem, Per100g } from "../lib/types";

type LookupResponse = {
  found: boolean;
  name: string;
  brand?: string;
  per100g: Per100g;
  notes?: string;
};

type Props = {
  onClose: () => void;
  onFound: (item: PantryItem) => void;
};

export default function SearchIngredient({ onClose, onFound }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResponse | null>(null);

  async function search() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setError(e.error ?? "Lookup failed");
        return;
      }
      const data = (await res.json()) as LookupResponse;
      if (!data.found) {
        setError("Couldn't find that one. Try a more specific name.");
        return;
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  function addToPantry() {
    if (!result) return;
    const item: PantryItem = {
      id: crypto.randomUUID(),
      name: result.name,
      brand: result.brand,
      per100g: result.per100g,
      notes: result.notes,
      source: "search",
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };
    onFound(item);
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-md rounded-t-3xl bg-paper p-5 pb-8">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink/15" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Search ingredient</h2>
          <button onClick={onClose} className="text-sm text-ink/60">
            Close
          </button>
        </div>
        <p className="mt-1 text-sm text-ink/60">
          Type a food (raw or cooked, generic or branded). We&apos;ll fetch per-100g
          macros so you just enter grams.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
          className="mt-4 flex gap-2"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='e.g. "raw sweet potato", "avocado flesh"'
            className="flex-1 rounded-full border border-ink/15 bg-white/60 px-4 py-3 text-sm"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper disabled:opacity-40"
          >
            {loading ? "…" : "Find"}
          </button>
        </form>

        {error && (
          <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-900">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-4 rounded-2xl border border-ink/10 bg-white/60 p-4">
            <div className="text-xs uppercase tracking-wider text-ink/60">
              Per 100 g
            </div>
            <div className="mt-1 font-display text-xl">
              {result.brand ? `${result.brand} · ` : ""}
              {result.name}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              <Stat label="kcal" value={result.per100g.kcal} />
              <Stat label="P" value={result.per100g.protein_g} unit="g" />
              <Stat label="C" value={result.per100g.carbs_g} unit="g" />
              <Stat label="F" value={result.per100g.fat_g} unit="g" />
            </div>
            {result.notes && (
              <p className="mt-3 text-xs text-ink/60">{result.notes}</p>
            )}
            <button
              onClick={addToPantry}
              className="mt-4 w-full rounded-full bg-ink py-3 text-sm font-medium text-paper"
            >
              Add to pantry · enter grams
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div className="rounded-xl bg-ink/5 p-2">
      <div className="text-[10px] uppercase tracking-wider text-ink/50">{label}</div>
      <div className="font-display text-base tabular-nums">
        {Math.round(value * 10) / 10}
        {unit && <span className="ml-0.5 text-xs text-ink/50">{unit}</span>}
      </div>
    </div>
  );
}
