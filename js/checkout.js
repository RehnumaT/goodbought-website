/*
  PayPal checkout (PayPal button + guest debit/credit card + Apple Pay /
  Google Pay when eligible) and order notification via Formspree.

  No backend: the PayPal JS SDK creates and captures the order directly
  from the browser using only the public Client ID in js/config.js
  (never a secret key — those are never safe to use from a webpage).
  This is PayPal's documented no-backend integration path, suited to a
  small store like this one. The one tradeoff of skipping a backend is
  that order amounts aren't independently re-verified server-side
  before capture; if this store ever needs that extra layer, a small
  serverless function can be added later without changing this UI.
*/

let paypalSdkPromise = null;
let paypalButtonsRendered = false;

function qsc(id) {
  return document.getElementById(id);
}

function loadPayPalSdk() {
  if (paypalSdkPromise) return paypalSdkPromise;
  paypalSdkPromise = new Promise((resolve, reject) => {
    const cfg = window.STORE_CONFIG || {};
    const script = document.createElement("script");
    const params = new URLSearchParams({
      "client-id": cfg.PAYPAL_CLIENT_ID || "sb",
      currency: cfg.CURRENCY || "USD",
      intent: "capture",
      components: "buttons,applepay,googlepay",
    });
    script.src = "https://www.paypal.com/sdk/js?" + params.toString();
    script.addEventListener("load", () => resolve(window.paypal));
    script.addEventListener("error", () => reject(new Error("PayPal SDK failed to load")));
    document.head.appendChild(script);
  });
  return paypalSdkPromise;
}

function showCheckoutError(message) {
  const el = qsc("checkoutError");
  el.textContent = message;
  el.hidden = !message;
}

function validateCheckoutFields() {
  const name = qsc("checkoutName").value.trim();
  const phone = qsc("checkoutPhone").value.trim();
  if (!name) {
    showCheckoutError("Please enter your name so we know whose order this is.");
    return null;
  }
  if (phone.replace(/\D/g, "").length < 7) {
    showCheckoutError("Please enter a phone number we can reach you at.");
    return null;
  }
  if (!Cart.get().length) {
    showCheckoutError("Your cart is empty.");
    return null;
  }
  showCheckoutError("");
  return { name, phone };
}

function buildOrderPayload() {
  const cart = Cart.get();
  const currency = (window.STORE_CONFIG && window.STORE_CONFIG.CURRENCY) || "USD";
  const itemTotal = Cart.subtotal();
  const taxTotal = Cart.tax();
  const total = Cart.total();

  return {
    purchase_units: [
      {
        description: `${(window.STORE_CONFIG || {}).STORE_NAME || "Store"} order — pickup in store`,
        amount: {
          currency_code: currency,
          value: total.toFixed(2),
          breakdown: {
            item_total: { currency_code: currency, value: itemTotal.toFixed(2) },
            tax_total: { currency_code: currency, value: taxTotal.toFixed(2) },
          },
        },
        items: cart.map((line) => ({
          name: line.name.slice(0, 127),
          unit_amount: { currency_code: currency, value: line.price.toFixed(2) },
          quantity: String(line.qty),
          category: "PHYSICAL_GOODS",
        })),
      },
    ],
  };
}

