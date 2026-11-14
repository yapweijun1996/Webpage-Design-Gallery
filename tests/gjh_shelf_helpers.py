"""Synchronize only the intentional 3D Shelf-to-detail handoff in legacy fixtures."""
def shelf_details(page):
    page.locator('#shelf-dialog').wait_for(state='visible')
    page.wait_for_function("__mall.mode==='shelf' && __mall.state.paused && !__mall.state.shelf.transitioning")
    assert page.evaluate('__mall.state.illegalCount') == 0
    page.locator('#shelf-dialog').evaluate('''dialog => {
      window.__shelfDetailsClosed = new Promise(resolve => dialog.addEventListener('close',
        () => requestAnimationFrame(resolve), {once:true}));
    }''')
    page.locator('#shelf-details').click()
    page.evaluate('''async () => {await window.__shelfDetailsClosed;delete window.__shelfDetailsClosed;}''')
    page.locator('#product-dialog').wait_for(state='visible')
    assert page.locator('#shelf-dialog').is_hidden()
    assert page.evaluate('__mall.mode') == 'inspect'
    assert page.evaluate('__mall.state.illegalCount') == 0
