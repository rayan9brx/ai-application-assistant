/**
 * The "Classic" template's reading of a CV text, the same rules as ClassicCvRenderer on the
 * backend: name, target title, one contact line with icons, the summary right below the header,
 * then sections. CvSheet draws the result for the preview.
 */
export type ContactKind = 'location' | 'email' | 'phone' | 'linkedin' | 'github' | 'link';

export interface Run {
  text: string;
  bold?: boolean;
  href?: string;
}

export interface ContactItem {
  kind: ContactKind;
  text: string;
  /** The text without "https://", "www." and a trailing slash, used when the line is too long. */
  short: string;
  href?: string;
}

export type ClassicBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'bullet'; runs: Run[] }
  | { kind: 'entry'; title: Run[]; dates: string; plain: boolean; spaced: boolean }
  | { kind: 'text'; runs: Run[] }
  | { kind: 'gap' };

export interface ClassicCv {
  name: string;
  title: string;
  contact: ContactItem[];
  /** Paragraphs of the summary, shown justified right below the header. */
  summary: Run[][];
  blocks: ClassicBlock[];
}

const SECTION =
  /^(professional |work |career )?(summary|profile|about me|experience|employment|employment history|work history|education|skills|technical skills|key skills|skills & interests|projects|certifications|certificates|languages|interests|awards|awards & scholarships|volunteering|volunteering & leadership|publications|references|zusammenfassung|profil|kurzprofil|berufserfahrung|erfahrung|praxiserfahrung|ausbildung|bildung|kenntnisse|fähigkeiten|kompetenzen|projekte|sprachen|zertifikate|interessen)\s*:?$/i;
const SUMMARY = /^(professional |career )?(summary|profile|about me|zusammenfassung|profil|kurzprofil)$/i;
/**
 * Headings that aren't in SECTION or in capitals: up to two words before a section word, then
 * optionally "& …" ("Selected Projects", "Certificates & Further Training").
 */
const LOOSE_SECTION =
  /^(?:[\p{L}-]+ ){0,2}(summary|profile|experience|employment|education|studies|skills|competencies|expertise|projects|certifications|certificates|further training|trainings|courses|languages|interests|awards|scholarships|honou?rs|volunteering|leadership|publications|references|zusammenfassung|profil|kurzprofil|berufserfahrung|erfahrung|praxiserfahrung|ausbildung|bildung|studium|kenntnisse|fähigkeiten|kompetenzen|projekte|sprachen|zertifikate|weiterbildungen?|fortbildungen?|interessen|ehrenamt)(?: ?(?:&|and|und|\/) ?[^\d,@]{1,30})?:?$/iu;
const SKILLS = /skill|kenntnisse|fähigkeit|kompetenz|languages|sprachen|interest|interessen/i;
export const CERTIFICATES = /certif|zertifikat|training|weiterbildung|fortbildung|course|kurse/i;
const BULLET = /^\s*[-•*–▪●]\s+/;
const ENTRY = /^(.*\S)\s{2,}(\S.{0,34})$/;
/** Projects sections: a year after a single space is read as the right-aligned year too. */
export const PROJECTS = /project|projekt/i;
/** A certificate (or project) line whose year (or date range) ends it with a single space before it. */
export const TRAILING_YEAR =
  /^(.*\S)\s+\(?((?:(?:\d{1,2}[./]\s?|[A-Za-zäöü]{3,9}\.? )?(?:19|20)\d{2})(?:\s*[–-]\s*(?:(?:\d{1,2}[./]\s?|[A-Za-zäöü]{3,9}\.? )?(?:19|20)\d{2}|present|heute|now))?)\)?$/i;
const LABEL = /^([^:]{1,40}):\s+(\S.*)$/;
/** A long sentence-like line: the summary, never part of the header. */
export const isProse = (line: string) =>
  line.length > 60 && !/@|https?:|www\.|linkedin|github|\s[·|•]\s/i.test(line);
const SEPARATOR = /\s+[·|•]\s+/;
const EMAIL = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/;
const PHONE = /^\+?[\d\s()/.-]{6,}$/;
const URL = /(https?:\/\/\S+|www\.\S+|(linkedin\.com|github\.com|gitlab\.com|xing\.com)\/\S*|[\w.+-]+@[\w-]+(\.[\w-]+)+)/gi;
const ORDER: ContactKind[] = ['location', 'email', 'phone', 'linkedin', 'github', 'link'];

