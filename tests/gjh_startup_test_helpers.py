"""Route and fault fixtures for the production mall startup tests."""


def mall_entry_url(url, fragment="experience"):
    """Resolve a test entry after its query is built, retaining explicit deep links."""
    return url if not fragment or "#" in url else url + "#" + fragment


def use_individual_assets(target):
    """Exercise the real pack-rejection path before injecting per-model faults."""
    target.route('**/startup-assets.pack', lambda route: route.fulfill(status=200, body=b'invalid pack'))
