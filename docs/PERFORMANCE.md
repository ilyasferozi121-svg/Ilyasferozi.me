# Performance review — 19 November 2026

The site was reviewed for mobile rendering, image delivery, script execution, loading behavior, caching, and layout stability. Changes preserve the website’s design, navigation, contact protection, blog administration, and existing article files.

## Controlled mobile measurements

These are medians of three Lighthouse 12.8.2 runs per page and version, using Chromium 156, a 412 × 823 mobile viewport at DPR 1.75, simulated 150 ms RTT / 1.6 Mbps, and 4× CPU slowdown. Exploratory runs were excluded from the standardized comparison. Every summarized run completed without Lighthouse runtime errors or warnings. The individual samples and settings are in [the results JSON](performance-results-2026-11-19.json).

| Page | Performance score | Largest contentful paint | Total blocking time | Layout shift |
| --- | --- | --- | --- | --- |
| Home | 90 → 95 | 2.61 s → 1.52 s | 296 ms → 271 ms | 0 → 0 |
| About | 85 → 92 | 3.03 s → 1.13 s | 381 ms → 344 ms | 0 → 0 |

Home’s measured transfer fell from 279,666 to 242,323 bytes, and About’s from 262,487 to 216,700 bytes. These totals include the retained Analytics library. Mobile portrait delivery itself fell from one 48,994-byte image to an 8,072-byte hero variant plus a 2,178-byte header image. Larger displays can select higher-resolution sources.

The public PageSpeed API returned HTTP 429. The environment’s direct Chromium connection could not validate its proxy certificate, and automatic approval review rejected a persistent, home-wide certificate-store change because it would broaden trust for future browser sessions. No such change was performed. For a safe comparison, the two site builds were served locally with gzip, the same Analytics library was fetched using normal TLS verification and replayed locally, and Analytics collection requests were blocked. No certificate checks were disabled. This controls the comparison but omits production-origin connection/hosting latency: the numbers are **lab results, not a live PageSpeed score or real-visitor Core Web Vitals**. Lab blocking time is not a measurement of visitors’ INP. Scores vary with device, connection, and test-host load.

## Changes

- **Responsive portraits.** The hero offers 256, 384, 640, and 864-pixel WebP sources with sizes matched to its layout. The shared 32-pixel header uses a 96-pixel version for sharp high-density rendering. Every derivative comes from the same original portrait; framing, aspect ratio, CSS geometry, the original JPEG, full-size WebP, and favicons are preserved.
- **Initial content stays visible.** Reveal setup batches layout reads and immediately reveals content already inside the viewport. Interior-page headings no longer wait for an opacity entrance animation. Below-fold reveal animations, reduced-motion support, keyboard navigation, filters, and the active section rail remain available.
- **No ineffective portrait pointer work.** The square profile frame already disables transforms in CSS. It no longer installs tilt listeners that performed layout measurements without a visible effect. Other portrait styles retain their effects, with geometry measured once per animation frame.
- **Analytics yields to rendering.** The original `dataLayer`, `gtag`, measurement ID, queued initialization, and single config remain. A small deferred first-party loader requests the Analytics library during an idle period after HTML parsing, with a 2,000 ms timeout request and a timer fallback. It does not wait for unrelated image or captcha requests. Analytics remains excluded from the administrator page. The timeout depends on main-thread availability; very short visits may leave before deferred loading completes. Queue/request tests do not prove Google’s receipt.
- **Native article image hints.** `_includes/article-content.html` adds missing lazy-loading and asynchronous-decoding attributes to rendered body images before the browser’s preload scanner runs. Existing author attributes, image dimensions, responsive sources, and article text are preserved. Covers retain their eager/high-priority behavior. The progressive JavaScript fallback also honors explicit attributes. Actual fetching remains the browser’s decision and may happen before an image enters the viewport.

- **Stable captcha space.** The contact form reserves the compact widget’s 164 × 144-pixel area and displays its iframe as a block. In a delayed-widget fixture at 320 and 390 pixels, submit-button movement fell from about 152 pixels to zero, and widget-induced CLS fell from about 0.048–0.051 to zero. Verification is still required before submission; no live captcha was solved or message sent during testing.

When an article has no cover, its first body image keeps eager loading because it may be the main image visible on arrival. Later images receive lazy hints, and explicit author choices still take precedence. Empty cover values do not render a broken cover image.

## Verification

The official GitHub Pages Jekyll builder completed successfully. Validation covered 21 exact-string article rendering cases, native offscreen-image request behavior, JavaScript enhancement with explicit eager/synchronous hints, 10 navigation/interaction regression groups, nine Analytics queue/loading cases, and mocked administrator/contact regressions. Desktop and mobile visuals, six viewport widths, square portrait geometry, the 32-pixel header, nine rail sections, filters, research tabs, reduced motion, and no-JavaScript readability were checked. GitHub writes, form submission, and Analytics collection were mocked in functional tests; no real article was changed or deleted by those tests.

## Deliberate limits

- The live server already compresses CSS/JavaScript. Lighthouse found no material first-party unused-CSS savings in these runs. Rules were not removed on the basis of one viewport, and no minifier or production dependency stack was introduced.
- Google Analytics remains the largest external script. Its full library still has a measurable CPU and transfer cost; deferring it does not remove that cost or make third-party code smaller.
- Observed production responses use ETags and `Cache-Control: max-age=600`. GitHub Pages/its delivery layer controls these headers; static repository files cannot safely override them. The existing per-build asset query version was retained to prevent stale interface files after deployment. It invalidates unchanged CSS/JS after a new build, which is a known repeat-visit tradeoff. Reliable per-file fingerprints would need a supported build step or a generated manifest; Jekyll/Liquid here provides no built-in SHA/MD5 filter. No unsupported filter, service worker, or fragile cache workaround was added.
- Real-user INP and hosting/network variation still require field data. These changes improve the measured pages without claiming that every visitor, device, route, or third-party service has a perfect score.
