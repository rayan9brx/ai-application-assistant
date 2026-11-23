/**
 * The logged-in app's sidebar. Items marked soon open their Coming Soon page (/tools/<slug>,
 * whose texts live in menu-config.ts) and get a "Soon" badge.
 */
export interface AppNavItem {
  label: string;
  href: string;
  /** An SVG path (24×24 viewBox, stroked). */
  icon: string;
  soon?: boolean;
}

export const APP_NAV: readonly AppNavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z' },
  { label: 'CV Checker', href: '/check', icon: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13l2 2 4-4' },
  { label: 'Tailor to Job', href: '/check?focus=job', icon: 'M12 3a9 9 0 1 0 9 9M12 8a4 4 0 1 0 4 4M12 12l8-8M16 4h4v4' },
  { label: 'AI Fixes', href: '/check?focus=fixes', icon: 'M5 19l9-9M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 11l.7 1.3L21 13l-1.3.7L19 15l-.7-1.3L17 13l1.3-.7z' },
  { label: 'Job Search', href: '/tools/job-search', soon: true, icon: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16' },
  { label: 'Cover Letters', href: '/tools/cover-letter-generator', soon: true, icon: 'M4 6h16v12H4zM4 7l8 6 8-6' },
  { label: 'AI Interview', href: '/tools/ai-interview', soon: true, icon: 'M5 5h14v10H9l-4 4zM9 9h6M9 12h4' },
];

/** Whether a sidebar item is the current page; /check items also compare the ?focus= query. */
export function isActive(item: AppNavItem, path: string, search: string): boolean {
  const url = new URL(item.href, location.origin);
  if (url.pathname !== path) return false;
  const focus = new URLSearchParams(search).get('focus');
  return (url.searchParams.get('focus') ?? null) === focus;
}
