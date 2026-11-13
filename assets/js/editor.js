(() => {
  'use strict';

  const form = document.querySelector('#blog-writer');
  if (!form) return;

  const storageKey = 'ilyasferozi.blog-draft.v1';
  const repository = 'ilyasferozi121-svg/Ilyasferozi.me';
  const administratorLogin = 'ilyasferozi121-svg';
  const githubBase = `https://github.com/${repository}`;
  const apiOrigin = 'https://api.github.com';
  const fields = Object.fromEntries(['title', 'date', 'summary', 'tags', 'body'].map(name => [name, form.elements.namedItem(name)]));
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
  let saveTimer;
  let unsavedChanges = false;
  let administratorToken = '';
  let authenticated = false;
  let sessionGeneration = 0;
  let loginBusy = false;
  let publishBusy = false;
  let publishedCurrentDraft = false;
  let loginController = null;
  let publishController = null;
  let pendingDraft = null;
  let pendingDraftUnsaved = false;

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
    if (!authenticated) return false;
    try {
      const savedAt = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify({ ...draftValues(), savedAt }));
      unsavedChanges = false;
      pendingDraftUnsaved = false;
      const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' }).format(new Date(savedAt));
      setStatus(`Draft saved in this browser at ${time} Pakistan time. Download a copy to keep a backup.`);
      return true;
    } catch {
      setStatus('This browser could not save your draft. Keep this tab open and download a copy before leaving.', true);
      return false;
    }
  }

  function restoreDraft() {
    if (!authenticated) return;
    try {
      const raw = pendingDraft ? null : localStorage.getItem(storageKey);
      if (!pendingDraft && !raw) return;
      const saved = pendingDraft || JSON.parse(raw);
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Invalid draft');
      for (const [name, field] of Object.entries(fields)) {
        if (typeof saved[name] === 'string') field.value = saved[name];
      }
      if (!fields.date.value) fields.date.value = today;
      const needsSaving = pendingDraftUnsaved;
      pendingDraft = null;
      pendingDraftUnsaved = false;
      unsavedChanges = needsSaving;
      setStatus('Your saved draft has been restored from this browser. Download a copy to keep a backup.');
      if (needsSaving) saveDraft();
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
    fields.date.max = todayInPakistan();
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
    if (!authenticated || publishBusy) return;
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
    form.setAttribute('aria-busy', String(busy));
    for (const control of form.querySelectorAll('input, textarea, button')) control.disabled = busy;
    document.querySelector('#new-draft').disabled = busy || !authenticated;
    document.querySelector('#download-post').disabled = busy || !authenticated;
    publishButton.disabled = busy || !authenticated || publishedCurrentDraft;
    publishButton.textContent = busy ? 'Publishing…' : publishedCurrentDraft ? 'Committed to GitHub' : 'Publish article';
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

  function resetEditorView() {
    clearTimeout(saveTimer);
    form.reset();
    fields.date.value = todayInPakistan();
    fields.date.max = todayInPakistan();
    fields.title.setCustomValidity('');
    fields.body.setCustomValidity('');
    unsavedChanges = false;
    publishedCurrentDraft = false;
    publishNotice.hidden = true;
    publishNotice.replaceChildren();
    setStatus('Drafts are saved in this browser as you write.');
    renderPreview();
  }

  function signOut(message = '') {
    const wasPublishing = publishBusy;
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
    loginController = null;
    publishController = null;
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
    setPublishingBusy(false);
    const detail = wasPublishing ? 'Signed out. If publishing was in progress, check GitHub before trying again.' : pendingDraftUnsaved ? 'Signed out. Draft storage was unavailable; sign in again in this tab to recover your writing before closing it.' : hadWriting ? 'Signed out. Your saved draft will return after administrator sign-in.' : 'Signed out. Sign in again to open the writing desk.';
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
    if (typeof sha !== 'string' || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(sha) || result?.content?.path !== expectedPath || typeof result?.content?.html_url !== 'string') return null;
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
    deployment.textContent = 'GitHub Pages will build the website next. Your article appears on Blogs after deployment finishes.';
    const file = document.createElement('p');
    const filename = document.createElement('code');
    filename.textContent = path;
    file.append('Article file: ', filename);
    publishNotice.replaceChildren(heading, deployment, file);
    publishNotice.classList.remove('is-error');
    publishNotice.dataset.state = 'success';
    publishNotice.hidden = false;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!authenticated || !administratorToken) {
      setSignInStatus('Sign in as the administrator before publishing.', true);
      return;
    }
    if (publishBusy || publishedCurrentDraft || !validate()) return;
    saveDraft();
    const post = preparedPost();
    const postPath = `_posts/${post.filename}`;
    const contentsPath = `/repos/${repository}/contents/${postPath.split('/').map(encodeURIComponent).join('/')}`;
    const generation = sessionGeneration;
    const credential = administratorToken;
    const controller = new AbortController();
    publishController = controller;
    const timeout = setTimeout(() => controller.abort(), 45000);
    let putAttempted = false;
    setPublishingBusy(true);
    setPublishMessage('Checking that this article has a new filename…');
    try {
      const existing = await requestGitHub(`${contentsPath}?ref=main`, credential, { signal: controller.signal });
      if (generation !== sessionGeneration || controller.signal.aborted) return;
      if (existing.ok) throw new GitHubError('An article with this title and date already exists. Change the title or publication date to create a new article. Existing files are never overwritten.', 409);
      if (existing.status !== 404) throw new GitHubError('GitHub could not check the article’s filename.', existing.status);
      setPublishMessage('Creating your article in GitHub…');
      putAttempted = true;
      const response = await requestGitHub(contentsPath, credential, {
        method: 'PUT',
        signal: controller.signal,
        body: { message: `Publish blog: ${fields.title.value.trim()}`, content: utf8Base64(post.markdown), branch: 'main' }
      });
      if (generation !== sessionGeneration || controller.signal.aborted) return;
      if (response.status !== 201) throw new GitHubError('GitHub did not confirm creation of the article.', response.status);
      const result = await responseJson(response);
      if (generation !== sessionGeneration || controller.signal.aborted) return;
      const sha = confirmCreatedPost(result, postPath);
      if (!sha) throw new GitHubError('GitHub returned an incomplete confirmation. Check your repository before trying again; the article may already have been created.');
      publishedCurrentDraft = true;
      showPublished(sha, postPath);
    } catch (error) {
      if (generation !== sessionGeneration) return;
      if (error instanceof GitHubError && error.statusCode === 401) {
        signOut('Your GitHub session is no longer valid. Your draft has been kept; sign in again before publishing.');
        return;
      }
      let message;
      if (error instanceof GitHubError && error.statusCode === 403) {
        message = 'GitHub denied this request (403). Check that the token has Contents read and write access to this repository, then try again.';
      } else if (error instanceof GitHubError && error.statusCode === 429) {
        message = 'GitHub has temporarily limited requests. Your draft is safe here; try again later.';
      } else if (error instanceof GitHubError && [409, 422].includes(error.statusCode)) {
        message = error.statusCode === 409 && !putAttempted ? error.message : 'GitHub could not create the file. Its name may already be in use. Check the repository or choose a different title before retrying.';
      } else if (error instanceof GitHubError) {
        message = error.message;
      } else {
        message = putAttempted ? 'The publish request could not be confirmed. Check your repository before trying again; the article may already have been created. Your draft is kept here.' : 'GitHub could not be reached. Your draft is kept here; check your connection and try again.';
      }
      setPublishMessage(message, true);
    } finally {
      clearTimeout(timeout);
      if (publishController === controller) {
        publishController = null;
        setPublishingBusy(false);
      }
    }
  });

  form.addEventListener('input', event => {
    if (!authenticated || publishBusy) return;
    if (event.target === fields.title || event.target === fields.body) event.target.setCustomValidity('');
    unsavedChanges = true;
    publishedCurrentDraft = false;
    publishButton.disabled = false;
    publishButton.textContent = 'Publish article';
    publishNotice.hidden = true;
    renderPreview();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 400);
  });

  document.querySelector('#download-post').addEventListener('click', downloadPost);
  document.querySelector('#new-draft').addEventListener('click', () => {
    if (!authenticated || publishBusy) return;
    if (hasWriting() && !window.confirm('Start a new draft? This will replace the draft saved in this browser. Download a copy first if you want to keep it.')) return;
    clearTimeout(saveTimer);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      setStatus('The saved draft could not be cleared. Your writing has been kept here; download a copy before starting over.', true);
      return;
    }
    pendingDraft = null;
    pendingDraftUnsaved = false;
    resetEditorView();
    setPublishingBusy(false);
    setStatus('New draft. Your writing will be saved in this browser as you type.');
    fields.title.focus();
  });

  window.addEventListener('pagehide', () => {
    if (authenticated && unsavedChanges) saveDraft();
  });
  window.addEventListener('beforeunload', event => {
    const unsavedWriting = authenticated && unsavedChanges && hasWriting() && !saveDraft();
    if (publishBusy || unsavedWriting || pendingDraftUnsaved) {
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
