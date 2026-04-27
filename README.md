# Calai

A Cal AI clone — snap a photo of your food, get calories and macros, log it against your daily goal.

## Run it

```bash
cp .env.example .env.local       # then paste your Anthropic API key
npm install
npm run dev
```

Open http://localhost:3000 on your phone (same Wi-Fi) or laptop.

Get an API key at https://console.anthropic.com — the `/api/scan` route uses Claude Opus 4.7's vision to identify food and estimate macros.

## How it works

- **Camera/upload** → the photo is downscaled in the browser to ~1568px JPEG, sent as base64 to `/api/scan`.
- **Server** → calls Claude Opus 4.7 with `output_config.format` for a strict JSON schema (items, kcal, protein, carbs, fat, confidence, notes).
- **Review screen** → adjust kcal per item ±50, remove items, or add a hint ("with mayo, on a brioche bun") and rescan.
- **Log** → saved to `localStorage`, grouped by local date. No backend or DB.
- **Goals** → configurable kcal + macro targets, also in `localStorage`.

## Where to tweak things

- **Prompt + schema** — `app/api/scan/route.ts`. Make it more aggressive about hidden calories, change the items shape, etc.
- **Default goals** — `app/lib/types.ts` (`DEFAULT_GOALS`).
- **UI** — single file: `app/page.tsx`.

## Notes

- All scans hit the API individually, so each photo costs you a Claude Opus 4.7 call. For high-volume use, swap to `claude-sonnet-4-6` in `route.ts` (~3x cheaper, still very accurate at vision).
- Vision estimates have real ceilings — hidden oils, dressings, and dense ingredients in mixed dishes are easy to undercount. The hint + rescan flow is there for that.
