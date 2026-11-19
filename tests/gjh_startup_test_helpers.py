"""Route and fault fixtures for the production mall startup tests."""

from datetime import datetime, timezone


def set_off_season_date(page):
    """Keep manual-theme tests independent of today's automatic theme."""
    page.clock.set_fixed_time(datetime(2027, 4, 1, 12, tzinfo=timezone.utc))


def mall_entry_url(url, fragment="experience"):
    """Resolve a test entry after its query is built, retaining explicit deep links."""
    return url if not fragment or "#" in url else url + "#" + fragment


def use_individual_assets(target):
    """Exercise the real pack-rejection path before injecting per-model faults."""
    target.route('**/startup-assets.pack', lambda route: route.fulfill(status=200, body=b'invalid pack'))


def wait_for_quality(page, preference):
    page.wait_for_function(
        """choice => {
          const profile = __mall.state.graphics.quality;
          return profile.preference === choice && (choice === 'auto' || profile.tier === choice);
        }""", arg=preference, timeout=90000)
