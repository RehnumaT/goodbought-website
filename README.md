# Goodbought Website

A simple, free, static website for Goodbought — a family-run liquidation store
at 700 E Main St, Larksville, PA. Built as plain HTML/CSS/JS so it can be
hosted for free and edited by anyone, no build tools required.

## Files

- `index.html` — the page content/structure
- `styles.css` — all styling
- `script.js` — renders the item grid + filters, mobile nav
- `items.json` — the product listings the site displays

## Editing the items

Open `items.json` and edit the array. Each item looks like:

```json
{
  "id": "unique-id",
  "name": "Item name",
  "category": "Furniture",
  "price": 45,
  "originalPrice": 110,
  "icon": "🪑",
  "tag": "New Arrival",
  "description": "Short description.",
  "source": "manual"
}
```

`tag` can be `"New Arrival"`, `"Almost Gone"`, `"Staff Pick"`, or `null`.
Right now these are **sample items** — swap in the family's real inventory
whenever it's convenient, or see the automation note below.

## Previewing locally

Just double-click `index.html` to open it in a browser — no server needed.
(If you want `items.json` to load over `fetch()` instead of the built-in
fallback, run a local server instead, e.g. `python3 -m http.server` from
this folder, then visit `http://localhost:8000`.)

## Publishing for free with GitHub Pages

1. Create a free GitHub account if you don't have one: https://github.com/signup
2. Create a new repository (e.g. `goodbought-website`), public, no README/gitignore needed.
3. Upload these files (`index.html`, `styles.css`, `script.js`, `items.json`) to the repo — either drag-and-drop them in the GitHub web UI ("Add file" → "Upload files"), or via git:
   ```
   git init
   git add .
   git commit -m "Goodbought website"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/goodbought-website.git
   git push -u origin main
   ```
4. In the repo, go to **Settings → Pages**.
5. Under "Build and deployment", set **Source** to "Deploy from a branch", branch `main`, folder `/ (root)`. Save.
6. After a minute or two, the site will be live at:
   `https://YOUR-USERNAME.github.io/goodbought-website/`
7. Optional: if the family buys a domain later (e.g. `goodbought.com` again), it can be pointed at the GitHub Pages site via a custom domain in the same Settings → Pages screen.

## Making it truly "automatic" from Facebook

Right now item data is edited by hand in `items.json`. To make it pull
automatically from Facebook, someone with **admin access to the Facebook
Page** would need to:

1. Create a Facebook App in Meta's developer portal and request the
   relevant permissions (e.g. `pages_read_engagement`, or Commerce/Catalog
   API access if they sell through Facebook Shops) — this requires Meta's
   app review process.
2. Generate a long-lived Page Access Token.
3. Set up a small scheduled job (a free option: a GitHub Action running on
   a schedule, or a free-tier serverless function) that calls the Facebook
   Graph API, reads the latest posts/catalog items, and rewrites
   `items.json` in the repo automatically. Since GitHub Pages redeploys on
   every push, the live site updates itself.

This is a bigger, separate project (it needs the store's own Facebook
credentials), but the site is already structured so that swapping in a
real feed just means updating what generates `items.json` — no changes to
`index.html`, `styles.css`, or `script.js` are needed.

An easier middle ground with no coding: use a no-code automation tool like
Zapier or Make.com to watch the Facebook Page and update a Google
Sheet, then adjust `script.js`'s `loadItems()` to fetch that sheet
(published as CSV/JSON) instead of `items.json`.
