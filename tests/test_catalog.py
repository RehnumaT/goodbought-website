"""The product grid shows exactly what items.json says, with correct prices."""

import pytest
from playwright.sync_api import expect

from helpers import grid_price, item_card, item_cards, open_store


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
