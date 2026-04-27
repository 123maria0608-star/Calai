import { DEFAULT_GOALS, Goals, LogEntry, PantryItem } from "./types";

const LOG_KEY = "calai.log.v1";
const GOALS_KEY = "calai.goals.v1";
const PANTRY_KEY = "calai.pantry.v1";

export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function loadLog(): LogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as LogEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveLog(entries: LogEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOG_KEY, JSON.stringify(entries));
}

export function loadGoals(): Goals {
  if (typeof window === "undefined") return DEFAULT_GOALS;
  try {
    const raw = window.localStorage.getItem(GOALS_KEY);
    return raw ? { ...DEFAULT_GOALS, ...(JSON.parse(raw) as Partial<Goals>) } : DEFAULT_GOALS;
  } catch {
    return DEFAULT_GOALS;
  }
}

export function saveGoals(g: Goals) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GOALS_KEY, JSON.stringify(g));
}

export function loadPantry(): PantryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PANTRY_KEY);
    return raw ? (JSON.parse(raw) as PantryItem[]) : [];
  } catch {
    return [];
  }
}

export function savePantry(items: PantryItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PANTRY_KEY, JSON.stringify(items));
}

export function upsertPantryItem(items: PantryItem[], item: PantryItem): PantryItem[] {
  const idx = items.findIndex(
    (it) =>
      it.id === item.id ||
      (item.barcode && it.barcode === item.barcode) ||
      (it.name.toLowerCase() === item.name.toLowerCase() &&
        (it.brand ?? "").toLowerCase() === (item.brand ?? "").toLowerCase()),
  );
  if (idx === -1) return [item, ...items];
  const next = [...items];
  next[idx] = { ...next[idx], ...item, id: next[idx].id, createdAt: next[idx].createdAt };
  return next;
}

export function touchPantryItem(items: PantryItem[], id: string, grams?: number): PantryItem[] {
  return items.map((it) =>
    it.id === id
      ? { ...it, lastUsedAt: Date.now(), defaultGrams: grams ?? it.defaultGrams }
      : it,
  );
}
