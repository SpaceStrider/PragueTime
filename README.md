# Prague winter atlas

Map, day-by-day plan, bookings checklist, and live sync across phones. The copy in this repository is a sample trip. Real names, lodging, and booking notes stay out of the committed files.

```bash
npm install
npm run dev
```

Open the local URL. The page stays on the lock until `TRIP_GATE_CODE` is set in the environment. After it opens, votes, checkmarks, notes, and custom pins sync through `/api/sync`. Without `TRIP_PRIVATE_JSON`, the opened page uses `content/trip.sample.json`.

## Private trip data

The itinerary is filled in at build time. It is not stored in the files on this branch.

Secret name: `TRIP_PRIVATE_JSON`

Where to set it: GitHub → this repository → Settings → Secrets and variables → Actions → Repository secrets → New repository secret. Paste the compact JSON only. Do not commit that file, and do not put it in the workflow, this README, or a pull request.

Build the value from the commit that still has the itinerary in `content/atlas.html` (`d356ad2c5fcc1af7cf38efbfb63fdfe1a649b369`):

```bash
git show d356ad2c5fcc1af7cf38efbfb63fdfe1a649b369:content/atlas.html > /tmp/atlas-before.html
node scripts/export-trip-secret.mjs /tmp/atlas-before.html > /tmp/trip-private.json
```

The script writes compact JSON to stdout and a warning to stderr. Paste `/tmp/trip-private.json` into the secret. GitHub secrets must stay under 48 KB; that compact file fits. If GitHub rejects it for size, do not split it into this repository. Put the same JSON as `trip.json` on the default branch of a new private repository you create yourself, for example `CzechTrip-private`, with no other copy of the file.

A push to `main`, or a manual run of the Pages workflow from `main`, reads both secrets. Pull requests never receive them. The published file is a lock screen. When `TRIP_GATE_CODE` is set, the trip HTML is sealed with that code and is not readable in the file. When `TRIP_PRIVATE_JSON` is set as well, that sealed trip is the real itinerary. If the code secret is missing, the lock stays up and the trip pages are left out.

The page is on the public internet. The code stops someone who only opens the page. Someone who downloads the file can try every 4-digit code. Git history on `main` still contains the itinerary in plain text, so this seal is not the only copy.

For the Next.js server (`npm run dev` or a hosted app), both variable names are read from the environment. A local `.env` file is gitignored. Do not commit it.

## Access code

Secret name: `TRIP_GATE_CODE`

Set it in the same place as the trip JSON: Settings → Secrets and variables → Actions → Repository secrets. Choose 4 digits. Do not commit them, and do not put them in the workflow, this README, or a pull request. On the Next.js host, put the same name in the environment or in `.env`.

The server checks the code and, on success, sets a cookie named `trip_gate`. The value is an HMAC of the expiry, not the digits. It lasts 30 days, is HttpOnly, and is `SameSite=Lax`. `Secure` is added when the request is HTTPS. A wrong code, or a missing secret, stays on the lock and does not return the trip. Sync requests are locked the same way.

GitHub Pages cannot set an HttpOnly cookie. There, a correct code decrypts the sealed page in the browser and stores a derived key in `trip_gate` for 30 days, with `SameSite=Lax` and `Secure` on HTTPS. That cookie is not the digits. Without the secret, that page has no sealed trip.

Git history on `main` still contains the private itinerary, including in `content/atlas.html`, `src/lib/sync-state.ts`, `scripts/test-merge.ts`, and the previous `README.md`. This change does not rewrite that history.

## GitHub Pages

The static atlas is published from `main` by `.github/workflows/pages.yml`. After that workflow succeeds, open:

https://spacestrider.github.io/PragueTime/

Enter the code. That page keeps votes and notes on each phone. Live sync across phones stays on the hosted app, which has the database.
