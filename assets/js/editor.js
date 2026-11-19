(() => {
  'use strict';

  const form = document.querySelector('#blog-writer');
  if (!form) return;
  const content = window.IlyasEditorContent;
  const media = window.EditorMedia;
  if (!content || !media) { document.querySelector('#signin-status').textContent = 'The writing tools could not load. Refresh the page before signing in.'; return; }

  const storageKey = 'ilyasferozi.blog-drafts.v2';
  const legacyStorageKey = 'ilyasferozi.blog-draft.v1';
  const repository = 'ilyasferozi121-svg/Ilyasferozi.me';
  const administratorLogin = 'ilyasferozi121-svg';
  const githubBase = `https://github.com/${repository}`;
  const apiOrigin = 'https://api.github.com';
  const commitIdentity = { name: 'Mohammad Ilyas', email: '231227306+ilyasferozi121-svg@users.noreply.github.com' };
  const fields = Object.fromEntries(['title', 'date', 'summary', 'tags', 'body', 'cover_image', 'cover_alt', 'cover_caption', 'cover_credit', 'cover_width', 'cover_height', 'cover_srcset', 'cover_sizes', 'seo_title', 'seo_description', 'slug', 'toc', 'last_modified_at'].map(name => [name, form.elements.namedItem(name)]));
  const status = document.querySelector('#draft-status');
  const publishNotice = document.querySelector('#publish-notice');
  const publishButton = document.querySelector('#publish-post');
  const loginForm = document.querySelector('#administrator-login');
  const tokenInput = document.querySelector('#administrator-token');
  const loginButton = document.querySelector('#administrator-login-button');
  const signInView = document.querySelector('#administrator-signin');
  const signInStatus = document.querySelector('#signin-status');
  const workspace = document.querySelector('#administrator-workspace');
  const previewBody = document.querySelector('#preview-body');
  let uploadBusy = false;
  let uploadController = null;
  let saveTimer;
  let unsavedChanges = false;
  let administratorToken = '';
  let authenticated = false;
  let sessionGeneration = 0;
  let loginBusy = false;
  let publishBusy = false;
  let deleteBusy = false;
  let deleteController = null;
  let pendingDeletion = null;
  let publishedCurrentDraft = false;
  let loginController = null;
  let publishController = null;
  let pendingDraft = null;
  let pendingDraftUnsaved = false;
  let draftLibrary = { version: 2, activeId: '', drafts: [] };
  let libraryLoaded = false;
  let currentSource = null;
  let articleEntries = [];
  let libraryBusy = false;
  let libraryController = null;
  let libraryGeneration = 0;
  let draftGeneration = 0;
  const seenDraftVersions = new Map();
  const deletedDraftIds = new Set();
  const removedArticlePaths = new Set();
  const validPostPath = path => typeof path === 'string' && /^_posts\/\d{4}-\d{2}-\d{2}-[^/\\\u0000-\u001f]+\.(?:md|markdown)$/i.test(path) && !path.includes('..');
  const validSha = value => typeof value === 'string' && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value);

  function todayInPakistan() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  const today = todayInPakistan();
  fields.date.value = today;
  fields.date.max = today;

  function draftValues() {
    return Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.type === 'checkbox' ? field.checked : field.value]));
  }

  function hasWriting() {
    return ['title', 'summary', 'tags', 'body', 'cover_image', 'cover_alt', 'seo_title', 'seo_description'].some(name => fields[name].value.trim());
  }

  function setStatus(message, warning = false) {
    status.textContent = message;
    status.classList.toggle('is-warning', warning);
  }

  function cleanValues(input = {}) {
    const values = {};
    for (const [key, field] of Object.entries(fields)) {
      if (field.type === 'checkbox') values[key] = input[key] === undefined ? true : input[key] === true || input[key] === 'true';
      else if (['cover_width', 'cover_height'].includes(key) && Number.isFinite(input[key]) && input[key] > 0) values[key] = String(input[key]);
      else {
        const limit = field.maxLength > 0 ? field.maxLength : key === 'cover_srcset' ? 12000 : 4000;
        if (typeof input[key] === 'string' && input[key].length > limit) throw new Error(`The ${key.replace(/_/g, ' ')} field exceeds this editor’s ${limit.toLocaleString()} character limit. Keep the original file and edit it in GitHub.`);
        values[key] = typeof input[key] === 'string' ? input[key] : '';
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) values.date = todayInPakistan();
    return values;
  }

  function cleanSource(source) {
    if (!source || !validPostPath(source.path) || !validSha(source.sha) || !Array.isArray(source.frontmatterLines) || source.frontmatterLines.some(line => typeof line !== 'string') || source.frontmatterLines.join('\n').length > 100000) return null;
    return { path: source.path, sha: source.sha, frontmatterLines: [...source.frontmatterLines], originalValues: cleanValues(source.originalValues), url: typeof source.url === 'string' && source.url.startsWith('/') && !source.url.startsWith('//') ? source.url : '' };
  }

  function activeDraft() {
    return draftLibrary.drafts.find(draft => draft.id === draftLibrary.activeId);
  }

  function newDraftRecord(values = {}) {
    return { id: crypto.randomUUID(), values: cleanValues(values), updatedAt: new Date().toISOString(), revisions: [], source: null, frontmatterLines: [] };
  }

  function parseDraftBackup(raw) {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || data.version !== 2 || !Array.isArray(data.drafts) || data.drafts.length > 100) throw new Error('This is not a supported draft backup.');
    return {
      version: 2,
      activeId: typeof data.activeId === 'string' ? data.activeId : '',
      drafts: data.drafts.map(item => {
        if (!item || typeof item.id !== 'string' || !/^[\w-]{1,80}$/.test(item.id) || !item.values) throw new Error('A draft in this backup is invalid.');
        return { id: item.id, values: cleanValues(item.values), updatedAt: typeof item.updatedAt === 'string' && Number.isFinite(Date.parse(item.updatedAt)) ? item.updatedAt : new Date().toISOString(), source: cleanSource(item.source), frontmatterLines: Array.isArray(item.frontmatterLines) && item.frontmatterLines.every(line => typeof line === 'string') && item.frontmatterLines.join('\n').length < 100000 ? item.frontmatterLines : [], revisions: Array.isArray(item.revisions) ? item.revisions.slice(-20).filter(revision => revision && revision.values && Number.isFinite(Date.parse(revision.savedAt))).map(revision => ({ savedAt: revision.savedAt, values: cleanValues(revision.values) })) : [] };
      })
    };
  }

  function loadDraftLibrary() {
    if (!authenticated || libraryLoaded) return;
    const raw = localStorage.getItem(storageKey);
    if (raw) draftLibrary = parseDraftBackup(raw);
    else {
      const legacy = localStorage.getItem(legacyStorageKey);
      if (legacy) {
        const item = newDraftRecord(JSON.parse(legacy));
        draftLibrary = { version: 2, activeId: item.id, drafts: [item] };
      }
    }
    if (!draftLibrary.drafts.length) {
      const item = newDraftRecord();
      draftLibrary.drafts.push(item);
      draftLibrary.activeId = item.id;
    }
    if (!activeDraft()) draftLibrary.activeId = draftLibrary.drafts[0].id;
    draftLibrary.drafts.forEach(item => seenDraftVersions.set(item.id, item.updatedAt));
    libraryLoaded = true;
  }

  function persistDraftLibrary() {
    const diskRaw = localStorage.getItem(storageKey);
    const disk = diskRaw ? parseDraftBackup(diskRaw) : { drafts: [] };
    const active = activeDraft();
    const remote = disk.drafts.find(item => item.id === draftLibrary.activeId);
    if (remote && seenDraftVersions.has(remote.id) && remote.updatedAt !== seenDraftVersions.get(remote.id)) throw new Error('Another tab changed this draft. Download your writing before reopening the saved version.');
    const merged = new Map(disk.drafts.filter(item => !deletedDraftIds.has(item.id)).map(item => [item.id, item]));
    for (const item of draftLibrary.drafts) {
      if (deletedDraftIds.has(item.id)) continue;
      const previous = merged.get(item.id);
      if (item === active || !previous || item.updatedAt >= previous.updatedAt) merged.set(item.id, item);
    }
    if (merged.size > 100) throw new Error('The draft library is full. Download a backup and remove drafts you no longer need.');
    const next = { version: 2, activeId: draftLibrary.activeId, drafts: [...merged.values()].map(item => item.source && removedArticlePaths.has(item.source.path) ? { ...item, frontmatterLines: item.frontmatterLines?.length ? item.frontmatterLines : [...item.source.frontmatterLines], source: null } : item) };
    localStorage.setItem(storageKey, JSON.stringify(next));
    draftLibrary = next;
    deletedDraftIds.clear();
    draftLibrary.drafts.forEach(item => seenDraftVersions.set(item.id, item.updatedAt));
  }

  function renderDraftLibrary(selectActive = false) {
    const list = document.querySelector('#saved-drafts');
    const selected = selectActive ? draftLibrary.activeId : list.value || draftLibrary.activeId;
    list.replaceChildren(...draftLibrary.drafts.map(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.values.title.trim() || 'Untitled draft'}${item.source ? ' · published article' : ''}`;
      return option;
    }));
    list.value = draftLibrary.drafts.some(item => item.id === selected) ? selected : draftLibrary.activeId;
    const revisions = document.querySelector('#draft-revisions');
    const old = revisions.value;
    revisions.replaceChildren(new Option('Choose a snapshot', ''), ...(activeDraft()?.revisions || []).map((revision, index) => new Option(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(revision.savedAt)), String(index))));
    if ([...revisions.options].some(option => option.value === old)) revisions.value = old;
    const mode = document.querySelector('#editor-mode');
    mode.replaceChildren(document.createTextNode(currentSource ? `Editing published article: ${currentSource.path}. Its address stays fixed. ` : 'New article draft'));
    if (currentSource) {
      const history = document.createElement('a');
      history.id = 'published-history';
      history.href = `${githubBase}/commits/main/${currentSource.path.split('/').map(encodeURIComponent).join('/')}`;
      history.target = '_blank'; history.rel = 'noopener noreferrer'; history.textContent = 'View published versions';
      mode.append(history);
    }
    fields.slug.readOnly = Boolean(currentSource);
    fields.date.readOnly = Boolean(currentSource);
  }

  function applyDraft(item) {
    draftGeneration++;
    resetEditorView();
    const values = cleanValues(item.values);
    for (const [key, field] of Object.entries(fields)) {
      if (field.type === 'checkbox') field.checked = values[key];
      else field.value = values[key];
    }
    currentSource = cleanSource(item.source);
    unsavedChanges = false;
    renderDraftLibrary(true);
    renderPreview();
    updateEditorControls();
  }

  function saveDraft(snapshot = false) {
    clearTimeout(saveTimer);
    if (!authenticated) return false;
    try {
      if (!libraryLoaded) loadDraftLibrary();
      let item = activeDraft();
      if (!item) { item = newDraftRecord(); draftLibrary.drafts.push(item); draftLibrary.activeId = item.id; }
      const values = cleanValues(draftValues());
      const previous = JSON.stringify(item.values);
      if (previous !== JSON.stringify(values) && (snapshot || !item.revisions.length || Date.now() - Date.parse(item.revisions.at(-1).savedAt) > 60000)) item.revisions.push({ savedAt: item.updatedAt, values: { ...item.values } });
      item.revisions = item.revisions.slice(-20);
      item.values = values;
      item.source = cleanSource(currentSource);
      item.updatedAt = new Date(Math.max(Date.now(), Date.parse(item.updatedAt || 0) + 1 || 0)).toISOString();
      persistDraftLibrary();
      unsavedChanges = false;
      pendingDraftUnsaved = false;
      renderDraftLibrary();
      setStatus('Draft saved in this browser. Up to 20 snapshots are kept per draft; download a backup to keep a separate copy.');
      return true;
    } catch (error) {
      unsavedChanges = true;
      pendingDraftUnsaved = hasWriting();
      setStatus(`${error?.message || 'This browser could not save your draft.'} Keep this tab open and download your writing before leaving.`, true);
      return false;
    }
  }

  function restoreDraft() {
    if (!authenticated) return;
    try {
      loadDraftLibrary();
      const item = activeDraft();
      const needsSaving = Boolean(pendingDraft && pendingDraftUnsaved);
      if (needsSaving) item.values = cleanValues(pendingDraft);
      applyDraft(item);
      pendingDraft = null;
      pendingDraftUnsaved = false;
      if (needsSaving) { unsavedChanges = true; if (!saveDraft()) return; }
      setStatus('Draft library restored from this browser. Drafts stay on this device; download a backup for safekeeping.');
    } catch {
      libraryLoaded = true;
      const item = newDraftRecord(pendingDraft || draftValues());
      draftLibrary = { version: 2, activeId: item.id, drafts: [item] };
      applyDraft(item);
      unsavedChanges = hasWriting();
      pendingDraftUnsaved = hasWriting();
      setStatus('Saved drafts could not be read. They have not been overwritten. Download your writing before clearing browser data.', true);
    }
  }

  function safeImageUrl(value) {
    if (typeof value !== 'string' || !value.trim() || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
    const source = value.trim();
    const local = source.startsWith('/') && !source.startsWith('//');
    try {
      const url = new URL(source, window.location.origin);
      if (url.username || url.password || (!local && url.protocol !== 'https:')) return null;
      if (!local && !/^https:\/\//i.test(source)) return null;
      const result = local ? `${url.pathname}${url.search}${url.hash}` : url.href;
      return result.replace(/\(/g, '%28').replace(/\)/g, '%29');
    } catch { return null; }
  }

  function renderMarkdown(source, parent) {
    content.renderMarkdown(source, parent);
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
    const cover = document.querySelector('#preview-cover');
    const coverImage = document.querySelector('#preview-cover-image');
    const coverUrl = safeImageUrl(fields.cover_image.value);
    cover.hidden = !coverUrl;
    if (coverUrl) {
      coverImage.src = coverUrl;
      coverImage.alt = fields.cover_alt.value.trim();
    } else coverImage.removeAttribute('src');
    let caption = document.querySelector('#preview-cover-caption');
    if (!caption) { caption = document.createElement('figcaption'); caption.id = 'preview-cover-caption'; cover.append(caption); }
    caption.textContent = [fields.cover_caption.value.trim(), fields.cover_credit.value.trim() ? `Credit: ${fields.cover_credit.value.trim()}` : ''].filter(Boolean).join(' — ');
    caption.hidden = !caption.textContent;
    document.querySelector('#search-title').textContent = fields.seo_title.value.trim() || fields.title.value.trim() || 'Your article title';
    document.querySelector('#search-description').textContent = fields.seo_description.value.trim() || fields.summary.value.trim() || 'Add a clear description of what your article covers.';
    document.querySelector('#search-url').textContent = `https://ilyasferozi.me${currentSource?.url || articleUrl(null, [], draftValues())}`;
    const words = fields.body.value.trim() ? fields.body.value.trim().split(/\s+/).length : 0;
    document.querySelector('#writing-stats').textContent = `${words.toLocaleString()} words · ${words ? Math.max(1, Math.ceil(words / 200)) : 0} min read`;
    if (fields.body.value.trim()) {
      renderMarkdown(fields.body.value, previewBody);
    } else {
      const placeholder = document.createElement('p');
      placeholder.className = 'preview-placeholder';
      placeholder.textContent = 'Your article will take shape here as you write.';
      previewBody.replaceChildren(placeholder);
    }
    if (fields.toc.checked) {
      const headings = [...previewBody.querySelectorAll('h2, h3')];
      if (headings.length > 1) {
        const nav = document.createElement('nav'); nav.className = 'preview-toc'; nav.setAttribute('aria-label', 'Article contents');
        const heading = document.createElement('strong'); heading.textContent = 'In this article'; nav.append(heading);
        const links = document.createElement('ul');
        headings.forEach(item => { const li = document.createElement('li'); const link = document.createElement('a'); link.href = `#${item.id}`; link.textContent = item.textContent; li.append(link); links.append(li); });
        nav.append(links); previewBody.prepend(nav);
      }
    }
  }

  function validate() {
    fields.date.max = currentSource ? currentSource.originalValues.date : todayInPakistan();
    fields.title.setCustomValidity(fields.title.value.trim() ? '' : 'Please give your article a title.');
    fields.body.setCustomValidity(fields.body.value.trim() ? '' : 'Please write your article before continuing.');
    fields.cover_image.setCustomValidity(!fields.cover_image.value.trim() || safeImageUrl(fields.cover_image.value) ? '' : 'Use an HTTPS image URL or a site path beginning with /.');
    fields.cover_alt.setCustomValidity(!fields.cover_image.value.trim() || fields.cover_alt.value.trim() ? '' : 'Please describe the cover picture.');
    fields.slug.setCustomValidity(currentSource || !fields.slug.value.trim() || /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(fields.slug.value.trim()) ? '' : 'Use letters, numbers, and single hyphens for the URL ending.');
    if (!fields.slug.checkValidity()) fields.slug.closest('details').open = true;
    if (!fields.cover_image.checkValidity() || !fields.cover_alt.checkValidity()) fields.cover_image.closest('details').open = true;
    return form.reportValidity();
  }

  function yamlString(value) {
    return JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  }

  function articleUrl(path, frontmatter = [], values = {}) {
    const explicit = frontmatter.find(line => /^permalink\s*:/.test(line));
    if (explicit) {
      let value = explicit.replace(/^permalink\s*:\s*/, '').trim();
      try { if (value.startsWith('"')) value = JSON.parse(value); else if (value.startsWith("'")) value = value.slice(1, -1).replace(/''/g, "'"); } catch { value = ''; }
      if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !/[\\\u0000-\u001f]/.test(value)) return value;
    }
    const slug = values.slug || path?.split('/').at(-1)?.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.(?:md|markdown)$/i, '') || content.slugify(values.title || 'your-article');
    return `/blogs/${slug}/`;
  }

  function preparedPost(lastModifiedAt) {
    const draft = draftValues();
    const slug = fields.slug.value.trim() || content.slugify(draft.title);
    draft.slug = currentSource ? currentSource.originalValues.slug || currentSource.path.split('/').at(-1).replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.(?:md|markdown)$/i, '') : slug;
    if (currentSource) draft.date = currentSource.originalValues.date;
    if (!draft.summary.trim()) draft.summary = draft.body.replace(/```[\s\S]*?```/g, '').replace(/!\[(?:\\.|[^\]\\])*\]\([^)]+\)/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[#>*_`~]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180);
    const originalFrontmatter = currentSource?.frontmatterLines || activeDraft()?.frontmatterLines || [];
    const markdown = content.serializePost(draft, { originalFrontmatter, ...(lastModifiedAt ? { lastModifiedAt } : {}) });
    return { filename: currentSource ? currentSource.path.split('/').at(-1) : `${draft.date}-${slug}.md`, markdown, values: draft };
  }

  function substantiveChanges() {
    if (!currentSource) return true;
    const current = cleanValues(draftValues());
    const original = cleanValues(currentSource.originalValues);
    return Object.keys(fields).some(key => !['last_modified_at', 'slug', 'date'].includes(key) && current[key] !== original[key]);
  }

  function runPublishChecks() {
    const knownPaths = new Set([...document.querySelector('#internal-link-select').options].map(option => option.value));
    knownPaths.add(currentSource?.url || articleUrl(null, [], draftValues()));
    const checks = content.checkContent(draftValues(), { knownPaths, baseUrl: 'https://ilyasferozi.me' });
    const list = document.querySelector('#publish-check-list');
    list.replaceChildren(...checks.map(check => {
      const item = document.createElement('li');
      item.className = `is-${check.severity === 'error' ? 'error' : 'warning'}`;
      item.textContent = `${check.severity === 'error' ? 'Fix' : 'Review'}: ${check.message}`;
      return item;
    }));
    if (!checks.length) { const item = document.createElement('li'); item.className = 'is-pass'; item.textContent = 'Ready: no issues found in the checks this editor can perform.'; list.append(item); }
    const reminder = document.createElement('li');
    reminder.textContent = 'Review accuracy, source citations, and external links before publishing. External destinations are not checked automatically.';
    list.append(reminder);
    return checks;
  }

  function downloadPost() {
    if (!canChangeDraft()) return;
    saveDraft();
    const originalDate = fields.date.value;
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date.value)) fields.date.value = todayInPakistan();
      const post = preparedPost();
      downloadFile(post.filename.replace(/[\\/]/g, '-'), post.markdown, 'text/markdown;charset=utf-8');
      setStatus('Markdown copy downloaded. Unfinished fields are kept; check the article before publishing.');
    } catch {
      setStatus('This draft could not be exported safely as Markdown. Use Download all drafts to keep a complete JSON backup, or copy the article text before leaving.', true);
    } finally { fields.date.value = originalDate; }
  }

  class GitHubError extends Error {
    constructor(message, statusCode = 0) {
      super(message);
      this.statusCode = statusCode;
    }
  }

  function setSignInStatus(message, error = false) {
    signInStatus.textContent = message;
    signInStatus.classList.toggle('is-error', error);
  }

  function setPublishMessage(message, error = false) {
    const paragraph = document.createElement('p');
    paragraph.textContent = message;
    publishNotice.replaceChildren(paragraph);
    publishNotice.hidden = false;
    publishNotice.classList.toggle('is-error', error);
    publishNotice.dataset.state = error ? 'error' : 'pending';
  }

  function setPublishingBusy(busy) {
    publishBusy = busy;
    updateEditorControls();
  }

  function updateEditorControls() {
    const busy = publishBusy || uploadBusy || libraryBusy || deleteBusy;
    form.setAttribute('aria-busy', String(busy));
    for (const control of form.querySelectorAll('input, textarea, select, button')) control.disabled = busy || !authenticated;
    document.querySelector('#new-draft').disabled = busy || !authenticated;
    document.querySelector('#writer-view').disabled = busy || !authenticated;
    document.querySelector('#download-post').disabled = busy || !authenticated;
    publishButton.disabled = busy || !authenticated || publishedCurrentDraft;
    publishButton.textContent = publishBusy ? 'Publishing…' : publishedCurrentDraft ? 'Committed to GitHub' : 'Publish article';
    document.querySelector('#upload-image').textContent = uploadBusy ? 'Uploading picture…' : 'Upload & insert';
    document.querySelectorAll('.writer-dashboard button, .writer-dashboard select, .writer-dashboard input').forEach(control => { control.disabled = busy || !authenticated; });
    fields.slug.readOnly = Boolean(currentSource);
    fields.date.readOnly = Boolean(currentSource);
    if (!busy && authenticated && !publishedCurrentDraft) publishButton.textContent = currentSource ? 'Update article' : 'Publish article';
    const deleteButton = document.querySelector('#delete-published');
    deleteButton.hidden = !authenticated || !currentSource;
    deleteButton.disabled = busy || !authenticated || !currentSource;
    const confirmation = document.querySelector('#delete-article-confirmation');
    confirmation.disabled = busy || !authenticated || !pendingDeletion;
    document.querySelector('#confirm-delete-article').disabled = busy || !authenticated || !pendingDeletion || !currentSource || currentSource.path !== pendingDeletion.path || currentSource.sha !== pendingDeletion.sha || confirmation.value !== pendingDeletion.filename;
    document.querySelector('#confirm-delete-article').textContent = deleteBusy ? 'Deleting…' : 'Delete published article';
  }

  async function requestGitHub(path, credential, options = {}) {
    const url = new URL(path, apiOrigin);
    if (url.origin !== apiOrigin || !credential) throw new GitHubError('Administrator sign-in is required.');
    return fetch(url.href, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${credential}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      signal: options.signal,
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      cache: 'no-store'
    });
  }

  async function responseJson(response) {
    try {
      return await response.json();
    } catch {
      throw new GitHubError('GitHub returned an unreadable response. Check your repository before retrying a publish request.');
    }
  }

  function canChangeDraft() {
    return authenticated && !publishBusy && !uploadBusy && !libraryBusy && !deleteBusy;
  }

  function safeToLeaveDraft() {
    return !hasWriting() || saveDraft();
  }

  function fillArticleChoices() {
    const select = document.querySelector('#published-articles');
    select.replaceChildren(new Option(articleEntries.length ? 'Choose an article' : 'No article files found', ''), ...articleEntries.map(item => new Option(item.path.split('/').at(-1).replace(/\.(?:md|markdown)$/i, ''), item.path)));
    const internal = document.querySelector('#internal-link-select');
    const existing = new Set([...internal.options].map(option => option.value));
    for (const item of articleEntries) {
      const url = articleUrl(item.path);
      if (existing.has(url)) continue;
      const option = new Option(item.path.split('/').at(-1).replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.(?:md|markdown)$/i, '').replace(/-/g, ' '), url);
      option.dataset.remote = 'true'; internal.append(option); existing.add(url);
    }
  }

  async function refreshArticles() {
    if (!canChangeDraft()) return;
    const generation = sessionGeneration;
    const requestGeneration = ++libraryGeneration;
    const credential = administratorToken;
    const controller = new AbortController();
    libraryController = controller; libraryBusy = true; updateEditorControls();
    const notice = document.querySelector('#article-library-status');
    notice.textContent = 'Loading article files from GitHub…'; notice.className = 'media-status';
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await requestGitHub(`/repos/${repository}/git/trees/main?recursive=1`, credential, { signal: controller.signal });
      if (!response.ok) throw new GitHubError('The article library could not be loaded. Check your repository access and try again.', response.status);
      const tree = await responseJson(response);
      if (generation !== sessionGeneration || requestGeneration !== libraryGeneration || controller.signal.aborted) return;
      if (!Array.isArray(tree.tree) || tree.truncated) throw new GitHubError('GitHub returned an incomplete article index. Open the repository to find articles; this editor will not show a partial list.');
      articleEntries = tree.tree.filter(item => item.type === 'blob' && validPostPath(item.path) && validSha(item.sha)).sort((a, b) => b.path.localeCompare(a.path));
      fillArticleChoices();
      notice.textContent = `${articleEntries.length} article ${articleEntries.length === 1 ? 'file' : 'files'} available. Dates and filenames identify each article.`;
    } catch (error) {
      if (generation !== sessionGeneration || requestGeneration !== libraryGeneration) return;
      if (error instanceof GitHubError && error.statusCode === 401) { signOut('Your GitHub session expired. Sign in again to open articles.'); return; }
      notice.className = 'media-status is-error';
      notice.textContent = error instanceof GitHubError ? error.message : 'The article library could not be reached. Try again; your draft is unchanged.';
    } finally {
      clearTimeout(timeout);
      if (libraryController === controller) { libraryController = null; libraryBusy = false; updateEditorControls(); }
    }
  }

  async function openPublishedArticle() {
    if (!canChangeDraft() || !safeToLeaveDraft()) return;
    const path = document.querySelector('#published-articles').value;
    if (!validPostPath(path) || !articleEntries.some(item => item.path === path)) { document.querySelector('#article-library-status').textContent = 'Choose an article first.'; return; }
    const generation = sessionGeneration;
    const draftVersion = draftGeneration;
    const credential = administratorToken;
    const controller = new AbortController();
    libraryController = controller; libraryBusy = true; updateEditorControls();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const notice = document.querySelector('#article-library-status'); notice.textContent = 'Opening your article…';
    try {
      const response = await requestGitHub(`/repos/${repository}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=main`, credential, { signal: controller.signal });
      if (!response.ok) throw new GitHubError('GitHub could not open this article. Refresh the article library and try again.', response.status);
      const file = await responseJson(response);
      if (generation !== sessionGeneration || draftVersion !== draftGeneration || controller.signal.aborted) return;
      if (file.path !== path || !validSha(file.sha) || file.encoding !== 'base64' || typeof file.content !== 'string' || file.content.length > 1600000) throw new GitHubError('GitHub returned an unsupported article file. Edit it directly in GitHub instead.');
      const binary = atob(file.content.replace(/\s/g, ''));
      const markdown = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
      let parsed;
      try { parsed = content.parsePost(markdown); } catch { throw new GitHubError('This article uses metadata the editor cannot safely change. Download or edit it in GitHub so no fields are lost.'); }
      const values = cleanValues({ ...parsed.values, date: parsed.values.date || path.slice(7, 17) });
      values.slug ||= path.split('/').at(-1).replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.(?:md|markdown)$/i, '');
      const existing = draftLibrary.drafts.find(item => item.source?.path === path);
      const item = newDraftRecord(values);
      removedArticlePaths.delete(path);
      item.source = { path, sha: file.sha, frontmatterLines: parsed.frontmatterLines, originalValues: { ...values }, url: articleUrl(path, parsed.frontmatterLines, values) };
      if (existing && JSON.stringify(existing.values) === JSON.stringify(existing.source?.originalValues)) {
        item.id = existing.id; item.revisions = existing.revisions; draftLibrary.drafts = draftLibrary.drafts.filter(draft => draft.id !== existing.id);
      }
      if (draftLibrary.drafts.length >= 100) throw new GitHubError('Your draft library is full. Export a backup and remove an unused draft before opening another article.');
      draftLibrary.drafts.push(item); draftLibrary.activeId = item.id;
      applyDraft(item); saveDraft();
      notice.textContent = 'Article opened. Changes stay in this browser until you choose Update article.';
      const internal = document.querySelector('#internal-link-select');
      if (![...internal.options].some(option => option.value === item.source.url)) internal.append(new Option(values.title || path, item.source.url));
    } catch (error) {
      if (generation !== sessionGeneration || draftVersion !== draftGeneration) return;
      if (error instanceof GitHubError && error.statusCode === 401) { signOut('Your GitHub session expired. Sign in again to open articles.'); return; }
      notice.className = 'media-status is-error'; notice.textContent = error instanceof GitHubError ? error.message : 'The article could not be read. Your current draft is unchanged.';
    } finally {
      clearTimeout(timeout);
      if (libraryController === controller) { libraryController = null; libraryBusy = false; updateEditorControls(); }
    }
  }

  function downloadFile(filename, value, type) {
    const url = URL.createObjectURL(new Blob([value], { type }));
    const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.querySelector('#refresh-articles').addEventListener('click', refreshArticles);
  document.querySelector('#open-article').addEventListener('click', openPublishedArticle);
  document.querySelector('#run-checks').addEventListener('click', () => { if (canChangeDraft()) runPublishChecks(); });
  document.querySelector('#open-draft').addEventListener('click', () => {
    if (!canChangeDraft() || !safeToLeaveDraft()) return;
    const item = draftLibrary.drafts.find(draft => draft.id === document.querySelector('#saved-drafts').value);
    if (!item) return;
    draftLibrary.activeId = item.id; applyDraft(item); saveDraft();
  });
  document.querySelector('#duplicate-draft').addEventListener('click', () => {
    if (!canChangeDraft() || !safeToLeaveDraft()) return;
    const selected = draftLibrary.drafts.find(draft => draft.id === document.querySelector('#saved-drafts').value);
    if (!selected || draftLibrary.drafts.length >= 100) { setStatus('Choose a draft to duplicate, or remove a draft if the library is full.', true); return; }
    const item = newDraftRecord({ ...selected.values, title: `${selected.values.title || 'Untitled'} (copy)`.slice(0, 180), date: todayInPakistan(), slug: '', last_modified_at: '' });
    draftLibrary.drafts.push(item); draftLibrary.activeId = item.id; applyDraft(item); saveDraft();
  });
  document.querySelector('#delete-draft').addEventListener('click', () => {
    if (!canChangeDraft()) return;
    const id = document.querySelector('#saved-drafts').value;
    const item = draftLibrary.drafts.find(draft => draft.id === id);
    if (!item || !window.confirm('Delete this browser draft and its snapshots? Published articles are kept on GitHub.')) return;
    if (!safeToLeaveDraft()) return;
    deletedDraftIds.add(id); draftLibrary.drafts = draftLibrary.drafts.filter(draft => draft.id !== id);
    if (!draftLibrary.drafts.length) draftLibrary.drafts.push(newDraftRecord());
    if (draftLibrary.activeId === id) draftLibrary.activeId = draftLibrary.drafts[0].id;
    try { persistDraftLibrary(); applyDraft(activeDraft()); setStatus('Browser draft deleted. Published articles were not changed.'); } catch { setStatus('The draft could not be deleted from browser storage. Download a backup before continuing.', true); }
  });
  document.querySelector('#snapshot-draft').addEventListener('click', () => {
    if (!canChangeDraft() || !saveDraft()) return;
    const item = activeDraft();
    item.revisions.push({ savedAt: new Date().toISOString(), values: cleanValues(draftValues()) }); item.revisions = item.revisions.slice(-20);
    try { persistDraftLibrary(); renderDraftLibrary(); setStatus('Snapshot saved. You can restore it from the revision list.'); } catch { setStatus('The snapshot could not be saved. Download a copy of your writing.', true); }
  });
  document.querySelector('#restore-revision').addEventListener('click', () => {
    if (!canChangeDraft()) return;
    const index = document.querySelector('#draft-revisions').value;
    const revision = index !== '' ? activeDraft()?.revisions[Number(index)] : null;
    if (!revision || !saveDraft(true)) return;
    const item = activeDraft(); item.values = cleanValues(revision.values); applyDraft(item); unsavedChanges = true; saveDraft();
  });
  document.querySelector('#export-drafts').addEventListener('click', () => {
    if (!canChangeDraft()) return;
    saveDraft(); downloadFile(`ilyas-drafts-${todayInPakistan()}.json`, JSON.stringify(draftLibrary, null, 2), 'application/json');
  });
  document.querySelector('#import-post').addEventListener('change', async event => {
    if (!canChangeDraft() || !safeToLeaveDraft()) return;
    const file = event.target.files[0];
    if (!file) return;
    const backupFile = /\.json$/i.test(file.name);
    if (file.size > (backupFile ? 20 : 1) * 1024 * 1024) { setStatus(backupFile ? 'Choose a draft backup up to 20 MB.' : 'Choose a Markdown file up to 1 MB.', true); event.target.value = ''; return; }
    const generation = sessionGeneration; const draftVersion = draftGeneration;
    libraryBusy = true; updateEditorControls();
    try {
      const raw = await file.text();
      if (generation !== sessionGeneration || draftVersion !== draftGeneration) return;
      let items;
      if (backupFile) {
        const backup = parseDraftBackup(raw);
        items = backup.drafts.map(item => ({ ...item, id: crypto.randomUUID(), updatedAt: new Date().toISOString() }));
      } else {
        const parsed = content.parsePost(raw); const item = newDraftRecord(parsed.values); item.frontmatterLines = parsed.frontmatterLines; items = [item];
      }
      if (!items.length || draftLibrary.drafts.length + items.length > 100) throw new Error('This import would exceed the 100-draft library limit.');
      draftLibrary.drafts.push(...items); draftLibrary.activeId = items[0].id; applyDraft(items[0]); saveDraft();
      setStatus(`${items.length} ${items.length === 1 ? 'draft imported' : 'drafts imported'} as separate copies. Existing drafts were kept.`);
    } catch { if (generation === sessionGeneration) setStatus('This file could not be imported safely. Existing drafts were kept; use a Markdown file or an exported draft backup.', true); }
    finally { if (generation === sessionGeneration) { libraryBusy = false; updateEditorControls(); event.target.value = ''; } }
  });

  function resetEditorView() {
    clearTimeout(saveTimer);
    form.reset();
    fields.date.value = todayInPakistan();
    fields.date.max = todayInPakistan();
    fields.title.setCustomValidity('');
    fields.body.setCustomValidity('');
    fields.cover_image.setCustomValidity('');
    fields.cover_alt.setCustomValidity('');
    editorSelection = { start: 0, end: 0 };
    document.querySelector('#writer-insert-panel').hidden = true;
    document.querySelector('#insert-status').textContent = '';
    document.querySelector('#upload-status').textContent = '';
    document.querySelector('#writer-view').value = 'split';
    document.querySelector('#writer-grid').dataset.view = 'split';
    unsavedChanges = false;
    publishedCurrentDraft = false;
    pendingDeletion = null;
    document.querySelector('#delete-article-panel').hidden = true;
    document.querySelector('#delete-article-panel').removeAttribute('aria-busy');
    document.querySelector('#delete-published').setAttribute('aria-expanded', 'false');
    document.querySelector('#delete-article-confirmation').value = '';
    document.querySelector('#delete-article-title').textContent = '';
    document.querySelector('#delete-article-path').textContent = '';
    document.querySelector('#delete-article-filename-hint').textContent = '';
    document.querySelector('#delete-article-status').textContent = '';
    document.querySelector('#delete-article-status').removeAttribute('data-state');
    publishNotice.hidden = true;
    publishNotice.replaceChildren();
    setStatus('Drafts are saved in this browser as you write.');
    renderPreview();
  }

  function signOut(message = '') {
    const wasPublishing = publishBusy || uploadBusy || deleteBusy;
    const hadWriting = authenticated && hasWriting();
    if (hadWriting) {
      pendingDraft = draftValues();
      pendingDraftUnsaved = !saveDraft();
    }
    administratorToken = '';
    authenticated = false;
    sessionGeneration++;
    loginController?.abort();
    publishController?.abort();
    uploadController?.abort();
    deleteController?.abort();
    libraryController?.abort();
    loginController = null;
    publishController = null;
    uploadController = null;
    deleteController = null;
    deleteBusy = false;
    libraryController = null;
    libraryBusy = false;
    libraryGeneration++;
    draftGeneration++;
    uploadBusy = false;
    loginBusy = false;
    tokenInput.value = '';
    tokenInput.disabled = false;
    loginButton.disabled = false;
    loginForm.removeAttribute('aria-busy');
    workspace.hidden = true;
    form.inert = true;
    signInView.hidden = false;
    document.querySelector('#administrator-identity').textContent = '';
    resetEditorView();
    currentSource = null;
    document.querySelector('#saved-drafts').replaceChildren();
    document.querySelector('#draft-revisions').replaceChildren();
    document.querySelector('#published-articles').replaceChildren(new Option('Refresh to load articles', ''));
    document.querySelector('#editor-mode').textContent = 'Sign in to open your drafts.';
    setPublishingBusy(false);
    const detail = wasPublishing ? 'Signed out. If an article save, deletion, or picture upload was in progress, check GitHub before trying again.' : pendingDraftUnsaved ? 'Signed out. Draft storage was unavailable; sign in again in this tab to recover your writing before closing it.' : hadWriting ? 'Signed out. Your saved draft will return after administrator sign-in.' : 'Signed out. Sign in again to open the writing desk.';
    setSignInStatus(message || detail);
    tokenInput.focus();
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (loginBusy || authenticated) return;
    tokenInput.setCustomValidity(tokenInput.value.trim() ? '' : 'Enter your repository-scoped GitHub access token.');
    if (!loginForm.reportValidity()) return;
    const credential = tokenInput.value.trim();
    tokenInput.value = '';
    loginBusy = true;
    loginButton.disabled = true;
    tokenInput.disabled = true;
    loginForm.setAttribute('aria-busy', 'true');
    setSignInStatus('Checking administrator access…');
    const generation = ++sessionGeneration;
    const controller = new AbortController();
    loginController = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const userResponse = await requestGitHub('/user', credential, { signal: controller.signal });
      if (!userResponse.ok) {
        const message = userResponse.status === 401 ? 'GitHub could not authenticate this token. Check that it is correct and has not expired.' : 'GitHub denied sign-in. Check the token’s repository access and try again.';
        throw new GitHubError(message, userResponse.status);
      }
      const user = await responseJson(userResponse);
      if (generation !== sessionGeneration || controller.signal.aborted) return;
      if (user?.login !== administratorLogin) throw new GitHubError('This writing desk is available only to the website administrator. Sign in as ilyasferozi121-svg.');
      const repoResponse = await requestGitHub(`/repos/${repository}`, credential, { signal: controller.signal });
      if (!repoResponse.ok) throw new GitHubError('GitHub could not verify administrator permissions for this repository. Check the token’s repository access.', repoResponse.status);
      const repo = await responseJson(repoResponse);
      if (repo?.permissions?.admin !== true) throw new GitHubError('Administrator permission for this website’s repository is required.');
      if (generation !== sessionGeneration || controller.signal.aborted) return;
      administratorToken = credential;
      authenticated = true;
      signInView.hidden = true;
      workspace.hidden = false;
      form.inert = false;
      document.querySelector('#administrator-identity').textContent = `Signed in as ${administratorLogin}`;
      setPublishingBusy(false);
      restoreDraft();
      renderPreview();
      fields.title.focus();
    } catch (error) {
      if (generation !== sessionGeneration) return;
      administratorToken = '';
      authenticated = false;
      workspace.hidden = true;
      form.inert = true;
      setPublishingBusy(false);
      const message = controller.signal.aborted ? 'GitHub did not respond in time. Check your connection and try signing in again.' : error instanceof GitHubError ? error.message : 'GitHub could not be reached. Check your connection and try signing in again.';
      setSignInStatus(message, true);
    } finally {
      clearTimeout(timeout);
      if (loginController === controller) {
        loginController = null;
        loginBusy = false;
        tokenInput.value = '';
        tokenInput.disabled = false;
        loginButton.disabled = false;
        loginForm.removeAttribute('aria-busy');
      }
    }
  });

  tokenInput.addEventListener('input', () => tokenInput.setCustomValidity(''));
  document.querySelector('#administrator-logout').addEventListener('click', () => signOut());

  function utf8Base64(value) {
    const bytes = new TextEncoder().encode(value);
    const chunks = [];
    for (let offset = 0; offset < bytes.length; offset += 8192) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
    return btoa(chunks.join(''));
  }

  function confirmCreatedPost(result, expectedPath) {
    const sha = result?.commit?.sha;
    if (typeof sha !== 'string' || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(sha) || !validSha(result?.content?.sha) || result?.content?.path !== expectedPath || typeof result?.content?.html_url !== 'string') return null;
    try {
      const contentUrl = new URL(result.content.html_url);
      if (contentUrl.origin !== 'https://github.com' || contentUrl.username || contentUrl.password || !decodeURIComponent(contentUrl.pathname).startsWith(`/${repository}/blob/`) || !decodeURIComponent(contentUrl.pathname).endsWith(`/${expectedPath}`)) return null;
    } catch {
      return null;
    }
    return sha;
  }

  function showPublished(sha, path) {
    const heading = document.createElement('p');
    heading.textContent = 'Your article was committed to GitHub. ';
    const link = document.createElement('a');
    link.href = `${githubBase}/commit/${sha}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `View commit ${sha.slice(0, 7)} ↗`;
    heading.append(link);
    const deployment = document.createElement('p');
    deployment.textContent = 'GitHub Pages will build the website next. Your changes appear after deployment finishes.';
    const file = document.createElement('p');
    const filename = document.createElement('code');
    filename.textContent = path;
    file.append('Article file: ', filename);
    publishNotice.replaceChildren(heading, deployment, file);
    publishNotice.classList.remove('is-error');
    publishNotice.dataset.state = 'success';
    publishNotice.hidden = false;
  }

  function showDeleteStatus(message, state) {
    const notice = document.querySelector('#delete-article-status');
    notice.className = `media-status${state === 'error' ? ' is-error' : state === 'success' ? ' is-success' : ''}`;
    notice.textContent = message;
    notice.dataset.state = state;
  }

  function closeDeletePanel() {
    if (deleteBusy) return;
    pendingDeletion = null;
    document.querySelector('#delete-article-panel').hidden = true;
    document.querySelector('#delete-article-confirmation').value = '';
    document.querySelector('#delete-published').setAttribute('aria-expanded', 'false');
    updateEditorControls();
    if (currentSource) document.querySelector('#delete-published').focus();
    else fields.title.focus();
  }

  function confirmDeletedPost(result) {
    if (!result || result.content !== null || !Object.prototype.hasOwnProperty.call(result, 'content') || !validSha(result.commit?.sha)) return null;
    const sha = result.commit.sha;
    if (result.commit.html_url !== undefined) {
      try {
        const url = new URL(result.commit.html_url);
        if (url.origin !== 'https://github.com' || url.username || url.password || url.pathname !== `/${repository}/commit/${sha}` || url.search || url.hash) return null;
      } catch { return null; }
    }
    return sha;
  }

  document.querySelector('#delete-published').addEventListener('click', () => {
    if (!canChangeDraft() || !currentSource || !administratorToken) return;
    const source = cleanSource(currentSource);
    if (!source) return;
    if (!saveDraft(true)) { setPublishMessage('Your browser could not save the recovery draft. Download your writing before deleting the published article.', true); return; }
    pendingDeletion = { ...source, filename: source.path.split('/').at(-1), title: source.originalValues.title || fields.title.value || source.path, session: sessionGeneration, draftVersion: draftGeneration, draftId: draftLibrary.activeId };
    document.querySelector('#delete-article-heading').textContent = 'Delete this published article?';
    document.querySelector('#delete-article-title').textContent = pendingDeletion.title;
    document.querySelector('#delete-article-path').textContent = source.path;
    document.querySelector('#delete-article-filename-hint').textContent = pendingDeletion.filename;
    document.querySelector('#delete-article-confirmation').value = '';
    document.querySelector('#cancel-delete-article').textContent = 'Cancel';
    document.querySelector('#delete-article-status').textContent = '';
    document.querySelector('#delete-article-status').removeAttribute('data-state');
    document.querySelector('#delete-article-panel').hidden = false;
    document.querySelector('#delete-published').setAttribute('aria-expanded', 'true');
    updateEditorControls();
    document.querySelector('#delete-article-confirmation').focus();
  });
  document.querySelector('#cancel-delete-article').addEventListener('click', closeDeletePanel);
  document.querySelector('#delete-article-confirmation').addEventListener('input', updateEditorControls);
  document.querySelector('#delete-article-confirmation').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); if (!document.querySelector('#confirm-delete-article').disabled) document.querySelector('#confirm-delete-article').focus(); }
    if (event.key === 'Escape') { event.preventDefault(); closeDeletePanel(); }
  });
  document.querySelector('#confirm-delete-article').addEventListener('click', async () => {
    if (!canChangeDraft() || !currentSource || !pendingDeletion || !administratorToken) return;
    const source = pendingDeletion;
    if (source.session !== sessionGeneration || source.draftVersion !== draftGeneration || source.draftId !== draftLibrary.activeId || source.path !== currentSource.path || source.sha !== currentSource.sha) { showDeleteStatus('This article selection changed. Close this confirmation and open it again for the current article.', 'error'); return; }
    if (document.querySelector('#delete-article-confirmation').value !== source.filename) { showDeleteStatus('Type the exact filename shown above before deleting.', 'error'); return; }
    if (!saveDraft(true)) { showDeleteStatus('Your recovery draft could not be saved in this browser. Download it before deleting the published article.', 'error'); return; }
    const credential = administratorToken;
    const generation = sessionGeneration;
    const draftVersion = draftGeneration;
    const draftId = draftLibrary.activeId;
    const controller = new AbortController();
    deleteController = controller;
    deleteBusy = true;
    updateEditorControls();
    document.querySelector('#delete-article-panel').setAttribute('aria-busy', 'true');
    showDeleteStatus('Checking that the published article has not changed…', 'pending');
    const timeout = setTimeout(() => controller.abort(), 60000);
    let deleteAttempted = false;
    const currentSession = () => {
      if (generation !== sessionGeneration || draftVersion !== draftGeneration || draftId !== draftLibrary.activeId || !authenticated || currentSource?.path !== source.path || currentSource?.sha !== source.sha) return false;
      if (controller.signal.aborted) throw new GitHubError('The deletion could not be confirmed in time. Check GitHub before trying again; your browser draft is kept.');
      return true;
    };
    try {
      const contentsPath = `/repos/${repository}/contents/${source.path.split('/').map(encodeURIComponent).join('/')}`;
      const existing = await requestGitHub(`${contentsPath}?ref=main`, credential, { signal: controller.signal });
      if (!currentSession()) return;
      if (!existing.ok) throw new GitHubError('GitHub could not verify the published article. Refresh the article library before trying again; your draft is kept.', existing.status);
      const latest = await responseJson(existing);
      if (!currentSession()) return;
      if (latest.path !== source.path || latest.sha !== source.sha) throw new GitHubError('This article changed on GitHub after you opened it. Nothing was deleted. Download your draft, then reopen the current article before deciding whether to delete it.', 409);
      showDeleteStatus('Removing the article file from GitHub…', 'pending');
      deleteAttempted = true;
      const response = await requestGitHub(contentsPath, credential, {
        method: 'DELETE', signal: controller.signal,
        body: { message: `Delete blog: ${source.title}`, sha: source.sha, branch: 'main', author: commitIdentity, committer: commitIdentity }
      });
      if (!currentSession()) return;
      if (response.status !== 200) throw new GitHubError('GitHub did not confirm article deletion. Check the repository before trying again; your draft is kept.', response.status);
      const result = await responseJson(response);
      if (!currentSession()) return;
      const commit = confirmDeletedPost(result);
      if (!commit) throw new GitHubError('GitHub returned an incomplete deletion confirmation. Check the repository before trying again; your draft is kept.');
      removedArticlePaths.add(source.path);
      draftLibrary.drafts = draftLibrary.drafts.map(item => item.source?.path === source.path ? { ...item, frontmatterLines: item.frontmatterLines?.length ? item.frontmatterLines : [...item.source.frontmatterLines], source: null } : item);
      currentSource = null;
      publishedCurrentDraft = false;
      draftGeneration++;
      pendingDeletion = null;
      articleEntries = articleEntries.filter(item => item.path !== source.path);
      const removedUrls = new Set([source.url, articleUrl(source.path), articleUrl(source.path, source.frontmatterLines, source.originalValues)].filter(Boolean).map(url => url.replace(/\/$/, '')));
      for (const option of [...document.querySelector('#internal-link-select').options]) if (removedUrls.has(option.value.replace(/\/$/, ''))) option.remove();
      fillArticleChoices();
      const recoverySaved = saveDraft(true);
      renderPreview();
      document.querySelector('#delete-article-heading').textContent = 'Article removed from GitHub';
      document.querySelector('#delete-article-confirmation').value = '';
      document.querySelector('#cancel-delete-article').textContent = 'Close';
      document.querySelector('#delete-published').setAttribute('aria-expanded', 'false');
      showDeleteStatus(recoverySaved ? 'The article was deleted from GitHub. Your writing is saved as an independent browser draft. The public page and listings update after GitHub Pages deploys. Picture files were kept.' : 'The article was deleted from GitHub. Your writing is still open, but the browser could not save the recovery draft. Download Markdown or all drafts before closing this page. Public pages update after deployment; picture files were kept.', 'success');
      const link = document.createElement('a'); link.href = `${githubBase}/commit/${commit}`; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'View deletion commit';
      document.querySelector('#delete-article-status').append(' ', link);
      if (recoverySaved) setStatus('Recovery draft saved. It is separate from the deleted article; publishing it would create an article again.');
      document.querySelector('#delete-article-status').tabIndex = -1;
      document.querySelector('#delete-article-status').focus();
    } catch (error) {
      if (generation !== sessionGeneration || draftVersion !== draftGeneration || draftId !== draftLibrary.activeId) return;
      if (error instanceof GitHubError && error.statusCode === 401) { signOut('Your GitHub session expired. Your draft is kept. If deletion was in progress, check GitHub before trying again.'); return; }
      let message;
      if (error instanceof GitHubError && error.statusCode === 403) message = 'GitHub denied this request. Check that your token has Contents read and write permission. Your article draft is kept.';
      else if (error instanceof GitHubError && [409, 422].includes(error.statusCode)) message = deleteAttempted ? 'The article changed or GitHub refused the deletion. Check the repository before retrying; your draft is kept.' : error.message;
      else if (error instanceof GitHubError) message = error.message;
      else message = deleteAttempted ? 'The deletion request could not be confirmed. Check GitHub before retrying; the article may already have been removed. Your draft is kept.' : 'GitHub could not be reached. Nothing was deleted by this request; your draft is kept.';
      showDeleteStatus(message, 'error');
    } finally {
      clearTimeout(timeout);
      if (deleteController === controller) { deleteController = null; deleteBusy = false; document.querySelector('#delete-article-panel').removeAttribute('aria-busy'); updateEditorControls(); }
    }
  });

  let editorSelection = { start: 0, end: 0 };
  let insertionKind = 'link';
  let citationKind = 'footnote';

  function rememberSelection() {
    editorSelection = { start: fields.body.selectionStart, end: fields.body.selectionEnd };
  }

  function editBody(text, start = editorSelection.start, end = editorSelection.end) {
    if (!canChangeDraft()) return false;
    if (fields.body.value.length - (end - start) + text.length > fields.body.maxLength) {
      setStatus('The article has reached the editor’s length limit. Shorten it before adding more content.', true);
      return false;
    }
    fields.body.focus();
    fields.body.setRangeText(text, start, end, 'select');
    rememberSelection();
    fields.body.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  function markdownLabel(value) {
    return value.trim().replace(/\r?\n/g, ' ').replace(/[\\\[\]]/g, '\\$&');
  }

  function openInsertPanel(kind) {
    insertionKind = kind;
    const image = kind === 'image';
    const selected = fields.body.value.slice(editorSelection.start, editorSelection.end);
    document.querySelector('#insert-heading').textContent = image ? 'Insert a picture' : 'Insert a link';
    document.querySelector('#insert-label-heading').textContent = image ? 'Picture description' : 'Link text';
    document.querySelector('#insert-url').value = '';
    document.querySelector('#insert-label').value = selected;
    document.querySelector('#insert-status').textContent = '';
    document.querySelector('#writer-insert-panel').hidden = false;
    document.querySelector('#insert-url').focus();
  }

  function formatArticle(command) {
    if (!canChangeDraft()) return;
    const { start, end } = editorSelection;
    const selected = fields.body.value.slice(start, end);
    if (command === 'link' || command === 'image') return openInsertPanel(command);
    if (command === 'internal') { document.querySelector('#internal-link-panel').hidden = false; document.querySelector('#internal-link-select').focus(); return; }
    if (command === 'footnote' || command === 'reference') {
      citationKind = command;
      document.querySelector('#academic-tools').hidden = false;
      document.querySelector('#citation-title').value = selected;
      document.querySelector('#citation-status').textContent = '';
      document.querySelector('#citation-title').focus(); return;
    }
    if (command === 'table') { editBody('\n\n| Column one | Column two |\n| --- | --- |\n| First value | Second value |\n\n'); return; }
    if (command === 'caption') { editBody(`\n\n*${escapeMarkdownText(selected || 'Describe the picture — Credit: Source')}*\n\n`); return; }
    if (command === 'bold' || command === 'italic') {
      const marker = command === 'bold' ? '**' : '*';
      editBody(`${marker}${selected || (command === 'bold' ? 'bold text' : 'italic text')}${marker}`);
    } else if (command === 'code') {
      editBody(`\n\n\`\`\`\n${selected || 'Your code here'}\n\`\`\`\n\n`);
    } else if (command === 'divider') {
      editBody('\n\n---\n\n');
    } else {
      const value = fields.body.value;
      const lineStart = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1;
      const nextBreak = value.indexOf('\n', end);
      const lineEnd = nextBreak === -1 ? value.length : nextBreak;
      const lines = value.slice(lineStart, lineEnd).split('\n');
      const transformed = lines.map((line, index) => {
        if (command === 'heading2' || command === 'heading3') return `${command === 'heading2' ? '##' : '###'} ${line.replace(/^\s*#{1,6}\s+/, '') || 'Section heading'}`;
        if (command === 'quote') return `> ${line.replace(/^\s*>\s?/, '') || 'Your quotation'}`;
        const content = line.replace(/^\s*(?:[-+*]|\d+[.)])\s+/, '') || 'List item';
        return `${command === 'numbers' ? `${index + 1}.` : '-'} ${content}`;
      }).join('\n');
      editBody(transformed, lineStart, lineEnd);
    }
  }

  ['select', 'keyup', 'click', 'blur'].forEach(type => fields.body.addEventListener(type, rememberSelection));
  document.querySelectorAll('[data-editor-command]').forEach(control => {
    control.addEventListener('mousedown', event => event.preventDefault());
    control.addEventListener('click', () => formatArticle(control.dataset.editorCommand));
  });
  fields.body.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const command = { b: 'bold', i: 'italic', k: 'link' }[event.key.toLowerCase()];
    if (!command) return;
    event.preventDefault();
    rememberSelection();
    formatArticle(command);
  });
  document.querySelector('#insert-cancel').addEventListener('click', () => {
    document.querySelector('#writer-insert-panel').hidden = true;
    fields.body.focus();
  });
  document.querySelector('#insert-confirm').addEventListener('click', () => {
    if (!authenticated || publishBusy || uploadBusy) return;
    const rawUrl = document.querySelector('#insert-url').value.trim();
    const label = document.querySelector('#insert-label').value.trim();
    let destination = insertionKind === 'image' ? safeImageUrl(rawUrl) : null;
    if (insertionKind === 'link') {
      try {
        const url = new URL(rawUrl, window.location.origin);
        if (rawUrl && !/[\\\u0000-\u001f\u007f]/.test(rawUrl) && !url.username && !url.password && ['https:', 'http:', 'mailto:'].includes(url.protocol)) destination = url.href.replace(/\(/g, '%28').replace(/\)/g, '%29');
      } catch { /* The panel shows a useful validation message. */ }
    }
    if (!destination || !label) {
      const target = document.querySelector('#insert-status');
      target.className = 'media-status is-error';
      target.textContent = insertionKind === 'image' ? 'Enter an HTTPS image URL or a site path beginning with /, and a picture description.' : 'Enter a valid web or email link and its text.';
      return;
    }
    const markdown = `${insertionKind === 'image' ? '!' : ''}[${markdownLabel(label)}](${destination})`;
    if (editBody(insertionKind === 'image' ? `\n\n${markdown}\n\n` : markdown)) document.querySelector('#writer-insert-panel').hidden = true;
  });
  document.querySelector('#writer-insert-panel').addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.matches('input')) { event.preventDefault(); document.querySelector('#insert-confirm').click(); }
    if (event.key === 'Escape') { event.preventDefault(); document.querySelector('#insert-cancel').click(); }
  });
  document.querySelector('#writer-view').addEventListener('change', event => {
    if (!authenticated || publishBusy || uploadBusy) return;
    document.querySelector('#writer-grid').dataset.view = event.target.value;
  });

  function escapeMarkdownText(value) {
    return String(value).trim().replace(/[\r\n]+/g, ' ').replace(/[\\`*_\[\]<>]/g, '\\$&');
  }

  document.querySelector('#citation-cancel').addEventListener('click', () => { document.querySelector('#academic-tools').hidden = true; fields.body.focus(); });
  document.querySelector('#citation-insert').addEventListener('click', () => {
    if (!canChangeDraft()) return;
    const title = document.querySelector('#citation-title').value.trim();
    const rawUrl = document.querySelector('#citation-url').value.trim();
    const author = document.querySelector('#citation-author').value.trim();
    const year = document.querySelector('#citation-year').value.trim();
    const url = safeImageUrl(rawUrl);
    if (!title || !url || !/^https:\/\//i.test(url)) { document.querySelector('#citation-status').textContent = 'Add the source title and its HTTPS web address.'; return; }
    const reference = [escapeMarkdownText(author), year ? `(${escapeMarkdownText(year)})` : '', `[${markdownLabel(title)}](${url})`].filter(Boolean).join('. ');
    if (citationKind === 'footnote') {
      let number = 1; while (fields.body.value.includes(`[^source-${number}]`)) number++;
      const id = `source-${number}`;
      const old = fields.body.value;
      const { start, end } = editorSelection;
      editBody(`${old.slice(0, start)}${old.slice(start, end)}[^${id}]${old.slice(end).trimEnd()}\n\n[^${id}]: ${reference}\n`, 0, old.length);
    } else {
      const old = fields.body.value.trimEnd();
      const heading = /^#{2,3}\s+References\s*$/im.test(old) ? '' : '\n\n## References';
      editBody(`${heading}\n\n- ${reference}\n`, fields.body.value.length, fields.body.value.length);
    }
    document.querySelector('#academic-tools').hidden = true;
  });
  document.querySelector('#academic-tools').addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.matches('input')) { event.preventDefault(); document.querySelector('#citation-insert').click(); }
    if (event.key === 'Escape') { event.preventDefault(); document.querySelector('#citation-cancel').click(); }
  });
  document.querySelector('#insert-internal-link').addEventListener('click', () => {
    if (!canChangeDraft()) return;
    const select = document.querySelector('#internal-link-select');
    const url = select.value;
    if (!url.startsWith('/') || url.startsWith('//') || /[\\\u0000-\u001f]/.test(url)) return;
    const label = fields.body.value.slice(editorSelection.start, editorSelection.end) || select.selectedOptions[0]?.textContent || 'Read more';
    if (editBody(`[${markdownLabel(label)}](${url.replace(/\(/g, '%28').replace(/\)/g, '%29')})`)) document.querySelector('#internal-link-panel').hidden = true;
  });
  document.querySelector('#cancel-internal-link').addEventListener('click', () => { document.querySelector('#internal-link-panel').hidden = true; fields.body.focus(); });

  document.querySelector('#upload-image').addEventListener('click', async () => {
    if (!canChangeDraft() || !administratorToken) return;
    const notice = document.querySelector('#upload-status');
    const fileInput = document.querySelector('#article-image-file');
    const file = fileInput.files[0];
    const description = document.querySelector('#upload-alt').value.trim();
    const caption = document.querySelector('#upload-caption').value.trim();
    const credit = document.querySelector('#upload-credit').value.trim();
    const optimize = document.querySelector('#optimize-image').checked;
    const placement = document.querySelector('#image-placement').value;
    const selection = { ...editorSelection };
    const originalBody = fields.body.value;
    const fail = message => { notice.className = 'media-status is-error'; notice.textContent = message; };
    if (!file || !description) { fail('Choose a picture and add its description first.'); return; }
    if (!file.size || file.size > 3 * 1024 * 1024) { fail('Choose a picture up to 3 MB.'); return; }
    const generation = sessionGeneration;
    const draftVersion = draftGeneration;
    const draftId = draftLibrary.activeId;
    const credential = administratorToken;
    const controller = new AbortController();
    uploadController = controller;
    uploadBusy = true;
    updateEditorControls();
    notice.className = 'media-status';
    notice.textContent = optimize ? 'Preparing optimized picture sizes…' : 'Checking your picture…';
    const timeout = setTimeout(() => controller.abort(), 90000);
    let putAttempted = false;
    const currentSession = () => {
      if (generation !== sessionGeneration || draftVersion !== draftGeneration || draftId !== draftLibrary.activeId || !authenticated) return false;
      if (controller.signal.aborted) throw new GitHubError('The upload timed out.');
      return true;
    };
    try {
      const prepared = await media.prepare(file, { signal: controller.signal, optimize });
      if (!currentSession()) return;
      const folder = todayInPakistan().slice(0, 7).replace('-', '/');
      const basePath = `source-assets/blog/${folder}/${crypto.randomUUID()}`;
      const uploads = prepared.files.map(item => {
        const path = `${basePath}${item.suffix}.${item.extension}`;
        return { ...item, path, url: `/${path}` };
      });
      // Plan every URL and the complete insertion before making anything public.
      const attributes = media.attributes(uploads);
      const imageAttributes = [`width="${attributes.width}"`, `height="${attributes.height}"`];
      if (uploads.length > 1) imageAttributes.push(`srcset="${attributes.srcset}"`, `sizes="${attributes.sizes}"`);
      const captionText = [caption, credit ? `Credit: ${credit}` : ''].filter(Boolean).join(' — ');
      const captionMarkdown = captionText ? `\n\n*${captionText.replace(/\r?\n/g, ' ').replace(/[\\*_`\[\]<>]/g, '\\$&')}*` : '';
      // kramdown requires inline IAL here; a new line would attach attrs to <p>.
      const imageMarkdown = `\n\n![${markdownLabel(description)}](${attributes.src}){: ${imageAttributes.join(' ')} }${captionMarkdown}\n\n`;
      if (placement !== 'cover' && originalBody.length - (selection.end - selection.start) + imageMarkdown.length > fields.body.maxLength) throw new GitHubError('The article has reached the editor’s length limit. Shorten it before uploading a picture.');
      for (let index = 0; index < uploads.length; index++) {
        if (!currentSession()) return;
        const image = uploads[index];
        const chunks = [];
        for (let offset = 0; offset < image.bytes.length; offset += 8192) chunks.push(String.fromCharCode(...image.bytes.subarray(offset, offset + 8192)));
        notice.textContent = uploads.length > 1 ? `Uploading picture size ${index + 1} of ${uploads.length} to GitHub…` : 'Uploading your picture to GitHub…';
        putAttempted = true;
        const response = await requestGitHub(`/repos/${repository}/contents/${image.path}`, credential, {
          method: 'PUT', signal: controller.signal,
          body: { message: 'Add article picture', content: btoa(chunks.join('')), branch: 'main', author: commitIdentity, committer: commitIdentity }
        });
        if (!currentSession()) return;
        if (response.status === 403) throw new GitHubError('GitHub denied the upload. Check that your token has Contents read and write permission for this repository.', 403);
        if (response.status !== 201) throw new GitHubError('GitHub did not confirm the picture upload.', response.status);
        const result = await responseJson(response);
        if (!currentSession()) return;
        if (!confirmCreatedPost(result, image.path)) throw new GitHubError('GitHub returned an incomplete picture upload confirmation.');
      }
      if (!currentSession()) return;
      if (placement !== 'cover' && fields.body.value !== originalBody) throw new GitHubError('The article changed during the upload. Choose its insertion point again.');
      // Every file has been verified; only now change the draft in one operation.
      uploadBusy = false;
      if (placement === 'cover') {
        fields.cover_image.value = attributes.src;
        fields.cover_alt.value = description;
        fields.cover_caption.value = caption;
        fields.cover_credit.value = credit;
        fields.cover_width.value = String(attributes.width);
        fields.cover_height.value = String(attributes.height);
        fields.cover_srcset.value = uploads.length > 1 ? attributes.srcset : '';
        fields.cover_sizes.value = uploads.length > 1 ? '(max-width: 920px) calc(100vw - 40px), 880px' : '';
        fields.cover_image.closest('details').open = true;
        fields.cover_image.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (!editBody(imageMarkdown, selection.start, selection.end)) throw new GitHubError('The picture files were uploaded, but their article insertion could not be completed.');
      fileInput.value = '';
      notice.className = 'media-status is-success';
      const savings = prepared.compressed && prepared.originalBytes > prepared.outputBytes ? Math.round((1 - prepared.outputBytes / prepared.originalBytes) * 100) : 0;
      const detail = prepared.animated ? ' Animation was preserved.' : uploads.length > 1 ? ` ${uploads.length} responsive sizes were created.` : '';
      notice.textContent = `Picture uploaded and added.${detail}${savings ? ` The main picture is ${savings}% smaller.` : ''} GitHub Pages will make it available after deployment finishes.`;
    } catch (error) {
      if (generation !== sessionGeneration || draftVersion !== draftGeneration || draftId !== draftLibrary.activeId) return;
      const partial = putAttempted ? ' Your article is unchanged. Some picture files may already be public in GitHub; check the repository before retrying.' : '';
      if (error instanceof GitHubError && error.statusCode === 401) { signOut(`Your GitHub session expired. Sign in again before uploading a picture.${partial}`); return; }
      const message = controller.signal.aborted ? 'The upload timed out.' : error instanceof Error ? error.message : 'The picture could not be prepared or uploaded.';
      fail(`${message}${partial}`);
    } finally {
      clearTimeout(timeout);
      if (uploadController === controller) {
        uploadController = null;
        uploadBusy = false;
        updateEditorControls();
      }
    }
  });


  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!authenticated || !administratorToken) { setSignInStatus('Sign in as the administrator before publishing.', true); return; }
    if (!canChangeDraft() || publishedCurrentDraft || !validate()) return;
    if (runPublishChecks().some(check => check.severity === 'error')) { setPublishMessage('Resolve the issues marked Fix before publishing. Your draft is kept here.', true); document.querySelector('#publish-checks').scrollIntoView({ block: 'center' }); return; }
    if (currentSource && !substantiveChanges()) { setPublishMessage('This article has no changes to save. Its publication and updated dates have been kept.'); return; }
    saveDraft();
    const source = currentSource ? cleanSource(currentSource) : null;
    const modifiedAt = source ? new Date().toISOString() : '';
    let post;
    try { post = preparedPost(modifiedAt); } catch { setPublishMessage('This article’s metadata cannot be saved safely in this editor. Download your draft or edit the original file in GitHub.', true); return; }
    const postPath = source ? source.path : `_posts/${post.filename}`;
    if (!validPostPath(postPath)) { setPublishMessage('Choose a valid title, date, and article URL before publishing.', true); return; }
    const contentsPath = `/repos/${repository}/contents/${postPath.split('/').map(encodeURIComponent).join('/')}`;
    const generation = sessionGeneration;
    const draftVersion = draftGeneration;
    const credential = administratorToken;
    const controller = new AbortController();
    publishController = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    let putAttempted = false;
    setPublishingBusy(true);
    setPublishMessage(source ? 'Checking that the published article has not changed…' : 'Checking that this article has a unique address…');
    const currentSession = () => generation === sessionGeneration && draftVersion === draftGeneration && !controller.signal.aborted;
    try {
      if (!source) {
        const indexResponse = await requestGitHub(`/repos/${repository}/git/trees/main?recursive=1`, credential, { signal: controller.signal });
        if (!indexResponse.ok) throw new GitHubError('GitHub could not check existing article addresses. Try again before publishing.', indexResponse.status);
        const index = await responseJson(indexResponse);
        if (!currentSession()) return;
        if (!Array.isArray(index.tree) || index.truncated) throw new GitHubError('GitHub returned an incomplete article index. The editor will not publish until address uniqueness can be checked.');
        const slug = post.values.slug;
        const sameSlug = index.tree.some(item => item.type === 'blob' && validPostPath(item.path) && content.slugify(item.path.split('/').at(-1).replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.(?:md|markdown)$/i, '')) === content.slugify(slug));
        const candidateUrl = articleUrl(postPath, activeDraft()?.frontmatterLines || [], post.values).replace(/\/$/, '');
        const knownUrl = [...document.querySelector('#internal-link-select').options].some(option => option.value.replace(/\/$/, '') === candidateUrl);
        if (sameSlug || knownUrl) throw new GitHubError('An article already uses this web address, even if its publication date is different. Choose another URL ending, or open the existing article to update it.', 409);
      }
      const existing = await requestGitHub(`${contentsPath}?ref=main`, credential, { signal: controller.signal });
      if (!currentSession()) return;
      if (source) {
        if (!existing.ok) throw new GitHubError('The original article could not be checked. It may have been removed; refresh the library before trying again.', existing.status);
        const latest = await responseJson(existing);
        if (!currentSession()) return;
        if (latest.path !== postPath || latest.sha !== source.sha) throw new GitHubError('This article changed on GitHub after you opened it. Your draft is kept here. Download it, then reopen the current article and merge your changes.', 409);
      } else {
        if (existing.ok) throw new GitHubError('An article with this filename already exists. Choose another URL ending or open the existing article.', 409);
        if (existing.status !== 404) throw new GitHubError('GitHub could not check this article’s filename.', existing.status);
      }
      setPublishMessage(source ? 'Saving the article update to GitHub…' : 'Creating your article in GitHub…');
      putAttempted = true;
      const response = await requestGitHub(contentsPath, credential, {
        method: 'PUT', signal: controller.signal,
        body: { message: `${source ? 'Update' : 'Publish'} blog: ${fields.title.value.trim()}`, content: utf8Base64(post.markdown), branch: 'main', author: commitIdentity, committer: commitIdentity, ...(source ? { sha: source.sha } : {}) }
      });
      if (!currentSession()) return;
      if (response.status !== (source ? 200 : 201)) throw new GitHubError('GitHub did not confirm the article save. Check the repository before retrying.', response.status);
      const result = await responseJson(response);
      if (!currentSession()) return;
      const sha = confirmCreatedPost(result, postPath);
      if (!sha) throw new GitHubError('GitHub returned an incomplete confirmation. Check the repository before trying again; the article may already have been saved.');
      fields.last_modified_at.value = modifiedAt || fields.last_modified_at.value;
      const parsed = content.parsePost(post.markdown);
      removedArticlePaths.delete(postPath);
      currentSource = { path: postPath, sha: result.content.sha, frontmatterLines: parsed.frontmatterLines, originalValues: cleanValues(draftValues()), url: source?.url || articleUrl(postPath, parsed.frontmatterLines, post.values) };
      publishedCurrentDraft = true;
      saveDraft();
      showPublished(sha, postPath);
    } catch (error) {
      if (generation !== sessionGeneration || draftVersion !== draftGeneration) return;
      if (error instanceof GitHubError && error.statusCode === 401) { signOut('Your GitHub session is no longer valid. Your draft has been kept; sign in again before publishing.'); return; }
      let message;
      if (error instanceof GitHubError && error.statusCode === 403) message = 'GitHub denied this request. Check that your token has Contents read and write permission for this repository.';
      else if (error instanceof GitHubError && error.statusCode === 429) message = 'GitHub temporarily limited requests. Your draft is kept here; try again later.';
      else if (error instanceof GitHubError && error.statusCode === 409 && !putAttempted) message = error.message;
      else if (error instanceof GitHubError && [409, 422].includes(error.statusCode)) message = 'The article changed or its address is already in use. Your draft is kept here. Check GitHub before retrying; the editor will not overwrite a newer version.';
      else if (error instanceof GitHubError) message = error.message;
      else message = putAttempted ? 'The save request could not be confirmed. Check GitHub before retrying; the article may already have been saved. Your draft is kept here.' : 'GitHub could not be reached. Your draft is kept here; check your connection and try again.';
      setPublishMessage(message, true);
    } finally {
      clearTimeout(timeout);
      if (publishController === controller) { publishController = null; setPublishingBusy(false); }
    }
  });

  form.addEventListener('input', event => {
    if (!canChangeDraft()) return;
    if (Object.values(fields).includes(event.target)) event.target.setCustomValidity('');
    else return;
    if (event.target === fields.cover_image || event.target === fields.cover_alt) {
      fields.cover_image.setCustomValidity('');
      fields.cover_alt.setCustomValidity('');
    }
    if (event.target === fields.cover_image && event.isTrusted) ['cover_width', 'cover_height', 'cover_srcset', 'cover_sizes'].forEach(key => { fields[key].value = ''; });
    unsavedChanges = true;
    publishedCurrentDraft = false;
    publishButton.disabled = false;
    publishButton.textContent = currentSource ? 'Update article' : 'Publish article';
    publishNotice.hidden = true;
    renderPreview();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 400);
  });

  document.querySelector('#download-post').addEventListener('click', downloadPost);
  document.querySelector('#new-draft').addEventListener('click', () => {
    if (!canChangeDraft() || !safeToLeaveDraft()) return;
    if (draftLibrary.drafts.length >= 100) { setStatus('Your draft library is full. Download a backup and remove an unused draft first.', true); return; }
    const item = newDraftRecord(); draftLibrary.drafts.push(item); draftLibrary.activeId = item.id;
    pendingDraft = null; pendingDraftUnsaved = false; applyDraft(item); saveDraft();
    setStatus('New draft created. Your other drafts are kept in the library.'); fields.title.focus();
  });
  window.addEventListener('storage', event => {
    if (!authenticated || event.key !== storageKey) return;
    setStatus('The draft library changed in another tab. Keep this tab open and download your writing before switching drafts if both tabs edited the same article.', true);
  });

  window.addEventListener('pagehide', () => {
    if (authenticated && unsavedChanges) saveDraft();
  });
  window.addEventListener('beforeunload', event => {
    const unsavedWriting = authenticated && unsavedChanges && hasWriting() && !saveDraft();
    if (publishBusy || uploadBusy || deleteBusy || unsavedWriting || pendingDraftUnsaved) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  // The token field and sign-in button remain disabled if this script cannot load.
  // No draft data is read or restored before successful administrator verification.
  workspace.hidden = true;
  form.inert = true;
  setPublishingBusy(false);
  tokenInput.value = '';
  tokenInput.disabled = false;
  loginButton.disabled = false;
})();
