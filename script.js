/*
  Goodbought site script.
  ------------------------------------------------------------------
  Item data currently comes from FALLBACK_ITEMS below (mirrors items.json)
  so the site works even when opened directly as a local file (fetch()
  can't load items.json over the file:// protocol due to browser CORS
  rules). When this site is hosted (e.g. GitHub Pages), it will try to
  fetch the live items.json first.

  FUTURE AUTOMATION HOOK:
  To pull items automatically from Facebook (or Shopify/another source),
  replace loadItems() with a call to your sync source, for example:
    - A small backend/serverless function that polls the Facebook Graph
      API (needs a Page Access Token from the page admin + app review
      for "pages_read_engagement" / catalog permissions), writes results
      into items.json or a database, on a schedule.
    - Or a Zapier/Make.com automation that watches the Facebook Page and
      updates a Google Sheet / Airtable, which this script then fetches.
  As long as whatever you swap in returns an array of objects shaped like
  the ones in items.json, everything below keeps working unchanged.
  ------------------------------------------------------------------
*/

const FALLBACK_ITEMS = [
  { id: "catfood-wholehearted-white-12lb", name: "Whole Hearted Easy Digestion Cat Food, 12 lb (White Bag)", category: "Pet Supplies", price: 11.92, originalPrice: null, icon: "🐱", image: "images/catfood-easy-digestion-white.jpg", tag: "Best By 7/10/26", description: "Whole Hearted Easy Digestion (Chicken & Egg Product Recipe), grain-free, 12 lb bag.\n$11.92 each · 2 for $20 · 5 for $40 (plus 6% state tax)\nWhite bags are just past their best-by date of 7/10/2026 — priced to move fast." },
  { id: "catfood-wholehearted-orange-12lb", name: "Whole Hearted Chicken & Pea Cat Food, 12 lb (Orange Bag)", category: "Pet Supplies", price: 11.92, originalPrice: null, icon: "🐱", image: "images/catfood-chicken-pea-orange.jpg", tag: "Best By 8/20/26", description: "Whole Hearted Grain-Free Complete Nutrition (Chicken & Pea Recipe), 12 lb bag.\n$11.92 each · 2 for $20 · 5 for $40 (plus 6% state tax)\nOrange bags are close to their best-by date of 8/20/2026." },
  { id: "ceiling-fan-54", name: "54\" Ceiling Fan", category: "Home Improvement", price: 45, originalPrice: 110, icon: "🌀", tag: "Almost Gone", description: "Reversible-blade ceiling fan with light kit. New in box." },
  { id: "boat-anchor-fluke", name: "Fluke Boat Anchor, Galvanized Steel (22-25 ft)", category: "Outdoor & Marine", price: 35, originalPrice: 89, icon: "⚓", tag: "New Arrival", description: "Heavy-duty galvanized fluke anchor, rated for boats 22-25 ft." },
  { id: "dining-table-set", name: "Solid Wood Dining Table + 4 Chairs", category: "Furniture", price: 220, originalPrice: 650, icon: "🪑", tag: "Staff Pick", description: "Farmhouse-style dining set, minor wear, very sturdy build." },
  { id: "patio-grill-6burner", name: "Stainless Steel 6-Burner Patio Grill", category: "Outdoor & Garden", price: 180, originalPrice: 499, icon: "🔥", tag: "New Arrival", description: "Propane grill with side burner, cover included." },
  { id: "area-rug-8x10", name: "Farmhouse Area Rug (8x10)", category: "Home Decor", price: 60, originalPrice: 175, icon: "🧵", tag: null, description: "Neutral tone woven rug, great for living or dining rooms." },
  { id: "cordless-drill-kit", name: "Cordless Drill Combo Kit", category: "Tools", price: 55, originalPrice: 140, icon: "🛠️", tag: "Almost Gone", description: "Drill + impact driver kit with two batteries and case." },
  { id: "storage-bins-set6", name: "Stackable Storage Bins (Set of 6)", category: "Home Organization", price: 25, originalPrice: 60, icon: "📦", tag: null, description: "Clear stackable bins with lids, great for closets or garages." },
  { id: "mattress-queen", name: "Queen Memory Foam Mattress", category: "Furniture", price: 150, originalPrice: 400, icon: "🛏️", tag: "New Arrival", description: "10\" memory foam mattress, factory sealed." },
  { id: "wall-mirror-set", name: "Decorative Wall Mirror Set", category: "Home Decor", price: 40, originalPrice: 95, icon: "🪞", tag: null, description: "Set of 3 round mirrors, gold-tone frames." },
  { id: "pressure-washer", name: "Electric Pressure Washer", category: "Tools", price: 70, originalPrice: 175, icon: "💦", tag: "Staff Pick", description: "2000 PSI electric pressure washer with 3 nozzle tips." },
  { id: "cabinet-hardware-lot", name: "Kitchen Cabinet Hardware Bulk Lot", category: "Home Improvement", price: 30, originalPrice: 85, icon: "🔩", tag: null, description: "Assorted brushed-nickel knobs and pulls, 50+ pieces." },
  { id: "patio-sectional", name: "Patio Sectional Sofa Set", category: "Outdoor & Garden", price: 350, originalPrice: 899, icon: "🛋️", tag: "New Arrival", description: "4-piece all-weather wicker sectional with cushions." }
];

