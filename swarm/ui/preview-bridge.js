(function () {
  'use strict';

  const stage = '/studio-preview.html';
  const handshake = 'swarm-preview:connect';

  function connect(frame, receive, synchronize) {
    let port;
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.referrerPolicy = 'no-referrer';

    function onLoad() {
      port?.close();
      port = undefined;
      const url = new URL(frame.src, location.href);
      if (url.origin !== location.origin || url.pathname !== stage) return;

      const channel = new MessageChannel();
      port = channel.port1;
      if (receive) {
        const current = port;
        port.onmessage = ({ data }) => {
          if (current === port && Array.isArray(data) && data.length === 2 && typeof data[0] === 'string') receive(...data);
        };
      }
      // Opaque sandboxed documents have no target origin. Send only preview display data.
      frame.contentWindow.postMessage(handshake, '*', [channel.port2]);
      synchronize();
    }

    frame.addEventListener('load', onLoad);
    const send = (type, data) => port?.postMessage([type, data]);
    send.close = () => {
      port?.close();
      port = undefined;
      frame.removeEventListener('load', onLoad);
    };
    return send;
  }

  function element(data, sections, withRect = false) {
    if (!data || !sections.includes(data.section) || typeof data.tag !== 'string' || !/^[a-z][a-z0-9-]{0,49}$/.test(data.tag) ||
        typeof data.text !== 'string' || data.text.length > 60 || typeof data.path !== 'string' || data.path.length > 200) return null;
    const { section, tag, text, path, rect } = data;
    if (!withRect) return { section, tag, text, path };
    const edges = ['top', 'left', 'bottom', 'right'];
    if (!rect || !edges.every(key => Number.isFinite(rect[key]) && Math.abs(rect[key]) < 1e7) ||
        rect.bottom < rect.top || rect.right < rect.left) return null;
    return { section, tag, text, path, rect };
  }

  window.StudioPreview = { stage, handshake, connect, element };
}());