export function isHeading(line: string): boolean {
  if (line.length > 40 || line.endsWith('.')) return false;
  if (SECTION.test(line)) return true;
  if (/^\p{Lu}/u.test(line) && LOOSE_SECTION.test(line)) return true;
  return /\p{L}/u.test(line) && line.length >= 4 && line === line.toUpperCase();
}

/** Splits "a, b (x, y); c · d" into items, never inside parentheses. */
function skillItems(text: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    const middot = (ch === '·' || ch === '•' || ch === '|') && text[i - 1] === ' ';
    if (depth === 0 && (ch === ',' || ch === ';' || middot)) {
      items.push(current.trim());
      current = '';
    } else current += ch;
  }
  items.push(current.trim());
  return items.filter(Boolean);
}

/**
 * Merges skill groups with the same label ("AI & LLM: …" twice) into the first one and drops
 * repeated items in each group. Lines that need no change stay exactly as they are.
 */
export function mergeSkillLines(lines: string[]): string[] {
  const out: (string | null)[] = [];
  const groups = new Map<string, { index: number; prefix: string; label: string; items: string[]; changed: boolean }>();
  for (const line of lines) {
    const prefix = BULLET.exec(line)?.[0] ?? '';
    const label = LABEL.exec(line.slice(prefix.length).trim());
    if (!label) {
      out.push(line);
      continue;
    }
    const key = label[1].trim().toLowerCase().replace(/\s+/g, ' ');
    const group = groups.get(key) ?? { index: out.length, prefix, label: label[1].trim(), items: [], changed: false };
    if (!groups.has(key)) {
      groups.set(key, group);
      out.push(line);
    } else {
      group.changed = true;
      out.push(null);
    }
    for (const item of skillItems(label[2])) {
      if (group.items.some((known) => known.toLowerCase() === item.toLowerCase())) group.changed = true;
      else group.items.push(item);
    }
  }
  for (const group of groups.values()) {
    if (group.changed) out[group.index] = `${group.prefix}${group.label}: ${group.items.join(', ')}`;
  }
  return out.filter((line): line is string => line !== null);
}

/** mergeSkillLines for every skills section of a CV text's lines. */
function mergeSkillSections(lines: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    out.push(lines[i++]);
    if (!line || !isHeading(line) || !SKILLS.test(line)) continue;
    const start = i;
    while (i < lines.length && !(lines[i].trim() && isHeading(lines[i].trim()))) i++;
    out.push(...mergeSkillLines(lines.slice(start, i)));
  }
  return out;
}

/** Joins a summary's wrapped lines into paragraphs: an empty line or a bullet starts a new one. */
function summaryParagraphs(lines: string[]): string[] {
  const paragraphs: string[] = [];
  let current = '';
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || BULLET.test(raw)) {
      if (current) paragraphs.push(current);
      current = '';
      if (line) paragraphs.push(line.replace(BULLET, ''));
      continue;
    }
    current = !current ? line : /\p{L}-$/u.test(current) ? current + line : `${current} ${line}`;
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}

export function contactKind(item: string): ContactKind {
  const lower = item.toLowerCase();
  if (EMAIL.test(item)) return 'email';
  if (lower.includes('linkedin.')) return 'linkedin';
  if (lower.includes('github.')) return 'github';
  if (lower.startsWith('http') || lower.startsWith('www.') || /^[\w-]+(\.[\w-]+)+\/\S*$/.test(lower)) return 'link';
  if (PHONE.test(item) && (item.match(/\d/g)?.length ?? 0) >= 6) return 'phone';
  return 'location';
}

/** "Portfolio: rayen.dev" from the builder's extra links: the label shows, the URL is the target. */
const LABELED_LINK = /^([^:]{1,30}):\s+(\S+\.\S+)$/;

