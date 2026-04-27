export type FoodItem = {
  name: string;
  portion: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type ScanResult = {
  is_food: boolean;
  items: FoodItem[];
  total_kcal: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  confidence: "low" | "medium" | "high";
  notes: string;
};

export type Per100g = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type PantrySource = "search" | "barcode" | "scan" | "manual";

export type PantryItem = {
  id: string;
  name: string;
  brand?: string;
  per100g: Per100g;
  thumbnail?: string;
  defaultGrams?: number;
  source: PantrySource;
  barcode?: string;
  notes?: string;
  createdAt: number;
  lastUsedAt: number;
};

export type LogEntry = {
  id: string;
  ts: number;
  dateKey: string; // YYYY-MM-DD in local time
  thumbnail?: string;
  result: ScanResult;
  customLabel?: string;
  pantryItemId?: string;
  grams?: number;
};

export type Goals = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export const DEFAULT_GOALS: Goals = {
  kcal: 1800,
  protein_g: 150,
  carbs_g: 180,
  fat_g: 60,
};

export function pantryItemToScanResult(item: PantryItem, grams: number): ScanResult {
  const factor = grams / 100;
  const kcal = Math.round(item.per100g.kcal * factor);
  const protein_g = Math.round(item.per100g.protein_g * factor * 10) / 10;
  const carbs_g = Math.round(item.per100g.carbs_g * factor * 10) / 10;
  const fat_g = Math.round(item.per100g.fat_g * factor * 10) / 10;
  const display = item.brand ? `${item.brand} ${item.name}` : item.name;
  return {
    is_food: true,
    items: [
      {
        name: display,
        portion: `${grams}g`,
        kcal,
        protein_g,
        carbs_g,
        fat_g,
      },
    ],
    total_kcal: kcal,
    total_protein_g: protein_g,
    total_carbs_g: carbs_g,
    total_fat_g: fat_g,
    confidence: "high",
    notes: "",
  };
}
