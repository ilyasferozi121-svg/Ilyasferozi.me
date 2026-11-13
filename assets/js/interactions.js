(() => {
  'use strict';

  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 701px)');
  const revealItems = [...document.querySelectorAll('.page-card, .panel, .interest, .item, .training-card, .blog-card, .section-heading, .page-hero, .post-header, .interest-explorer')];
  let observer;

  root.classList.add('interactions-ready');

  function reveal(item) {
    item.style.setProperty('--reveal-delay', '0ms');
    item.classList.add('is-revealed');
    if (observer) observer.unobserve(item);
  }

  function setupReveals() {
    if (observer) observer.disconnect();
    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      root.classList.remove('motion-ready');
      revealItems.forEach(reveal);
      return;
    }
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -24px 0px' });
    revealItems.forEach((item, index) => {
      item.classList.add('reveal-item');
      item.style.setProperty('--reveal-delay', `${Math.min(index % 3, 2) * 65}ms`);
      if (item.contains(document.activeElement)) reveal(item);
      else if (!item.classList.contains('is-revealed')) observer.observe(item);
    });
    root.classList.add('motion-ready');
  }

  document.addEventListener('focusin', event => {
    let target = event.target;
    while (target && target !== document) {
      if (target.classList && target.classList.contains('reveal-item')) reveal(target);
      target = target.parentElement;
    }
  });

  setupReveals();

  const explorer = document.querySelector('.interest-explorer');
  let panelAnimation;
  if (explorer) {
    const tabs = [...explorer.querySelectorAll('[role="tab"][data-theme]')];
    const panels = [...explorer.querySelectorAll('[role="tabpanel"]')];
    const tablist = explorer.querySelector('[role="tablist"]');

    function selectTheme(tab, focus = false, animate = true) {
      const panelId = tab.getAttribute('aria-controls');
      const panel = panels.find(item => item.id === panelId);
      if (!panel) return;
      if (panelAnimation) panelAnimation.cancel();
      tabs.forEach(item => {
        const selected = item === tab;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
      panels.forEach(item => { item.hidden = item !== panel; });
      explorer.dataset.activeTheme = tab.dataset.theme;
      if (focus) tab.focus();
      if (animate && !reducedMotion.matches && typeof panel.animate === 'function') {
        panelAnimation = panel.animate(
          [{ opacity: 0.45, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: 260, easing: 'cubic-bezier(.2,.7,.2,1)' }
        );
      }
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => selectTheme(tab));
      tab.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        selectTheme(tabs[next], true);
      });
    });
    const initial = tabs.find(tab => tab.getAttribute('aria-selected') === 'true') || tabs[0];
    if (initial) {
      selectTheme(initial, false, false);
      if (tablist) tablist.hidden = false;
    }
  }

  const filters = document.querySelector('.portfolio-filters');
  if (filters) {
    const buttons = [...filters.querySelectorAll('[data-filter]')];
    const cards = [...document.querySelectorAll('.page-card[data-category]')];
    const status = document.querySelector('#filter-status');
    if (cards.length && buttons.length) {
      filters.hidden = false;
      buttons.forEach(button => {
        button.addEventListener('click', () => {
          const category = button.dataset.filter;
          let count = 0;
          buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
          cards.forEach(card => {
            const visible = category === 'all' || card.dataset.category.split(/\s+/).includes(category);
            card.hidden = !visible;
            if (visible) { count++; reveal(card); }
          });
          if (status) status.textContent = `${count} ${count === 1 ? 'section' : 'sections'} shown.`;
          scheduleScrollUpdate();
        });
      });
    }
  }

  const progress = document.querySelector('.reading-progress > span');
  const header = document.querySelector('.topbar');
  const backToTop = document.querySelector('[data-back-to-top]');
  let scrollFrame;

  function updateScroll() {
    scrollFrame = null;
    const distance = Math.max(0, window.scrollY);
    const available = document.documentElement.scrollHeight - window.innerHeight;
    const amount = available > 0 ? Math.min(1, distance / available) : 0;
    if (progress) progress.style.transform = `scaleX(${amount})`;
    if (header) header.classList.toggle('is-scrolled', distance > 24);
    if (backToTop) backToTop.hidden = distance < 500;
  }

  function scheduleScrollUpdate() {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScroll);
  }

  window.addEventListener('scroll', scheduleScrollUpdate, { passive: true });
  window.addEventListener('resize', scheduleScrollUpdate, { passive: true });
  window.addEventListener('load', scheduleScrollUpdate);
  window.addEventListener('pageshow', scheduleScrollUpdate);
  updateScroll();
  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      const focusTarget = document.querySelector('.brand');
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    });
  }

  const portrait = document.querySelector('.portrait-frame');
  let portraitFrame;
  let pointerX = 0;
  let pointerY = 0;
  function resetPortrait() {
    if (portraitFrame) window.cancelAnimationFrame(portraitFrame);
    portraitFrame = null;
    if (portrait) {
      portrait.style.removeProperty('--portrait-rotate-x');
      portrait.style.removeProperty('--portrait-rotate-y');
    }
  }
  if (portrait) {
    portrait.addEventListener('pointermove', event => {
      if (!finePointer.matches || reducedMotion.matches || event.pointerType === 'touch') return;
      const bounds = portrait.getBoundingClientRect();
      pointerX = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
      pointerY = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
      if (!portraitFrame) portraitFrame = window.requestAnimationFrame(() => {
        portraitFrame = null;
        portrait.style.setProperty('--portrait-rotate-x', `${(-pointerY * 2.5).toFixed(2)}deg`);
        portrait.style.setProperty('--portrait-rotate-y', `${(pointerX * 2.5).toFixed(2)}deg`);
      });
    });
    portrait.addEventListener('pointerleave', resetPortrait);
    finePointer.addEventListener('change', resetPortrait);
  }

  reducedMotion.addEventListener('change', () => {
    if (panelAnimation) panelAnimation.cancel();
    resetPortrait();
    setupReveals();
  });
})();