async function notifyStoreOfOrder({ name, phone, orderId, payerEmail }) {
  const cfg = window.STORE_CONFIG || {};
  if (!cfg.FORMSPREE_FORM_ID) return; // notifications not configured yet

  const cart = Cart.get();
  const itemsText = cart.map((l) => `${l.qty} x ${l.name} — ${formatMoney(l.price * l.qty)}`).join("\n");
  const body = {
    _subject: `New pickup order from ${name}`,
    name,
    phone,
    payer_email: payerEmail || "",
    paypal_order_id: orderId,
    items: itemsText,
    subtotal: formatMoney(Cart.subtotal()),
    tax: formatMoney(Cart.tax()),
    total: formatMoney(Cart.total()),
    fulfillment: "Pickup in store — " + (cfg.STORE_ADDRESS || ""),
  };

  try {
    await fetch(`https://formspree.io/f/${cfg.FORMSPREE_FORM_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.warn("Order notification email failed to send (payment still succeeded):", e);
  }
}

function showConfirmation({ name, orderId }) {
  const cfg = window.STORE_CONFIG || {};
  qsc("checkoutForm").hidden = true;
  const confirmation = qsc("checkoutConfirmation");
  confirmation.hidden = false;
  qsc("confirmationText").textContent =
    `Thanks, ${name}! Order #${orderId.slice(-8).toUpperCase()} is paid and ready to prep. ` +
    `Swing by ${cfg.STORE_ADDRESS || "the store"} during store hours and show this confirmation (or your PayPal receipt) at pickup.`;
  Cart.clear();
}

async function handleApprove(data, actions, fields) {
  try {
    const details = await actions.order.capture();
    const payerEmail = details && details.payer && details.payer.email_address;
    await notifyStoreOfOrder({ name: fields.name, phone: fields.phone, orderId: data.orderID, payerEmail });
    showConfirmation({ name: fields.name, orderId: data.orderID });
  } catch (e) {
    console.error(e);
    showCheckoutError("Something went wrong finishing your payment. You have not been charged — please try again, or call/text us.");
  }
}

function renderStandardButtons(paypal) {
  paypal
    .Buttons({
      style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal" },
      createOrder: (data, actions) => {
        const fields = validateCheckoutFields();
        if (!fields) return Promise.reject(new Error("validation failed"));
        return actions.order.create(buildOrderPayload());
      },
      onApprove: (data, actions) => {
        const fields = { name: qsc("checkoutName").value.trim(), phone: qsc("checkoutPhone").value.trim() };
        return handleApprove(data, actions, fields);
      },
      onError: (err) => {
        console.error(err);
        showCheckoutError("PayPal ran into a problem loading. Please try again, or call/text us to place your order.");
      },
    })
    .render("#paypal-button-container");
}

function renderAltFundingButton(paypal, fundingSource, containerId) {
  const container = qsc(containerId);
  const button = paypal.Buttons({
    fundingSource,
    style: { layout: "vertical", shape: "rect" },
    createOrder: (data, actions) => {
      const fields = validateCheckoutFields();
      if (!fields) return Promise.reject(new Error("validation failed"));
      return actions.order.create(buildOrderPayload());
    },
    onApprove: (data, actions) => {
      const fields = { name: qsc("checkoutName").value.trim(), phone: qsc("checkoutPhone").value.trim() };
      return handleApprove(data, actions, fields);
    },
    onError: (err) => {
      console.error(err);
      showCheckoutError("That payment method ran into a problem. Please try again, or use another option below.");
    },
  });

  if (button.isEligible()) {
    container.hidden = false;
    button.render("#" + containerId);
  } else {
    container.hidden = true;
  }
}

function ensurePayPalButtonsRendered() {
  if (paypalButtonsRendered) return;
  qsc("applepay-button-container").hidden = true;
  qsc("googlepay-button-container").hidden = true;

  loadPayPalSdk()
    .then((paypal) => {
      // The main PayPal + guest card buttons are the ones that must work.
      // Apple Pay / Google Pay are a bonus — if either throws (e.g. not
      // yet enabled on the merchant account, or the SDK build doesn't
      // expose that funding source), it must not take down checkout.
      renderStandardButtons(paypal);
      paypalButtonsRendered = true;

      try {
        if (paypal.FUNDING && paypal.FUNDING.APPLEPAY) {
          renderAltFundingButton(paypal, paypal.FUNDING.APPLEPAY, "applepay-button-container");
        }
      } catch (e) {
        console.warn("Apple Pay button unavailable:", e);
      }
      try {
        if (paypal.FUNDING && paypal.FUNDING.GOOGLEPAY) {
          renderAltFundingButton(paypal, paypal.FUNDING.GOOGLEPAY, "googlepay-button-container");
        }
      } catch (e) {
        console.warn("Google Pay button unavailable:", e);
      }
    })
    .catch((err) => {
      console.error(err);
      paypalButtonsRendered = false;
      const cfg = window.STORE_CONFIG || {};
      showCheckoutError(
        `Online payment isn't loading right now. Please call/text us at ${cfg.STORE_PHONE || "the store"} and we'll set your order aside.`
      );
    });
}

function renderCheckoutSummary() {
  const cart = Cart.get();
  const lines = cart.map((l) => `<div class="checkout-summary__row"><span>${l.qty} × ${l.name}</span><span>${formatMoney(l.price * l.qty)}</span></div>`).join("");
  qsc("checkoutSummary").innerHTML = `
    ${lines}
    <div class="checkout-summary__row"><span>Subtotal</span><span>${formatMoney(Cart.subtotal())}</span></div>
    <div class="checkout-summary__row"><span>Sales tax (6%)</span><span>${formatMoney(Cart.tax())}</span></div>
    <div class="checkout-summary__row checkout-summary__row--total"><span>Total</span><span>${formatMoney(Cart.total())}</span></div>
  `;
}

function openCheckoutModal() {
  showCheckoutError("");
  qsc("checkoutForm").hidden = false;
  qsc("checkoutConfirmation").hidden = true;
  renderCheckoutSummary();
  qsc("checkoutOverlay").hidden = false;
  document.body.classList.add("no-scroll");
  ensurePayPalButtonsRendered();
}

function closeCheckoutModal() {
  qsc("checkoutOverlay").hidden = true;
  document.body.classList.remove("no-scroll");
}

document.addEventListener("DOMContentLoaded", () => {
  qsc("checkoutClose").addEventListener("click", closeCheckoutModal);
  qsc("checkoutDoneBtn").addEventListener("click", closeCheckoutModal);
  qsc("checkoutOverlay").addEventListener("click", (e) => {
    if (e.target === qsc("checkoutOverlay")) closeCheckoutModal();
  });
});

window.openCheckoutModal = openCheckoutModal;
window.closeCheckoutModal = closeCheckoutModal;
