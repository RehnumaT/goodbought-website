"""Item detail modal and the cart."""

import pytest
from playwright.sync_api import expect

from helpers import item_card, item_dialog, open_store, read_cart


@pytest.mark.smoke
def test_add_to_cart_with_quantity_two(page, site_url, catalog):
    item = catalog[0]
    open_store(page, site_url)
    badge = page.locator("#cartCount")

    item_card(page, item).click()
    dialog = item_dialog(page, item)
    dialog.get_by_role("button", name="Increase quantity").click()
    expect(dialog.locator("#qtyInput")).to_have_value("2")
    dialog.get_by_role("button", name="Add to Cart").click()

    expect(dialog.get_by_text("✓ Added to cart")).to_be_visible()
    expect(badge).to_have_text("2")
    cart = read_cart(page)
    assert [(line["id"], line["price"], line["qty"]) for line in cart] == [
        (item["id"], item["price"], 2)
    ]


@pytest.mark.xfail(
    strict=True,
    reason="CSS display:flex on .cart-btn__count overrides [hidden], so an empty cart shows a 0 badge; see issue",
)
def test_cart_badge_is_hidden_when_cart_is_empty(page, site_url):
    open_store(page, site_url)

    assert read_cart(page) == []
    expect(page.locator("#cartCount")).to_be_hidden()


def test_quantity_cannot_go_below_one(page, site_url, catalog):
    """Failure path: minus at 1 and a typed 0 both stay at 1, and the cart gets 1."""
    item = catalog[0]
    open_store(page, site_url)

    item_card(page, item).click()
    dialog = item_dialog(page, item)
    quantity = dialog.locator("#qtyInput")
    dialog.get_by_role("button", name="Decrease quantity").click()
    expect(quantity).to_have_value("1")

    quantity.fill("0")
    quantity.press("Tab")  # the site clamps the value on the change event
    expect(quantity).to_have_value("1")
    dialog.get_by_role("button", name="Add to Cart").click()

    expect(page.locator("#cartCount")).to_have_text("1")
    assert [(line["id"], line["qty"]) for line in read_cart(page)] == [(item["id"], 1)]
