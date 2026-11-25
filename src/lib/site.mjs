/** Canonical production origin. www 308-redirects here. */
export const SITE_ORIGIN = 'https://jtapsbarandgrill.com';

export const DEFAULT_OG_IMAGE_PATH = '/images/og-image.jpg';

/**
 * Routes that should not be submitted to Google.
 * Private account tools, the TV beer board, and URLs that redirect.
 */
export const SITEMAP_EXCLUDED_PATHS = [
  '/admin',
  '/login',
  '/dashboard',
  '/loyalty-card',
  '/events',
  '/beer-menu-tv',
  '/bengals-brunch',
  '/elder-princeton-regional-final',
  '/404',
];

export function canonicalUrl(pathname) {
  if (!pathname || pathname === '/') return SITE_ORIGIN;
  const path = pathname.replace(/\/+$/, '');
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export function absoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return `${SITE_ORIGIN}${DEFAULT_OG_IMAGE_PATH}`;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl, `${SITE_ORIGIN}/`).href;
}

export function isSitemapExcluded(pageUrl) {
  let pathname;
  try {
    pathname = new URL(pageUrl).pathname;
  } catch {
    return true;
  }
  if (pathname === '/api' || pathname.startsWith('/api/')) return true;
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return SITEMAP_EXCLUDED_PATHS.some(
    (excluded) => normalized === excluded || normalized.startsWith(`${excluded}/`),
  );
}
