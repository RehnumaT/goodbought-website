# Goodbought Website

A simple, free, static website for Goodbought — a family-run liquidation store
at 700 E Main St, Larksville, PA. Built as plain HTML/CSS/JS so it can be
hosted for free and edited by anyone, no build tools required.

## Files

- `index.html` — the page content/structure
- `styles.css` — all styling
- `script.js` — renders the item grid + filters, mobile nav, item click handling
- `items.json` — the product listings the site displays
- `js/config.js` — store settings: PayPal Client ID, Formspree form ID, tax rate
- `js/cart.js` — shopping cart state (localStorage-backed)
- `js/ui.js` — item detail modal + cart drawer UI
- `js/checkout.js` — PayPal checkout (button, guest card, Apple Pay, Google Pay) + order email

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
  "image": "images/optional-photo.jpg",
  "tag": "New Arrival",
  "description": "Short description.",
  "source": "manual"
}
```

`image` is optional — if set, that photo shows instead of the `icon` emoji,
both on the shop grid and in the item detail popup. `tag` is free text (e.g.
`"New Arrival"`, `"Almost Gone"`, `"Staff Pick"`, or a specific date like
`"Best By 8/20/26"`) or `null` to show no tag. `originalPrice` is optional —
set it to show a "was $X" struck-through price and a "% OFF" badge, or leave
it `null` if there's no comparison price. Right now most of these are
**sample items** — swap in the family's real inventory whenever it's
convenient, or see the automation note below.

## Previewing locally

Just double-click `index.html` to open it in a browser — no server needed.
(If you want `items.json` to load over `fetch()` instead of the built-in
fallback, run a local server instead, e.g. `python3 -m http.server` from
this folder, then visit `http://localhost:8000`.)

## Cart & checkout (pay online, pick up in store)

Clicking any item opens a detail view where a shopper picks a quantity and
adds it to their cart. The cart icon in the header opens a cart drawer where
quantities can be adjusted; "Checkout" collects a name + phone number and
shows PayPal payment options: the PayPal button, a guest debit/credit card
option (no PayPal account needed), and Apple Pay / Google Pay when eligible.
Every order is pickup-only — there's no shipping/delivery flow.

This runs with **no backend/server** — PayPal's JavaScript SDK creates and
captures the payment directly from the browser using a public Client ID
(never a secret key, which should never go in a webpage). This is PayPal's
supported no-backend integration path, well suited to a small store's site.

### Setup checklist before accepting real payments

1. **PayPal Business account** — sign up free at
   https://www.paypal.com/us/business, then grab your live Client ID from
   https://developer.paypal.com/dashboard/applications/live. Paste it into
   `PAYPAL_CLIENT_ID` in `js/config.js`, replacing the default `"sb"`
   sandbox placeholder.
   - Until you do this, the site runs against PayPal's shared **sandbox**
     client ID, so you can test the entire add-to-cart → checkout → pay flow
     with fake sandbox money before going live. Use PayPal's sandbox test
     buyer account (created automatically in your PayPal Developer Dashboard
     under Sandbox → Accounts) to test-purchase.
2. **Apple Pay / Google Pay** — these buttons only appear once enabled in
   your PayPal Business account under
   **Account Settings → Payment methods**. Apple Pay additionally requires
   verifying this exact domain with Apple from that same settings screen —
   PayPal walks you through it and gives you a small verification file to
   add to the site. Until both are enabled, those two buttons simply don't
   render; the PayPal button and guest card option work regardless.
3. **Order notification emails** — sign up free at https://formspree.io,
   create a form, and paste the form ID it gives you into
   `FORMSPREE_FORM_ID` in `js/config.js`. Every completed order (name,
   phone, items, total, PayPal order ID) will then email straight to
   whichever inbox you connect there. Skipping this is fine too — PayPal
   itself always emails a receipt to both the buyer and the store's PayPal
   account regardless of Formspree being set up.
4. **Sales tax** — `SALES_TAX_RATE` in `js/config.js` is set to PA's 6%.
   Update it there if that ever changes.

### A note on going live safely

Because there's no backend, the order amount PayPal charges is calculated
in the browser from the cart contents at checkout time — PayPal does not
independently re-verify it against a trusted source before capturing
payment. For a small store this is a reasonable, well-documented tradeoff
(it's PayPal's own recommended path for sites without a server). If order
values grow enough that this risk matters, a small serverless function
(e.g. on Vercel or Netlify, free tier) could later verify/create the order
server-side instead — the checkout UI wouldn't need to change.

## Publishing for free with GitHub Pages

1. Create a free GitHub account if you don't have one: https://github.com/signup
2. Create a new repository (e.g. `goodbought-website`), public, no README/gitignore needed.
3. Upload this whole folder (including the `js/` and `images/` subfolders) to the repo — either drag-and-drop in the GitHub web UI ("Add file" → "Upload files"), or via git:
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
