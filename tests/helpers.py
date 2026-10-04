"""Shared helpers for the Goodbought end to end tests.

The money formatters are the test oracle: they reproduce, in Python, the two
formats the site uses, so expected text is computed from items.json instead of
being hardcoded.
"""

import time
from decimal import ROUND_HALF_UP, Decimal

import pytest
from playwright.sync_api import Page, expect

CART_STORAGE_KEY = "goodbought-cart"


# ---------------------------------------------------------------- money

def grid_price(amount) -> str:
    """Format like currency() in script.js (the item grid).

    Whole dollars show no cents ($45), anything else shows two decimals
    ($32.50), both with comma grouping.
    """
    value = Decimal(amount)  # exact binary value, like Intl.NumberFormat rounds
    if value == value.to_integral_value():
        return f"${value:,.0f}"
    return f"${value.quantize(Decimal('0.01'), ROUND_HALF_UP):,.2f}"


def fixed_price(amount: float) -> str:
    """Format like formatMoney() in js/ui.js: "$" + n.toFixed(2).

    toFixed rounds the exact binary value of the float, and rounds ties up.
    Decimal(float) keeps that exact binary value, so ROUND_HALF_UP matches it.
    No comma grouping, same as toFixed.
    """
    return "$" + str(Decimal(amount).quantize(Decimal("0.01"), ROUND_HALF_UP))


# ---------------------------------------------------------------- catalog

def pick_item(items: list[dict], predicate, description: str) -> dict:
    """Return the first item matching predicate, or skip the test."""
    for item in items:
        if predicate(item):
            return item
    pytest.skip(f"No item in items.json is {description}")


def has_cents(amount) -> bool:
    return amount is not None and Decimal(str(amount)) % 1 != 0


# ---------------------------------------------------------------- page

def open_store(page: Page, site_url: str) -> None:
    """Open the home page and wait until the item grid has rendered."""
    page.goto(site_url)
    expect(item_cards(page).first).to_be_visible()


def item_cards(page: Page):
    return page.locator(".item-card")


def item_card(page: Page, item: dict):
    # data-id is a stable contract. The role/label locator would be more user
    # facing, but item names with quotes break the label (see test_catalog),
    # and that bug should fail one test, not every test that opens an item.
    return page.locator(f'.item-card[data-id="{item["id"]}"]')


def item_dialog(page: Page, item: dict):
    return page.get_by_role("dialog", name=item["name"], exact=True)


def read_cart(page: Page) -> list[dict]:
    """Return the cart as saved in localStorage (the real state, not the screen)."""
    return page.evaluate(
        "key => JSON.parse(window.localStorage.getItem(key) || '[]')",
        CART_STORAGE_KEY,
    )


# ---------------------------------------------------------------- polling

def wait_until(condition, timeout: float, interval: float, message: str):
    """Poll condition() until it returns something truthy, then return that value.

    For external state only (for example, a deploy going live). UI tests use
    Playwright's expect, which already waits.
    """
    deadline = time.monotonic() + timeout
    last_error = None
    while True:
        try:
            result = condition()
            if result:
                return result
        except Exception as error:  # keep polling through transient failures
            last_error = error
        if time.monotonic() >= deadline:
            detail = f" Last error: {last_error!r}" if last_error else ""
            raise TimeoutError(f"{message} (waited {timeout}s).{detail}")
        time.sleep(interval)
