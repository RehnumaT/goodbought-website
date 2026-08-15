/*
  Item detail modal + cart drawer UI. Reads/writes cart state through
  the Cart API (js/cart.js). Checkout modal open/close lives here too;
  its PayPal wiring lives in js/checkout.js.
*/

let currentModalItem = null;

function formatMoney(n) {
  return "$" + Number(n).toFixed(2);
}

function qs(id) {
  return document.getElementById(id);
}

/* ---------------- Item detail modal ---------------- */

function openItemModal(item) {
  currentModalItem = item;
  qs("itemModalCategory").textContent = item.category;
  qs("itemModalName").textContent = item.name;
  qs("itemModalDesc").textContent = item.description || "";
  qs("itemModalPrice").textContent = formatMoney(item.price);
  qs("itemModalMedia").innerHTML = item.image
    ? `<img src="${item.image}" alt="${item.name}">`
    : `<span>${item.icon || "🏷️"}</span>`;
  qs("qtyInput").value = 1;
  qs("addToCartConfirm").hidden = true;
  qs("itemModalOverlay").hidden = false;
  document.body.classList.add("no-scroll");
}

function closeItemModal() {
  qs("itemModalOverlay").hidden = true;
  currentModalItem = null;
  document.body.classList.remove("no-scroll");
}

function stepQty(delta) {
  const input = qs("qtyInput");
  const next = Math.max(1, (parseInt(input.value, 10) || 1) + delta);
  input.value = next;
}

/* ---------------- Cart drawer ---------------- */

function cartLineHTML(line) {
  const media = line.image ? `<img src="${line.image}" alt="${line.name}">` : `<span>${line.icon || "🏷️"}</span>`;
  return `
    <div class="cart-line" data-id="${line.id}">
      <div class="cart-line__media">${media}</div>
      <div class="cart-line__body">
        <div class="cart-line__name">${line.name}</div>
        <div class="cart-line__price">${formatMoney(line.price)} each</div>
        <div class="cart-line__controls">
          <div class="qty-stepper qty-stepper--small">
            <button type="button" class="cart-qty-minus" aria-label="Decrease quantity">−</button>
            <input type="number" class="cart-qty-input" value="${line.qty}" min="1" step="1" inputmode="numeric">
            <button type="button" class="cart-qty-plus" aria-label="Increase quantity">+</button>
          </div>
          <button type="button" class="cart-line__remove" aria-label="Remove ${line.name}">Remove</button>
        </div>
      </div>
      <div class="cart-line__total">${formatMoney(line.price * line.qty)}</div>
    </div>
  `;
}

function renderCartDrawer() {
  const cart = Cart.get();
  const linesEl = qs("cartLines");
  const footerEl = qs("cartFooter");

  if (!cart.length) {
    linesEl.innerHTML = `<p class="cart-empty">Your cart is empty. Tap any item to add it.</p>`;
    footerEl.hidden = true;
    return;
  }

  footerEl.hidden = false;
  linesEl.innerHTML = cart.map(cartLineHTML).join("");
  qs("cartSubtotal").textContent = formatMoney(Cart.subtotal());
  qs("cartTax").textContent = formatMoney(Cart.tax());
  qs("cartTotal").textContent = formatMoney(Cart.total());
}

function updateCartBadge() {
  const count = Cart.count();
  const badge = qs("cartCount");
  badge.textContent = count;
  badge.hidden = count === 0;
}

function openCartDrawer() {
  renderCartDrawer();
  qs("cartOverlay").hidden = false;
  document.body.classList.add("no-scroll");
}

function closeCartDrawer() {
  qs("cartOverlay").hidden = true;
  document.body.classList.remove("no-scroll");
}

/* ---------------- Wiring ---------------- */

function initOverlayDismiss(overlayId, closeFn) {
  const overlay = qs(overlayId);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeFn();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Item modal
  qs("itemModalClose").addEventListener("click", closeItemModal);
  initOverlayDismiss("itemModalOverlay", closeItemModal);
  qs("qtyMinus").addEventListener("click", () => stepQty(-1));
  qs("qtyPlus").addEventListener("click", () => stepQty(1));
  qs("qtyInput").addEventListener("change", () => {
    const input = qs("qtyInput");
    input.value = Math.max(1, parseInt(input.value, 10) || 1);
  });
  qs("addToCartBtn").addEventListener("click", () => {
    if (!currentModalItem) return;
    const qty = Math.max(1, parseInt(qs("qtyInput").value, 10) || 1);
    Cart.addItem(currentModalItem, qty);
    qs("addToCartConfirm").hidden = false;
  });

  // Cart drawer
  qs("cartBtn").addEventListener("click", openCartDrawer);
  qs("cartClose").addEventListener("click", closeCartDrawer);
  initOverlayDismiss("cartOverlay", closeCartDrawer);

  qs("cartLines").addEventListener("click", (e) => {
    const line = e.target.closest(".cart-line");
    if (!line) return;
    const id = line.dataset.id;
    const cartLine = Cart.get().find((l) => l.id === id);
    if (!cartLine) return;

    if (e.target.classList.contains("cart-qty-minus")) {
      Cart.setQty(id, cartLine.qty - 1);
    } else if (e.target.classList.contains("cart-qty-plus")) {
      Cart.setQty(id, cartLine.qty + 1);
    } else if (e.target.classList.contains("cart-line__remove")) {
      Cart.removeItem(id);
    }
  });

  qs("cartLines").addEventListener("change", (e) => {
    if (!e.target.classList.contains("cart-qty-input")) return;
    const line = e.target.closest(".cart-line");
    const qty = Math.max(1, parseInt(e.target.value, 10) || 1);
    Cart.setQty(line.dataset.id, qty);
  });

  qs("checkoutBtn").addEventListener("click", () => {
    closeCartDrawer();
    if (window.openCheckoutModal) window.openCheckoutModal();
  });

  document.addEventListener("cart:updated", () => {
    updateCartBadge();
    if (!qs("cartOverlay").hidden) renderCartDrawer();
  });

  updateCartBadge();
});

window.openItemModal = openItemModal;
window.closeItemModal = closeItemModal;
window.openCartDrawer = openCartDrawer;
window.closeCartDrawer = closeCartDrawer;
window.formatMoney = formatMoney;
