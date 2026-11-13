# Mohammad Ilyas — Academic Portfolio

The portfolio at **https://ilyasferozi.me** uses GitHub Pages and Jekyll. Each navigation item has its own page. Shared layouts, styles, and navigation keep the design consistent, including the mobile three-dot menu and compact footer. Interactive research themes, portfolio filters, scroll reveals, and subtle hover effects add motion without changing the content. Visitors who prefer reduced motion receive a still experience. The approved full-body welcome GIF plays once, with a Replay welcome control; its face remains fixed across all frames.

## Pages

- `/` — home, with separate bordered section cards and More links
- `/about/`, `/research/`, `/education/`, `/experience/`, `/training/`, `/skills/`
- `/blogs/` — published articles
- `/write/` — administrator sign-in, article editor, reading preview, and authenticated publishing
- `/cv/` — complete printable CV
- `/contact/`

## Admin-only blog publishing

The writing desk at `/write/` requires administrator sign-in before revealing the article editor or restoring a saved draft. Use a fine-grained GitHub access token restricted to `ilyasferozi121-svg/Ilyasferozi.me`, with **Contents: Read and write** permission. The website verifies the exact owner account `ilyasferozi121-svg` and its repository administrator role. GitHub separately enforces write permissions when the editor publishes a post.

The token is entered only in the website’s masked sign-in field, held in page memory, and sent only to `https://api.github.com`. It is never stored in browser storage, drafts, files, or URLs. Signing out clears the credential and hides the editor; reloading requires a new sign-in. The session uses the existing static hosting and needs no additional OAuth service or backend.

The restored editor includes local draft saving, Markdown reading preview, and complete Markdown downloads. **Publish article** creates a new `_posts/YYYY-MM-DD-title.md` file on `main` through GitHub’s authenticated API. Existing files are never overwritten, and success is shown only after a valid commit confirmation. GitHub Pages publishes the article after its build finishes. To revise or delete a published article, use the repository’s authenticated [`_posts` editor](https://github.com/ilyasferozi121-svg/Ilyasferozi.me/tree/main/_posts).

See [the writing guide](docs/WRITING.md) for token setup, drafts, publishing, and direct Markdown authoring. The `_drafts/first-post.md` template remains unpublished.

## Edit and publish

Edit page content in the root HTML files, the shared header/footer in `_layouts/default.html`, navigation in `_data/navigation.yml`, and shared design in `assets/css/site.css`. The contact details, portrait, and 22 certificates remain in their existing locations.

Committing to `main` triggers the repository’s existing **pages build and deployment** workflow. Keep its current GitHub Pages configuration and the `CNAME` for `ilyasferozi.me`. No additional hosting service or custom workflow is required.

## Local preview

With Ruby and Bundler installed:

```sh
bundle install
bundle exec jekyll serve
```

Open `http://localhost:4000`. A plain file server over the repository source does not render Jekyll layouts; serve the built `_site/` directory instead.

## Contact

- Email: ilyasferozi121@gmail.com
- LinkedIn: https://www.linkedin.com/in/muhammad-ilyas-930830370
