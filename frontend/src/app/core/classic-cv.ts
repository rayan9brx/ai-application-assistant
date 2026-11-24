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
const SKILLS = /skill|kenntnisse|fähigkeit|kompetenz|languages|sprachen|interest|interessen/i;
const CERTIFICATES = /certif|zertifikat/i;
const BULLET = /^\s*[-•*–▪●]\s+/;
const ENTRY = /^(.*\S)\s{2,}(\S.{0,34})$/;
const LABEL = /^([^:]{1,40}):\s+(\S.*)$/;
const SEPARATOR = /\s+[·|•]\s+/;
const EMAIL = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/;
const PHONE = /^\+?[\d\s()/.-]{6,}$/;
const URL = /(https?:\/\/\S+|www\.\S+|(linkedin\.com|github\.com|gitlab\.com|xing\.com)\/\S*|[\w.+-]+@[\w-]+(\.[\w-]+)+)/gi;
const ORDER: ContactKind[] = ['location', 'email', 'phone', 'linkedin', 'github', 'link'];

function isHeading(line: string): boolean {
  if (line.length > 40 || line.endsWith('.')) return false;
  if (SECTION.test(line)) return true;
  return /\p{L}/u.test(line) && line.length >= 4 && line === line.toUpperCase();
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
    return { kind, text: labeled[1].trim(), href: href(labeled[2]) };
  }
  const kind = contactKind(item);
  return { kind, text: item, href: kind === 'location' || kind === 'phone' ? undefined : href(item) };
}

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
  const lines = text.replace(/\t/g, '    ').split(/\r\n?|\n/);
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  const name = i < lines.length ? lines[i++].trim() : '';
  let title = '';
  const items: string[] = [];
  for (let n = 0; n < 3 && i < lines.length && lines[i].trim() && !isHeading(lines[i].trim()); n++, i++) {
    const line = lines[i].trim();
    if (!title && !items.length && !isContactLine(line)) title = line;
    else items.push(...line.split(SEPARATOR).map((item) => item.trim()).filter(Boolean));
  }
  const contact = items
    .map(contactItem)
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

  // A summary as the first section goes right below the header, without a heading.
  const summary: Run[][] = [];
  while (i < lines.length && !lines[i].trim()) i++;
  if (i < lines.length && SUMMARY.test(lines[i].trim().replace(/:$/, ''))) {
    for (i++; i < lines.length && !isHeading(lines[i].trim()); i++) {
      const line = lines[i].trim();
      if (line) summary.push(runs(line.replace(BULLET, '')));
    }
  }

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
    const entry = ENTRY.exec(line);
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