export function contactItem(item: string): ContactItem {
  const labeled = LABELED_LINK.exec(item);
  if (labeled && !/^(https?|www.*)$/i.test(labeled[1])) {
    let kind = contactKind(labeled[2]);
    if (kind === 'location' || kind === 'phone') kind = 'link';
    return { kind, text: labeled[1].trim(), short: labeled[1].trim(), href: href(labeled[2]) };
  }
  const kind = contactKind(item);
  const link = kind !== 'location' && kind !== 'phone';
  return { kind, text: item, short: link ? shortLink(item) : item, href: link ? href(item) : undefined };
}

/** "https://www.linkedin.com/in/rayen/" → "linkedin.com/in/rayen". */
export const shortLink = (link: string) =>
  link.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');

const isContactLine = (line: string) => line.split(SEPARATOR).some((item) => contactItem(item.trim()).kind !== 'location');

export function href(link: string): string {
  const value = link.replace(/[.,;:)]+$/, '');
  if (EMAIL.test(value)) return `mailto:${value}`;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/** Splits text into runs, with links (URLs and emails) as their own runs. */
export function runs(text: string, bold = false): Run[] {
  const result: Run[] = [];
  let at = 0;
  for (const match of text.matchAll(URL)) {
    const link = match[0].replace(/[.,;:)]+$/, '');
    const start = match.index ?? 0;
    if (start > at) result.push({ text: text.slice(at, start), bold });
    result.push({ text: link, bold, href: href(link) });
    at = start + link.length;
  }
  if (at < text.length) result.push({ text: text.slice(at), bold });
  return result;
}

export function parseClassic(text: string): ClassicCv {
  const lines = mergeSkillSections(text.replace(/\t/g, '    ').split(/\r\n?|\n/));
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  const name = i < lines.length ? lines[i++].trim() : '';
  let title = '';
  const items: string[] = [];
  // The header ends at the first prose line: that is the summary, which must never be cut.
  for (let n = 0; n < 3 && i < lines.length && lines[i].trim() && !isHeading(lines[i].trim()) && !isProse(lines[i].trim()); n++, i++) {
    const line = lines[i].trim();
    if (!title && !items.length && !isContactLine(line)) title = line;
    else items.push(...line.split(SEPARATOR).map((item) => item.trim()).filter(Boolean));
  }
  const contact = items
    .map(contactItem)
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

  // A summary (with its heading, or the text before the first heading) goes right below the
  // header, without a heading; its wrapped lines are joined so it is justified as one paragraph.
  while (i < lines.length && !lines[i].trim()) i++;
  const summaryLines: string[] = [];
  if (i < lines.length) {
    const first = lines[i].trim();
    if (SUMMARY.test(first.replace(/:$/, ''))) i++;
    if (SUMMARY.test(first.replace(/:$/, '')) || !isHeading(first)) {
      for (; i < lines.length && !isHeading(lines[i].trim()); i++) summaryLines.push(lines[i]);
    }
  }
  const summary: Run[][] = summaryParagraphs(summaryLines).map((paragraph) => runs(paragraph));

  const blocks: ClassicBlock[] = [];
  let section = '';
  let afterHeading = false;
  for (; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) {
      blocks.push({ kind: 'gap' });
      continue;
    }
    if (isHeading(line)) {
      section = line.replace(/:$/, '');
      blocks.push({ kind: 'heading', text: section });
      afterHeading = true;
      continue;
    }
    const certificates = CERTIFICATES.test(section);
    const entry = ENTRY.exec(line) ?? (certificates || PROJECTS.test(section) ? TRAILING_YEAR.exec(line) : null);
    const label = LABEL.exec(line);
    if (BULLET.test(raw)) {
      blocks.push({ kind: 'bullet', runs: runs(raw.replace(BULLET, '').trim()) });
    } else if (entry && /\d/.test(entry[2])) {
      blocks.push({
        kind: 'entry',
        title: runs(entry[1], !certificates),
        dates: entry[2],
        plain: certificates,
        spaced: !afterHeading && !certificates,
      });
    } else if (SKILLS.test(section) && label) {
      blocks.push({ kind: 'text', runs: [{ text: `${label[1]}:`, bold: true }, { text: ' ' }, ...runs(label[2])] });
    } else {
      blocks.push({ kind: 'text', runs: runs(line) });
    }
    afterHeading = false;
  }
  return { name, title, contact, summary, blocks };
}
