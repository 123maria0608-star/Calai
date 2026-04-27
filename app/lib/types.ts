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

export type LogEntry = {
  id: string;
  ts: number;
  dateKey: string; // YYYY-MM-DD in local time
  thumbnail?: string; // small base64 jpeg
  result: ScanResult;
  customLabel?: string;
};

export type Goals = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export const DEFAULT_GOALS: Goals = {
  kcal: 2000,
  protein_g: 150,
  carbs_g: 200,
  fat_g: 65,
};
