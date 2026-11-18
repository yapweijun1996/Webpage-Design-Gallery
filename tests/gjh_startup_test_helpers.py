"""Route and fault fixtures for the production mall startup tests."""


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
