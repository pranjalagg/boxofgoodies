# box of goodies

A digital care package. Pick a few things (note, photo, song, video, coupon), tuck them into a box, and send the link. The person who gets it sees "you've got mail", taps the box, and opens each item.

Plain HTML/CSS/JS with no build step. Supabase stores packages and uploaded photos and videos.

## Run locally

```sh
python3 serve.py
# open http://localhost:8000
```

`serve.py` is `python3 -m http.server` with caching turned off, listening on localhost only. Plain `http.server` lets the browser reuse old CSS and JS after you edit them. (ES modules don't load from `file://`, so you do need a server.)

If `config.js` is empty, the app runs without a backend. Links then carry the whole package in the URL, and photo/video uploads are turned off. Song and YouTube links still work.

## Set up Supabase (needed for uploads and short links)

1. Create a free project at https://supabase.com.
2. Open **SQL Editor** and run `supabase/schema.sql`, then each file in `supabase/migrations/` in order (002 to 005). Each file is safe to re-run. Together they create:
   - the `packages` table, which nobody can list or write to directly
   - `create_package(...)`, the only way to add a package, with the limits below
   - `get_package(id)`, used to read a single package
   - a public `attachments` storage bucket (50 MB per file, images and videos only)
   - read-only dashboard views in the `admin` schema
3. Go to **Project Settings → API**, copy the Project URL and the `anon` public key, and paste them into `config.js`.

The anon key is safe to ship in the frontend. What it can do is limited by the policies in the schema.

If your database is already set up, just run the migrations you haven't run yet.

### Limits

Enforced in the database, because anyone holding the public key can skip the app and call the backend directly:

- 1–20 items per package, about 200 KB of text
- 10 packages per hour per IP (stored as a hash, never the raw IP)
- 500 packages per day across everyone
- uploads only into the folder of a package created in the last 15 minutes, at most 20 files each, 50 MB per file

The per-IP limit is best effort: a determined sender can fake the header it relies on. The daily cap holds regardless. Adjust the numbers in `004_limits.sql` and re-run it.

### Test data vs real data

`env.js` decides the tag. In the repo it says `dev`, so anything you create while testing locally is tagged `env = 'dev'`, with uploads under `dev/` in the `attachments` bucket. The GitHub Pages workflow rewrites it to `prod` when it deploys, so only the live site creates `prod` packages, with uploads under `prod/`. The database also defaults to `dev`.

- See real packages only: `select * from packages where env = 'prod';`
- Wipe test packages: `delete from packages where env = 'dev';`, then in **Storage → attachments** delete the `dev` folder.

The tag is a label, not a security boundary. Anyone can send packages to the backend, so don't rely on `env` to keep anything secret.

### "Don't open until" and opened notices

Both need `005_open_at_and_tracking.sql`.

- **Don't open until.** An optional date and time on the send receipt. Until then the recipient sees the box with a "do not open until" sticker and a countdown. The database holds the contents back (`get_package` returns only names, the open time and the item count), so they can't be read early. Without Supabase, the date travels inside the link and is only enforced by the page.
- **Opened notice.** Generating a link also gives the sender a private tracking link (`?track=<id>.<token>`); only a hash of the token is stored. The first time the recipient taps the box open, `opened_at` is recorded. The tracking page and the "sent packages" list on the send receipt show sealed / not opened yet / opened with the time. Opening your own link in the browser you sent it from doesn't count, and recipients are told the sender will see when they open it.

### Browsing packages

Run `supabase/migrations/003_admin_views.sql`, then in **Table Editor** switch the schema dropdown to `admin`:

| view | shows |
| --- | --- |
| `packages_overview` | one row per package: to, from, env, item counts by type |
| `package_items` | one row per item, raw JSON included |
| `notes`, `photos`, `songs`, `videos`, `coupons` | one view per item type with readable columns |

Every view has an `env` column, so you can filter to `prod` in the dashboard. The views live in `admin`, not `public`, so the app's public key can't read them.

## Deploy

GitHub Pages, through `.github/workflows/pages.yml`:

1. On GitHub, open the repo's **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Push to `main`. The workflow sets `env.js` to `prod` and publishes the site to `https://<user>.github.io/boxofgoodies/`.

Don't use "Deploy from a branch". That would serve the committed `env.js`, and real users' packages would be tagged `dev`.

## Files

| file | what |
| --- | --- |
| `index.html` | editor and recipient view (one page, switched by `?p=<id>` or `#d=<data>`) |
| `app.js` | all behaviour: catalog, cart, dialogs, upload, link generation, viewer |
| `icons.js` | SVG artwork for each item, plus the barcode generator |
| `styles.css` | cardboard, receipt paper, shipping label, stamp, parcel |
| `config.js` | Supabase URL and anon key |
| `env.js` | `dev` in the repo; the deploy workflow sets it to `prod` |
| `supabase/schema.sql` | base table, read function, storage bucket |
| `supabase/migrations/` | dev/prod tag (002), dashboard views (003), abuse limits (004), open date and tracking (005) |
| `.github/workflows/pages.yml` | deploys to GitHub Pages as `prod`, with versioned asset URLs |
| `serve.py` | local dev server without caching |

## Adding more item types

Add an entry to `TYPES` in `app.js` (label and form fields), add artwork under the same key in `ICONS` in `icons.js`, and add a branch to `openItem()` to control how the item looks when opened.
