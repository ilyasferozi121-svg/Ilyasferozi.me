(() => {
  'use strict';
  const portrait = document.querySelector('[data-welcome-portrait]');
  const replay = document.querySelector('[data-portrait-replay]');
  if (!portrait || !replay) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animatedSource = portrait.dataset.animatedSrc;
  const stillSource = portrait.dataset.staticSrc;
  let failed = false;

  function updateControl() {
    replay.hidden = reducedMotion.matches || failed;
  }

  replay.addEventListener('click', () => {
    if (reducedMotion.matches || failed) return;
    const source = new URL(animatedSource, window.location.href);
    source.searchParams.set('play', String(Date.now()));
    portrait.src = source.href;
  });

  portrait.addEventListener('error', () => {
    if (failed) return;
    failed = true;
    portrait.src = stillSource;
    updateControl();
  });

  reducedMotion.addEventListener('change', () => {
    portrait.src = reducedMotion.matches || failed ? stillSource : animatedSource;
    updateControl();
  });

  updateControl();
})();
