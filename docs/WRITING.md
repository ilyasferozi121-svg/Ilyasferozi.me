# Publish a blog as the administrator

Blog publishing is managed by GitHub sign-in and repository permissions. The public website has no writing form, password store, or unauthenticated publishing API.

1. Sign in to GitHub as the repository owner, or as an account you have explicitly granted write access.
2. Open [the `_posts` folder](https://github.com/ilyasferozi121-svg/Ilyasferozi.me/tree/main/_posts).
3. Choose **Add file → Create new file**. Name it `YYYY-MM-DD-your-title.md`, using today or an earlier date in Pakistan time.
4. Write the front matter and article below. GitHub’s Preview tab supports Markdown preview.
5. Choose **Commit changes**, targeting `main`. The existing GitHub Pages deployment publishes the article after its build completes.

```markdown
---
layout: post
title: "Your article title"
date: 2026-11-13 00:00:00 +0500
description: "A short introduction to your article."
tags: [Diplomacy, Research]
---

Write your introduction here.

## A section heading

Continue with your article. Use **bold**, *italic*, and [links](https://example.com).
```

Change the sample date, title, description, and tags for each article. Do not publish the example as your own writing. The template in `_drafts/first-post.md` remains unpublished until you copy it into `_posts/`, set a date, and remove `published: false`.

To update an article, open its Markdown file, select **Edit**, and commit your changes. To remove a published article, delete its file and commit. Each post automatically gets the shared design and a link from `/blogs/`.

The `/write/` bookmark leads to GitHub administration. It does not grant access: GitHub verifies permissions before allowing any change. Keep repository write access limited to the administrators you trust.
