// Run with Node.js: node scripts/check-authoring.cjs
// Pure helper regressions; browser/authentication tests must mock GitHub writes.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ window: { location: { origin: 'https://ilyasferozi.me' } }, URL, DOMException });
for (const filename of ['editor-content.js', 'editor-media.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js', filename), 'utf8'), context, { filename });
}
const content = context.window.IlyasEditorContent;
const images = context.window.EditorMedia;
const original = [
  '---', 'layout: post', 'title: Original title', 'date: 2025-06-12 14:35:00 +0530',
  'description: >-', '  First line', '  second line', 'tags: [Diplomacy, Research]',
  'permalink: /writing/stable-address/', 'custom:', '  nested: true', '---', '',
  'An introduction.[^source]', '', '## Evidence', '', '[^source]: An original source.', ''
].join('\n');
const parsed = content.parsePost(original);
assert.equal(parsed.values.summary, 'First line second line');
assert.equal(parsed.values.toc, true, 'existing articles without a setting retain the default contents list');
const updated = content.serializePost({ ...parsed.values, title: 'An updated title' }, {
  originalFrontmatter: parsed.frontmatterLines, lastModifiedAt: '2026-11-18T12:00:00+05:00'
});
assert.match(updated, /date: 2025-06-12 14:35:00 \+0530/);
assert.match(updated, /permalink: \/writing\/stable-address\//);
assert.match(updated, /custom:\n  nested: true/);
assert.match(updated, /last_modified_at: "2026-11-18T12:00:00\+05:00"/);
assert.equal(content.parsePost(updated).values.title, 'An updated title');
const notUpdated = content.serializePost(parsed.values, { originalFrontmatter: parsed.frontmatterLines });
assert.doesNotMatch(notUpdated, /last_modified_at:/, 'exporting or rebuilding never invents a revision date');
for (const bad of [
  '---\ntitle: First\ntitle: Second\n---\nBody',
  '---\ntitle: &anchor Value\n---\nBody',
  '---\ntitle: "Unfinished\n---\nBody'
]) assert.throws(() => content.parsePost(bad), 'unsupported known metadata must not be silently rewritten');
const values = { title: 'Evidence and policy', summary: 'A useful introduction.', body: '## Evidence\n\nAnalysis.[^source]\n\n[^source]: [Research](/research/)' };
const options = { baseUrl: 'https://ilyasferozi.me', knownPaths: new Set(['/research/']) };
assert.equal(content.checkContent(values, options).filter(item => item.severity === 'error').length, 0);
assert.equal(content.checkContent({ ...values, body: 'A claim.[^missing]' }, options).some(item => item.code === 'footnote' && item.severity === 'error'), true);
assert.equal(content.checkContent({ ...values, body: '<script>alert(1)</script>' }, options).some(item => item.code === 'active-html' && item.severity === 'error'), true);
assert.doesNotThrow(() => content.checkContent({ ...values, body: '[Malformed anchor](#%)' }, options));
assert.equal(content.checkContent({ ...values, body: '[Unknown page](/missing/)' }, options).some(item => item.code === 'internal-link'), true);
const example = '~~~markdown\n[Example](javascript:alert)\n[^not-a-real-reference]\n~~~';
assert.equal(content.checkContent({ ...values, body: example }, options).filter(item => item.severity === 'error').length, 0, 'code examples do not become live links or references');
assert.equal(content.extractHeadings('## Evidence\n\n```\n## Code example\n```\n\n### Implications').length, 2);
const attributes = images.attributes([
  { url: '/source-assets/blog/example.jpg', width: 1280, height: 640 },
  { url: '/source-assets/blog/example-384w.jpg', width: 384, height: 192 }
]);
assert.equal(attributes.src, '/source-assets/blog/example.jpg');
assert.match(attributes.srcset, /example-384w\.jpg 384w, .*example\.jpg 1280w/);
for (const url of ['javascript:alert(1)', '//other.example/image.png', 'https://user:password@example.com/image.png', '/image.png,other']) {
  assert.throws(() => images.attributes([{ url, width: 100, height: 100 }]));
}
assert.throws(() => images.attributes([{ url: '/a.png', width: 100, height: 100 }, { url: '/b.png', width: 100, height: 100 }]));
console.log('Authoring helper regression checks passed. No network requests or repository writes.');
