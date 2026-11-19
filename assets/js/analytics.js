/* Keep the existing queue, then fetch analytics during an idle period after parsing. */
(() => {
  'use strict';
  const id = document.currentScript?.dataset.measurementId;
  if (!/^G-[A-Z0-9]+$/.test(id || '')) return;
  let requested = false;
  function load() {
    if (requested) return;
    requested = true;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.append(script);
  }
  function schedule() {
    // A finite timeout keeps tracking active even when the browser remains busy.
    if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 2000 });
    else window.setTimeout(load, 0);
  }
  // Do not wait for unrelated image or captcha requests to finish.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
})();
