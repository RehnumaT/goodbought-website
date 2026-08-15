/*
  Store checkout configuration.
  ------------------------------------------------------------------
  Fill these in with your real values before going live. Until then,
  the site runs against PayPal's public SANDBOX client ID, so you can
  test the full add-to-cart -> checkout -> pay flow with fake money.

  1. PAYPAL_CLIENT_ID
     - Sandbox (default): PayPal's shared testing client ID, works out
       of the box, no signup needed, no real charges are ever made.
     - Live: create a free PayPal Business account at
       https://www.paypal.com/us/business, then get your own Client ID
       from https://developer.paypal.com/dashboard/applications/live
       Paste it below in place of the sandbox value.

  2. FORMSPREE_FORM_ID
     - Sign up free at https://formspree.io, create a form, and it
       will give you a form ID (looks like "xayzabcd"). Paste it below.
       Every order will then email its details (name, phone, items,
       PayPal transaction ID) to whatever inbox you connect there.
     - Until you set this, order notification emails are skipped —
       the sale still goes through on PayPal's side either way, since
       PayPal itself always emails a receipt to the store's PayPal
       account and the buyer.

  3. Apple Pay / Google Pay buttons appear automatically once you
     enable them in your PayPal Business account settings
     (https://www.paypal.com/businessmanage/preferences/payments).
     Apple Pay additionally requires verifying this exact domain with
     Apple from that same settings page (PayPal walks you through it
     and gives you a small verification file to add to the site).
     Until enabled, those buttons just don't render — everything else
     keeps working normally.
------------------------------------------------------------------ */

window.STORE_CONFIG = {
  PAYPAL_CLIENT_ID: "sb", // "sb" = PayPal's public sandbox client ID for testing
  FORMSPREE_FORM_ID: "", // e.g. "xayzabcd" — leave blank to skip order emails
  CURRENCY: "USD",
  SALES_TAX_RATE: 0.06, // 6% PA state sales tax
  STORE_NAME: "Goodbought",
  STORE_ADDRESS: "700 E Main St, Larksville, PA 18651",
  STORE_PHONE: "(570) 592-6096",
};
