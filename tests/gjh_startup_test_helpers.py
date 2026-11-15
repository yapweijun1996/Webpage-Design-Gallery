"""Fault fixtures for the production startup asset pack."""


def use_individual_assets(target):
    """Exercise the real pack-rejection path before injecting per-model faults."""
    target.route('**/startup-assets.pack', lambda route: route.fulfill(status=200, body=b'invalid pack'))
