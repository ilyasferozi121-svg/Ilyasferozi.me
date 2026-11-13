# Mohammad Ilyas — Academic Portfolio

The portfolio at **https://ilyasferozi.me** uses GitHub Pages and Jekyll. Each navigation item has its own page. Shared layouts, styles, and navigation keep the design consistent, including the mobile three-dot menu and compact footer. Interactive research themes, portfolio filters, scroll reveals, and subtle hover effects add motion without changing the content. Visitors who prefer reduced motion receive a still experience. The approved full-body welcome GIF plays once, with a Replay welcome control; its face remains fixed across all frames.

## Pages

- `/` — home, with separate bordered section cards and More links
- `/about/`, `/research/`, `/education/`, `/experience/`, `/training/`, `/skills/`
- `/blogs/` — published articles
- `/write/` — administrator handoff to authenticated GitHub post management
- `/cv/` — complete printable CV
- `/contact/`

## Admin-only blog publishing

The public website is read-only. It contains no blog editor or public write API. `/write/` is a small handoff to GitHub administration, not a public authoring form, and it is not linked from the public blog listing.

Open the repository’s [`_posts` folder](https://github.com/ilyasferozi121-svg/Ilyasferozi.me/tree/main/_posts) while signed in to GitHub. Only the owner and accounts explicitly granted repository write permission can create, edit, or publish posts. GitHub enforces these permissions on the server; the website stores no passwords or access tokens.

Create Markdown files named `YYYY-MM-DD-title.md` in `_posts/` and commit to `main`. See [the writing guide](docs/WRITING.md) and the unpublished `_drafts/first-post.md` template.

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
