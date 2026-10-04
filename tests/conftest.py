"""Fixtures shared by every test.

- site_url: the environment under test, with exactly one trailing slash.
- catalog: items.json fetched from that environment (the source of expected values).
- site_guard (autouse): production safety rails plus observability checks.
"""

import re
import time
from urllib.parse import urlparse

import pytest

FORMSPREE = re.compile(r"^https?://([a-z0-9-]+\.)*formspree\.io(/|$)", re.IGNORECASE)


@pytest.fixture(scope="session")
def site_url(base_url: str) -> str:
    if not base_url:
        pytest.exit("No --base-url given; set it in pytest.ini or on the command line.")
    return base_url.rstrip("/") + "/"


@pytest.fixture(scope="session")
def site_origin(site_url: str) -> str:
    parts = urlparse(site_url)
    return f"{parts.scheme}://{parts.netloc}"


@pytest.fixture(scope="session")
def catalog(playwright, site_url: str) -> list[dict]:
    """items.json from the environment under test, fetched once per run.

    The cache busting query makes sure a CDN (GitHub Pages) can't hand us an
    older copy than the page itself loads.
    """
    request = playwright.request.new_context()
    try:
        response = request.get(f"{site_url}items.json?t={int(time.time())}")
        assert response.ok, f"items.json returned HTTP {response.status}"
        items = response.json()
    finally:
        request.dispose()
    assert isinstance(items, list) and items, "items.json must be a non empty list"
    return items


@pytest.fixture(autouse=True)
def site_guard(request, site_origin: str):
    """Safety rails and observability for every browser test.

    Safety: abort every request to formspree.io so no order email can ever be
    sent. (Tests must also never click PayPal, Apple Pay or Google Pay buttons.)

    Observability: record same origin console errors, uncaught page errors
    thrown by site code, and same origin HTTP 4xx/5xx responses. The
    pytest_runtest_call hook below fails the test if any were recorded, unless
    the test is marked allow_site_errors.
    """
    if "page" not in request.fixturenames:
        yield  # not a browser test
        return

    page = request.getfixturevalue("page")
    page.context.route(FORMSPREE, lambda route: route.abort())

    errors: list[str] = []

    def same_origin(url: str) -> bool:
        return url == site_origin or url.startswith(site_origin + "/")

    def ignored(url: str) -> bool:
        return urlparse(url).path.endswith("/favicon.ico")

    def on_console(message):
        url = message.location.get("url", "")
        if message.type == "error" and same_origin(url) and not ignored(url):
            errors.append(f"console error: {message.text} ({url})")

    def on_page_error(error):
        stack = error.stack or ""
        if site_origin in stack:
            errors.append(f"uncaught error: {error.message}\n{stack}")

    def on_response(response):
        if response.status >= 400 and same_origin(response.url) and not ignored(response.url):
            errors.append(f"HTTP {response.status}: {response.url}")

    page.on("console", on_console)
    page.on("pageerror", on_page_error)
    page.on("response", on_response)

    request.node.site_errors = errors
    yield


@pytest.hookimpl(wrapper=True)
def pytest_runtest_call(item):
    """Fail a passing test if the site logged errors while it ran.

    This runs right after the test body, so the problem is reported as a test
    failure (with trace and screenshot kept) rather than a teardown error.
    """
    result = yield
    errors = getattr(item, "site_errors", None)
    if errors and not item.get_closest_marker("allow_site_errors"):
        raise AssertionError("The site reported errors during this test:\n" + "\n".join(errors))
    return result
