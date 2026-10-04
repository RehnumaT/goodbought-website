# Goodbought website

Static store site (plain HTML/CSS/JS, no build step) live on GitHub Pages at
https://rehnumat.github.io/goodbought-website/. This is a real family business:
never run anything that could charge money, send order emails, or change the live store.

End to end tests live in `tests/` (pytest + Playwright). Run locally:

```
python -m http.server 8000 --bind 127.0.0.1   # in one terminal
pytest                                        # in another
```

## Test design rules

- Expected values come from `items.json` fetched from the environment under test. Never
  hardcode item names or prices, so inventory changes don't break tests. Pick items by
  property (the first item, the first item whose price has cents, the first item with
  several images). Skip the test if no such item exists.
- Build every URL from the `site_url` fixture: `base_url` with exactly one trailing slash.
  Never `page.goto("/")`, because on GitHub Pages that drops `/goodbought-website/`.
- User facing locators first: roles, labels, text. `data-id` and `data-category` are
  acceptable contracts. No CSS class chains, no XPath.
- No sleeps in UI tests; use `expect` auto waiting. Polling external state (deploy
  verification) uses the `wait_until` helper with a timeout and an interval.
- Check real state, not just the screen. After "Add to Cart", read `goodbought-cart` from
  localStorage and compare it with what was added.
- Every happy path test gets a matching failure path test.
- Production safety rails, in the autouse fixture in `tests/conftest.py`: abort every
  request to `formspree.io`; never click PayPal, Apple Pay or Google Pay buttons; tests
  are read only.
- Observability, in the same autouse fixture: fail the test on same origin console errors,
  uncaught page errors whose stack comes from the site, and same origin HTTP 4xx/5xx
  responses. Ignore `favicon.ico`. Tests that cause errors on purpose use
  `@pytest.mark.allow_site_errors`.
- Never change site code to make a test pass. A bug gets a failing test and a GitHub
  issue, then a separate fix PR.
- Tax math: compute expected subtotal, tax and total in Python from `items.json` prices
  and `window.STORE_CONFIG.SALES_TAX_RATE`, in the same order the JS does, and format
  like `toFixed(2)`.

## Markers

- `smoke`: safe and fast enough to run against production.
- `advisory`: reports a risk, never blocks a merge or deploy.
- `allow_site_errors`: turns off the observability check for that test.
