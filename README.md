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

The script writes compact JSON to stdout and a warning to stderr. Paste `/tmp/trip-private.json` into the secret. GitHub secrets must stay under 48 KB; that compact file fits. If GitHub rejects it for size, do not split it into this repository. Put the same JSON as `trip.json` on the default branch of a new private repository you create yourself, for example `CzechTrip-private`, with no other copy of the file. Then keep this public site on the sample until that private file can be read at build time without publishing it.

The Pages workflow reads `TRIP_PRIVATE_JSON` only when all of these are true:

- the run is a push to `main` (pull requests never receive it)
- the repository is private
- GitHub Pages reports `public: false` (Settings → Pages → site visibility Private)

It still does not write that JSON into the page unless `TRIP_GATE_CODE` is set. The published file is a lock screen. The trip HTML is sealed with the code and is not readable in the file. If the code secret is missing, the lock stays up and the trip pages are left out.

A private repository can still have a public Page. On a free plan, Pages is public, so the live page can be sealed only around the sample trip. Private Pages needs a plan that includes it. After you turn on private Pages and save both secrets, run the Pages workflow again from the Actions tab.

For the Next.js server (`npm run dev` or a hosted app), both variable names are read from the environment. Set them only on a host that is not public. A local `.env` file is gitignored. Do not commit it.

## Access code

Secret name: `TRIP_GATE_CODE`

Set it in the same place as the trip JSON: Settings → Secrets and variables → Actions → Repository secrets. Choose 4 digits. Do not commit them, and do not put them in the workflow, this README, or a pull request. On the Next.js host, put the same name in the environment or in `.env`.

The server checks the code and, on success, sets a cookie named `trip_gate`. The value is an HMAC of the expiry, not the digits. It lasts 30 days, is HttpOnly, and is `SameSite=Lax`. `Secure` is added when the request is HTTPS. A wrong code, or a missing secret, stays on the lock and does not return the trip. Sync requests are locked the same way.

GitHub Pages cannot set an HttpOnly cookie. There, a correct code decrypts the sealed page in the browser and stores a derived key in `trip_gate` for 30 days, with `SameSite=Lax` and `Secure` on HTTPS. That cookie is not the digits. Without the secret, that page has no sealed trip.

Git history on `main` still contains the private itinerary, including in `content/atlas.html`, `src/lib/sync-state.ts`, `scripts/test-merge.ts`, and the previous `README.md`. This change does not rewrite that history.

## GitHub Pages

The static atlas is published from `main` by `.github/workflows/pages.yml`. After that workflow succeeds, the page is:

https://spacestrider.github.io/CzechTrip/

This repository is private, and GitHub Pages is not turned on yet. A private repository can publish a Page only on a plan that includes private Pages. On a free plan the repository has to be public before the deploy step can succeed. That public Page is still the lock screen. With the code secret set, it opens the sample trip, not the private one. On that Page, each phone keeps its own votes and notes. Live sync across phones stays on the hosted app, which has the database.
