# Write and publish as the administrator

Open the [writing desk](https://ilyasferozi.me/write/). The editor verifies the GitHub account `ilyasferozi121-svg` and its administrator permission for `ilyasferozi121-svg/Ilyasferozi.me`; visitors cannot publish articles.

## Sign in

1. [Create a fine-grained GitHub token](https://github.com/settings/personal-access-tokens/new). Select `ilyasferozi121-svg` as resource owner, only the `Ilyasferozi.me` repository, and **Contents: Read and write** permission. Set an expiration.
2. Enter the token in the writing desk’s masked field, then choose **Sign in as administrator**. Do not put tokens in articles, screenshots, or chat.
3. Sign out when finished. Reloading or closing the page also ends the website session. Revoke a token separately in GitHub’s settings when necessary.

The token stays in page memory and is sent only to `https://api.github.com`. It is excluded from drafts, downloads, browser storage, and URLs. A read-only token can verify the account but cannot publish; a 403 response can indicate missing repository write permission.

## Article library and drafts

The writing desk separates browser drafts from published repository articles. Start a new draft for each article, switch between saved drafts, and use saved versions to recover earlier writing. The old single browser draft is migrated when available. Autosave and revision snapshots are browser-local, not a cloud backup. Use Markdown downloads and draft-library backup export to keep independent copies; import creates recoverable writing without publishing it.

Browser drafts do not sync across devices. Clearing site data or using private browsing can remove them. Anyone using the same browser profile can access its local data, so use your own device. If storage fails or fills, keep the tab open and download your writing. Downloads contain image links rather than the image files; keep originals separately.

Refresh the published-article library and open an article to revise it. Its repository path, publication date, and URL stay fixed even when its title changes. **Update article** sends the loaded file’s exact GitHub blob SHA. If someone has edited the file since it was opened, the editor stops with a conflict and preserves your draft. Download your work, reopen the current repository version, and reconcile the changes. The GitHub history link contains published revisions; browser saved versions contain local revisions.

Existing frontmatter is preserved when supported. The editor refuses an update when it cannot safely read the original metadata instead of silently discarding it. Such files can still be edited directly in GitHub.

### Delete a published article

1. Sign in at the writing desk and choose **Refresh articles**.
2. Select the article and choose **Open article**. Check its title and repository filename.
3. Choose **Delete published article**, then type the exact filename shown in the confirmation panel.
4. Confirm the deletion. The editor rechecks the loaded file’s SHA and stops if the article changed in GitHub.

A confirmed deletion removes the article file from `main`. GitHub Pages then rebuilds the Blogs page, homepage previews, related reading, and sitemap without that article. The site can continue to show the old version until deployment finishes. The local writing is retained as a separate recovery draft, and published versions remain recoverable through GitHub history. Deleting an article does not erase repository history or delete image files, which may be used by other articles. **Delete draft** only removes a browser draft; it does not delete a published article.

If a response is interrupted or cannot be confirmed, check the `_posts` folder on GitHub before retrying. If a file changed since you opened it, reopen the current article before deciding whether to delete that version.

## Write and format

Add an article title, Pakistan-time publication date, short introduction, topics, and body. New publication dates must be today or earlier. The introduction appears to readers and in article listings. Topics are comma-separated and help select related reading.

Use the toolbar for headings, emphasis, links, lists, quotations, code, dividers, pictures, tables, citations, and references. Ctrl/Command+B, I, and K format selected text. The internal-link picker offers public pages and published articles. The writing view can show both editor and preview, focus on writing, or show just the preview.

The editor writes portable Markdown. The safe preview covers the supported formatting; it does not execute pasted HTML or Liquid. Review publishing checks and the deployed article, especially when importing advanced Markdown. A word count and estimated reading time describe the draft; they are not ranking targets.

### Sources and academic writing

Cite claims near the relevant sentence and distinguish evidence from interpretation. A footnote uses a marker and matching definition:

```markdown
A claim supported by a source.[^source-1]

[^source-1]: Author, *Publication title*, publisher, date, [source](https://example.com).
```

Use a References section when appropriate. Include original sources, dates, and enough detail to locate the evidence. Check quotations, statistics, uncertainty, and image rights before publishing. Tables use standard Markdown:

```markdown
| Policy option | Evidence |
| --- | --- |
| Cooperation | Primary sources |
```

The published page builds an optional contents list from at least two section headings, provides accessible footnotes and horizontally scrollable tables, and suggests related articles. Disable the contents option for short articles when appropriate.

### Pictures, captions, and covers

Insert an HTTPS image URL or a site path beginning with `/`, with useful alternative text. For a device image, choose PNG, JPEG, GIF, or WebP up to 3 MB, describe it, and select body or cover. The editor verifies the file contents and image dimensions. Optimized static pictures receive smaller responsive variants without upscaling. Animated pictures are preserved.

**Upload & insert immediately publishes image files in the public repository**, even while the article is a local draft. All required upload confirmations must succeed before the editor inserts the picture. A failed multi-file upload may leave an unreferenced public file; check the repository before retrying. Removing an image from a draft does not delete its uploaded files. Never upload confidential images.

Add captions and credits with the image tools. The portable caption convention is an emphasized paragraph immediately after a standalone image:

```markdown
![Describe the image](/source-assets/blog/example.jpg)

*Explain the image — Credit: Photographer or source*
```

Uploaded static images also include inline kramdown attributes with dimensions and responsive sources, directly after the closing image parenthesis. Keep these attributes on the same line as the image when editing Markdown directly. The optional cover appears above the article, supplies the social sharing image, and serves as the thumbnail on Blogs, homepage previews, and related articles. Choose **The article cover** when uploading, or set its URL under **Customize the article cover**, then publish or update. Without a cover, cards use the first picture in the article; articles with no picture show a styled placeholder. A failed image request also reveals that placeholder. Cover captions and credits are distinct from alternative text.

## Search appearance and publishing

The SEO panel supports a separate optional search title, a unique description, and a readable URL slug for a new article. The visible article title and introduction remain separate. Search and social previews are illustrative: Google and social platforms decide the actual appearance and may choose other text or cache older images. There is no guaranteed title/description character cutoff or preferred article word count.

Choose a clear, descriptive title and slug, write an accurate description, use a logical heading hierarchy, link to relevant pages, and describe informative images. Run publishing checks for metadata, headings, image descriptions, references, and internal links. External links require manual verification; a browser cannot reliably inspect every other site. Review spelling, source accuracy, and the publishing reminders before submitting. Checks help catch omissions and do not promise rankings.

Publish creates `_posts/YYYY-MM-DD-slug.md` on `main`; updates modify the existing path with conflict protection. The editor verifies GitHub’s returned commit before reporting success. GitHub Pages then builds the website. A confirmation from GitHub means the file was committed, not that deployment has finished. If a response is lost, inspect the repository before retrying.

Published articles automatically receive canonical and social metadata, cover-based sharing images when supplied, `BlogPosting` structured data, and sitemap entries. The author links to About. The original publication date stays intact. An actual update supplies `last_modified_at`; merely rebuilding the website does not make an article appear newly updated.

Article publishing, deletion, and image commits explicitly use **Mohammad Ilyas** and GitHub’s noreply identity for both author and committer. For edits made with other tools, also enable **Keep my email addresses private** and **Block command line pushes that expose my email** in [GitHub email settings](https://github.com/settings/emails).

## Edit Markdown in GitHub

The editor is optional. Create a file in `_posts/` with today’s date or an earlier date and commit it to `main`:

```markdown
---
layout: post
title: "Your article title"
date: 2026-11-18 00:00:00 +0500
description: "The introduction shown to readers."
seo_title: "Optional search title"
seo_description: "An accurate, unique description of this article."
tags: ["Diplomacy", "Research"]
toc: true
---

Your introduction.

## A section heading

Your analysis and supporting sources.
```

Change the example fields for your article. Optional cover fields are `cover_image`, `cover_alt`, `cover_caption`, `cover_credit`, `cover_width`, `cover_height`, and `cover_srcset`. Set `last_modified_at` to the actual revision time when substantially updating an existing article. Preserve its filename and any explicit `permalink` to preserve its URL.

The existing `_drafts/first-post.md` template is not published by Pages. Files committed to this public repository are still publicly visible on GitHub, including files excluded from the website; private drafts belong in your browser or private backups.
