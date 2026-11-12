// Use for local PUBLIC asset URLs, not for next/link route hrefs.
// The path passed here must be an unprefixed public-root path.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function assetUrl(publicPath: string): string {
  if (!publicPath.startsWith("/") || publicPath.startsWith("//")) {
    throw new Error("assetUrl expects a local path such as /images/portrait.jpg");
  }
  return `${basePath}${publicPath}`;
}

// Example: <Image src={assetUrl('/images/portrait.jpg')} ... />
// Example: <a href={assetUrl('/documents/public-cv.pdf')} download>Download CV</a>
// For page navigation keep <Link href="/about/">About</Link> without this helper.
