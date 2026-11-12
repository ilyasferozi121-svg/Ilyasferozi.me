GITHUB PAGES HANDOFF
Revised 7 November 2026

STATUS
These are deployment templates for the website that will be implemented from the production prompt. This kit has no package.json, runnable application, repository or deployed URL. Do not upload the intake kit as a finished website.

RECOMMENDED ADDRESS
For a personal portfolio, use an available repository named YOUR-GITHUB-USERNAME.github.io. Its normal URL is https://YOUR-GITHUB-USERNAME.github.io/. If that account site is already used, a project repository such as portfolio can publish at https://YOUR-GITHUB-USERNAME.github.io/portfolio/. Both work; the project form requires a base path during the build.
GitHub Pages supports public repositories on GitHub Free. A custom domain can be configured later if the owner controls it. The CV-listed domain ilyasferozi.me has not been verified or configured.

FILES TO USE IN THE IMPLEMENTED PROJECT
1. next.config.mjs goes in the application root, merged with any necessary existing compatible configuration.
2. paths.ts is a helper for public images, PDF downloads and other raw asset links. Keep Next Link route hrefs unprefixed because Next.js applies basePath itself.
3. github-pages.yml goes at .github/workflows/github-pages.yml after the application, lockfile and required scripts exist.

REQUIRED APPLICATION SCRIPTS
lint: direct linter invocation.
typecheck: framework-appropriate type generation if needed, followed by TypeScript validation.
validate:content: check safe content fields, IDs, asset paths, date precision and publication eligibility.
build: next build, with any necessary public asset/metadata preparation wired before it.

The workflow uses npm and package-lock.json. Adapt deliberately if an existing project uses a different package manager. The template defaults to the main branch and Node 24. Confirm compatibility and action versions before first deployment. Source references for the action versions and inputs are recorded below.

STATIC REQUIREMENTS
- output:'export' and trailingSlash:true; publish the generated out/ directory.
- images.unoptimized:true; prepare image sizes locally instead of relying on the server image-optimization endpoint.
- Education is at /education-experience/. Experience, training and seminars have separate nested routes.
- generateStaticParams must enumerate all prepared certificate IDs; dynamicParams=false prevents a runtime fallback.
- Email contact uses mailto. No runtime backend or server-side contact handler is provided by Pages.
- PDFs and any JSON/SEO files must be prepared before deployment.
- Content updates require a new build and deployment.

PATH CONFIGURATION
NEXT_PUBLIC_BASE_PATH is empty for a root account site/custom domain, or /repository-name for a project site. The workflow obtains it from the configured Pages site. NEXT_PUBLIC_SITE_URL is the full site base URL, including any project path. Rebuild after changing either value.
Do not add assetPrefix as a substitute for correct basePath handling. Check public image/PDF paths, internal links, canonical URLs and sitemap entries separately.

PUBLISHING SEQUENCE
1. Implement the app from the complete production prompt and inspect it locally.
2. Prepare a clean publishable repository containing only application code, selected public content and eligible assets. Do not commit source-assets/, review/, raw CVs, the private manifest or the kit ZIP. Check staged files; .gitignore does not remove previously committed files.
3. In the chosen GitHub repository, open Settings > Pages and select GitHub Actions as the source.
4. Add the completed project, lockfile, required scripts and the supplied workflow. A push to main or manual workflow dispatch then runs checks, builds and deploys out/.
5. Inspect the deployment URL, nested route refreshes, navigation, certificate pages, multi-page views, images, downloads and the 404 before considering publication complete.

GitHub Actions permissions and repository policies still apply. The template does not supply account credentials or activate Pages itself. No manual personal-access token is required by this workflow for its normal in-repository Pages deployment.

ABOUT .NOJEKYLL
The selected custom Actions artifact workflow does not require it. For branch-based publishing of prebuilt output, add an empty .nojekyll at the published root to bypass Jekyll processing. Do not mix the two deployment instructions accidentally.

TEMPLATE VALIDATION
The configuration's root/project path values and JavaScript syntax, YAML structure, safe artifact path and dependency on the build job were checked. No Next.js build or GitHub Actions run has occurred because the website has not yet been implemented.

OFFICIAL REFERENCES
https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
https://nextjs.org/docs/app/guides/static-exports
https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath
https://nextjs.org/docs/app/api-reference/components/image
https://nextjs.org/docs/app/api-reference/functions/generate-static-params
https://github.com/actions/setup-node
https://github.com/actions/configure-pages
https://raw.githubusercontent.com/actions/configure-pages/main/action.yml
