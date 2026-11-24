// Run with Node and Playwright. Set MINI_STREET_BROWSER=webkit for WebKit.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { test } from "node:test";

const { chromium, webkit } = createRequire(import.meta.url)("playwright");
const route = "/demos/corporate/gjh/mini-street/";
const html = `<!doctype html>
<html lang="en" data-gjh-design="mini-street">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="assets/theme.css">
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="shop-product-ui.css">
<main class="street">
  <button type="button" id="opener">Inspect the can</button>
  <div class="stage" id="stage" data-webgl><canvas id="view" aria-hidden="true"></canvas></div>
</main>
<script type="module">
  import { createShopProductUI } from "./shop-product-ui.js";
  import { getNewMoonProduct } from "./shop-product-catalog.js";
  const stage = document.getElementById("stage");
  const opener = document.getElementById("opener");
  const events = [];
  const product = createShopProductUI({
    mount: stage,
    onClose: () => { events.push("close"); product.render(); },
    onRotate: (direction) => events.push(direction),
    onReset: () => events.push("reset"),
    onPutBack: () => { events.push("put-back"); product.render({ phase: "returning" }); },
    onAddToBasket: (id) => {
      events.push(id);
      product.render({
        phase: "inspecting",
        fallback: stage.querySelector(".shop-product").hasAttribute("data-fallback"),
        added: true,
      });
    },
  });
  opener.addEventListener("click", () => product.render({ phase: "loading", opener }));
  window.fixture = { product, events, getNewMoonProduct };
</script>`;
const files = new Map([
  [route + "assets/theme.css", "text/css"],
  [route + "style.css", "text/css"],
  [route + "shop-product-ui.css", "text/css"],
  [route + "shop-product-ui.js", "text/javascript"],
  [route + "shop-product-catalog.js", "text/javascript"],
  ...["au-425g", "nz-425g", "sa-425g", "mx-454g"].map(id => [
    `/demos/corporate/gjh/v11/assets/new-moon-${id}-front.webp`, "image/webp",
  ]),
]);

async function checkBounds(page, stage, dialog, settings) {
  const frame = await stage.boundingBox();
  const preview = await dialog.locator(".shop-product-preview").boundingBox();
  const panel = await dialog.locator(".shop-product-panel").boundingBox();
  assert.ok(preview.width >= 180 && preview.height >= 175, JSON.stringify({ settings, preview }));
  assert.ok(frame.x <= panel.x && panel.x + panel.width <= frame.x + frame.width);
  assert.ok(frame.y <= panel.y && panel.y + panel.height <= frame.y + frame.height);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  for (const button of await dialog.getByRole("button").all()) {
    const bounds = await button.boundingBox();
    assert.ok(bounds.width >= 44 && bounds.height >= 44, JSON.stringify(bounds));
  }
  return preview;
}

