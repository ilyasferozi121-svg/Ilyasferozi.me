(() => {
  'use strict';

  const rail = document.querySelector('[data-dot-rail]');
  if (!rail) return;

  const items = [...rail.querySelectorAll('a[href^="#"]')].map(link => {
    let id;
    try { id = decodeURIComponent(link.hash.slice(1)); } catch { return null; }
    const section = document.getElementById(id);
    return section?.matches('[data-rail-section]') ? { link, section } : null;
  }).filter(Boolean);
  if (!items.length) return;

  const desktop = window.matchMedia('(min-width: 1025px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const end = document.querySelector('[data-rail-end]');
  let sectionObserver;
  let endObserver;
  let frame;
  let hashFrame;
  let hoveredLink;
  let lastScrollY = window.scrollY;
  let scrollingDown = true;
  let bandBounds;

  function visible(item) {
    return !item.section.hidden && item.section.getClientRects().length > 0;
  }

  function activate(item) {
    if (!item) return;
    items.forEach(candidate => {
      const active = candidate === item;
      if (active) candidate.link.setAttribute('aria-current', 'true');
      else candidate.link.removeAttribute('aria-current');
      candidate.link.classList.toggle('is-active', active);
    });
  }

  function updateCurrent() {
    if (!desktop.matches) return;
    const available = items.filter(visible);
    if (!available.length) return;
    const height = window.innerHeight;
    if (window.scrollY !== lastScrollY) scrollingDown = window.scrollY > lastScrollY;
    lastScrollY = window.scrollY;

    // A short final section may never reach the middle band on a tall screen.
    if (end && window.scrollY > 0 && document.documentElement.scrollHeight > height + 1) {
      const bounds = end.getBoundingClientRect();
      if (bounds.top >= 0 && bounds.top <= height && bounds.bottom > 0) {
        activate(available[available.length - 1]);
        return;
      }
    }

    const bandTop = bandBounds?.top ?? height * 0.4;
    const bandBottom = bandBounds?.bottom ?? height * 0.55;
    const inBand = available.filter(item => {
      const bounds = item.section.getBoundingClientRect();
      return bounds.bottom >= bandTop && bounds.top <= bandBottom;
    });
    if (inBand.length) {
      activate(scrollingDown ? inBand[inBand.length - 1] : inBand[0]);
      return;
    }

    // Keep the preceding section selected through the space between cards.
    const marker = height * 0.475;
    activate(available.filter(item => item.section.getBoundingClientRect().top <= marker).pop() || available[0]);
  }

  function disconnect() {
    sectionObserver?.disconnect();
    endObserver?.disconnect();
    sectionObserver = null;
    endObserver = null;
  }

  function observeSections() {
    frame = null;
    disconnect();
    bandBounds = null;
    if (!desktop.matches) return;
    lastScrollY = window.scrollY;
    updateCurrent();
    if (!('IntersectionObserver' in window)) return;

    sectionObserver = new IntersectionObserver(entries => {
      bandBounds = entries[0]?.rootBounds || bandBounds;
      updateCurrent();
    }, {
      rootMargin: '-40% 0px -45% 0px',
      threshold: 0
    });
    items.filter(visible).forEach(item => sectionObserver.observe(item.section));
    if (end) {
      endObserver = new IntersectionObserver(updateCurrent, { threshold: 0 });
      endObserver.observe(end);
    }
  }

  function scheduleObservation() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(observeSections);
  }

  function itemForTarget(target) {
    if (!target) return null;
    return items.find(item => item.section === target || item.section.contains(target)) ||
      items.filter(item => item.section.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING).pop() || null;
  }

  function revealTarget(item) {
    const card = item?.section.closest('.page-card[data-category]');
    if (!card?.hidden) return false;
    // Reuse the existing filter's state, count announcement and reveal behavior.
    document.querySelector('.portfolio-filters [data-filter="all"]')?.click();
    if (card.hidden) card.hidden = false;
    return true;
  }

  function synchronizeHash() {
    hashFrame = null;
    let id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
    if (!id) { scheduleObservation(); return; }
    const target = document.getElementById(id);
    const item = itemForTarget(target);
    if (item && revealTarget(item)) {
      // Native hash scrolling happened while this destination was filtered out.
      target.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    }
    if (!('IntersectionObserver' in window) && item) activate(item);
    scheduleObservation();
  }

  function scheduleHash() {
    if (hashFrame) window.cancelAnimationFrame(hashFrame);
    hashFrame = window.requestAnimationFrame(synchronizeHash);
  }

  rail.addEventListener('click', event => {
    const link = event.target.closest('a');
    const item = items.find(candidate => candidate.link === link);
    if (!item || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    revealTarget(item);
    if (!('IntersectionObserver' in window)) activate(item);
    // Leave scrolling, URL updates and back/forward history to native anchors.
  });

  rail.addEventListener('keydown', event => {
    const index = items.findIndex(item => item.link === event.target.closest('a'));
    if (index < 0) return;
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    items[next].link.focus({ preventScroll: true });
  });

  items.forEach(({ link }) => {
    link.addEventListener('pointerenter', () => {
      hoveredLink = link;
      link.classList.remove('is-tooltip-dismissed');
    });
    link.addEventListener('pointerleave', () => {
      if (hoveredLink === link) hoveredLink = null;
      if (!link.matches(':focus-visible')) link.classList.remove('is-tooltip-dismissed');
    });
    link.addEventListener('focus', () => link.classList.remove('is-tooltip-dismissed'));
    link.addEventListener('blur', () => {
      if (hoveredLink !== link) link.classList.remove('is-tooltip-dismissed');
    });
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !desktop.matches) return;
    const focused = items.find(item => item.link === document.activeElement)?.link;
    const links = new Set([hoveredLink, focused].filter(Boolean));
    links.forEach(link => link.classList.add('is-tooltip-dismissed'));
    if (links.size) event.preventDefault();
  });

  if ('MutationObserver' in window) {
    const filtersObserver = new MutationObserver(scheduleObservation);
    items.forEach(item => filtersObserver.observe(item.section, { attributes: true, attributeFilter: ['hidden'] }));
  }

  desktop.addEventListener('change', scheduleObservation);
  window.addEventListener('resize', scheduleObservation, { passive: true });
  window.addEventListener('hashchange', scheduleHash);
  window.addEventListener('popstate', scheduleHash);
  window.addEventListener('pageshow', scheduleHash);
  window.addEventListener('load', scheduleObservation);
  activate(items[0]);
  synchronizeHash();
})();
