(() => {
  'use strict';

  const form = document.querySelector('#blog-writer');
  if (!form) return;

  const storageKey = 'ilyasferozi.blog-draft.v1';
  const githubBase = 'https://github.com/ilyasferozi121-svg/Ilyasferozi.me';
  const fields = Object.fromEntries(['title', 'date', 'summary', 'tags', 'body'].map(name => [name, form.elements.namedItem(name)]));
  const status = document.querySelector('#draft-status');
  const githubNotice = document.querySelector('#github-ready');
  const longPostNotice = document.querySelector('#long-post-notice');
  const githubLink = document.querySelector('#github-editor-link');
  const previewBody = document.querySelector('#preview-body');
  let saveTimer;
  let unsavedChanges = false;

  function todayInPakistan() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  const today = todayInPakistan();
  fields.date.value = today;
  fields.date.max = today;

  function draftValues() {
    return Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.value]));
  }

  function hasWriting() {
    return ['title', 'summary', 'tags', 'body'].some(name => fields[name].value.trim());
  }

  function setStatus(message, warning = false) {
    status.textContent = message;
    status.classList.toggle('is-warning', warning);
  }

  function saveDraft() {
    clearTimeout(saveTimer);
    try {
      const savedAt = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify({ ...draftValues(), savedAt }));
      unsavedChanges = false;
      const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' }).format(new Date(savedAt));
      setStatus(`Draft saved in this browser at ${time} Pakistan time. Download a copy to keep a backup.`);
      return true;
    } catch {
      setStatus('This browser could not save your draft. Keep this tab open and download a copy before leaving.', true);
      return false;
    }
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Invalid draft');
      for (const [name, field] of Object.entries(fields)) {
        if (typeof saved[name] === 'string') field.value = saved[name];
      }
      if (!fields.date.value) fields.date.value = today;
      setStatus('Your saved draft has been restored from this browser. Download a copy to keep a backup.');
    } catch {
      setStatus('A saved draft could not be loaded. Draft storage may be unavailable; download your writing to keep a copy.', true);
    }
  }

  function appendInline(parent, value, depth = 0) {
    if (depth > 8) {
      parent.append(document.createTextNode(value));
      return;
    }
    const tokens = /\[([^\]\n]+)\]\(([^)\s]+)\)|`([^`\n]+)`|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_/g;
    let cursor = 0;
    for (const token of value.matchAll(tokens)) {
      parent.append(document.createTextNode(value.slice(cursor, token.index)));
      let element;
      if (token[1] !== undefined) {
        let destination;
        try { destination = new URL(token[2], window.location.origin); } catch { /* Show unsupported links as text. */ }
        if (destination && ['https:', 'http:', 'mailto:'].includes(destination.protocol)) {
          element = document.createElement('a');
          element.href = destination.href;
          if (destination.protocol !== 'mailto:') {
            element.target = '_blank';
            element.rel = 'noopener noreferrer';
          }
          appendInline(element, token[1], depth + 1);
        } else {
          element = document.createTextNode(token[0]);
        }
      } else if (token[3] !== undefined) {
        element = document.createElement('code');
        element.textContent = token[3];
      } else {
        element = document.createElement(token[4] !== undefined || token[5] !== undefined ? 'strong' : 'em');
        appendInline(element, token[4] ?? token[5] ?? token[6] ?? token[7], depth + 1);
      }
      parent.append(element);
      cursor = token.index + token[0].length;
    }
    parent.append(document.createTextNode(value.slice(cursor)));
  }

  function isBlockStart(line) {
    return /^\s*$|^ {0,3}(?:#{1,6}\s|>|[-+*]\s|\d+[.)]\s|```|~~~)|^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
  }

  function renderMarkdown(source, parent, depth = 0) {
    if (depth > 16) {
      const paragraph = document.createElement('p');
      paragraph.textContent = source;
      parent.replaceChildren(paragraph);
      return;
    }
    const fragment = document.createDocumentFragment();
    const lines = source.replace(/\r\n?/g, '\n').split('\n');
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) { index++; continue; }
      const fence = line.match(/^ {0,3}(`{3,}|~{3,})[^\n]*$/);
      const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
      const listItem = line.match(/^ {0,3}([-+*]|\d+[.)])\s+(.+)$/);
      if (fence) {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        const content = [];
        const closing = new RegExp(`^ {0,3}${fence[1][0]}{${fence[1].length},}\\s*$`);
        index++;
        while (index < lines.length && !closing.test(lines[index])) content.push(lines[index++]);
        if (index < lines.length) index++;
        code.textContent = content.join('\n');
        pre.append(code);
        fragment.append(pre);
      } else if (heading) {
        const element = document.createElement(`h${heading[1].length}`);
        appendInline(element, heading[2]);
        fragment.append(element);
        index++;
      } else if (/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        fragment.append(document.createElement('hr'));
        index++;
      } else if (/^ {0,3}>/.test(line)) {
        const quote = document.createElement('blockquote');
        const content = [];
        while (index < lines.length && /^ {0,3}>/.test(lines[index])) content.push(lines[index++].replace(/^ {0,3}>\s?/, ''));
        renderMarkdown(content.join('\n'), quote, depth + 1);
        fragment.append(quote);
      } else if (listItem) {
        const ordered = /^\d/.test(listItem[1]);
        const list = document.createElement(ordered ? 'ol' : 'ul');
        if (ordered) list.start = parseInt(listItem[1], 10);
        while (index < lines.length) {
          const item = lines[index].match(/^ {0,3}([-+*]|\d+[.)])\s+(.+)$/);
          if (!item || /^\d/.test(item[1]) !== ordered) break;
          const element = document.createElement('li');
          appendInline(element, item[2]);
          list.append(element);
          index++;
        }
        fragment.append(list);
      } else {
        const paragraph = document.createElement('p');
        const content = [line];
        index++;
        while (index < lines.length && !isBlockStart(lines[index])) content.push(lines[index++]);
        appendInline(paragraph, content.join(' '));
        fragment.append(paragraph);
      }
    }
    parent.replaceChildren(fragment);
  }

  function tagsFrom(value) {
    return [...new Set(value.split(',').map(tag => tag.trim()).filter(Boolean))];
  }

  function renderPreview() {
    document.querySelector('#preview-title').textContent = fields.title.value.trim() || 'Your article title';
    const date = fields.date.value;
    const dateLabel = document.querySelector('#preview-date');
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00+05:00`) : null;
    dateLabel.textContent = parsedDate && Number.isFinite(parsedDate.getTime()) ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'long', year: 'numeric' }).format(parsedDate) : '';
    const summary = document.querySelector('#preview-summary');
    summary.textContent = fields.summary.value.trim();
    summary.hidden = !summary.textContent;
    const tags = document.querySelector('#preview-tags');
    tags.replaceChildren(...tagsFrom(fields.tags.value).map(value => {
      const tag = document.createElement('span');
      tag.textContent = value;
      return tag;
    }));
    tags.hidden = !tags.childElementCount;
    if (fields.body.value.trim()) {
      renderMarkdown(fields.body.value, previewBody);
    } else {
      const placeholder = document.createElement('p');
      placeholder.className = 'preview-placeholder';
      placeholder.textContent = 'Your article will take shape here as you write.';
      previewBody.replaceChildren(placeholder);
    }
  }

  function validate() {
    fields.title.setCustomValidity(fields.title.value.trim() ? '' : 'Please give your article a title.');
    fields.body.setCustomValidity(fields.body.value.trim() ? '' : 'Please write your article before continuing.');
    return form.reportValidity();
  }

  function yamlString(value) {
    return JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  }

  function preparedPost() {
    const draft = draftValues();
    const slug = Array.from(draft.title.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')).slice(0, 80).join('').replace(/-$/, '') || 'new-post';
    const excerpt = draft.body.replace(/```[\s\S]*?```/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[#>*_`~]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180);
    const markdown = ['---', 'layout: post', `title: ${yamlString(draft.title.trim())}`, `date: ${draft.date} 00:00:00 +0500`, `description: ${yamlString(draft.summary.trim() || excerpt)}`, `tags: ${JSON.stringify(tagsFrom(draft.tags))}`, '---', '', draft.body.trim(), ''].join('\n');
    return { filename: `${draft.date}-${slug}.md`, markdown };
  }

  function downloadPost() {
    if (!validate()) return;
    saveDraft();
    const post = preparedPost();
    const objectUrl = URL.createObjectURL(new Blob([post.markdown], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = post.filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  form.addEventListener('input', event => {
    if (event.target === fields.title || event.target === fields.body) event.target.setCustomValidity('');
    unsavedChanges = true;
    githubNotice.hidden = true;
    longPostNotice.hidden = true;
    renderPreview();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 400);
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!validate()) return;
    saveDraft();
    const post = preparedPost();
    const url = new URL(`${githubBase}/new/main`);
    url.searchParams.set('filename', `_posts/${post.filename}`);
    url.searchParams.set('value', post.markdown);
    githubNotice.hidden = true;
    longPostNotice.hidden = true;
    if (url.href.length > 6000) {
      longPostNotice.hidden = false;
      document.querySelector('#long-post-heading').focus();
      return;
    }
    githubLink.href = url.href;
    githubNotice.hidden = false;
    githubLink.click();
  });

  document.querySelector('#download-post').addEventListener('click', downloadPost);
  document.querySelector('#download-long-post').addEventListener('click', downloadPost);
  document.querySelector('#new-draft').addEventListener('click', () => {
    if (hasWriting() && !window.confirm('Start a new draft? This will replace the draft saved in this browser. Download a copy first if you want to keep it.')) return;
    clearTimeout(saveTimer);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      setStatus('The saved draft could not be cleared. Your writing has been kept here; download a copy before starting over.', true);
      return;
    }
    form.reset();
    fields.title.setCustomValidity('');
    fields.body.setCustomValidity('');
    fields.date.value = today;
    unsavedChanges = false;
    githubNotice.hidden = true;
    longPostNotice.hidden = true;
    setStatus('New draft. Your writing will be saved in this browser as you type.');
    renderPreview();
    fields.title.focus();
  });

  window.addEventListener('pagehide', () => {
    if (unsavedChanges) saveDraft();
  });
  window.addEventListener('beforeunload', event => {
    if (unsavedChanges && hasWriting() && !saveDraft()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  restoreDraft();
  renderPreview();
})();