test("product controls and static fallback share one responsive scene", async () => {
  const server = createServer(async (request, response) => {
    const contentType = files.get(request.url);
    if (contentType) {
      response.writeHead(200, { "Content-Type": contentType });
      response.end(await readFile(new URL(".." + request.url, import.meta.url)));
    } else if (request.url === route) {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end(html);
    } else {
      response.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}${route}`;
  let browser;
  try {
    browser = process.env.MINI_STREET_BROWSER === "webkit"
      ? await webkit.launch()
      : await chromium.launch({ channel: "chrome" });
    for (const settings of [
      { viewport: { width: 1440, height: 900 } },
      { viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" },
    ]) {
      const page = await browser.newPage(settings);
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(url);
      await page.waitForFunction(() => window.fixture);
      const stage = page.locator("#stage");
      const opener = page.getByRole("button", { name: "Inspect the can" });
      const dialog = page.getByRole("dialog", { name: "Australian abalone" });
      await opener.press("Enter");
      const controls = dialog.getByRole("group", { name: "Product view controls" });
      const add = dialog.getByRole("button", { name: "Add to basket", exact: true });
      const putBack = dialog.getByRole("button", { name: "Put back" });
      assert.equal(await dialog.getByRole("status").textContent(), "Loading product view…");
      assert.ok(await add.isDisabled());
      assert.ok(await controls.getByRole("button", { name: "Rotate left" }).isDisabled());
      assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), "Close");

      await page.evaluate(() => window.fixture.product.render({ phase: "inspecting" }));
      const preview = await checkBounds(page, stage, dialog, settings);
      assert.equal(await page.evaluate(({ x, y, width, height }) =>
        document.elementFromPoint(x + width / 2, y + height / 2).id, preview), "view");
      assert.equal(await page.locator("canvas").count(), 1);
      if (process.env.PRODUCT_UI_SCREENSHOT_DIR) {
        await page.screenshot({ path: `${process.env.PRODUCT_UI_SCREENSHOT_DIR}/product-${settings.viewport.width}.jpg`, quality: 45 });
      }
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Rotate left");
      await page.keyboard.press("Enter");
      await controls.getByRole("button", { name: "Rotate right" }).press("Space");
      await controls.getByRole("button", { name: "Reset rotation" }).press("Enter");
      await putBack.press("Enter");
      assert.ok(await putBack.isDisabled());
      await page.keyboard.press("Escape");
      assert.ok(await dialog.isHidden());
      assert.equal(await page.evaluate(() => document.activeElement.id), "opener");

      await opener.press("Enter");
      await page.evaluate(() => {
        document.querySelector("#stage").removeAttribute("data-webgl");
        window.fixture.product.render({ phase: "inspecting", fallback: true });
      });
      const photo = dialog.getByRole("img", { name: "Front of the New Moon Australian abalone can" });
      await photo.waitFor();
      await page.waitForFunction(() => document.querySelector(".shop-product-photo").naturalWidth === 768);
      assert.ok(await controls.isHidden());
      assert.equal(await dialog.getByRole("status").textContent(), "Showing product photo.");
      assert.ok((await dialog.innerText()).includes("425 g"));
      assert.ok((await dialog.innerText()).includes("Australia"));
      await checkBounds(page, stage, dialog, settings);
      if (process.env.PRODUCT_UI_SCREENSHOT_DIR) {
        await page.screenshot({ path: `${process.env.PRODUCT_UI_SCREENSHOT_DIR}/product-photo-${settings.viewport.width}.jpg`, quality: 45 });
      }
      // A synchronously acknowledged intent allows the controller to block a rapid double click.
      await add.evaluate(button => { button.click(); button.click(); });
      assert.ok(await dialog.getByRole("button", { name: "Added to basket" }).isDisabled());
      assert.equal(await dialog.getByRole("status").textContent(), "Added to the virtual basket.");
      await dialog.getByRole("button", { name: "Close" }).click();
      assert.ok(await dialog.isHidden());
      assert.equal(await page.evaluate(() => document.activeElement.id), "opener");
      assert.deepEqual(await page.evaluate(() => window.fixture.events),
        [-1, 1, "reset", "put-back", "close", "au-425g", "close"]);
      for (const [id, title, origin, size] of [
        ["nz-425g", "New Zealand abalone", "New Zealand", "425 g"],
        ["sa-425g", "South African abalone", "South Africa", "425 g"],
        ["mx-454g", "Mexican abalone", "Mexico", "454 g"],
      ]) {
        await page.evaluate((id) => {
          const {product, getNewMoonProduct} = window.fixture;
          product.render({phase: "inspecting", product: getNewMoonProduct(id), fallback: true});
        }, id);
        const variant = page.getByRole("dialog", {name: title});
        await variant.waitFor();
        assert.deepEqual(await variant.locator("dd").allTextContents(), [size, origin]);
        const variantPhoto = variant.getByRole("img", {name: `Front of the New Moon ${title} can`});
        assert.ok((await variantPhoto.getAttribute("src")).endsWith(`new-moon-${id}-front.webp`));
        await variantPhoto.evaluate(photo => photo.decode());
        await checkBounds(page, stage, variant, settings);
        await variant.getByRole("button", {name: "Add to basket", exact: true}).click();
        assert.equal(await page.evaluate(() => window.fixture.events.at(-1)), id);
        assert.ok(await variant.getByRole("button", {name: "Added to basket"}).isDisabled());
        await variant.getByRole("button", {name: "Close"}).click();
      }
      await page.evaluate(() => window.fixture.product.destroy());
      assert.equal(await page.locator(".shop-product").count(), 0);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
