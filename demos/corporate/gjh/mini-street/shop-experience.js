import * as THREE from "../v11/vendor/three.module.min.js";
import { GLTFLoader } from "../v11/vendor/GLTFLoader.js";
import { createShopInterior } from "./shop-interior.js";
import { createProductHand } from "./product-hand.js";
import { createShopProductUI } from "./shop-product-ui.js";
import { createShopBasket } from "./basket.js";
import { paintedTexture } from "./surfaces.js";

import { NEW_MOON_PRODUCTS } from "./shop-product-catalog.js";

// The shop and product inspection use the street renderer, never another WebGL context.
export function createShopExperience({street, stage, toolbar, onExit}) {
  const root = document.createElement("div");
  root.className = "shop-experience";
  root.hidden = true;
  const controls = document.createElement("div");
  controls.className = "shop-experience-controls";
  const basketHost = document.createElement("div");
  basketHost.className = "shop-experience-basket";
  root.append(controls, basketHost);
  stage.append(root);
  const basket = createShopBasket({host: basketHost});
  let active = false;
  let frame = 0;
  let lastTime = 0;
  let indoor;
  let hand;
  let selectionToken;
  let selectionOpener;
  let wasAdded = false;
  let disposed = false;
  let previewUI;
  let exteriorView;
  let inputPaused = false;

  function setInputPaused(value) {
    if (value === inputPaused) return;
    inputPaused = value;
    indoor?.setPaused(value);
  }

  const productUI = createShopProductUI({
    mount: root,
    onClose: () => {
      if (hand?.getState().phase === "inspecting") hand.putBack();
      else hand?.cancel();
    },
    onRotate: direction => hand?.rotate(direction * Math.PI / 8),
    onDrag: (dx, dy) => hand?.rotate(dx * 0.016, dy * 0.010),
    onReset: () => hand?.resetRotation(),
    onPutBack: () => hand?.putBack(),
    onAddToBasket: () => hand?.addToBasket(),
  });
  previewUI = productUI;

  function updateProductState(state) {
    const inspecting = state.phase !== "idle";
    controls.inert = inspecting;
    basketHost.inert = inspecting;
    setInputPaused(inspecting);
    root.classList.toggle("is-inspecting", inspecting);
    previewUI.render({
      phase: state.phase,
      product: state.product,
      fallback: state.phase === "inspecting" && state.modelReady === false,
      added: wasAdded,
      opener: selectionOpener,
    });
  }

  const contactGeometry = new THREE.PlaneGeometry(0.15, 0.15).rotateX(-Math.PI / 2);
  const contactMaterial = new THREE.MeshBasicMaterial({
    map: paintedTexture(32, 32, (ctx, size) => {
      const radius = size / 2;
      const shade = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
      shade.addColorStop(0, "#21180e8a");
      shade.addColorStop(0.48, "#21180e47");
      shade.addColorStop(1, "#21180e00");
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, size, size);
    }),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });

  function createProduct(product) {
    const group = new THREE.Group();
    const contact = new THREE.Mesh(contactGeometry, contactMaterial);
    contact.name = "Shelf can contact";
    contact.position.y = 0.003;
    group.add(contact);
    const fallback = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03875, 0.03875, 0.124, 24),
      new THREE.MeshStandardMaterial({color: 0xdbc8a4, metalness: 0.25, roughness: 0.6})
    );
    fallback.position.y = 0.062;
    group.add(fallback);
    new GLTFLoader().load(product.modelUrl, ({scene}) => {
      if (disposed) return;
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      if (!size.y) return;
      const scale = 0.124 / size.y;
      scene.scale.multiplyScalar(scale);
      box.setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      scene.position.x -= center.x;
      scene.position.z -= center.z;
      scene.position.y -= box.min.y;
      group.remove(fallback);
      fallback.geometry.dispose();
      fallback.material.dispose();
      group.add(scene);
    }, undefined, () => {});
    return group;
  }

  function selectProduct(product, anchor) {
    if (!active || hand.getState().phase !== "idle") return;
    selectionToken = {};
    selectionOpener = controls.querySelector(".shop-interior-controls") || document.activeElement;
    wasAdded = false;
    hand.select(product, anchor);
  }

  indoor = createShopInterior({
    THREE,
    renderer: street.renderer,
    canvas: street.canvas,
    controlsRoot: controls,
    basketHost,
    products: NEW_MOON_PRODUCTS,
    createProduct,
    onProductSelect: selectProduct,
    onExitRequest: onExit,
  });
  hand = createProductHand({
    THREE, GLTFLoader,
    scene: indoor.scene,
    camera: indoor.camera,
    canvas: street.canvas,
    preview: productUI.preview,
    getProductObject: anchorId => indoor.getProductObject(anchorId),
    onStateChange: updateProductState,
    onAddRequested: product => {
      const added = basket.add(product.id, selectionToken);
      if (added) wasAdded = true;
      return added;
    },
    onInvalidate: () => {},
  });

  function render(now) {
    if (!active) return;
    const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
    lastTime = now;
    const blocked = hand.getState().phase !== "idle" ||
      Boolean(document.querySelector("#mini-basket")?.open);
    setInputPaused(blocked);
    hand.update(delta);
    indoor.render(delta);
    frame = requestAnimationFrame(render);
  }
  function resize() {
    if (!active) return;
    const rect = stage.getBoundingClientRect();
    indoor.resize(rect.width, rect.height);
  }
  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  if (resizeObserver) resizeObserver.observe(stage);
  else window.addEventListener("resize", resize);

  return {
    enter() {
      if (active || disposed) return;
      exteriorView = street.getCameraState();
      street.setInteractive(false);
      street.setPaused(true);
      active = true;
      stage.dataset.interior = "";
      toolbar.hidden = true;
      root.hidden = false;
      indoor.enter();
      inputPaused = false;
      resize();
      lastTime = 0;
      frame = requestAnimationFrame(render);
    },
    exit() {
      if (!active) return;
      active = false;
      cancelAnimationFrame(frame);
      frame = 0;
      basket.close();
      hand.cancel();
      root.append(basketHost);
      indoor.exit();
      root.hidden = true;
      delete stage.dataset.interior;
      toolbar.hidden = false;
      street.restoreCameraState(exteriorView);
      street.setInteractive(true);
      street.setPaused(false);
    },
    moveBasketTo(host) {
      const dock = basketHost.querySelector(".mini-basket-dock");
      if (dock) host.append(dock);
      return basket;
    },
    destroy() {
      this.exit();
      disposed = true;
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener("resize", resize);
      hand.dispose();
      indoor.dispose();
      basket.cleanup();
      productUI.destroy();
      root.remove();
    },
  };
}
