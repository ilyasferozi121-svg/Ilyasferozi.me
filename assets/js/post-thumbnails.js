(() => {
  'use strict';
  document.querySelectorAll('[data-post-thumbnail] img').forEach(image => {
    const showFallback = () => { image.hidden = true; };
    image.addEventListener('error', showFallback, { once: true });
    if (image.complete && !image.naturalWidth) showFallback();
  });
})();