async function loadItems() {
  try {
    const res = await fetch("items.json", { cache: "no-store" });
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    if (Array.isArray(data) && data.length) return data;
    throw new Error("empty data");
  } catch (err) {
    return FALLBACK_ITEMS;
  }
}

function currency(n) {
  return "$" + Number(n).toLocaleString("en-US");
}

function discountPercent(price, originalPrice) {
  if (!originalPrice || originalPrice <= price) return 0;
  return Math.round((1 - price / originalPrice) * 100);
}

function itemCardHTML(item) {
  const off = discountPercent(item.price, item.originalPrice);
  return `
    <article class="item-card" data-category="${item.category}" data-id="${item.id}" tabindex="0" role="button" aria-label="View ${item.name}">
      <div class="item-card__media">
        ${item.tag ? `<span class="item-card__tag">${item.tag}</span>` : ""}
        ${off ? `<span class="item-card__discount">${off}% OFF</span>` : ""}
        ${item.image ? `<img src="${item.image}" alt="${item.name}" loading="lazy">` : `<span>${item.icon || "🏷️"}</span>`}
      </div>
      <div class="item-card__body">
        <span class="item-card__category">${item.category}</span>
        <h3 class="item-card__name">${item.name}</h3>
        <p class="item-card__desc">${item.description || ""}</p>
        <div class="item-card__price">
          <span class="now">${currency(item.price)}</span>
          ${item.originalPrice ? `<span class="was">${currency(item.originalPrice)}</span>` : ""}
        </div>
      </div>
    </article>
  `;
}

function renderItems(items) {
  const grid = document.getElementById("itemGrid");
  grid.innerHTML = items.map(itemCardHTML).join("");
}

function initItemGridClicks(items) {
  const grid = document.getElementById("itemGrid");
  function openFromCard(card) {
    const item = items.find((i) => i.id === card.dataset.id);
    if (item && window.openItemModal) window.openItemModal(item);
  }
  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".item-card");
    if (card) openFromCard(card);
  });
  grid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".item-card");
    if (!card) return;
    e.preventDefault();
    openFromCard(card);
  });
}

function renderFilters(items) {
  const filtersEl = document.getElementById("filters");
  const categories = ["All", ...new Set(items.map((i) => i.category))];
  filtersEl.innerHTML = categories
    .map((cat, i) => `<button class="filter-btn${i === 0 ? " active" : ""}" data-filter="${cat}">${cat}</button>`)
    .join("");

  filtersEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    filtersEl.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const filter = btn.dataset.filter;
    document.querySelectorAll(".item-card").forEach((card) => {
      const match = filter === "All" || card.dataset.category === filter;
      card.style.display = match ? "" : "none";
    });
  });
}

function initNav() {
  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("nav");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  nav.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    })
  );
}

async function init() {
  document.getElementById("year").textContent = new Date().getFullYear();
  initNav();
  const items = await loadItems();
  window.STORE_ITEMS = items;
  renderFilters(items);
  renderItems(items);
  initItemGridClicks(items);
  document.dispatchEvent(new CustomEvent("store:items-ready", { detail: items }));
}

document.addEventListener("DOMContentLoaded", init);
