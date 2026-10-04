"""Item detail modal and the cart."""

import re

import pytest
from playwright.sync_api import expect

from helpers import (
    CART_STORAGE_KEY,
    add_to_cart,
    cart_totals,
    fixed_price,
    has_cents,
    item_card,
    item_dialog,
    open_cart,
    open_store,
    pick_item,
    read_cart,
    store_config,
)


def item_images(item: dict) -> list[str]:
    """Same rule as getItemImages() in js/ui.js."""
    if item.get("images"):
        return item["images"]
    return [item["image"]] if item.get("image") else []


def items_without_quotes(catalog: list[dict]) -> list[dict]:
    # "Remove {name}" labels hit the quote bug too; keep that bug in its own test.
    return [item for item in catalog if '"' not in item["name"]]


# ---------------------------------------------------------------- item detail

def test_item_detail_shows_catalog_data(page, site_url, catalog):
    item = catalog[0]
    open_store(page, site_url)

    item_card(page, item).click()
    dialog = item_dialog(page, item)

    expect(dialog.get_by_role("heading", name=item["name"], exact=True)).to_be_visible()
    expect(dialog.locator("#itemModalPrice")).to_have_text(fixed_price(item["price"]))
    expect(dialog.get_by_text(item["category"], exact=True)).to_be_visible()


def test_item_detail_resets_between_items(page, site_url, catalog):
    """Failure path: the modal is reused, so stale name, price or quantity
    from the previous item must not leak into the next one."""
    if len(catalog) < 2:
        pytest.skip("Needs at least two items")
    first, second = catalog[0], catalog[1]
    open_store(page, site_url)

    item_card(page, first).click()
    dialog = item_dialog(page, first)
    dialog.get_by_role("button", name="Increase quantity").click()
    dialog.get_by_role("button", name="Close", exact=True).click()
    item_card(page, second).click()

    dialog = item_dialog(page, second)
    expect(dialog.locator("#itemModalPrice")).to_have_text(fixed_price(second["price"]))
    expect(dialog.get_by_role("spinbutton")).to_have_value("1")


def test_gallery_arrows_move_between_photos(page, site_url, catalog):
    item = pick_item(catalog, lambda i: len(item_images(i)) > 1, "listed with several photos")
    images = item_images(item)
    open_store(page, site_url)

    item_card(page, item).click()
    dialog = item_dialog(page, item)
    photo = dialog.get_by_role("img", name=item["name"], exact=True)
    expect(photo).to_have_attribute("src", images[0])

    dialog.get_by_role("button", name="Next photo").click()
    expect(photo).to_have_attribute("src", images[1])
    dialog.get_by_role("button", name="Previous photo").click()
    expect(photo).to_have_attribute("src", images[0])
    dialog.get_by_role("button", name="Previous photo").click()
    expect(photo).to_have_attribute("src", images[-1])  # wraps around


def test_single_photo_item_has_no_gallery_arrows(page, site_url, catalog):
    """Failure path: arrows on a one photo item would lead nowhere."""
    item = pick_item(catalog, lambda i: len(item_images(i)) == 1, "listed with exactly one photo")
    open_store(page, site_url)

    item_card(page, item).click()
    dialog = item_dialog(page, item)

    expect(dialog.get_by_role("img", name=item["name"], exact=True)).to_be_visible()
    expect(dialog.get_by_role("button", name="Next photo")).to_have_count(0)
    expect(dialog.get_by_role("button", name="Previous photo")).to_have_count(0)


# ---------------------------------------------------------------- add to cart


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


# ---------------------------------------------------------------- cart drawer

def test_cart_totals_match_catalog_and_tax_rate(page, site_url, catalog):
    """Two different items, one with quantity 2, preferring a price with cents
    so rounding is exercised."""
    first = pick_item(catalog, lambda i: has_cents(i["price"]), "priced with cents")
    second = pick_item(catalog, lambda i: i["id"] != first["id"], "a second item")
    open_store(page, site_url)
    rate = store_config(page)["SALES_TAX_RATE"]

    add_to_cart(page, first, qty=2)
    add_to_cart(page, second, qty=1)
    cart = open_cart(page)

    subtotal, tax, total = cart_totals([(first["price"], 2), (second["price"], 1)], rate)
    expect(cart.locator("#cartSubtotal")).to_have_text(fixed_price(subtotal))
    expect(cart.locator("#cartTax")).to_have_text(fixed_price(tax))
    expect(cart.locator("#cartTotal")).to_have_text(fixed_price(total))
    # The label is hardcoded in index.html, separately from SALES_TAX_RATE.
    expect(cart.get_by_text(re.compile(r"^Sales tax"))).to_have_text(f"Sales tax ({rate * 100:g}%)")


def test_cart_survives_a_reload(page, site_url, catalog):
    item = catalog[0]
    open_store(page, site_url)
    add_to_cart(page, item, qty=2)
    saved = read_cart(page)

    page.reload()
    expect(item_card(page, item)).to_be_visible()

    assert read_cart(page) == saved
    expect(page.locator("#cartCount")).to_have_text("2")
    expect(open_cart(page).get_by_text(item["name"], exact=True)).to_be_visible()


def test_corrupt_saved_cart_is_treated_as_empty(page, site_url):
    """Failure path: unreadable localStorage must not break the page."""
    open_store(page, site_url)
    page.evaluate("key => window.localStorage.setItem(key, '{not json')", CART_STORAGE_KEY)

    page.reload()

    expect(open_cart(page).get_by_text("Your cart is empty")).to_be_visible()


def test_cart_drawer_plus_minus_and_remove(page, site_url, catalog):
    items = items_without_quotes(catalog)
    if len(items) < 2:
        pytest.skip("Needs two items whose names have no quotes")
    first, second = items[0], items[1]
    open_store(page, site_url)
    add_to_cart(page, first)
    add_to_cart(page, second)
    cart = open_cart(page)
    first_line = cart.locator(f'[data-id="{first["id"]}"]')

    first_line.get_by_role("button", name="Increase quantity").click()
    expect(first_line.get_by_role("spinbutton")).to_have_value("2")
    expect(page.locator("#cartCount")).to_have_text("3")
    assert {line["id"]: line["qty"] for line in read_cart(page)} == {first["id"]: 2, second["id"]: 1}

    first_line.get_by_role("button", name="Decrease quantity").click()
    expect(first_line.get_by_role("spinbutton")).to_have_value("1")

    cart.get_by_role("button", name=f"Remove {second['name']}", exact=True).click()
    expect(cart.locator(f'[data-id="{second["id"]}"]')).to_have_count(0)
    assert [line["id"] for line in read_cart(page)] == [first["id"]]

    # Minus at quantity 1 removes the line (setQty(0) in js/cart.js).
    first_line.get_by_role("button", name="Decrease quantity").click()
    expect(cart.get_by_text("Your cart is empty")).to_be_visible()
    assert read_cart(page) == []
