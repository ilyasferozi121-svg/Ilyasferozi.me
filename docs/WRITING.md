# Write and publish as the administrator

The [writing desk](https://ilyasferozi.me/write/) restores the website’s article editor and reading preview after administrator sign-in. Sign-in must verify both the GitHub account `ilyasferozi121-svg` and its administrator permission for `ilyasferozi121-svg/Ilyasferozi.me`. GitHub enforces the token’s publishing permissions on its servers.

## Sign in

1. In GitHub, [create a fine-grained personal access token](https://github.com/settings/personal-access-tokens/new). Choose `ilyasferozi121-svg` as the resource owner, select only the `Ilyasferozi.me` repository, and grant **Contents: Read and write** repository permission. Choose an expiration suitable for your use.
2. Open the writing desk and enter that token in its masked **GitHub access token** field. Enter it on the website, not in ChatGPT or in an article.
3. Choose **Sign in as administrator**. The writing fields appear only after GitHub verifies the account and repository administrator role.

The token is kept only in the page’s memory and sent only to `https://api.github.com`. It is not saved in browser storage, drafts, files, or URLs. Sign out, reload, or close the page to end the website session; sign in again to reopen the editor. Signing out of the website does not revoke the token in GitHub—you can revoke or replace it in GitHub’s token settings.

## Draft, preview, and publish

Add your title, publication date, introduction, topics, and article. The introduction and topics are optional. Dates follow Pakistan time and must be today or earlier. The preview supports common Markdown headings, paragraphs, emphasis, links, lists, quotations, and code blocks.

The editor saves one draft in the current browser. Signing out hides the writing fields and keeps that saved draft; it is restored only after administrator sign-in. Drafts do not sync across devices, and clearing website data or using private browsing can remove them. **Download Markdown** keeps a separate copy. If saving fails, the page shows a warning—keep the tab open and download your writing.

Choose **Publish article** when your writing is ready. The editor creates a new Markdown file in `_posts/` on the repository’s `main` branch through GitHub’s authenticated API. It confirms a returned commit before reporting success. GitHub Pages then builds the website; the article appears on [Blogs](https://ilyasferozi.me/blogs/) after deployment finishes.

Each article needs a unique combination of title and date. The editor checks for an existing file and never overwrites one. To revise or remove a published article, open its file in [the `_posts` folder on GitHub](https://github.com/ilyasferozi121-svg/Ilyasferozi.me/tree/main/_posts) and commit your edit or deletion there.

A read-only token may verify your account but cannot publish. If GitHub returns **403**, check that the token has **Contents: Read and write** access to this repository, then sign out and sign in with the updated token. If a publish request cannot be confirmed, check `_posts` before trying again: a file might have been created even if its response did not reach the browser. Your draft remains available.

## Write Markdown directly

You can also use GitHub’s authenticated editor. Create `_posts/YYYY-MM-DD-article-title.md` with a date of today or earlier, then commit it to `main`:

```markdown
---
layout: post
title: "Your article title"
date: 2026-11-13 00:00:00 +0500
description: "A short introduction to your article."
tags: ["Diplomacy", "Research"]
---

Write your introduction here.

## A section heading

Continue with your article. Use **bold**, *italic*, and [links](https://example.com).
```

Change the sample date, title, description, and topics for each article. The template in `_drafts/first-post.md` remains unpublished until you copy it into `_posts/`, set a date, and remove `published: false`. Files committed to this public repository remain visible on GitHub even when excluded from the published website.
