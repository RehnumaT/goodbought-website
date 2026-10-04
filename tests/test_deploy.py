"""Deploy verification: the live site really serves the commit just deployed."""

import os
import time

import pytest

from helpers import wait_until

DEPLOY_TIMEOUT_S = 180
POLL_INTERVAL_S = 5


@pytest.mark.smoke
def test_site_serves_expected_commit(playwright, site_url):
    expected = os.environ.get("EXPECTED_COMMIT")
    if not expected:
        pytest.skip("EXPECTED_COMMIT is not set (only set right after a deploy)")
    request = playwright.request.new_context()

    def served_commit():
        # Cache busting query: GitHub Pages' CDN may still hold the old file.
        response = request.get(f"{site_url}build-info.json?t={time.time_ns()}")
        if not response.ok:
            return None
        commit = response.json().get("commit")
        return commit if commit == expected else None

    try:
        wait_until(
            served_commit,
            timeout=DEPLOY_TIMEOUT_S,
            interval=POLL_INTERVAL_S,
            message=f"{site_url}build-info.json never showed commit {expected}",
        )
    finally:
        request.dispose()
