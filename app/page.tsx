"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import AddFoodMenu from "./components/AddFoodMenu";
import GramsEntry from "./components/GramsEntry";
import PantryList from "./components/PantryList";
import SearchIngredient from "./components/SearchIngredient";
import { fileToCompressedBase64, makeThumbnail } from "./lib/image";
import { lookupBarcode } from "./lib/openfoodfacts";
import {
  dateKey,
  loadGoals,
  loadLog,
  loadPantry,
  saveGoals,
  saveLog,
  savePantry,
  touchPantryItem,
  upsertPantryItem,
} from "./lib/storage";
import {
  DEFAULT_GOALS,
  Goals,
  LogEntry,
  PantryItem,
  ScanResult,
  pantryItemToScanResult,
} from "./lib/types";

// Barcode scanner uses the camera — load only on the client.
const BarcodeScanner = dynamic(() => import("./components/BarcodeScanner"), {
  ssr: false,
});

type Stage =
  | { kind: "idle" }
  | { kind: "menu" }
  | { kind: "search" }
  | { kind: "barcode" }
  | { kind: "barcode-loading"; code: string }
  | { kind: "scanning-photo"; preview: string }
  | { kind: "review"; preview: string; result: ScanResult; hint: string }
  | { kind: "grams"; item: PantryItem; afterAdd?: "log" | "pantry-only" }
  | { kind: "error"; message: string };

