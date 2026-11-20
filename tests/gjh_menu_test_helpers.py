"""Drive the shared v11 menu through its visible controls."""


def open_menu_page(page, name="menu"):
    dialog = page.locator("#keyboard-help")
    if not dialog.is_visible():
        if name in ("settings", "audio", "graphics", "controls", "language", "updates", "about"):
            page.locator("#header-menu").click()
        else:
            page.locator("#mall-tools").click()
    active = page.locator('#keyboard-help [data-menu-page]:visible')
    parent = "settings" if name in ("audio", "graphics", "controls", "language", "updates", "about") else "menu"
    while active.get_attribute("data-menu-page") not in (name, parent, "menu"):
        page.locator("#menu-back").click()
    if active.get_attribute("data-menu-page") == name:
        return
    if parent == "settings" and active.get_attribute("data-menu-page") == "menu":
        active.locator('[data-menu-to="settings"]').click()
    active.locator(f'[data-menu-to="{name}"]').click()


def close_menu(page):
    page.locator("#menu-close").click()


def open_decor_theme(page):
    open_menu_page(page, "about")
    page.locator("#mall-theme-open").click()
