"""Checkout modal and the PayPal revenue path.

Safety: these tests never click a PayPal, Apple Pay or Google Pay button.
Name and phone validation only runs inside PayPal's createOrder, so it is a
manual test charter, not an automated one.
"""

import pytest
from playwright.sync_api import expect

from helpers import add_to_cart, cart_totals, fixed_price, open_checkout, open_store, store_config


@pytest.mark.smoke
def test_checkout_summary_matches_cart(page, site_url, catalog):
    item = catalog[0]
    open_store(page, site_url)
    config = store_config(page)
    add_to_cart(page, item, qty=2)

    checkout = open_checkout(page)

    _, _, total = cart_totals([(item["price"], 2)], config["SALES_TAX_RATE"])
    summary = checkout.locator("#checkoutSummary")
    expect(summary).to_contain_text(f"2 × {item['name']}")
    total_row = summary.locator(".checkout-summary__row--total")
    expect(total_row.locator("span")).to_have_text(["Total", fixed_price(total)])
    # The pickup address is hardcoded in index.html; the order confirmation uses
    # STORE_ADDRESS from js/config.js. They must agree.
    expect(checkout.get_by_text(config["STORE_ADDRESS"])).to_be_visible()


@pytest.mark.smoke
def test_paypal_buttons_load(page, site_url, catalog):
    """The revenue path: the PayPal SDK loads and renders its button iframe."""
    open_store(page, site_url)
    add_to_cart(page, catalog[0])

    checkout = open_checkout(page)

    expect(checkout.locator("#paypal-button-container iframe").first).to_be_visible(timeout=20_000)
    expect(checkout.locator("#checkoutError")).to_be_hidden()


@pytest.mark.allow_site_errors
def test_checkout_shows_phone_fallback_when_paypal_fails(page, site_url, catalog):
    """Failure path: if PayPal can't load, shoppers get the store phone number."""
    page.route("https://www.paypal.com/sdk/js**", lambda route: route.abort())
    open_store(page, site_url)
    phone = store_config(page)["STORE_PHONE"]
    add_to_cart(page, catalog[0])

    checkout = open_checkout(page)

    error = checkout.locator("#checkoutError")
    expect(error).to_be_visible()
    expect(error).to_contain_text("Online payment isn't loading right now")
    expect(error).to_contain_text(phone)
    expect(checkout.locator("#paypal-button-container iframe")).to_have_count(0)
