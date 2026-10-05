"""The product grid shows exactly what items.json says, with correct prices."""

import pytest
from playwright.sync_api import expect

from helpers import grid_price, item_card, item_cards, js_round, open_store, pick_item


@pytest.mark.smoke
def test_every_item_is_listed(page, site_url, catalog):
    open_store(page, site_url)

    expect(item_cards(page)).to_have_count(len(catalog))
    for item in catalog:
        card = item_card(page, item)
        expect(card).to_have_count(1)
        expect(card.get_by_text(item["name"], exact=True)).to_be_visible()


@pytest.mark.smoke
def test_prices_keep_their_cents(page, site_url, catalog):
    """Regression test for efb9c9e: $32.50 must not render as $32.5."""
    open_store(page, site_url)

    for item in catalog:
        card = item_card(page, item)
        expect(card.locator(".now")).to_have_text(grid_price(item["price"]))
        if item.get("originalPrice"):
            expect(card.locator(".was")).to_have_text(grid_price(item["originalPrice"]))
        else:
            expect(card.locator(".was")).to_have_count(0)


@pytest.mark.smoke
def test_price_formatter_keeps_cents_for_any_amount(page, site_url):
    """Failure path for the test above.

    test_prices_keep_their_cents can only catch the bug while the inventory
    has an item priced with cents. This calls the site's own currency()
    with fixed amounts, so the regression is caught whatever is in stock.
    The amounts are formatter inputs, not inventory, so hardcoding them is fine.
    """
    open_store(page, site_url)
    amounts = [32.5, 11.92, 45, 0.1, 1234.5, 1000]

    rendered = page.evaluate("amounts => amounts.map(currency)", amounts)

    assert rendered == [grid_price(a) for a in amounts]


def test_discount_badge_matches_prices(page, site_url, catalog):
    open_store(page, site_url)

    for item in catalog:
        badge = item_card(page, item).locator(".item-card__discount")
        original = item.get("originalPrice")
        percent = js_round((1 - item["price"] / original) * 100) if original and original > item["price"] else 0
        if percent:
            expect(badge).to_have_text(f"{percent}% OFF")
        else:
            expect(badge).to_have_count(0)


def test_category_filters_show_only_their_items(page, site_url, catalog):
    open_store(page, site_url)
    categories = list(dict.fromkeys(item["category"] for item in catalog))
    filter_bar = page.locator("#filters")
    expect(filter_bar.get_by_role("button")).to_have_text(["All", *categories])

    for category in [*categories, "All"]:
        filter_bar.get_by_role("button", name=category, exact=True).click()
        for item in catalog:
            card = item_card(page, item)
            if category == "All" or item["category"] == category:
                expect(card).to_be_visible()
            else:
                expect(card).to_be_hidden()


@pytest.mark.xfail(strict=True, reason="Quotes in item names break aria-label; see issue")
def test_item_names_with_quotes_keep_their_screen_reader_label(page, site_url, catalog):
    item = pick_item(catalog, lambda i: '"' in i["name"], "named with a double quote")
    open_store(page, site_url)

    expect(page.get_by_role("button", name=f"View {item['name']}", exact=True)).to_have_count(1)


@pytest.mark.advisory
@pytest.mark.allow_site_errors
def test_fallback_list_matches_items_json(page, site_url, catalog):
    """script.js keeps a second copy of the catalog (FALLBACK_ITEMS) for when
    items.json can't load. Block items.json so the page uses it, then compare.
    Advisory: drift is a real risk, but it only shows when items.json fails."""
    page.route("**/items.json*", lambda route: route.abort())
    open_store(page, site_url)

    shown = page.evaluate("() => window.STORE_ITEMS")

    def key(items):
        return [(i["id"], i["price"], i.get("originalPrice")) for i in items]

    assert key(shown) == key(catalog), "FALLBACK_ITEMS in script.js has drifted from items.json"
