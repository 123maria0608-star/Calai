# Calai

Snap, search, scan. Hit your daily calorie goal.

A Cal AI-style web app, but built around a **personal pantry**: scan a barcode or search an ingredient *once*, then log it forever with one tap and a gram count. Photo scan is still there for restaurant meals.

## What's in it

- **Search ingredient** — type "raw sweet potato", "avocado flesh", etc. → Claude returns per-100g macros → saved to your pantry → enter grams → logged.
- **Scan barcode** — phone camera reads the UPC/EAN → looked up via [Open Food Facts](https://world.openfoodfacts.org/) (free, no API key) → straight into your pantry with brand, name, image.
- **Photo of a meal** — restaurant plate or finished dish → Claude Opus 4.7 vision identifies items and estimates calories + macros. Hint + rescan flow if it gets it wrong.
- **Pantry** — every item you've ever scanned/searched, sorted by recently used. Tap → enter grams → logged in 2 seconds.
- **Daily ring + macro bars** — kcal, protein, carbs, fat against your goal.
- **Goals** — default 1800 / 150P / 180C / 60F (cut). Editable.
- **Local only** — log, pantry, goals all in localStorage. No backend DB. Clears if you wipe browser storage.

## Getting your phone using it (3 paths, ranked)

You need `ANTHROPIC_API_KEY` from <https://console.anthropic.com>. Then pick one:

### 1. Vercel (recommended — gets you a real HTTPS URL in 5 minutes)

Camera + barcode scanner require HTTPS on phones. Vercel is the path of least resistance.

```bash
npm i -g vercel
vercel        # follow prompts, link a project
vercel env add ANTHROPIC_API_KEY production
# paste your key, hit enter
vercel --prod
```

You get a `https://your-app.vercel.app` URL. Open it on your phone, allow camera permission, you're in.

### 2. Phone on same Wi-Fi as your laptop (no HTTPS = no camera, only typing/photo upload)

```bash
cp .env.example .env.local        # paste your key
npm install
npm run dev -- -H 0.0.0.0
```

Find your laptop's LAN IP (e.g. macOS: `ipconfig getifaddr en0`), then on your phone open `http://192.168.x.x:3000`. **Note:** iOS/Android Chrome won't let websites use the camera over plain HTTP, so barcode scanner won't work this way. Search + photo upload (gallery) still does.

### 3. ngrok / cloudflared tunnel (HTTPS over your dev server)

```bash
npm run dev
# in another terminal:
npx ngrok http 3000
# or: cloudflared tunnel --url http://localhost:3000
```

Open the `https://...` URL it prints on your phone. Camera works.

## Add to home screen (makes it feel like a real app)

- **iOS Safari:** Share → Add to Home Screen.
- **Android Chrome:** ⋮ → Add to Home screen.

Now you tap the Calai icon and it opens fullscreen, no browser chrome.

## Where to tweak things

- **Default goals** — `app/lib/types.ts` (`DEFAULT_GOALS`). Already 1800 / 150 / 180 / 60.
- **Photo-scan prompt** — `app/api/scan/route.ts`. Make it more aggressive about hidden calories or flag specific cuisines.
- **Ingredient lookup prompt** — `app/api/lookup/route.ts`.
- **UI** — `app/page.tsx` for the home screen, `app/components/*.tsx` for the sheets.

## Costs (rough)

- **Search** = 1 Claude API call (~$0.005).
- **Photo scan** = 1 Claude API call with vision (~$0.02 per scan).
- **Barcode** = $0 (Open Food Facts is free).
- **Logging from pantry** = $0 (no API call, math runs locally).

So once your pantry is seeded with your usual foods, daily logging is essentially free.

## What's still missing (next up)

- Edit a logged entry's grams after the fact
- Partial-portion tracking (logged 200g of a 500g sweet potato → pantry remembers 300g left)
- Restaurant sticker mode (Starbucks/Chipotle receipts)
- Weekly trend graph
- One-tap "saved meals" (multiple pantry items as a recipe)

Tell me which to add next.