export default function Home() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [showGoals, setShowGoals] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLog(loadLog());
    setGoals(loadGoals());
    setPantry(loadPantry());
  }, []);

  const today = useMemo(() => dateKey(), []);
  const todays = useMemo(() => log.filter((e) => e.dateKey === today), [log, today]);

  const totals = useMemo(
    () =>
      todays.reduce(
        (acc, e) => ({
          kcal: acc.kcal + e.result.total_kcal,
          protein_g: acc.protein_g + e.result.total_protein_g,
          carbs_g: acc.carbs_g + e.result.total_carbs_g,
          fat_g: acc.fat_g + e.result.total_fat_g,
        }),
        { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      ),
    [todays],
  );

  function persistLog(next: LogEntry[]) {
    setLog(next);
    saveLog(next);
  }
  function persistGoals(g: Goals) {
    setGoals(g);
    saveGoals(g);
  }
  function persistPantry(next: PantryItem[]) {
    setPantry(next);
    savePantry(next);
  }

  /* --- pantry actions --- */

  function addPantryItem(item: PantryItem) {
    const next = upsertPantryItem(pantry, item);
    persistPantry(next);
  }

  function deletePantryItem(id: string) {
    persistPantry(pantry.filter((it) => it.id !== id));
  }

  function logFromPantry(item: PantryItem, grams: number) {
    const result = pantryItemToScanResult(item, grams);
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      dateKey: dateKey(),
      thumbnail: item.thumbnail,
      result,
      pantryItemId: item.id,
      grams,
    };
    persistLog([entry, ...log]);
    persistPantry(touchPantryItem(pantry, item.id, grams));
    setStage({ kind: "idle" });
  }

  /* --- photo scan --- */

  async function handlePhoto(file: File) {
    try {
      const { base64, mediaType } = await fileToCompressedBase64(file);
      const preview = `data:${mediaType};base64,${base64}`;
      setStage({ kind: "scanning-photo", preview });
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setStage({ kind: "error", message: err.error ?? "Scan failed" });
        return;
      }
      const result = (await res.json()) as ScanResult;
      if (!result.is_food) {
        setStage({ kind: "error", message: "That doesn't look like food." });
        return;
      }
      setStage({ kind: "review", preview, result, hint: "" });
    } catch (e) {
      setStage({
        kind: "error",
        message: e instanceof Error ? e.message : "Scan failed",
      });
    }
  }

  async function rescanWithHint(preview: string, hint: string) {
    setStage({ kind: "scanning-photo", preview });
    const base64 = preview.split(",")[1] ?? "";
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image: base64, mediaType: "image/jpeg", hint }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      setStage({ kind: "error", message: err.error ?? "Scan failed" });
      return;
    }
    const result = (await res.json()) as ScanResult;
    setStage({ kind: "review", preview, result, hint });
  }

  async function commitScanEntry(preview: string, result: ScanResult) {
    const base64 = preview.split(",")[1] ?? "";
    const thumbnail = await makeThumbnail(base64);
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      dateKey: dateKey(),
      thumbnail,
      result,
    };
    persistLog([entry, ...log]);
    setStage({ kind: "idle" });
  }

  /* --- barcode --- */

  async function handleBarcode(code: string) {
    setStage({ kind: "barcode-loading", code });
    try {
      const item = await lookupBarcode(code);
      if (!item) {
        setStage({
          kind: "error",
          message: `No nutrition data for barcode ${code}. Try search instead.`,
        });
        return;
      }
      addPantryItem(item);
      setStage({ kind: "grams", item });
    } catch (e) {
      setStage({
        kind: "error",
        message: e instanceof Error ? e.message : "Barcode lookup failed",
      });
    }
  }

  /* --- render --- */

  return (
    <main className="mx-auto max-w-md px-5 pb-32 pt-8">
      <Header onOpenGoals={() => setShowGoals(true)} />

      <DailyRing totals={totals} goals={goals} />
      <MacroBars totals={totals} goals={goals} />

      <h2 className="mt-8 text-sm font-medium uppercase tracking-wider text-ink/50">
        Today
      </h2>
      {todays.length === 0 ? (
        <p className="mt-3 text-ink/60">
          No scans yet today. Tap{" "}
          <span className="font-medium">+ Add food</span> below.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {todays.map((e) => (
            <LogRow
              key={e.id}
              entry={e}
              onDelete={() => persistLog(log.filter((x) => x.id !== e.id))}
            />
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-sm font-medium uppercase tracking-wider text-ink/50">
        Pantry
      </h2>
      <PantryList
        items={pantry}
        onTap={(item) => setStage({ kind: "grams", item })}
        onDelete={deletePantryItem}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(ev) => {
          const f = ev.target.files?.[0];
          ev.target.value = "";
          if (f) void handlePhoto(f);
        }}
      />

      <AddButton onClick={() => setStage({ kind: "menu" })} />

      {stage.kind === "menu" && (
        <AddFoodMenu
          onClose={() => setStage({ kind: "idle" })}
          onChoosePhoto={() => {
            setStage({ kind: "idle" });
            fileRef.current?.click();
          }}
          onChooseSearch={() => setStage({ kind: "search" })}
          onChooseBarcode={() => setStage({ kind: "barcode" })}
        />
      )}

      {stage.kind === "search" && (
        <SearchIngredient
          onClose={() => setStage({ kind: "idle" })}
          onFound={(item) => {
            addPantryItem(item);
            setStage({ kind: "grams", item });
          }}
        />
      )}

      {stage.kind === "barcode" && (
        <BarcodeScanner
          onCancel={() => setStage({ kind: "idle" })}
          onDetected={(code) => void handleBarcode(code)}
        />
      )}

      {stage.kind === "barcode-loading" && (
        <CenterOverlay>
          <Spinner />
          <span className="text-sm text-ink/70">Looking up {stage.code}…</span>
        </CenterOverlay>
      )}

      {stage.kind === "scanning-photo" && (
        <ScanningOverlay preview={stage.preview} />
      )}

      {stage.kind === "review" && (
        <ReviewSheet
          preview={stage.preview}
          result={stage.result}
          hint={stage.hint}
          onCancel={() => setStage({ kind: "idle" })}
          onRescan={(hint) => rescanWithHint(stage.preview, hint)}
          onAdjust={(items) => {
            const total_kcal = items.reduce((s, i) => s + i.kcal, 0);
            const total_protein_g = items.reduce((s, i) => s + i.protein_g, 0);
            const total_carbs_g = items.reduce((s, i) => s + i.carbs_g, 0);
            const total_fat_g = items.reduce((s, i) => s + i.fat_g, 0);
            setStage({
              ...stage,
              result: {
                ...stage.result,
                items,
                total_kcal,
                total_protein_g,
                total_carbs_g,
                total_fat_g,
              },
            });
          }}
          onAdd={() => commitScanEntry(stage.preview, stage.result)}
        />
      )}

      {stage.kind === "grams" && (
        <GramsEntry
          item={stage.item}
          onCancel={() => setStage({ kind: "idle" })}
          onConfirm={(g) => logFromPantry(stage.item, g)}
        />
      )}

      {stage.kind === "error" && (
        <ErrorOverlay
          message={stage.message}
          onClose={() => setStage({ kind: "idle" })}
        />
      )}

      {showGoals && (
        <GoalsSheet
          goals={goals}
          onClose={() => setShowGoals(false)}
          onSave={(g) => {
            persistGoals(g);
            setShowGoals(false);
          }}
        />
      )}
    </main>
  );
}

/* ------- header ------- */

function Header({ onOpenGoals }: { onOpenGoals: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="font-display text-3xl">Calai</h1>
        <p className="text-sm text-ink/60">Snap, search, scan. Hit your goal.</p>
      </div>
      <button
        onClick={onOpenGoals}
        className="rounded-full border border-ink/15 px-4 py-2 text-sm hover:bg-ink hover:text-paper"
      >
        Goals
      </button>
    </div>
  );
}

/* ------- daily ring ------- */

function DailyRing({ totals, goals }: { totals: Goals; goals: Goals }) {
  const pct = Math.min(1, totals.kcal / Math.max(1, goals.kcal));
  const remaining = Math.max(0, goals.kcal - totals.kcal);
  const over = totals.kcal > goals.kcal;
  const size = 220;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * pct;

  return (
    <div className="mt-8 flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(11,11,12,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? "#b91c1c" : "#0b0b0c"}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="-mt-[148px] mb-[60px] text-center">
        <div className="font-display text-5xl tabular-nums">
          {Math.round(totals.kcal)}
        </div>
        <div className="text-sm text-ink/60">
          {over
            ? `${Math.round(totals.kcal - goals.kcal)} over`
            : `${Math.round(remaining)} left`}
          <span className="text-ink/40"> · goal {goals.kcal}</span>
        </div>
      </div>
    </div>
  );
}

/* ------- macro bars ------- */

function MacroBars({ totals, goals }: { totals: Goals; goals: Goals }) {
  const rows: Array<{ label: string; have: number; goal: number; unit: string }> = [
    { label: "Protein", have: totals.protein_g, goal: goals.protein_g, unit: "g" },
    { label: "Carbs", have: totals.carbs_g, goal: goals.carbs_g, unit: "g" },
    { label: "Fat", have: totals.fat_g, goal: goals.fat_g, unit: "g" },
  ];
  return (
    <div className="mt-2 grid grid-cols-3 gap-3">
      {rows.map((r) => {
        const pct = Math.min(1, r.have / Math.max(1, r.goal));
        return (
          <div key={r.label} className="rounded-2xl border border-ink/10 p-3">
            <div className="flex items-baseline justify-between">
              <div className="text-xs uppercase tracking-wider text-ink/60">
                {r.label}
              </div>
              <div className="text-xs tabular-nums text-ink/50">
                /{r.goal}
                {r.unit}
              </div>
            </div>
            <div className="mt-1 font-display text-xl tabular-nums">
              {Math.round(r.have)}
              <span className="ml-0.5 text-sm text-ink/50">{r.unit}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full bg-ink" style={{ width: `${pct * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------- log row ------- */

function LogRow({ entry, onDelete }: { entry: LogEntry; onDelete: () => void }) {
  const time = new Date(entry.ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const title =
    entry.customLabel ??
    entry.result.items.map((i) => i.name).join(", ") ??
    "Food";
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white/60 p-3">
      {entry.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.thumbnail}
          alt=""
          className="h-14 w-14 flex-none rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-ink/5 text-lg">
          {entry.pantryItemId ? "🥗" : "🍽️"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="text-xs text-ink/50">
          {time}
          {entry.grams ? ` · ${entry.grams}g` : ""} · P{" "}
          {Math.round(entry.result.total_protein_g)}g · C{" "}
          {Math.round(entry.result.total_carbs_g)}g · F{" "}
          {Math.round(entry.result.total_fat_g)}g
        </div>
      </div>
      <div className="flex flex-col items-end">
        <div className="font-display text-lg tabular-nums">
          {Math.round(entry.result.total_kcal)}
        </div>
        <button
          onClick={onDelete}
          className="text-xs text-ink/40 hover:text-ink"
          aria-label="Delete entry"
        >
          remove
        </button>
      </div>
    </li>
  );
}

/* ------- floating add button ------- */

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 flex justify-center pb-6">
      <button
        onClick={onClick}
        className="flex items-center gap-3 rounded-full bg-ink px-6 py-4 text-paper shadow-lg shadow-black/20 active:scale-[0.98]"
      >
        <span className="text-xl leading-none">+</span>
        <span className="text-base font-medium">Add food</span>
      </button>
    </div>
  );
}

/* ------- overlays ------- */

function ScanningOverlay({ preview }: { preview: string }) {
  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-paper/95 backdrop-blur">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={preview}
        alt=""
        className="h-64 w-64 rounded-3xl object-cover shadow-xl"
      />
      <div className="mt-6 flex items-center gap-3">
        <Spinner />
        <span className="text-sm text-ink/70">Analyzing your food…</span>
      </div>
    </div>
  );
}

function CenterOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-paper/95 backdrop-blur">
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
  );
}

/* ------- review sheet (photo scan) ------- */

function ReviewSheet({
  preview,
  result,
  hint,
  onCancel,
  onAdd,
  onAdjust,
  onRescan,
}: {
  preview: string;
  result: ScanResult;
  hint: string;
  onCancel: () => void;
  onAdd: () => void;
  onAdjust: (items: ScanResult["items"]) => void;
  onRescan: (hint: string) => void;
}) {
  const [hintText, setHintText] = useState(hint);
  const confColor =
    result.confidence === "high"
      ? "bg-emerald-100 text-emerald-800"
      : result.confidence === "medium"
        ? "bg-amber-100 text-amber-800"
        : "bg-rose-100 text-rose-800";

  function bumpKcal(idx: number, delta: number) {
    const next = result.items.map((it, i) => {
      if (i !== idx) return it;
      const ratio = (it.kcal + delta) / Math.max(1, it.kcal);
      return {
        ...it,
        kcal: Math.max(0, Math.round(it.kcal + delta)),
        protein_g: Math.max(0, Math.round(it.protein_g * ratio)),
        carbs_g: Math.max(0, Math.round(it.carbs_g * ratio)),
        fat_g: Math.max(0, Math.round(it.fat_g * ratio)),
      };
    });
    onAdjust(next);
  }

  function removeItem(idx: number) {
    onAdjust(result.items.filter((_, i) => i !== idx));
  }

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-paper">
      <div className="flex-1 overflow-y-auto pb-40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="" className="h-64 w-full object-cover" />

        <div className="mx-auto max-w-md px-5 pt-5">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-ink/50">
                Estimated total
              </div>
              <div className="font-display text-5xl tabular-nums">
                {Math.round(result.total_kcal)}
                <span className="ml-1 text-base text-ink/50">kcal</span>
              </div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs ${confColor}`}>
              {result.confidence} confidence
            </span>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
            <Macro label="Protein" value={result.total_protein_g} />
            <Macro label="Carbs" value={result.total_carbs_g} />
            <Macro label="Fat" value={result.total_fat_g} />
          </div>

          {result.notes && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              {result.notes}
            </p>
          )}

          <h3 className="mt-5 text-sm font-medium uppercase tracking-wider text-ink/50">
            Items
          </h3>
          <ul className="mt-2 space-y-2">
            {result.items.map((it, i) => (
              <li
                key={i}
                className="rounded-2xl border border-ink/10 bg-white/60 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{it.name}</div>
                    <div className="text-xs text-ink/50">{it.portion}</div>
                  </div>
                  <button
                    onClick={() => removeItem(i)}
                    className="text-xs text-ink/40 hover:text-ink"
                  >
                    remove
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xs text-ink/60">
                    P {Math.round(it.protein_g)}g · C {Math.round(it.carbs_g)}g · F{" "}
                    {Math.round(it.fat_g)}g
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => bumpKcal(i, -50)}
                      className="rounded-full border border-ink/15 px-2 py-1 text-xs"
                    >
                      −50
                    </button>
                    <span className="font-display text-lg tabular-nums">
                      {Math.round(it.kcal)}
                    </span>
                    <button
                      onClick={() => bumpKcal(i, 50)}
                      className="rounded-full border border-ink/15 px-2 py-1 text-xs"
                    >
                      +50
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5">
            <label className="text-sm font-medium uppercase tracking-wider text-ink/50">
              Got it wrong? Add a hint and rescan
            </label>
            <div className="mt-2 flex gap-2">
              <input
                value={hintText}
                onChange={(e) => setHintText(e.target.value)}
                placeholder='e.g. "with mayo, on a brioche bun"'
                className="flex-1 rounded-full border border-ink/15 bg-white/60 px-4 py-2 text-sm"
              />
              <button
                onClick={() => onRescan(hintText)}
                disabled={!hintText.trim()}
                className="rounded-full bg-ink px-4 py-2 text-sm text-paper disabled:opacity-40"
              >
                Rescan
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-ink/10 bg-paper/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-md gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-ink/15 py-3 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onAdd}
            className="flex-[2] rounded-full bg-ink py-3 text-sm font-medium text-paper"
          >
            Add to today
          </button>
        </div>
      </div>
    </div>
  );
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-ink/10 p-2">
      <div className="text-[10px] uppercase tracking-wider text-ink/50">
        {label}
      </div>
      <div className="font-display text-lg tabular-nums">
        {Math.round(value)}
        <span className="ml-0.5 text-xs text-ink/50">g</span>
      </div>
    </div>
  );
}

/* ------- error overlay ------- */

function ErrorOverlay({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-sm rounded-3xl bg-paper p-6 text-center">
        <div className="font-display text-xl">Something went wrong</div>
        <p className="mt-2 text-sm text-ink/70">{message}</p>
        <button
          onClick={onClose}
          className="mt-4 rounded-full bg-ink px-5 py-2 text-sm text-paper"
        >
          OK
        </button>
      </div>
    </div>
  );
}

/* ------- goals sheet ------- */

function GoalsSheet({
  goals,
  onClose,
  onSave,
}: {
  goals: Goals;
  onClose: () => void;
  onSave: (g: Goals) => void;
}) {
  const [draft, setDraft] = useState<Goals>(goals);

  function set<K extends keyof Goals>(key: K, raw: string) {
    const n = Number(raw);
    setDraft({ ...draft, [key]: Number.isFinite(n) && n >= 0 ? n : 0 });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-md rounded-t-3xl bg-paper p-5 pb-8">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink/15" />
        <h2 className="font-display text-2xl">Daily goals</h2>
        <p className="mt-1 text-sm text-ink/60">
          Set targets for cutting, bulking, or maintenance.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Calories" suffix="kcal" value={draft.kcal} onChange={(v) => set("kcal", v)} />
          <Field label="Protein" suffix="g" value={draft.protein_g} onChange={(v) => set("protein_g", v)} />
          <Field label="Carbs" suffix="g" value={draft.carbs_g} onChange={(v) => set("carbs_g", v)} />
          <Field label="Fat" suffix="g" value={draft.fat_g} onChange={(v) => set("fat_g", v)} />
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-ink/15 py-3 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(draft)}
            className="flex-[2] rounded-full bg-ink py-3 text-sm font-medium text-paper"
          >
            Save goals
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  suffix,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="rounded-2xl border border-ink/10 p-3">
      <div className="text-xs uppercase tracking-wider text-ink/60">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent font-display text-2xl tabular-nums focus:outline-none"
        />
        <span className="text-sm text-ink/50">{suffix}</span>
      </div>
    </label>
  );
}
