/**
 * Single source of truth for the "Services" menu, the mobile accordion and the /tools page.
 * Add, edit or remove items here. Tools that aren't built yet use soon(): they link to
 * /tools/<slug>, which shows a "Coming soon" page, and get a "Soon" badge. Switch an item to
 * live() with its real route once it works.
 */
export type MenuColumnId = 'cv' | 'additional';

export interface MenuColumn {
  id: MenuColumnId;
  label: string;
}

export interface MenuItemConfig {
  /** Used for the placeholder route /tools/<slug> and as a stable id. */
  slug: string;
  title: string;
  description: string;
  href: string;
  badge?: string;
  column: MenuColumnId;
  /** Not built yet: shown with a "Soon" badge instead of `badge`. */
  soon?: boolean;
}

export const MENU_COLUMNS: readonly MenuColumn[] = [
  { id: 'cv', label: 'CV Tools' },
  { id: 'additional', label: 'Additional Tools' },
];

/** The CV checker page: upload, score, fix with AI and download. */
export const CHECK_HREF = '/check';

/** "Try it free" buttons for guests; AuthService.startHref swaps in /dashboard once signed in. */
export const SIGNUP_HREF = '/signup';

const live = (
  slug: string,
  title: string,
  description: string,
  column: MenuColumnId,
  href: string,
): MenuItemConfig => ({ slug, title, description, href, column });

const soon = (
  slug: string,
  title: string,
  description: string,
  column: MenuColumnId,
  badge?: string,
): MenuItemConfig => ({
  slug,
  title,
  description,
  href: `/tools/${slug}`,
  column,
  badge,
  soon: true,
});

export const MENU_ITEMS: readonly MenuItemConfig[] = [
  soon('ai-cv-builder', 'AI CV Builder', 'Smart CV creation', 'cv'),
  soon('ai-cv-agent', 'AI CV Agent', 'Our new AI CV experience', 'cv'),
  live('cv-checker', 'CV Checker', 'Get instant feedback', 'cv', CHECK_HREF),
  live('cv-keyword-scanner', 'CV Keyword Scanner', 'Target your application', 'cv', CHECK_HREF),
  soon('cv-bullet-point-writer', 'CV Bullet Point Writer', 'Stronger CV content', 'cv'),
  soon('cv-summary-generator', 'CV Summary Generator', 'Create a CV summary', 'cv'),
  soon(
    'cover-letter-generator',
    'Cover Letter Generator',
    'Personalized cover letters',
    'additional',
  ),
  soon(
    'resignation-letter-generator',
    'Resignation Letter Generator',
    'Leave on good terms',
    'additional',
  ),
  soon('job-search', 'Job Search', 'Discover new opportunities', 'additional', 'New'),
  soon('ai-interview', 'AI Interview', 'Practice your answers', 'additional'),
];

export const TOOLS_HREF = '/tools';

export const itemsIn = (column: MenuColumnId): MenuItemConfig[] =>
  MENU_ITEMS.filter((item) => item.column === column);

export const itemBySlug = (slug: string): MenuItemConfig | undefined =>
  MENU_ITEMS.find((item) => item.slug === slug);
