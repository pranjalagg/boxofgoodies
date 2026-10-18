# box of goodies

A digital care package. Pick a few things (note, photo, song, video, coupon), tuck them into a box, and send the link. The person who gets it sees "you've got mail", taps the box, and opens each item.

Plain HTML/CSS/JS with no build step. Supabase stores packages and uploaded photos and videos.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

(ES modules don't load from `file://`, so you need a local server.)

If `config.js` is empty, the app runs without a backend. Links then carry the whole package in the URL, and photo/video uploads are turned off. Song and YouTube links still work.

## Set up Supabase (needed for uploads and short links)

1. Create a free project at https://supabase.com.
2. Open **SQL Editor**, paste `supabase/schema.sql`, and run it. This creates:
   - the `packages` table, which anyone can insert into but nobody can list
   - the `get_package(id)` function, used to read a single package
   - a public `attachments` storage bucket (50 MB per file, images and videos only)
3. Go to **Project Settings → API**, copy the Project URL and the `anon` public key, and paste them into `config.js`.

The anon key is safe to ship in the frontend. What it can do is limited by the policies in the schema.

If you set up the database before the dev/prod split, also run `supabase/migrations/002_env.sql`.

### Test data vs real data

Packages made from `localhost` / `127.0.0.1` are tagged `env = 'dev'`, and their uploads go under `dev/` in the `attachments` bucket. Packages made on the deployed site are tagged `prod`, with uploads under `prod/`.

- See real packages only: `select * from packages where env = 'prod';`
- Wipe test packages: `delete from packages where env = 'dev';`, then in **Storage → attachments** delete the `dev` folder.

The tag is a label, not a security boundary. Anyone can send packages to the backend, so don't rely on `env` to keep anything secret.

## Deploy

**Vercel:** push to GitHub, then in Vercel choose *Add New → Project*, import the repo, and keep the defaults (no framework, no build command). Or run `npx vercel` in this folder.

**GitHub Pages:** push to GitHub, open *Settings → Pages*, and set the source to deploy from the branch root.

## Files

| file | what |
| --- | --- |
| `index.html` | editor and recipient view (one page, switched by `?p=<id>` or `#d=<data>`) |
| `app.js` | all behaviour: catalog, cart, dialogs, upload, link generation, viewer |
| `icons.js` | SVG artwork for each item, plus the barcode generator |
| `styles.css` | cardboard, receipt paper, shipping label, stamp, parcel |
| `config.js` | Supabase URL and anon key |
| `supabase/schema.sql` | table, read function, storage bucket and policies |

## Adding more item types

Add an entry to `TYPES` in `app.js` (label and form fields), add artwork under the same key in `ICONS` in `icons.js`, and add a branch to `openItem()` to control how the item looks when opened.
