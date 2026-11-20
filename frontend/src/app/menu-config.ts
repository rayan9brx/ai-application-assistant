/**
 * Single source of truth for the "Services" menu, the mobile accordion and the /tools page.
 * Add, edit or remove items here. Items whose href is under /tools/ show a "Coming soon"
 * page until the tool exists; point href somewhere else once it is built.
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
}

export const MENU_COLUMNS: readonly MenuColumn[] = [
  { id: 'cv', label: 'CV Tools' },
  { id: 'additional', label: 'Additional Tools' },
];

const tool = (
  slug: string,
  title: string,
  description: string,
  column: MenuColumnId,
  badge?: string,
): MenuItemConfig => ({ slug, title, description, href: `/tools/${slug}`, column, badge });

export const MENU_ITEMS: readonly MenuItemConfig[] = [
  tool('ai-cv-builder', 'AI CV Builder', 'Smart CV creation', 'cv'),
  tool('ai-cv-agent', 'AI CV Agent', 'Our new AI CV experience', 'cv'),
  tool('cv-checker', 'CV Checker', 'Get instant feedback', 'cv'),
  tool('cv-keyword-scanner', 'CV Keyword Scanner', 'Target your application', 'cv'),
  tool('cv-bullet-point-writer', 'CV Bullet Point Writer', 'Stronger CV content', 'cv'),
  tool('cv-summary-generator', 'CV Summary Generator', 'Create a CV summary', 'cv'),
  tool(
    'cover-letter-generator',
    'Cover Letter Generator',
    'Personalized cover letters',
    'additional',
  ),
  tool(
    'resignation-letter-generator',
    'Resignation Letter Generator',
    'Leave on good terms',
    'additional',
  ),
  tool('job-search', 'Job Search', 'Discover new opportunities', 'additional', 'New'),
  tool('ai-interview', 'AI Interview', 'Practice your answers', 'additional'),
];

export const TOOLS_HREF = '/tools';

export const itemsIn = (column: MenuColumnId): MenuItemConfig[] =>
  MENU_ITEMS.filter((item) => item.column === column);

export const itemBySlug = (slug: string): MenuItemConfig | undefined =>
  MENU_ITEMS.find((item) => item.slug === slug);
