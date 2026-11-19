// Serve the repository root with: python3 -m http.server 8812 --bind 127.0.0.1
// Run with: GALLERY_CHROME=/path/to/chrome node tests/probe_gjh_mili_seat.cjs
const assert = require('node:assert/strict');
const {mkdir, readFile} = require('node:fs/promises');
const {tmpdir} = require('node:os');
const {join} = require('node:path');
const {chromium} = require('playwright');

const url = 'http://127.0.0.1:8812/demos/corporate/gjh/v11/';
const output = process.argv[2] ?? join(tmpdir(), 'gjh-mili-seat');

async function probe() {
  assert.ok(process.env.GALLERY_CHROME, 'Set GALLERY_CHROME to the Chrome executable');
  const browser = await chromium.launch({
    executablePath: process.env.GALLERY_CHROME,
    headless: false,
    args: [`--use-angle=${process.env.GALLERY_WEBGL_BACKEND ?? 'swiftshader'}`, '--enable-unsafe-swiftshader']
  });
  try {
    const page = await browser.newPage({viewport:{width:393, height:700}, isMobile:true, hasTouch:true});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(`${url}#experience`, {waitUntil:'domcontentloaded'});
    assert.ok(response?.ok(), `Could not load the mall on port 8812 (${response?.status()})`);
    const index = join(__dirname, '../demos/corporate/gjh/v11/index.html');
    assert.equal(await response.text(), await readFile(index, 'utf8'), 'Server must serve this worktree');
    await page.waitForFunction(() => window.__mall?.ready && window.__sceneReady, null, {timeout:90000});
    if (await page.locator('#guide-skip').isVisible()) await page.locator('#guide-skip').tap();

    const before = await page.evaluate(() => {
      const mall = window.__mall;
      const seat = mall.state.seats.find(item => item.name === 'MILI bench 2');
      if (!seat || !mall.teleport('mili')) throw Error('MILI bench 2 is unavailable');
      // Teleport to the shop entrance and take the clear aisle around the island.
      for (const [x,z] of [[1.4,2.4],[1.4,seat.exitZ],[seat.exitX,seat.exitZ]]) {
        let arrived = false;
        for (let i = 0; i < 160; i++) {
          const p = mall.state;
          const dx = x-p.x, dz = z-p.z, distance = Math.hypot(dx,dz);
          if (distance < .065) { arrived = true; break; }
          mall.setInput({right:dx/distance, forward:-dz/distance, yaw:0});
          mall.step(Math.max(17, Math.min(100, distance/2.65*1000)));
        }
        if (!arrived) throw Error(`Seat approach blocked at ${x}, ${z}`);
      }
      mall.setInput({});
      const state = mall.step(20);
      return {seat, nearby:state.nearby, yaw:state.yaw, pitch:state.pitch};
    });
    assert.equal(before.nearby, before.seat.id);
    const action = page.locator('#inspect');
    assert.match(await action.innerText(), /Sit/);
    await mkdir(output, {recursive:true});
    await page.screenshot({path:join(output, '01-approach.png')});

    await action.tap();
    const seated = await page.evaluate(() => window.__mall.step(1500));
    assert.equal(seated.seatPhase, 'seated');
    assert.equal(seated.seatId, before.seat.id);
    assert.equal(seated.capsuleEnabled, false);
    assert.ok(Math.hypot(seated.x-before.seat.x, seated.z-before.seat.z) < .02);
    assert.ok(Math.cos(seated.facing)*before.seat.facing > .99);
    assert.ok(seated.cameraDistance >= 4.8 && seated.cameraObstruction.distance > 3.5);
    assert.ok(seated.cameraObstruction.avatarVisible);
    assert.ok((seated.camera.position[2]-seated.z)*before.seat.facing < -2);
    assert.match(await action.innerText(), /Stand/);
    await page.screenshot({path:join(output, '02-seated.png')});

    await action.tap();
    const standing = await page.evaluate(() => window.__mall.step(1000));
    assert.equal(standing.seatPhase, 'idle');
    assert.ok(standing.capsuleEnabled && !standing.seated);
    assert.ok(Math.hypot(standing.x-before.seat.exitX, standing.z-before.seat.exitZ) < .08);
    assert.equal(standing.cameraFocus, null);
    assert.ok(Math.abs(standing.yaw-before.yaw) < .01 && Math.abs(standing.pitch-before.pitch) < .01);
    await page.screenshot({path:join(output, '03-standing.png')});
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({seat:before.seat.name, cameraClearance:seated.cameraObstruction.distance, output}));
  } finally {
    await browser.close();
  }
}

probe().catch(error => { console.error(error); process.exitCode = 1; });
