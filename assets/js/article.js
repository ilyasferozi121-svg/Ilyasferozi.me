(() => {
  'use strict';

  const article = document.getElementById('article-content');
  if (!article) return;

  // Keep captions ordinary Markdown in the source and enhance the reading view.
  article.querySelectorAll('p').forEach((paragraph) => {
    const image = paragraph.children.length === 1 && paragraph.firstElementChild;
    if (!image || image.tagName !== 'IMG' || paragraph.textContent.trim()) return;
    const next = paragraph.nextElementSibling;
    const emphasis = next && next.children.length === 1 && next.firstElementChild;
    if (!emphasis || emphasis.tagName !== 'EM' || next.textContent.trim() !== emphasis.textContent.trim()) return;
    const figure = document.createElement('figure');
    figure.className = 'article-figure';
    const caption = document.createElement('figcaption');
    while (emphasis.firstChild) caption.append(emphasis.firstChild);
    paragraph.replaceWith(figure);
    figure.append(image, caption);
    next.remove();
  });

  article.querySelectorAll('img').forEach((image) => {
    if (!image.hasAttribute('loading')) image.loading = 'lazy';
    if (!image.hasAttribute('decoding')) image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
  });

  // A keyboard-focusable container keeps wide data tables usable on small screens.
  article.querySelectorAll('table').forEach((table, index) => {
    if (table.parentElement.classList.contains('article-table')) return;
    const region = document.createElement('div');
    region.className = 'article-table';
    region.tabIndex = 0;
    region.setAttribute('role', 'region');
    const caption = table.querySelector('caption');
    region.setAttribute('aria-label', caption && caption.textContent.trim() || `Article table ${index + 1}; scroll horizontally if needed`);
    table.replaceWith(region);
    region.append(table);
  });

  const navigation = document.getElementById('article-toc');
  const list = document.getElementById('article-toc-list');
  if (!navigation || !list) return;
  const headings = Array.from(article.querySelectorAll('h2, h3')).filter((heading) => !heading.closest('.footnotes'));
  if (headings.length < 2) return;

  const usedIds = new Set(Array.from(document.querySelectorAll('[id]'), (node) => node.id));
  headings.forEach((heading, index) => {
    if (!heading.id) {
      const stem = heading.textContent.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `section-${index + 1}`;
      let id = stem;
      let suffix = 2;
      while (usedIds.has(id)) id = `${stem}-${suffix++}`;
      heading.id = id;
      usedIds.add(id);
    }
    const item = document.createElement('li');
    item.className = heading.tagName === 'H3' ? 'toc-subheading' : 'toc-heading';
    const link = document.createElement('a');
    link.href = `#${encodeURIComponent(heading.id)}`;
    link.textContent = heading.textContent;
    item.append(link);
    list.append(item);
  });
  navigation.hidden = false;
})();
