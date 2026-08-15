/*
  Cart state, backed by localStorage so it survives a page refresh.
  Fires a "cart:updated" event on document whenever it changes, so any
  UI (header badge, cart drawer, checkout total) can just listen and
  re-render instead of being called directly.
*/

const CART_STORAGE_KEY = "goodbought-cart";

function readCart() {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function writeCart(cart) {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  document.dispatchEvent(new CustomEvent("cart:updated", { detail: cart }));
}

const Cart = {
  get() {
    return readCart();
  },

  addItem(item, qty) {
    const cart = readCart();
    const existing = cart.find((line) => line.id === item.id);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image || null,
        icon: item.icon || "🏷️",
        qty,
      });
    }
    writeCart(cart);
  },

  setQty(id, qty) {
    let cart = readCart();
    if (qty <= 0) {
      cart = cart.filter((line) => line.id !== id);
    } else {
      const line = cart.find((l) => l.id === id);
      if (line) line.qty = qty;
    }
    writeCart(cart);
  },

  removeItem(id) {
    const cart = readCart().filter((line) => line.id !== id);
    writeCart(cart);
  },

  clear() {
    writeCart([]);
  },

  count() {
    return readCart().reduce((sum, line) => sum + line.qty, 0);
  },

  subtotal() {
    return readCart().reduce((sum, line) => sum + line.price * line.qty, 0);
  },

  tax() {
    const rate = (window.STORE_CONFIG && window.STORE_CONFIG.SALES_TAX_RATE) || 0;
    return this.subtotal() * rate;
  },

  total() {
    return this.subtotal() + this.tax();
  },
};

window.Cart = Cart;
