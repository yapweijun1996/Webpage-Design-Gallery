(function () {
  'use strict';

  const storageKey = 'swarm.studio.compare.reference';
  const storageLimit = 2 * 1024 * 1024;
  const formats = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const modes = [['side', 'Side by side'], ['overlay', 'Overlay'], ['swipe', 'Swipe']];
  const svgNS = 'http://www.w3.org/2000/svg';
  const availableFormats = 'PNG, JPEG, WebP, or GIF';
  let reference;
  let dispose;
  let selectAnchor;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(text, variant) {
    const node = element('button', 'sds-btn sds-btn--sm sds-btn--' + variant, text);
    node.type = 'button';
    return node;
  }

  function icon(pathData) {
    const svg = document.createElementNS(svgNS, 'svg');
    const path = document.createElementNS(svgNS, 'path');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    path.setAttribute('d', pathData);
    svg.append(path);
    return svg;
  }

  function imageType(header) {
    if (header.startsWith('\x89PNG\r\n\x1a\n')) return 'image/png';
    if (header.startsWith('\xff\xd8\xff')) return 'image/jpeg';
    if (header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP') return 'image/webp';
    if (header.startsWith('GIF87a') || header.startsWith('GIF89a')) return 'image/gif';
    return '';
  }

  async function readImage(src, name) {
    const image = new Image();
    image.src = src;
    await image.decode();
    return { src, name, width: image.naturalWidth, height: image.naturalHeight };
  }

  function encodeImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result), { once: true });
      reader.addEventListener('error', () => reject(reader.error), { once: true });
      reader.readAsDataURL(file);
    });
  }

  function forgetSavedImage() {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Storage can be blocked while the in-memory comparison remains usable.
    }
  }

  async function loadSavedImage() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw || raw.length > storageLimit) return null;
      const { src, name } = JSON.parse(raw);
      const data = typeof src === 'string' && /^data:(image\/(?:png|jpeg|webp|gif));base64,/.exec(src);
      if (!data || typeof name !== 'string' || imageType(atob(src.slice(data[0].length, data[0].length + 16))) !== data[1]) return null;
      return { ...await readImage(src, name.slice(0, 240)), saved: true };
    } catch {
      return null;
    }
  }

  function saveImage(name, dataURL) {
    if (dataURL) {
      const payload = JSON.stringify({ name, src: dataURL });
      if (new TextEncoder().encode(payload).length <= storageLimit) {
        try {
          localStorage.setItem(storageKey, payload);
          return true;
        } catch {
          // A full or restricted store falls back to the current page session.
        }
      }
    }
    forgetSavedImage();
    return false;
  }

  function setReference(next) {
    if (reference?.src.startsWith('blob:')) URL.revokeObjectURL(reference.src);
    reference = next;
  }

  function previewSource(getActiveSrc) {
    const src = getActiveSrc();
    if (src === 'about:blank') return new URL(src);
    if (typeof src !== 'string' || !src.trim()) return null;
    try {
      const url = new URL(src, location.href);
      if (url.origin === location.origin && url.pathname === '/studio-preview.html' && !url.username && !url.password) return url;
    } catch {
      // The host may not have an active preview yet.
    }
    return null;
  }

  function frameDimension(url, key, fallback) {
    // Both the /frame wrapper and the Studio preview pass viewport dimensions in the URL.
    const value = Number(url?.searchParams.get(key));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  function createSlider(text) {
    const label = element('label', 'studio-compare__slider');
    const title = element('span', '', text);
    const input = element('input');
    const output = element('span', 'studio-compare__value');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.value = '50';
    input.setAttribute('aria-label', text);
    title.setAttribute('aria-hidden', 'true');
    output.setAttribute('aria-hidden', 'true');
    label.append(title, input, output);
    return { label, input, output };
  }

  function mount(host, { getActiveSrc = () => '', connectPreview, sampleDocument } = {}) {
    destroy();
    const controller = new AbortController();
    const { signal } = controller;
    const listen = (node, type, handler) => node.addEventListener(type, handler, { signal });
    let revision = 0;
    let mode = 'side';
    let viewportWidth = 0;
    let frameWidth = 0;
    let swipePointer = null;
    let anchorReference;

    const root = element('section', 'studio-compare');
    root.setAttribute('aria-label', 'Reference comparison');
    const header = element('header', 'studio-compare__header');
    const heading = element('h2', '', 'Reference comparison');
    heading.tabIndex = -1;
    const actions = element('div', 'studio-compare__actions');
    const pick = button('Replace image', 'secondary');
    const clear = button('Clear', 'ghost');
    const fileInput = element('input');
    fileInput.type = 'file';
    fileInput.accept = formats.join(',');
    fileInput.hidden = true;
    actions.append(pick, clear);
    header.append(heading, actions, fileInput);

    const empty = element('div', 'studio-compare__empty');
    const emptyTitle = element('h3', '', 'Add a reference image');
    const instructions = element('p', '', 'Drop or paste a PNG, JPEG, WebP, or GIF here.');
    const privacy = element('p', 'studio-compare__privacy', 'Images above the 2 MB storage limit stay in this page session.');
    const emptyPick = button('Choose image', 'primary');
    empty.append(icon('M4 4h16v16H4zM4 16l5-5 4 4 2-2 5 5M15 8h.01'), emptyTitle, instructions, emptyPick, privacy);

    const notice = element('p', 'studio-compare__notice');
    notice.setAttribute('role', 'status');

    const workbench = element('div', 'studio-compare__workbench');
    const toolbar = element('div', 'studio-compare__toolbar');
    const modeGroup = element('fieldset', 'studio-compare__modes');
    modeGroup.append(element('legend', 'sds-visually-hidden', 'Comparison mode'));
    for (const [value, label] of modes) {
      const radio = element('input');
      radio.type = 'radio';
      radio.name = 'studio-compare-mode';
      radio.value = value;
      radio.checked = mode === value;
      const chip = element('label', 'sds-radio-chip');
      chip.append(radio, label);
      modeGroup.append(chip);
      listen(radio, 'change', () => {
        mode = value;
        renderMode();
      });
    }
    const opacity = createSlider('Reference opacity');
    const swipe = createSlider('Swipe position');
    toolbar.append(modeGroup, opacity.label, swipe.label);

    const stage = element('div', 'studio-compare__stage');
    const referenceLabel = element('div', 'studio-compare__label studio-compare__label--reference', 'Reference');
    const actualLabel = element('div', 'studio-compare__label studio-compare__label--actual', 'Actual preview');
    const referenceSurface = element('div', 'studio-compare__surface studio-compare__surface--reference');
    const actualSurface = element('div', 'studio-compare__surface studio-compare__surface--actual');
    const referenceImage = element('img', 'studio-compare__image');
    referenceImage.alt = 'Reference image';
    referenceImage.draggable = false;
    const frame = element('iframe', 'studio-compare__frame');
    frame.title = 'Actual design preview';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.referrerPolicy = 'no-referrer';
    frame.src = 'about:blank';
    const disconnectPreview = connectPreview?.(frame);
    frame.inert = true;
    frame.tabIndex = -1;
    const noPreview = element('p', 'studio-compare__no-preview', 'No active preview');
    const scrubber = element('div', 'studio-compare__scrubber');
    const handle = element('div', 'studio-compare__handle');
    scrubber.setAttribute('aria-hidden', 'true');
    handle.append(icon('m9 8-4 4 4 4m6-8 4 4-4 4'));
    scrubber.append(handle);
    referenceSurface.append(referenceImage);
    actualSurface.append(frame, noPreview);
    stage.append(referenceLabel, referenceSurface, actualLabel, actualSurface, scrubber);

    const metadata = element('div', 'studio-compare__metadata');
    const filename = element('span', 'studio-compare__filename');
    const dimensions = element('span', 'studio-compare__dimensions');
    const persistence = element('span', 'studio-compare__persistence');
    metadata.append(filename, dimensions, persistence);
    workbench.append(toolbar, stage, metadata);
    root.append(header, empty, notice, workbench);

    function announce(message, kind = '') {
      notice.textContent = message;
      notice.dataset.kind = kind;
    }

    function scaleFrame() {
      if (viewportWidth > 0 && frameWidth > 0) frame.style.transform = 'scale(' + viewportWidth / frameWidth + ')';
    }

    function updateFrame() {
      const shown = anchorReference || reference;
      if (!shown || !root.getClientRects().length) return;
      const src = previewSource(getActiveSrc);
      if (anchorReference && src && src.href !== 'about:blank') {
        src.searchParams.set('w', anchorReference.width);
        src.searchParams.set('h', anchorReference.height);
      }
      frameWidth = frameDimension(src, 'w', shown.width);
      const frameHeight = frameDimension(src, 'h', shown.height);
      stage.style.setProperty('--studio-compare-ratio', frameWidth + ' / ' + frameHeight);
      stage.style.setProperty('--studio-compare-width', frameWidth + 'px');
      frame.style.width = frameWidth + 'px';
      frame.style.height = frameHeight + 'px';
      frame.hidden = !src;
      noPreview.hidden = !!src;
      const url = src?.href || 'about:blank';
      if (frame.getAttribute('src') !== url) frame.src = url;
      if (sampleDocument && url === 'about:blank' && src && !frame.hasAttribute('srcdoc')) frame.srcdoc = sampleDocument;
      scaleFrame();
    }

    function renderSlider(slider, name, suffix) {
      const value = slider.input.value;
      const text = value + '%';
      stage.style.setProperty('--studio-compare-' + name, text);
      slider.output.textContent = text;
      slider.input.setAttribute('aria-valuetext', text + suffix);
    }

    function renderMode() {
      stage.dataset.mode = mode;
      opacity.label.hidden = mode !== 'overlay';
      swipe.label.hidden = mode !== 'swipe';
      scrubber.hidden = mode !== 'swipe';
      updateFrame();
    }

    function renderReference() {
      const shown = anchorReference || reference;
      const hasReference = !!shown;
      empty.hidden = hasReference;
      actions.hidden = !hasReference;
      pick.hidden = Boolean(anchorReference);
      clear.textContent = anchorReference ? 'Return to uploaded reference' : 'Clear';
      workbench.hidden = !hasReference;
      if (!hasReference) {
        referenceImage.removeAttribute('src');
        frame.removeAttribute('srcdoc');
        if (frame.getAttribute('src') !== 'about:blank') frame.src = 'about:blank';
        filename.textContent = '';
        dimensions.textContent = '';
        persistence.textContent = '';
        return;
      }
      referenceImage.src = shown.src;
      filename.textContent = shown.name;
      dimensions.textContent = shown.width + ' × ' + shown.height;
      persistence.textContent = anchorReference ? 'Project anchor' : shown.saved ? 'Saved in this browser' : 'This page session only';
      updateFrame();
    }

    async function choose(file) {
      if (!file || anchorReference) return;
      const ticket = ++revision;
      announce('Reading reference image…', 'loading');
      let objectURL;
      try {
        const header = await file.slice(0, 12).arrayBuffer();
        const type = imageType(String.fromCharCode(...new Uint8Array(header)));
        if (signal.aborted || ticket !== revision) return;
        if (!type || (file.type && file.type !== type)) {
          announce('Choose a valid ' + availableFormats + ' image.', 'error');
          return;
        }
        const imageBlob = file.type ? file : file.slice(0, file.size, type);
        objectURL = URL.createObjectURL(imageBlob);
        const name = (file.name || 'Reference image').slice(0, 240);
        const next = await readImage(objectURL, name);
        let dataURL;
        if (!signal.aborted && ticket === revision && Math.ceil(file.size / 3) * 4 < storageLimit) {
          try {
            dataURL = await encodeImage(imageBlob);
          } catch {
            // An image can still be displayed when encoding or storage fails.
          }
        }
        if (signal.aborted || ticket !== revision) return;
        next.saved = saveImage(name, dataURL);
        if (next.saved) next.src = dataURL;
        else objectURL = null;
        setReference(next);
        const moveFocus = document.activeElement === emptyPick;
        renderReference();
        announce('Reference image added.');
        if (moveFocus) pick.focus();
      } catch {
        if (!signal.aborted && ticket === revision) announce('This image could not be opened. Choose another file.', 'error');
      } finally {
        if (objectURL) URL.revokeObjectURL(objectURL);
      }
    }

    listen(pick, 'click', () => fileInput.click());
    listen(emptyPick, 'click', () => fileInput.click());
    listen(fileInput, 'change', () => {
      choose(fileInput.files[0]);
      fileInput.value = '';
    });
    listen(clear, 'click', () => {
      revision += 1;
      if (anchorReference) {
        anchorReference = undefined;
        renderReference();
        announce('Anchor comparison closed.');
        (reference ? pick : emptyPick).focus();
        return;
      }
      forgetSavedImage();
      setReference(null);
      renderReference();
      announce('Reference image cleared.');
      emptyPick.focus();
    });

    function fileDrag(event) {
      return event.dataTransfer?.types.includes('Files');
    }

    listen(root, 'dragover', event => {
      if (!fileDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      root.dataset.dragging = 'true';
    });
    listen(root, 'dragleave', event => {
      if (!root.contains(event.relatedTarget)) delete root.dataset.dragging;
    });
    listen(root, 'drop', event => {
      delete root.dataset.dragging;
      if (!fileDrag(event)) return;
      event.preventDefault();
      choose(event.dataTransfer.files[0]);
    });
    listen(document, 'paste', event => {
      const target = event.target;
      if (event.defaultPrevented || !root.getClientRects().length || getComputedStyle(root).visibility !== 'visible' ||
          target.isContentEditable || target.closest?.('textarea, input:not([type="radio"], [type="range"])')) return;
      const files = Array.from(event.clipboardData?.files || []);
      const file = files.find(item => item.type.startsWith('image/')) || files[0];
      if (file) {
        event.preventDefault();
        choose(file);
      }
    });

    listen(opacity.input, 'input', () => renderSlider(opacity, 'opacity', ''));
    listen(swipe.input, 'input', () => renderSlider(swipe, 'split', ' reference'));

    function slide(event) {
      const { left, width } = scrubber.getBoundingClientRect();
      swipe.input.value = String(Math.round((event.clientX - left) / width * 100));
      renderSlider(swipe, 'split', ' reference');
    }

    listen(scrubber, 'pointerdown', event => {
      if (event.button !== 0 || swipePointer !== null) return;
      swipePointer = event.pointerId;
      scrubber.setPointerCapture(swipePointer);
      slide(event);
    });
    listen(scrubber, 'pointermove', event => {
      if (event.pointerId === swipePointer) slide(event);
    });
    listen(scrubber, 'lostpointercapture', () => { swipePointer = null; });

    const resize = new ResizeObserver(([entry]) => {
      viewportWidth = entry.contentRect.width;
      updateFrame();
    });
    resize.observe(actualSurface);

    host.append(root);
    renderSlider(opacity, 'opacity', '');
    renderSlider(swipe, 'split', ' reference');
    renderReference();
    renderMode();
    if (reference === undefined) {
      loadSavedImage().then(saved => {
        if (signal.aborted || reference !== undefined) return;
        reference = saved;
        renderReference();
      });
    }
    selectAnchor = async (source, name) => {
      const ticket = ++revision;
      root.scrollIntoView({ block: 'start' });
      heading.focus({ preventScroll: true });
      announce('Loading the project anchor…', 'loading');
      try {
        const src = new URL(source, location.href);
        if (src.origin !== location.origin || !/^\/api\/anchor\/image\/v\d{3,}\/(desktop|tablet|mobile)$/.test(src.pathname)) {
          throw new Error('Invalid anchor reference');
        }
        const next = await readImage(src.href, name);
        if (signal.aborted || ticket !== revision) return;
        anchorReference = next;
        renderReference();
        announce('Comparing the project anchor.');
      } catch {
        if (!signal.aborted && ticket === revision) announce('The project anchor could not be opened.', 'error');
      }
    };
    dispose = () => {
      controller.abort();
      disconnectPreview?.();
      resize.disconnect();
      selectAnchor = undefined;
      root.remove();
    };
  }

  function destroy() {
    dispose?.();
    dispose = undefined;
  }

  window.StudioCompare = { mount, destroy, showAnchor: (src, name) => selectAnchor?.(src, name) };
}());
