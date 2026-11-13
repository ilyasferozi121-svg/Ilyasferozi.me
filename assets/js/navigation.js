(() => {
  'use strict';

  document.querySelectorAll('[data-print-cv]').forEach(button => {
    button.addEventListener('click', () => window.print());
  });

  const toggle = document.querySelector('.nav-toggle');
  const navigation = document.querySelector('#main-navigation');
  if (!toggle || !navigation) return;

  const mobile = window.matchMedia('(max-width: 960px)');

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('is-open', open);
  }

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  navigation.addEventListener('click', event => {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('click', event => {
    if (!toggle.contains(event.target) && !navigation.contains(event.target)) {
      setOpen(false);
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });

  mobile.addEventListener('change', () => setOpen(false));
})();
