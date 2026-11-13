# Mohammad Ilyas — Academic Portfolio

The portfolio at **https://ilyasferozi.me** uses GitHub Pages and Jekyll. Each navigation item has its own page. Shared layouts, styles, and navigation keep the design consistent, including the mobile three-dot menu and compact footer.

## Pages

- `/` — home, with separate bordered section cards and More links
- `/about/`, `/research/`, `/education/`, `/experience/`, `/training/`, `/skills/`
- `/blogs/` — published articles
- `/write/` — draft, preview, and prepare a blog for publishing through GitHub
- `/cv/` — complete printable CV
- `/contact/`

## Write a blog

Open **https://ilyasferozi.me/write/** to write and preview a draft. **Continue in GitHub** opens the new post in this repository. Sign in as an account with repository write access and commit the file to `main` to publish it. The website does not request or store a GitHub token.

Drafts are saved in that browser when storage is available. Download important drafts as Markdown for backup. For a long post, download the Markdown and upload it using the supplied GitHub link.

You can also add Markdown files directly in `_posts/`, named `YYYY-MM-DD-title.md`. See [the writing guide](docs/WRITING.md) and the unpublished template in `_drafts/first-post.md`. No demonstration articles are published as the owner’s writing.

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
