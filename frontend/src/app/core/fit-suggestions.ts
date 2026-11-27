import { BuilderContent, BuilderEntry, BuilderSection, SectionKind, dateRange } from './cv-builder';

/**
 * What the builder suggests cutting when a CV is longer than one page, in this order: the oldest
 * certificates, the least relevant project bullets, extra skill groups, older jobs. Nothing is
 * removed until the user clicks "Remove" on a suggestion.
 */
export interface FitSuggestion {
  key: string;
  label: string;
  detail: string;
  remove: (content: BuilderContent) => void;
}

/** Skill groups kept before the rest are suggested as cuts. */
const KEPT_SKILL_GROUPS = 3;
/** The most recent jobs are never suggested. */
const KEPT_JOBS = 2;

const visible = (content: BuilderContent, kind: SectionKind): BuilderSection | undefined =>
  content.sections.find((s) => s.kind === kind && !s.hidden);

const sectionOf = (content: BuilderContent, kind: SectionKind) => content.sections.find((s) => s.kind === kind);

/** The latest year in an entry's dates (or title); Present counts as the newest. */
function year(entry: BuilderEntry): number {
  if (entry.present) return 9999;
  const years = `${entry.end} ${entry.start} ${entry.title}`.match(/\b(19|20)\d{2}\b/g)?.map(Number) ?? [];
  return years.length ? Math.max(...years) : 0;
}

/** How many of a text's words appear in the job ad (0 without one). */
function relevance(text: string, job: string): number {
  if (!job) return 0;
  const words = new Set(job.toLowerCase().match(/[\p{L}\d+#.]{3,}/gu) ?? []);
  return (text.toLowerCase().match(/[\p{L}\d+#.]{3,}/gu) ?? []).filter((w) => words.has(w)).length;
}

const quote = (text: string, max = 70) => `“${text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text}”`;

const removeEntry = (kind: SectionKind, id: string) => (content: BuilderContent) => {
  const section = sectionOf(content, kind);
  if (section) section.entries = section.entries.filter((e) => e.id !== id);
};

export function fitSuggestions(content: BuilderContent, job = ''): FitSuggestion[] {
  const suggestions: FitSuggestion[] = [];

  // 1. Oldest certificates first (undated ones count as oldest).
  const certificates = visible(content, 'certifications')?.entries.filter((e) => e.title.trim()) ?? [];
  for (const entry of [...certificates].sort((a, b) => year(a) - year(b))) {
    suggestions.push({
      key: `cert:${entry.id}`,
      label: `Certificate ${quote(entry.title)}`,
      detail: dateRange(entry) || 'No date',
      remove: removeEntry('certifications', entry.id),
    });
  }

  // 2. The least relevant project bullets; a project always keeps at least one bullet.
  const bullets = (visible(content, 'projects')?.entries ?? []).flatMap((entry) => {
    const filled = entry.bullets.filter((b) => b.trim());
    if (filled.length < 2) return [];
    return filled.map((text, order) => ({ entry, text, order, score: relevance(text, job) }));
  });
  bullets.sort((a, b) => a.score - b.score || b.order - a.order);
  const perEntry = new Map<string, number>();
  for (const bullet of bullets) {
    const offered = perEntry.get(bullet.entry.id) ?? 0;
    if (offered >= bullet.entry.bullets.filter((b) => b.trim()).length - 1) continue;
    perEntry.set(bullet.entry.id, offered + 1);
    suggestions.push({
      key: `bullet:${bullet.entry.id}:${bullet.text}`,
      label: `Project bullet ${quote(bullet.text)}`,
      detail: bullet.entry.title || 'Project',
      remove: (c) => {
        const entry = sectionOf(c, 'projects')?.entries.find((e) => e.id === bullet.entry.id);
        const i = entry?.bullets.indexOf(bullet.text) ?? -1;
        if (entry && i >= 0) entry.bullets.splice(i, 1);
      },
    });
  }

  // 3. Extra skill groups, the last ones first.
  const skills = visible(content, 'skills');
  const groups = (skills?.text ?? '').split('\n').filter((line) => line.trim());
  for (const line of groups.slice(KEPT_SKILL_GROUPS).reverse()) {
    const label = /^([^:]{1,40}):/.exec(line.trim())?.[1];
    suggestions.push({
      key: `skill:${line}`,
      label: label ? `Skill group “${label.trim()}”` : `Skill line ${quote(line.trim())}`,
      detail: label ? quote(line.slice(line.indexOf(':') + 1).trim(), 60) : 'Skills',
      remove: (c) => {
        const section = sectionOf(c, 'skills');
        if (!section) return;
        const lines = section.text.split('\n');
        const i = lines.indexOf(line);
        if (i >= 0) lines.splice(i, 1);
        section.text = lines.join('\n');
      },
    });
  }

  // 4. Older (and, with a job ad, less relevant) jobs; the most recent ones stay.
  const jobs = visible(content, 'experience')?.entries.filter((e) => e.title.trim() || e.org.trim()) ?? [];
  const older = [...jobs].sort((a, b) => year(b) - year(a)).slice(KEPT_JOBS);
  older.sort((a, b) => relevance(`${a.title} ${a.bullets.join(' ')}`, job) - relevance(`${b.title} ${b.bullets.join(' ')}`, job) || year(a) - year(b));
  for (const entry of older) {
    suggestions.push({
      key: `job:${entry.id}`,
      label: `Job ${quote([entry.title, entry.org].filter(Boolean).join(', '))}`,
      detail: dateRange(entry) || 'No date',
      remove: removeEntry('experience', entry.id),
    });
  }
  return suggestions;
}
