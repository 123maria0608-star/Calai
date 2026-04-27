import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a precise nutrition estimator. Given a photo of food, you identify each distinct item, estimate a realistic portion size based on visual cues (plate size, utensils, hand if visible, common serving conventions), and produce calorie + macro estimates.

Rules:
- If the image is not food, set "is_food" to false and return an empty items array.
- Be realistic: a restaurant burger is 600-900 kcal, not 350. A bowl of pasta is 500-800 kcal.
- Estimate generously when sauces, oils, dressings, or cheese are visible — they are easy to undercount.
- Each item gets: name (concise, e.g. "grilled chicken breast"), portion (human-readable, e.g. "1 cup, ~150g"), kcal, protein_g, carbs_g, fat_g (all numbers).
- "confidence" is "low" | "medium" | "high" — low if the photo is blurry, partial, or ambiguous.
- "notes" is a short string (under 120 chars) flagging any uncertainty (e.g. "dressing amount estimated", "could be ground beef or turkey").
- Return ONLY the JSON. No prose, no markdown fences.`;

const SCHEMA = {
  type: "object",
  properties: {
    is_food: { type: "boolean" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          portion: { type: "string" },
          kcal: { type: "number" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" },
        },
        required: ["name", "portion", "kcal", "protein_g", "carbs_g", "fat_g"],
        additionalProperties: false,
      },
    },
    total_kcal: { type: "number" },
    total_protein_g: { type: "number" },
    total_carbs_g: { type: "number" },
    total_fat_g: { type: "number" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    notes: { type: "string" },
  },
  required: [
    "is_food",
    "items",
    "total_kcal",
    "total_protein_g",
    "total_carbs_g",
    "total_fat_g",
    "confidence",
    "notes",
  ],
  additionalProperties: false,
};

type ScanRequest = {
  image: string;
  mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  hint?: string;
};

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing ANTHROPIC_API_KEY. Add it to .env.local and restart." },
      { status: 500 },
    );
  }

  let body: ScanRequest;
  try {
    body = (await req.json()) as ScanRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { image, mediaType = "image/jpeg", hint } = body;
  if (!image || typeof image !== "string") {
    return NextResponse.json({ error: "Missing 'image' (base64 string)" }, { status: 400 });
  }

  const client = new Anthropic();

  const userText = hint?.trim()
    ? `Analyze this food. Extra context from the user: "${hint.trim()}"`
    : "Analyze this food and estimate calories and macros.";

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2048,
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
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: image },
            },
            { type: "text", text: userText },
          ],
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
