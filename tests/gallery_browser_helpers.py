"""User-visible access to responsive Gallery preferences."""


def open_settings(page):
    settings = page.locator('.gallery-settings')
    summary = settings.locator('summary')
    if summary.is_visible() and not settings.evaluate('(element) => element.open'):
        summary.click()


def select_preference(page, selector, value):
    open_settings(page)
    page.select_option(selector, value)
