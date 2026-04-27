import { PantryItem } from "./types";

type OFFProduct = {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  image_thumb_url?: string;
  image_front_thumb_url?: string;
  nutriments?: Record<string, number | string | undefined>;
};

type OFFResponse = {
  status?: number;
  product?: OFFProduct;
};

function num(v: number | string | undefined): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export async function lookupBarcode(barcode: string): Promise<PantryItem | null> {
  const cleaned = barcode.replace(/\s+/g, "");
  if (!/^\d{6,14}$/.test(cleaned)) return null;

  const url = `https://world.openfoodfacts.org/api/v2/product/${cleaned}.json?fields=product_name,product_name_en,brands,image_thumb_url,image_front_thumb_url,nutriments`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as OFFResponse;
  if (data.status !== 1 || !data.product) return null;

  const p = data.product;
  const n = p.nutriments ?? {};
  const kcal = num(n["energy-kcal_100g"]) || num(n["energy-kcal"]) || 0;
  const protein_g = num(n["proteins_100g"]);
  const carbs_g = num(n["carbohydrates_100g"]);
  const fat_g = num(n["fat_100g"]);

  if (kcal === 0 && protein_g === 0 && carbs_g === 0 && fat_g === 0) return null;

  const name = p.product_name_en || p.product_name || `Product ${cleaned}`;
  const brand = (p.brands ?? "").split(",")[0]?.trim() || undefined;
  const thumbnail = p.image_front_thumb_url || p.image_thumb_url || undefined;

  return {
    id: crypto.randomUUID(),
    name,
    brand,
    per100g: { kcal, protein_g, carbs_g, fat_g },
    thumbnail,
    source: "barcode",
    barcode: cleaned,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
  };
}
