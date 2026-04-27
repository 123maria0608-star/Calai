import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM_PROMPT = `You are a precise nutrition database. Given a food name (raw ingredient or branded item), return per-100g macros.

Rules:
- Use USDA FoodData Central values for raw/generic ingredients (chicken breast, raw oats, avocado flesh, etc.).
- For ambiguous items, default to the most common interpretation and explain in "notes" (under 80 chars).
- "name" should be a clean, canonical form. Capitalize the first word. Add "(raw)" or "(cooked)" if the user said it.
- "brand" is only for branded products; null/omit otherwise.
- All macros are per 100 grams.
- "found" is false only if you genuinely don't know; in that case, leave macros at 0.
- Return ONLY the JSON.`;

const SCHEMA = {
  type: "object",
  properties: {
    found: { type: "boolean" },
    name: { type: "string" },
    brand: { type: "string" },
    per100g: {
      type: "object",
      properties: {
        kcal: { type: "number" },
        protein_g: { type: "number" },
        carbs_g: { type: "number" },
        fat_g: { type: "number" },
      },
      required: ["kcal", "protein_g", "carbs_g", "fat_g"],
      additionalProperties: false,
    },
    notes: { type: "string" },
  },
  required: ["found", "name", "per100g", "notes"],
  additionalProperties: false,
};

type LookupRequest = { query: string };

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing ANTHROPIC_API_KEY." },
      { status: 500 },
    );
  }

  let body: LookupRequest;
  try {
    body = (await req.json()) as LookupRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "Missing 'query'" }, { status: 400 });
  }
  if (query.length > 200) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 512,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: `Look up: ${query}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No text response from model" },
        { status: 502 },
      );
    }

    const data = JSON.parse(textBlock.text);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error (${err.status}): ${err.message}` },
        { status: err.status ?? 500 },
      );
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
