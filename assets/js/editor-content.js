/* Safe authoring helpers: no HTML evaluation and no network or storage access. */
(() => {
  'use strict';
  const textFields = ['title', 'seo_title', 'seo_description', 'slug', 'cover_image', 'cover_alt', 'cover_caption', 'cover_credit', 'cover_srcset', 'cover_sizes', 'last_modified_at'];
  const numberFields = ['cover_width', 'cover_height'];
  const knownKeys = new Set(['layout', 'description', 'date', 'tags', 'toc', ...textFields, ...numberFields]);
  const origin = () => window.location.origin;
  const yamlString = value => JSON.stringify(String(value ?? '')).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const cleanLabel = value => String(value).replace(/\\([\\[\]*_`])/g, '$1').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '');

  function slugify(value) {
    return Array.from(String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')).slice(0, 80).join('').replace(/-$/, '') || 'new-post';
  }

  function imageUrl(value) {
    const source = String(value ?? '').trim();
    if (!source || /[\\\u0000-\u001f\u007f]/.test(source)) return null;
    const local = source.startsWith('/') && !source.startsWith('//');
    try {
      const url = new URL(source, origin());
      if (url.username || url.password || (!local && (!/^https:\/\//i.test(source) || url.protocol !== 'https:'))) return null;
      return local ? `${url.pathname}${url.search}${url.hash}` : url.href;
    } catch { return null; }
  }

  function linkUrl(value) {
    const source = String(value ?? '').trim();
    if (!source || /[\\\u0000-\u001f\u007f]/.test(source) || source.startsWith('//')) return null;
    try {
      const url = new URL(source, origin());
      return !url.username && !url.password && ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.href : null;
    } catch { return null; }
  }

  function blocksFrom(lines) {
    const blocks = [];
    for (const line of lines) {
      const match = line.match(/^([A-Za-z_][\w-]*):(?:\s*(.*))?$/);
      if (match) blocks.push({ key: match[1], value: match[2] || '', lines: [line] });
      else if (!line.trim() || /^\s|^#/.test(line)) {
        if (blocks.length) blocks[blocks.length - 1].lines.push(line);
        else blocks.push({ key: null, value: '', lines: [line] });
      } else throw new Error('This front matter uses syntax the writing desk cannot safely preserve. Edit this article in GitHub.');
    }
    return blocks;
  }

  function scalar(value, key) {
    const raw = value.trim();
    if (!raw) return '';
    if (raw.startsWith('"')) {
      const quoted = raw.match(/^("(?:\\.|[^"\\])*")\s*(?:#.*)?$/);
      try { if (!quoted) throw new Error(); return JSON.parse(quoted[1]); } catch { throw new Error(`The ${key} field needs a simple quoted value. Edit its front matter in GitHub.`); }
    }
    if (raw.startsWith("'")) {
      const quoted = raw.match(/^('(?:[^']|'')*')\s*(?:#.*)?$/);
      if (!quoted) throw new Error(`The ${key} field has unsupported quoting. Edit its front matter in GitHub.`);
      return quoted[1].slice(1, -1).replace(/''/g, "'");
    }
    if (/^[!&*[{]|^\{/.test(raw)) throw new Error(`The ${key} field uses advanced YAML. Edit this article in GitHub to keep it intact.`);
    return raw.replace(/\s+#.*$/, '').trim();
  }

  function scalarBlock(block) {
    if (/^[|>][-+]?\s*(?:#.*)?$/.test(block.value.trim())) {
      const content = block.lines.slice(1).filter(line => !/^\s*#/.test(line));
      const indents = content.filter(line => line.trim()).map(line => line.match(/^\s*/)[0].length);
      const indent = indents.length ? Math.min(...indents) : 0;
      const joined = content.map(line => line.slice(indent)).join(block.value.trim().startsWith('>') ? ' ' : '\n');
      return joined.trimEnd();
    }
    if (block.lines.slice(1).some(line => line.trim() && !/^\s*#/.test(line))) throw new Error(`The ${block.key} field spans unsupported YAML. Edit this article in GitHub to keep it intact.`);
    return scalar(block.value, block.key);
  }

  function tagArray(block) {
    const raw = block.value.trim();
    if (!raw) return block.lines.slice(1).filter(line => line.trim() && !/^\s*#/.test(line)).map(line => {
      const item = line.match(/^\s+-\s+(.*)$/);
      if (!item) throw new Error('Tags must be a simple list of names. Edit advanced tags in GitHub.');
      return String(scalar(item[1], 'tags'));
    });
    if (!raw.startsWith('[')) return [String(scalarBlock(block))];
    if (!raw.endsWith(']')) throw new Error('Tags must be a simple list of names.');
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every(value => typeof value === 'string')) return parsed;
    } catch { /* A basic YAML flow list is also supported. */ }
    const values = raw.slice(1, -1).match(/'(?:[^']|'')*'|"(?:\\.|[^"\\])*"|[^,]+/g) || [];
    return values.filter(value => value.trim()).map(value => String(scalar(value.trim(), 'tags')));
  }

  function parsePost(markdown) {
    const source = String(markdown ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (source.length > 1000000) throw new Error('This Markdown file is too large for the writing desk.');
    const values = { title: '', date: '', summary: '', tags: '', body: source, toc: true };
    for (const key of [...textFields, ...numberFields]) if (!(key in values)) values[key] = '';
    if (!source.startsWith('---\n')) return { values, frontmatterLines: [], unsupported: false };
    const closing = source.indexOf('\n---', 4);
    if (closing < 0 || !/^\n---(?:\n|$)/.test(source.slice(closing))) throw new Error('The article’s front matter has no closing --- line.');
    const frontmatterLines = source.slice(4, closing).split('\n');
    const blocks = blocksFrom(frontmatterLines);
    const seen = new Set();
    for (const block of blocks) {
      if (!knownKeys.has(block.key)) continue;
      if (seen.has(block.key)) throw new Error(`Duplicate ${block.key} metadata cannot be edited safely. Remove the duplicate in GitHub first.`);
      seen.add(block.key);
      if (block.key === 'tags') { values.tags = tagArray(block).join(', '); continue; }
      const value = scalarBlock(block);
      if (block.key === 'layout') {
        if (value && value !== 'post') throw new Error('This article uses a custom layout. Edit it in GitHub to preserve its layout.');
      } else if (block.key === 'toc') {
        if (!['true', 'false', ''].includes(String(value))) throw new Error('The table-of-contents setting must be true or false.');
        values.toc = String(value) === 'true';
      } else if (block.key === 'date') {
        const date = String(value).match(/^\d{4}-\d{2}-\d{2}/);
        if (!date) throw new Error('The article needs a YYYY-MM-DD publication date.');
        values.date = date[0];
      } else if (block.key === 'description') values.summary = String(value);
      else if (numberFields.includes(block.key)) {
        if (value !== '' && (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > 40000)) throw new Error(`The ${block.key} value must be a positive image dimension.`);
        values[block.key] = value === '' ? '' : Number(value);
      } else if (typeof value !== 'string' && typeof value !== 'number') throw new Error(`The ${block.key} metadata needs a plain text value.`);
      else values[block.key] = String(value);
    }
    values.body = source.slice(closing + 4).replace(/^\n/, '');
    return { values, frontmatterLines, unsupported: false };
  }

  function serializePost(values, context = {}) {
    const strings = Object.fromEntries(textFields.map(key => [key, String(values[key] ?? '').trim()]));
    const body = String(values.body ?? '').trim();
    const excerpt = body.replace(/```[\s\S]*?```/g, '').replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[#>*_`~]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180);
    const date = String(values.date ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose a valid publication date before exporting or publishing.');
    const tagNames = Array.isArray(values.tags) ? values.tags : String(values.tags ?? '').split(',');
    const tags = [...new Set(tagNames.map(tag => String(tag).trim()).filter(Boolean))];
    const replacements = new Map([
      ['layout', 'layout: post'], ['title', `title: ${yamlString(strings.title)}`], ['date', `date: ${date} 00:00:00 +0500`],
      ['description', `description: ${yamlString(String(values.summary ?? '').trim() || excerpt)}`], ['tags', `tags: ${JSON.stringify(tags)}`],
      ['toc', `toc: ${values.toc === true || values.toc === 'true'}`]
    ]);
    if (context.lastModifiedAt) strings.last_modified_at = String(context.lastModifiedAt);
    for (const key of textFields) if (!['title'].includes(key)) replacements.set(key, strings[key] ? `${key}: ${yamlString(strings[key])}` : null);
    for (const key of numberFields) {
      const number = Number(values[key]);
      replacements.set(key, Number.isInteger(number) && number > 0 && number <= 40000 ? `${key}: ${number}` : null);
    }
    const original = Array.isArray(context.originalFrontmatter) ? context.originalFrontmatter : [];
    const blocks = blocksFrom(original);
    const originalDate = blocks.find(block => block.key === 'date');
    const preserveOriginalDate = originalDate && String(scalarBlock(originalDate)).slice(0, 10) === date;
    const lines = [];
    const handled = new Set();
    for (const block of blocks) {
      if (!replacements.has(block.key)) { lines.push(...block.lines); continue; }
      if (handled.has(block.key)) throw new Error(`Duplicate ${block.key} metadata cannot be saved safely.`);
      handled.add(block.key);
      if (block.key === 'date' && preserveOriginalDate) { lines.push(...block.lines); continue; }
      if (replacements.get(block.key)) lines.push(replacements.get(block.key));
      for (const line of block.lines.slice(1)) if (/^\s*#/.test(line)) lines.push(line);
    }
    for (const [key, line] of replacements) if (!handled.has(key) && line) lines.push(line);
    return ['---', ...lines, '---', '', body, ''].join('\n');
  }

  function headingId(text) {
    return cleanLabel(text).trim().toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu, '').replace(/ /g, '-') || 'section';
  }

  function closingFence(line, fence) {
    return new RegExp(`^ {0,3}${fence.character}{${fence.length},}\\s*$`).test(line);
  }

  function withoutCode(source) {
    const lines = [], input = String(source).split('\n');
    let fence = null;
    for (const line of input) {
      if (fence) { if (closingFence(line, fence)) fence = null; lines.push(''); continue; }
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (marker) { fence = { character: marker[1][0], length: marker[1].length }; lines.push(''); continue; }
      lines.push(line);
    }
    return lines.join('\n').replace(/(`+)[^\n]*?\1/g, '');
  }

  function extractHeadings(source) {
    const headings = [], counts = new Map();
    let fence = null;
    for (const line of String(source ?? '').replace(/\r\n?/g, '\n').split('\n')) {
      if (fence) { if (closingFence(line, fence)) fence = null; continue; }
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (marker) { fence = { character: marker[1][0], length: marker[1].length }; continue; }
      const match = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (!match) continue;
      const base = headingId(match[2]), count = counts.get(base) || 0;
      counts.set(base, count + 1);
      headings.push({ level: match[1].length, text: cleanLabel(match[2]), id: count ? `${base}-${count}` : base });
    }
    return headings;
  }

  function referenceData(source) {
    const notes = new Map(), links = new Map(), lines = String(source).replace(/\r\n?/g, '\n').split('\n'), kept = [];
    let fence = null;
    for (let i = 0; i < lines.length; i++) {
      if (fence) { if (closingFence(lines[i], fence)) fence = null; kept.push(lines[i]); continue; }
      const marker = lines[i].match(/^ {0,3}(`{3,}|~{3,})/);
      if (marker) { fence = { character: marker[1][0], length: marker[1].length }; kept.push(lines[i]); continue; }
      const note = lines[i].match(/^ {0,3}\[\^([^\]\s]+)\]:\s*(.*)$/);
      const link = lines[i].match(/^ {0,3}\[([^\]\n]+)\]:\s*(\S+)(?:\s+.*)?$/);
      if (note) {
        const content = [note[2]];
        while (i + 1 < lines.length && /^(?: {4}|\t)/.test(lines[i + 1])) content.push(lines[++i].replace(/^(?: {4}|\t)/, ''));
        notes.set(note[1], content.join('\n'));
        kept.push('');
      } else if (link) { links.set(link[1].toLowerCase(), link[2]); kept.push(''); }
      else kept.push(lines[i]);
    }
    return { notes, links, source: kept.join('\n'), used: [], references: new Map(), nextReference: 0 };
  }

  function appendInline(parent, value, state, depth = 0) {
    if (depth > 10) { parent.append(document.createTextNode(value)); return; }
    const expression = /\\(?<escaped>[\\`*_{}[\]()#+.!<>|-])|!\[(?<imageAlt>(?:\\.|[^\]\\\n])*)\]\((?<imageUrl>[^)\s]+)\)(?:[ \t]*(?<imageAttrs>\{:[^}\n]*\}))?|\[\^(?<note>[^\]\s]+)\]|\[(?<linkLabel>[^\]\n]+)\]\((?<linkUrl>[^)\s]+)\)|\[(?<refLabel>[^\]\n]+)\]\[(?<refId>[^\]\n]*)\]|`(?<code>[^`\n]+)`|\*\*\*(?<both>[^*\n]+)\*\*\*|\*\*(?<bold>[^*\n]+)\*\*|__(?<bold2>[^_\n]+)__|\*(?<italic>[^*\n]+)\*|_(?<italic2>[^_\n]+)_|<(?<auto>https?:\/\/[^>\s]+)>/g;
    let cursor = 0;
    for (const match of value.matchAll(expression)) {
      parent.append(document.createTextNode(value.slice(cursor, match.index)));
      const group = match.groups;
      let element;
      if (group.escaped !== undefined) element = document.createTextNode(group.escaped);
      else if (group.imageAlt !== undefined) {
        const url = imageUrl(group.imageUrl);
        if (url) { element = document.createElement('img'); element.src = url; element.alt = group.imageAlt.replace(/\\([\\[\]])/g, '$1'); element.loading = 'lazy'; element.decoding = 'async'; element.referrerPolicy = 'no-referrer'; if (group.imageAttrs) imageAttributes(group.imageAttrs, element); }
      } else if (group.note !== undefined) {
        if (state.notes.has(group.note)) {
          if (!state.used.includes(group.note)) state.used.push(group.note);
          const number = state.used.indexOf(group.note) + 1;
          const ref = ++state.nextReference;
          if (!state.references.has(group.note)) state.references.set(group.note, []);
          state.references.get(group.note).push(ref);
          element = document.createElement('sup');
          element.id = `preview-note-ref-${ref}`;
          const anchor = document.createElement('a'); anchor.href = `#preview-note-${number}`; anchor.textContent = String(number); anchor.setAttribute('aria-label', `Footnote ${number}`); element.append(anchor);
        }
      } else if (group.code !== undefined) { element = document.createElement('code'); element.textContent = group.code; }
      else if (group.both !== undefined) { element = document.createElement('strong'); const emphasis = document.createElement('em'); appendInline(emphasis, group.both, state, depth + 1); element.append(emphasis); }
      else if (group.bold !== undefined || group.bold2 !== undefined) { element = document.createElement('strong'); appendInline(element, group.bold ?? group.bold2, state, depth + 1); }
      else if (group.italic !== undefined || group.italic2 !== undefined) { element = document.createElement('em'); appendInline(element, group.italic ?? group.italic2, state, depth + 1); }
      else {
        const url = linkUrl(group.linkUrl ?? group.auto ?? state.links.get((group.refId || group.refLabel || '').toLowerCase()));
        if (url) { element = document.createElement('a'); element.href = url; element.target = '_blank'; element.rel = 'noopener noreferrer'; appendInline(element, group.linkLabel ?? group.refLabel ?? group.auto, state, depth + 1); }
      }
      parent.append(element || document.createTextNode(match[0]));
      cursor = match.index + match[0].length;
    }
    parent.append(document.createTextNode(value.slice(cursor)));
  }

  function cells(line) { return line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(value => value.trim().replace(/\\\|/g, '|')); }
  const tableDivider = line => /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  const isBlock = line => /^\s*$|^ {0,3}(?:#{1,6}\s|>|[-+*]\s|\d+[.)]\s|```|~~~)|^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);

  function imageAttributes(line, image) {
    if (!/^\{:\s*[\s\S]*\}\s*$/.test(line)) return false;
    for (const match of line.matchAll(/([\w-]+)="([^"]*)"/g)) {
      const [, key, value] = match;
      if (['width', 'height'].includes(key) && /^[1-9]\d{0,4}$/.test(value) && Number(value) <= 40000) image.setAttribute(key, value);
      if (key === 'sizes' && value.length < 1000 && /^[A-Za-z0-9\s(),.:%+\-]+$/.test(value)) image.setAttribute('sizes', value);
      if (key === 'srcset') {
        const sources = value.split(',').map(part => part.trim());
        if (sources.length <= 8 && sources.every(part => { const bits = part.match(/^(\S+)\s+([1-9]\d{0,4})w$/); return bits && Number(bits[2]) <= 40000 && imageUrl(bits[1]); })) image.setAttribute('srcset', sources.join(', '));
      }
    }
    return true;
  }

  function renderBlocks(source, state, depth = 0, headingCounts = new Map()) {
    const fragment = document.createDocumentFragment();
    if (depth > 12) { fragment.append(document.createTextNode(source)); return fragment; }
    const lines = source.split('\n');
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) { index++; continue; }
      const previous = fragment.lastElementChild;
      const previousImage = previous?.tagName === 'P' && previous.childElementCount === 1 && previous.firstElementChild.tagName === 'IMG' && !previous.textContent.trim() ? previous.firstElementChild : null;
      if (previousImage && imageAttributes(line, previousImage)) { index++; continue; }
      if (previousImage && /^\*[^*].*\*\s*$/.test(line)) {
        const figure = document.createElement('figure'), caption = document.createElement('figcaption');
        figure.className = 'article-figure'; figure.append(previousImage); appendInline(caption, line.trim().slice(1, -1), state); figure.append(caption); previous.replaceWith(figure); index++; continue;
      }
      const fence = line.match(/^ {0,3}(`{3,}|~{3,})[^\n]*$/);
      const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
      const list = line.match(/^ {0,3}([-+*]|\d+[.)])\s+(.+)$/);
      if (fence) {
        const pre = document.createElement('pre'), code = document.createElement('code'), content = [];
        const closing = new RegExp(`^ {0,3}${fence[1][0]}{${fence[1].length},}\\s*$`);
        index++;
        while (index < lines.length && !closing.test(lines[index])) content.push(lines[index++]);
        if (index < lines.length) index++;
        code.textContent = content.join('\n'); pre.append(code); fragment.append(pre);
      } else if (heading) {
        const element = document.createElement(`h${heading[1].length}`), base = headingId(heading[2]), count = headingCounts.get(base) || 0;
        headingCounts.set(base, count + 1); element.id = count ? `${base}-${count}` : base; appendInline(element, heading[2], state); fragment.append(element); index++;
      } else if (/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { fragment.append(document.createElement('hr')); index++; }
      else if (/^ {0,3}>/.test(line)) {
        const content = [], quote = document.createElement('blockquote');
        while (index < lines.length && /^ {0,3}>/.test(lines[index])) content.push(lines[index++].replace(/^ {0,3}>\s?/, ''));
        quote.append(renderBlocks(content.join('\n'), state, depth + 1, headingCounts)); fragment.append(quote);
      } else if (index + 1 < lines.length && line.includes('|') && tableDivider(lines[index + 1])) {
        const table = document.createElement('table'), thead = document.createElement('thead'), headRow = document.createElement('tr'), tbody = document.createElement('tbody');
        const headers = cells(line).slice(0, 30);
        for (const value of headers) { const cell = document.createElement('th'); cell.scope = 'col'; appendInline(cell, value, state); headRow.append(cell); }
        thead.append(headRow); table.append(thead, tbody); index += 2;
        while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
          const row = document.createElement('tr'), values = cells(lines[index++]);
          for (let i = 0; i < headers.length; i++) { const cell = document.createElement('td'); appendInline(cell, values[i] || '', state); row.append(cell); }
          tbody.append(row);
        }
        fragment.append(table);
      } else if (list) {
        const ordered = /^\d/.test(list[1]), element = document.createElement(ordered ? 'ol' : 'ul');
        if (ordered) element.start = parseInt(list[1], 10);
        while (index < lines.length) {
          const item = lines[index].match(/^ {0,3}([-+*]|\d+[.)])\s+(.+)$/);
          if (!item || /^\d/.test(item[1]) !== ordered) break;
          const row = document.createElement('li'); appendInline(row, item[2], state); element.append(row); index++;
        }
        fragment.append(element);
      } else {
        const content = [line], paragraph = document.createElement('p'); index++;
        while (index < lines.length && !isBlock(lines[index])) {
          if (/^\{:\s/.test(lines[index]) || (lines[index].includes('|') && index + 1 < lines.length && tableDivider(lines[index + 1]))) break;
          content.push(lines[index++]);
        }
        appendInline(paragraph, content.join(' '), state); fragment.append(paragraph);
      }
    }
    return fragment;
  }

  function renderMarkdown(source, parent) {
    const state = referenceData(String(source ?? ''));
    const fragment = renderBlocks(state.source, state);
    if (state.used.length) {
      const section = document.createElement('section'), heading = document.createElement('h2'), list = document.createElement('ol');
      section.className = 'footnotes'; section.setAttribute('aria-label', 'Footnotes'); heading.textContent = 'References'; section.append(heading, list);
      for (let index = 0; index < state.used.length && index < 1000; index++) {
        const id = state.used[index];
        const row = document.createElement('li'); row.id = `preview-note-${index + 1}`; row.append(renderBlocks(state.notes.get(id), state));
        for (const reference of state.references.get(id) || []) { const back = document.createElement('a'); back.href = `#preview-note-ref-${reference}`; back.textContent = ' ↩'; back.setAttribute('aria-label', `Back to footnote ${index + 1}`); row.append(back); }
        list.append(row);
      }
      fragment.append(section);
    }
    parent.replaceChildren(fragment);
  }

  function checkContent(values, options = {}) {
    const issues = [], source = String(values.body ?? ''), headings = extractHeadings(source);
    const prose = withoutCode(source);
    const add = (severity, code, message) => issues.push({ severity, code, message });
    if (!String(values.title ?? '').trim()) add('error', 'title', 'Add an article title.');
    if (!source.trim()) add('error', 'body', 'Write the article before publishing.');
    if (/<\s*(?:script|iframe|object|embed|base|form)\b|<[^>]+\son[a-z]+\s*=|<[^>]+(?:src|href)\s*=\s*["']?\s*(?:javascript|vbscript):|\{:[^}]*\bon[a-z]+\s*=|\{:[^}]*(?:src|href)\s*=\s*["']?\s*(?:javascript|vbscript):/i.test(prose)) add('error', 'active-html', 'Remove active HTML such as scripts, embeds, forms, or event handlers before publishing. Use ordinary Markdown links and pictures.');
    else if (/<\/?[A-Za-z][^>]*>|\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}/.test(prose)) add('warning', 'preview-markup', 'This draft contains HTML or Liquid that the safe reading preview does not interpret. Check the published formatting carefully.');
    if (!String(values.seo_description ?? values.summary ?? '').trim() && !String(values.summary ?? '').trim()) add('warning', 'description', 'Add a useful summary or search description so readers can understand this article before opening it.');
    if (headings.some(heading => heading.level === 1)) add('warning', 'heading-title', 'The page already uses your article title as its H1. Use section headings (H2) within the article.');
    let level = 1;
    for (const heading of headings) { if (heading.level > level + 1) { add('warning', 'heading-order', 'A heading skips a level. Use a clear H2 → H3 structure.'); break; } level = heading.level; }
    if (values.cover_image && !imageUrl(values.cover_image)) add('error', 'cover-url', 'Use an HTTPS image URL or a site path beginning with / for the cover.');
    if (values.cover_image && !String(values.cover_alt ?? '').trim()) add('error', 'cover-alt', 'Describe the cover picture for readers using assistive technology.');
    const content = referenceData(prose);
    const noteReferences = [...content.source.matchAll(/\[\^([^\]\s]+)\]/g)].map(match => match[1]);
    for (const id of new Set(noteReferences)) if (!content.notes.has(id)) add('error', 'footnote', `Footnote “${id}” has no reference text. Add its definition or remove the marker.`);
    for (const match of prose.matchAll(/!\[((?:\\.|[^\]\\\n])*)\]\(([^)\s]+)\)/g)) {
      if (!match[1].trim()) add('warning', 'image-alt', 'An inline picture has no description. Add meaningful alternative text unless it is purely decorative.');
      if (!imageUrl(match[2])) add('error', 'image-url', 'An inline picture uses an unsupported URL. Use HTTPS or a site path beginning with /.');
    }
    let base;
    try { base = new URL(options.baseUrl || origin()); } catch { base = new URL(origin()); }
    const knownPaths = options.knownPaths ? new Set([...options.knownPaths].map(path => { try { return new URL(path, base).pathname.replace(/\/$/, '') || '/'; } catch { return String(path); } })) : null;
    const headingIds = new Set(headings.map(heading => heading.id));
    for (const match of prose.matchAll(/(?<!!)\[([^\]\n]+)\]\(([^)\s]+)\)/g)) {
      const safe = linkUrl(match[2]);
      if (!safe) { add('error', 'link-url', `The link “${match[1]}” uses an unsupported URL.`); continue; }
      if (match[2].startsWith('#')) {
        let id;
        try { id = decodeURIComponent(match[2].slice(1)); } catch { add('warning', 'anchor', `The link “${match[1]}” has a malformed heading address.`); continue; }
        if (!headingIds.has(id)) add('warning', 'anchor', `The link “${match[1]}” points to a heading that is not in this draft.`);
        continue;
      }
      const destination = new URL(match[2], base);
      if (knownPaths && destination.origin === base.origin && !knownPaths.has(destination.pathname.replace(/\/$/, '') || '/')) add('warning', 'internal-link', `Check the internal link “${match[1]}”: its destination is not in the current site index.`);
    }
    return issues;
  }

  window.IlyasEditorContent = Object.freeze({ renderMarkdown, parsePost, serializePost, slugify, checkContent, extractHeadings });
})();
