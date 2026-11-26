// Registers the V8 service worker (scope: the V8 folder) and reports offline/online changes.
import {toast} from './toast.js';

export function init() {
  window.addEventListener('offline', () => toast({key: 'network', type: 'warning', messageKey: 'toast.offline.title', detailKey: 'toast.offline.detail'}));
  window.addEventListener('online', () => toast({key: 'network', type: 'success', messageKey: 'toast.online.title', detailKey: 'toast.online.detail'}));
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  const meta = document.querySelector('meta[name="pomelo-root"]');
  const scope = new URL(meta ? meta.content : './', document.baseURI);
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', scope), {scope: scope.pathname}).catch(() => {
      /* Offline support is optional; the site works without it. */
    });
  });
}
