"""Regression checks for keyboard disclosure, resilient form access and text spacing."""

TEXT_SPACING = """
* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }
p { margin-bottom: 2em !important; }
"""

# Measure the glyphs themselves: overflowing text can be clipped by a hero even
# while the viewport and document have exactly the same width.
CLIPPED_TEXT = """elements => {
  const clipped = [];
  for (const element of elements) {
    const nodes = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (nodes.nextNode()) {
      const node = nodes.currentNode;
      if (!node.textContent.trim() || node.parentElement.closest('[aria-hidden="true"]')) continue;
      let left = 0, right = innerWidth;
      for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
        if (!['clip', 'hidden'].includes(getComputedStyle(ancestor).overflowX)) continue;
        const box = ancestor.getBoundingClientRect();
        left = Math.max(left, box.left);
        right = Math.min(right, box.right);
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      if ([...range.getClientRects()].some(rect => rect.width && (rect.left < left - 1 || rect.right > right + 1))) {
        clipped.push(node.textContent.trim());
      }
    }
  }
  return clipped;
}"""

def check_accessibility_regressions(page, version, width):
    if version == 'v16' and width <= 768:
        toggle = page.locator('.menu-toggle')
        toggle.click()
        page.locator('#navigation a').last.focus()
        page.keyboard.press('Tab')
        assert toggle.get_attribute('aria-expanded') == 'false', (version, width, 'menu stays open after Tab exits')
        focused = page.evaluate_handle('document.activeElement')
        try:
            page.keyboard.press('Escape')
            assert focused.evaluate('el => el === document.activeElement'), (version, width, 'Escape moved focus outside menu')
        finally:
            focused.dispose()

    if version == 'v19' and width == 390:
        fallback = page.context.browser.new_page(viewport=page.viewport_size)
        try:
            fallback.route('**/v19/script.js', lambda route: route.abort())
            fallback.goto(page.url)
            link = fallback.locator('#enquiry #fallback-contact')
            assert link.is_visible() and link.get_attribute('href').endswith('/contact-us/')
            assert fallback.locator('#brief-app').is_hidden()
        finally:
            fallback.close()

    selectors = {
        'v12': '.hero h1, header nav',
        'v13': '.hero h1, .visual-label, .contact h2',
        'v14': '.ribbon',
        'v15': '.hero h1, .brand-row h3, .notice',
        'v16': '.hero h1, #navigation:visible',
        'v17': '.masthead, .footer-links',
        'v18': '.masthead, .cover h1, .channels',
        'v19': 'h1, #navigation',
    }
    if version in selectors:
        style = page.add_style_tag(content=TEXT_SPACING)
        try:
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (version, width, 'text spacing overflow')
            clipped = page.locator(selectors[version]).evaluate_all(CLIPPED_TEXT)
            assert not clipped, (version, width, 'clipped with text spacing', clipped)
        finally:
            style.evaluate('el => el.remove()')
