"""Whole page health: images, overlays and load time."""

import json
from pathlib import Path

import pytest
from playwright.sync_api import expect

from helpers import broken_images, item_cards, open_store

LOAD_BUDGET_MS = 5_000

FIRST_CARD_TIMER = """
new MutationObserver((_, observer) => {
  if (document.querySelector('.item-card')) {
    window.__firstItemCardMs = performance.now();
    observer.disconnect();
  }
}).observe(document, { childList: true, subtree: true });
"""


@pytest.mark.smoke
def test_no_broken_images(page, site_url, site_origin):
    open_store(page, site_url)

    assert broken_images(page, site_origin) == []


@pytest.mark.allow_site_errors
def test_broken_image_check_catches_a_missing_image(page, site_url, site_origin, catalog):
    """Failure path: prove the check above isn't vacuous by breaking one image."""
    item = next((i for i in catalog if i.get("image")), None)
    if not item:
        pytest.skip("No item in items.json has an image")
    page.route(f"**/{item['image']}", lambda route: route.fulfill(status=404))
    open_store(page, site_url)

    assert broken_images(page, site_origin) == [site_url + item["image"]]


@pytest.mark.smoke
def test_overlays_are_closed_on_page_load(page, site_url):
    """Regression test for issue #1: .overlay's display:flex overrode [hidden],
    so the item, cart and checkout overlays rendered open and blocked the site."""
    open_store(page, site_url)

    expect(page.get_by_role("dialog")).to_have_count(0)
    item_cards(page).first.click(trial=True)  # nothing covers the grid


@pytest.mark.smoke
def test_page_loads_within_budget(page, site_url, pytestconfig):
    page.add_init_script(FIRST_CARD_TIMER)
    open_store(page, site_url)

    metrics = page.evaluate(
        """() => ({
            first_item_card_ms: Math.round(window.__firstItemCardMs),
            dom_content_loaded_ms: Math.round(
                performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd),
        })"""
    )
    metrics.update(url=site_url, budget_ms=LOAD_BUDGET_MS)
    output = Path(pytestconfig.getoption("output"))
    output.mkdir(parents=True, exist_ok=True)
    (output / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")

    assert metrics["dom_content_loaded_ms"] <= LOAD_BUDGET_MS, metrics
    assert metrics["first_item_card_ms"] <= LOAD_BUDGET_MS, metrics
