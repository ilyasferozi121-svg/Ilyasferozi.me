# Writing and publishing a blog

Open [the writing desk](https://ilyasferozi.me/write/). Add a title, publication date, introduction, topics and article text. The introduction and topics are optional. The preview supports common Markdown formatting.

The writing desk saves one draft in the current browser. It does not sync across devices or accounts. Private browsing, browser storage settings and clearing website data can remove drafts. **Download Markdown** keeps a separate copy. If saving fails, the page shows a warning; keep the tab open and download your work.

## Publish through GitHub

1. Choose **Continue in GitHub**. The GitHub editor opens in a new tab with the complete post.
2. Sign in to the GitHub account that can write to `ilyasferozi121-svg/Ilyasferozi.me`.
3. Review the post and choose **Commit changes**, committing directly to `main` when ready to publish.
4. Wait for the repository’s GitHub Pages deployment to finish. The article then appears on [Blogs](https://ilyasferozi.me/blogs/).

Long posts use a file upload instead of a prefilled link. The writing desk shows **Download this post** and **Upload in GitHub**. Download the file, upload it into `_posts`, and commit it. The article is never shortened to fit a link.

Use a different title or filename for each article. To revise an existing article, edit its file in `_posts` on GitHub and commit the update; the writing desk creates new posts.

## Write Markdown directly

Create a file in `_posts` named `YYYY-MM-DD-article-title.md`, with a date of today or earlier. For example:

```markdown
---
layout: post
title: "Your article title"
date: 2026-11-13 00:00:00 +0500
description: "A short introduction to the article."
tags: ["Diplomacy", "International relations"]
---

Your opening paragraph goes here.

## A section heading

Continue your article with paragraphs, **bold text**, *italic text*, lists,
and [links](https://example.com).
```

The file in `_drafts/first-post.md` is an unpublished template. Copy it into `_posts` with a dated filename and remove `published: false` to publish your own writing. Do not commit private or unfinished writing in a public repository: unpublished files still remain visible on GitHub.

Dates use Pakistan time. The writer accepts today or an earlier date. Future-dated Markdown posts are not a scheduling service: a site rebuild on or after that date is needed before they can appear.
