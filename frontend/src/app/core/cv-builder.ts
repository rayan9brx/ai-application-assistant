import { TRAILING_YEAR, mergeSkillLines } from './classic-cv';
import { CvTemplateId, DEFAULT_TEMPLATE, isTemplateId, parseCv } from './cv-templates';

/**
 * The CV Builder's structured CV, saved in cvs.content as { text, builder }. `text` is always
 * generated from `builder` (toCvText), so the dashboard preview, the score history, the AI
 * endpoints and the PDF export keep working on plain text.
 */
export type SectionKind =
  | 'target'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'certifications'
  | 'awards'
  | 'projects'
  | 'volunteering'
  | 'publications';

export interface BuilderEntry {
  id: string;
  title: string;
  org: string;
  location: string;
  start: string;
  end: string;
  present: boolean;
  bullets: string[];
  /** Projects only: an optional link. Projects use `start` as their single year (no org, location, end). */
  link: string;
}

export interface BuilderSection {
  kind: SectionKind;
  hidden: boolean;
  /** Target title, summary and skills are free text; the others are entries. */
  text: string;
  entries: BuilderEntry[];
}

export interface ExtraLink {
  label: string;
  url: string;
}

export const MAX_EXTRA_LINKS = 5;
/** About two lines of the Classic template's summary (11pt over the A4 width). */
export const SUMMARY_MAX = 220;

export interface BuilderContact {
  name: string;
  email: string;
  phone: string;
  location: string;
  links: string;
  /** Extra links (portfolio, website, Xing…), at most MAX_EXTRA_LINKS. */
  extraLinks: ExtraLink[];
}

export type AccentId = 'default' | 'indigo' | 'navy' | 'teal' | 'charcoal' | 'burgundy' | 'amber';
export type FontId = 'sans' | 'serif' | 'humanist';
export type SizeId = 'small' | 'medium' | 'large';
export type SpacingId = 'tight' | 'normal' | 'relaxed';

export interface BuilderDesign {
  template: CvTemplateId;
  accent: AccentId;
  font: FontId;
  fontSize: SizeId;
  spacing: SpacingId;
  dividers: boolean;
  indent: boolean;
}

export interface BuilderContent {
  version: 1;
  contact: BuilderContact;
  sections: BuilderSection[];
  design: BuilderDesign;
}

export interface SectionInfo {
  kind: SectionKind;
  label: string;
  /** The heading written into the CV text (all caps, so parseCv and the PDF see a heading). */
  heading: string;
  type: 'text' | 'entries';
  entryLabels?: { title: string; org: string };
  placeholder?: string;
}

export const SECTIONS: readonly SectionInfo[] = [
  { kind: 'target', label: 'Target Title', heading: '', type: 'text', placeholder: 'e.g. Senior Software Engineer' },
  {
    kind: 'summary',
    label: 'Professional Summary',
    heading: 'SUMMARY',
    type: 'text',
    placeholder: 'Two or three sentences about who you are and what you achieve.',
  },
  { kind: 'experience', label: 'Work Experience', heading: 'EXPERIENCE', type: 'entries', entryLabels: { title: 'Job title', org: 'Company' } },
  { kind: 'education', label: 'Education', heading: 'EDUCATION', type: 'entries', entryLabels: { title: 'Degree', org: 'School' } },
  { kind: 'projects', label: 'Projects', heading: 'PROJECTS', type: 'entries', entryLabels: { title: 'Project', org: '' } },
  {
    kind: 'skills',
    label: 'Skills & Interests',
    heading: 'SKILLS & INTERESTS',
    type: 'text',
    placeholder: 'Java, Spring Boot, TypeScript…\nLanguages: German (native), English (C1)',
  },
  {
    kind: 'certifications',
    label: 'Certificates & Further Training',
    heading: 'CERTIFICATES & FURTHER TRAINING',
    type: 'entries',
    entryLabels: { title: 'Certificate', org: 'Issuer' },
  },
  { kind: 'awards', label: 'Awards & Scholarships', heading: 'AWARDS & SCHOLARSHIPS', type: 'entries', entryLabels: { title: 'Award', org: 'Awarded by' } },
  { kind: 'volunteering', label: 'Volunteering & Leadership', heading: 'VOLUNTEERING & LEADERSHIP', type: 'entries', entryLabels: { title: 'Role', org: 'Organisation' } },
  { kind: 'publications', label: 'Publications', heading: 'PUBLICATIONS', type: 'entries', entryLabels: { title: 'Title', org: 'Publisher' } },
];

export const sectionInfo = (kind: SectionKind): SectionInfo => SECTIONS.find((s) => s.kind === kind)!;

/** Accent colors are existing tokens; the CV sheet is always light, so they resolve light there. */
export const ACCENTS: readonly { id: AccentId; label: string; token: string }[] = [
  { id: 'default', label: 'Template default', token: '' },
  { id: 'indigo', label: 'Indigo', token: 'var(--primary-600)' },
  { id: 'navy', label: 'Navy', token: 'var(--primary-900)' },
  { id: 'teal', label: 'Teal', token: 'var(--success-text)' },
  { id: 'charcoal', label: 'Charcoal', token: 'var(--text)' },
  { id: 'burgundy', label: 'Burgundy', token: 'var(--danger-text)' },
  { id: 'amber', label: 'Amber', token: 'var(--warning-text)' },
];
export const FONTS: readonly { id: FontId; label: string; stack: string }[] = [
  { id: 'sans', label: 'Sans', stack: 'var(--font)' },
  { id: 'serif', label: 'Serif', stack: "Georgia, 'Times New Roman', serif" },
  { id: 'humanist', label: 'Humanist', stack: "Calibri, Candara, 'Segoe UI', Optima, Arial, sans-serif" },
];
export const SIZES: Record<SizeId, number> = { small: 0.92, medium: 1, large: 1.08 };
export const SPACINGS: Record<SpacingId, number> = { tight: 0.7, normal: 1, relaxed: 1.4 };

export const DEFAULT_DESIGN: BuilderDesign = {
  template: DEFAULT_TEMPLATE,
  accent: 'default',
  font: 'sans',
  fontSize: 'medium',
  spacing: 'normal',
  dividers: true,
  indent: false,
};

let counter = 0;
export const newId = (): string => `e${Date.now().toString(36)}${(counter++).toString(36)}`;

export const emptyEntry = (): BuilderEntry => ({
  id: newId(),
  title: '',
  org: '',
  location: '',
  start: '',
  end: '',
  present: false,
  bullets: [''],
  link: '',
});

/** The single year of a project: the end year, else the start year (Present → the start year). */
export function projectYear(entry: Pick<BuilderEntry, 'start' | 'end' | 'present'>): string {
  const year = (value: string) => value.match(/\b(19|20)\d{2}\b/g)?.pop() ?? '';
  return (!entry.present && year(entry.end)) || year(entry.start) || entry.start.trim();
}

/** Projects keep only title, one year (in `start`), link and bullets. */
function asProject(entry: BuilderEntry): BuilderEntry {
  return { ...entry, org: '', location: '', start: projectYear(entry), end: '', present: false };
}

export function emptyContent(template: CvTemplateId = DEFAULT_TEMPLATE): BuilderContent {
  return {
    version: 1,
    contact: { name: '', email: '', phone: '', location: '', links: '', extraLinks: [] },
    sections: SECTIONS.map((s) => ({ kind: s.kind, hidden: false, text: '', entries: [] })),
    design: { ...DEFAULT_DESIGN, template },
  };
}

/** Accepts saved builder JSON, filling anything missing or malformed with defaults. */
export function normalizeContent(raw: unknown, template: CvTemplateId): BuilderContent | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<BuilderContent>;
  const base = emptyContent(template);
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const contact = (value.contact ?? {}) as Partial<BuilderContact>;
  base.contact = {
    name: str(contact.name),
    email: str(contact.email),
    phone: str(contact.phone),
    location: str(contact.location),
    links: str(contact.links),
    extraLinks: (Array.isArray(contact.extraLinks) ? contact.extraLinks : [])
      .map((link) => ({ label: str(link?.label), url: str(link?.url) }))
      .slice(0, MAX_EXTRA_LINKS),
  };
  const saved = Array.isArray(value.sections) ? value.sections : [];
  const known = saved.filter((s) => SECTIONS.some((info) => info.kind === s?.kind));
  const order = [...known.map((s) => s.kind), ...SECTIONS.map((s) => s.kind)].filter(
    (kind, i, all) => all.indexOf(kind) === i,
  );
  base.sections = order.map((kind) => {
    const s = known.find((item) => item.kind === kind);
    return {
      kind,
      hidden: !!s?.hidden,
      text: str(s?.text),
      entries: (Array.isArray(s?.entries) ? s.entries : []).map((e) => {
        const entry: BuilderEntry = {
          id: str(e?.id) || newId(),
          title: str(e?.title),
          org: str(e?.org),
          location: str(e?.location),
          start: str(e?.start),
          end: str(e?.end),
          present: !!e?.present,
          bullets: Array.isArray(e?.bullets) ? e.bullets.map(str) : [],
          link: str(e?.link),
        };
        // Migration: older projects had context, location and a date range.
        return kind === 'projects' ? asProject(entry) : entry;
      }),
    };
  });
  const d = (value.design ?? {}) as Partial<BuilderDesign>;
  const pick = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
    options.includes(v as T) ? (v as T) : fallback;
  base.design = {
    template: isTemplateId(d.template) ? d.template : template,
    accent: pick(d.accent, ACCENTS.map((a) => a.id), DEFAULT_DESIGN.accent),
    font: pick(d.font, FONTS.map((f) => f.id), DEFAULT_DESIGN.font),
    fontSize: pick(d.fontSize, Object.keys(SIZES) as SizeId[], DEFAULT_DESIGN.fontSize),
    spacing: pick(d.spacing, Object.keys(SPACINGS) as SpacingId[], DEFAULT_DESIGN.spacing),
    dividers: d.dividers ?? DEFAULT_DESIGN.dividers,
    indent: d.indent ?? DEFAULT_DESIGN.indent,
  };
  return base;
}

/* Structured → text, in the format parseCv (and the backend's PDF export) reads. */

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

/**
 * Joins single line breaks (e.g. from text pasted out of a PDF) into spaces and keeps a paragraph
 * break only where there is an empty line. Hyphens stay: "AI-\npowered" becomes "AI-powered".
 */
export function joinLineBreaks(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n\s*/)
    .map((paragraph) =>
      paragraph
        .replace(/(\p{L})-[ \t]*\n[ \t]*(?=\p{L})/gu, '$1-')
        .replace(/[ \t]*\n[ \t]*/g, ' ')
        .replace(/[ \t]{2,}/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .join('\n\n');
}

/** One line per skill group: groups with the same label are merged, repeated items dropped. */
export const mergeSkills = (text: string): string => mergeSkillLines(text.split('\n')).join('\n');

/** Multi-line fields whose single line breaks are joined; skills keep one line per group. */
export const JOINS_LINES: ReadonlySet<SectionKind> = new Set(['summary']);

/**
 * The same line-break cleanup as on paste, for content already saved: summaries and bullets get
 * their single line breaks joined (hyphens kept). Returns the content unchanged when there is none.
 */
export function cleanLineBreaks(content: BuilderContent): BuilderContent {
  let changed = false;
  const sections = content.sections.map((section) => {
    let text = section.text;
    if (JOINS_LINES.has(section.kind) && text.includes('\n') && joinLineBreaks(text) !== text.trim()) {
      text = joinLineBreaks(text);
      changed = true;
    }
    if (section.kind === 'skills' && mergeSkills(text) !== text) {
      text = mergeSkills(text);
      changed = true;
    }
    const entries = section.entries.map((entry) => {
      if (!entry.bullets.some((b) => b.includes('\n'))) return entry;
      changed = true;
      return { ...entry, bullets: entry.bullets.map((b) => joinLineBreaks(b).replace(/\n+/g, ' ')) };
    });
    return { ...section, text, entries };
  });
  return changed ? { ...content, sections } : content;
}

export function dateRange(entry: BuilderEntry): string {
  const end = entry.present ? 'Present' : clean(entry.end);
  const start = clean(entry.start);
  return start && end ? `${start} – ${end}` : start || end;
}

export function toCvText(content: BuilderContent): string {
  const lines: string[] = [];
  const { contact } = content;
  const visible = content.sections.filter((s) => !s.hidden);
  const target = visible.find((s) => s.kind === 'target');
  lines.push(clean(contact.name) || 'Your Name');
  if (target && clean(target.text)) lines.push(clean(target.text));
  // Extra links go in as "Label: url"; the Classic template shows the label as the link.
  const extra = contact.extraLinks
    .filter((link) => clean(link.url))
    .map((link) => {
      const label = clean(link.label).replace(/:/g, '');
      return label ? `${label}: ${clean(link.url)}` : clean(link.url);
    });
  const contactLine = [contact.email, contact.phone, contact.location, ...contact.links.split(/[,\n]/), ...extra]
    .map(clean)
    .filter(Boolean)
    .join(' · ');
  if (contactLine) lines.push(contactLine);

  for (const section of visible) {
    const info = sectionInfo(section.kind);
    if (section.kind === 'target') continue;
    const body: string[] = [];
    if (info.type === 'text') {
      const text = JOINS_LINES.has(section.kind)
        ? joinLineBreaks(section.text)
        : section.kind === 'skills'
          ? mergeSkills(section.text)
          : section.text;
      body.push(...text.split('\n').map((line) => line.trimEnd()).filter((line) => line.trim()));
    } else {
      section.entries.forEach((entry, i) => {
        const project = section.kind === 'projects';
        // A project: "Title | stack · link   2024" (bold title left, the year right).
        const head = project
          ? [clean(entry.title), clean(entry.link)].filter(Boolean).join(' · ')
          : [clean(entry.title), clean(entry.org), clean(entry.location)].filter(Boolean).join(', ');
        const dates = project ? projectYear(entry) : dateRange(entry);
        // Two or more spaces before the dates make parseCv draw them right-aligned.
        if (head && dates && /\d/.test(dates)) body.push(`${head}   ${dates}`);
        else if (head || dates) body.push([head, dates].filter(Boolean).join(', '));
        body.push(...entry.bullets.map((b) => clean(joinLineBreaks(b))).filter(Boolean).map((b) => `- ${b}`));
        if (i < section.entries.length - 1) body.push('');
      });
    }
    while (body.length && !body[body.length - 1].trim()) body.pop();
    if (!body.length) continue;
    lines.push('', info.heading, ...body);
  }
  return lines.join('\n');
}

/* Text → structured, to prefill the builder from an uploaded (or checked) CV. */

const HEADING_KINDS: [RegExp, SectionKind][] = [
  [/volunteer|leadership|ehrenamt/i, 'volunteering'],
  [/summary|profile|about|zusammenfassung|profil/i, 'summary'],
  [/experience|employment|work|career|berufserfahrung|erfahrung/i, 'experience'],
  [/education|ausbildung|bildung|studies/i, 'education'],
  [/certif|zertifikat|licen|training|weiterbildung|fortbildung|course|kurse/i, 'certifications'],
  [/award|scholarship|honou?r|auszeichnung/i, 'awards'],
  [/project|projekt/i, 'projects'],
  [/publication|publikation/i, 'publications'],
  [/skill|interest|language|kenntnisse|fähigkeiten|kompetenzen|sprachen|interessen|tools|technolog/i, 'skills'],
];

/** The builder section a CV heading (or an analysis issue's section name) belongs to. */
export function kindForHeading(heading: string): SectionKind | null {
  if (/target|headline|title/i.test(heading)) return 'target';
  return HEADING_KINDS.find(([pattern]) => pattern.test(heading))?.[1] ?? null;
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /^\+?[\d\s()/.-]{7,}$/;
const LINK = /(https?:\/\/|www\.|linkedin\.com|github\.com|\.\w{2,}\/)/i;

function splitDates(dates: string): Pick<BuilderEntry, 'start' | 'end' | 'present'> {
  const [start, end = ''] = dates.split(/\s+[–—-]\s+|\s+to\s+|\s+bis\s+/i).map((part) => part.trim());
  const present = /present|now|current|heute|today|jetzt/i.test(end);
  return { start, end: present ? '' : end, present };
}

function splitTitle(line: string): Pick<BuilderEntry, 'title' | 'org' | 'location'> {
  const parts = line.split(/,\s+|\s+[|·]\s+|\s+at\s+|\s+@\s+/).map((part) => part.trim()).filter(Boolean);
  return { title: parts[0] ?? '', org: parts[1] ?? '', location: parts.slice(2).join(', ') };
}

/** A parsed project line: a link in it moves to `link`, the dates become one year. */
function project(title: string, dates: string): BuilderEntry {
  const link = title.match(/(https?:\/\/\S+|www\.\S+|(github\.com|gitlab\.com)\/\S+)/i)?.[0] ?? '';
  const rest = title
    .replace(link, ' ')
    .replace(/\s*[·•]\s*[·•]\s*/g, ' · ')
    .replace(/^\s*[·|•]\s*|\s*[·|•]\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return asProject({ ...emptyEntry(), title: rest, link, ...splitDates(dates), bullets: [] });
}

export function fromCvText(text: string, template: CvTemplateId): BuilderContent {
  const content = emptyContent(template);
  const parsed = parseCv(text);
  const section = (kind: SectionKind) => content.sections.find((s) => s.kind === kind)!;
  const append = (kind: SectionKind, line: string) => {
    const s = section(kind);
    s.text = s.text ? `${s.text}\n${line}` : line;
  };

  content.contact.name = parsed.name;
  const links: string[] = [];
  for (const line of parsed.contact) {
    const parts = line.split(/\s+[·|•]\s+|\s{2,}|\s+\|\s+/).map((p) => p.trim()).filter(Boolean);
    const isContact = parts.some((p) => EMAIL.test(p) || PHONE.test(p) || LINK.test(p));
    if (!isContact) {
      // A second non-contact line is text, not a title: keep it (it starts the summary).
      if (!section('target').text) section('target').text = line;
      else append('summary', line);
      continue;
    }
    for (const part of parts) {
      if (EMAIL.test(part) && !content.contact.email) content.contact.email = part;
      else if (PHONE.test(part) && !content.contact.phone) content.contact.phone = part;
      else if (LINK.test(part)) links.push(part);
      else if (!content.contact.location) content.contact.location = part;
      else links.push(part);
    }
  }
  content.contact.links = links.join(', ');

  let current: SectionKind = 'summary';
  let entry: BuilderEntry | null = null;
  /** "Languages", "Interests"… go into Skills & Interests, keeping their name on the first line. */
  let label = '';
  const entries = () => section(current).entries;
  for (const block of parsed.blocks) {
    if (block.kind === 'gap') continue;
    if (block.kind === 'heading') {
      current = kindForHeading(block.text) ?? 'skills';
      entry = null;
      label = current === 'skills' && !/skill|kenntnisse/i.test(block.text)
        ? `${block.text[0]}${block.text.slice(1).toLowerCase()}: `
        : '';
      continue;
    }
    if (sectionInfo(current).type === 'text') {
      append(current, label + (block.kind === 'entry' ? `${block.title} ${block.dates}` : block.text));
      label = '';
      continue;
    }
    if (current === 'projects' && block.kind !== 'bullet') {
      // Projects: the whole line is the title (stack included), one year, a link if there is one.
      const year = block.kind === 'entry' ? null : TRAILING_YEAR.exec(block.text);
      if (block.kind === 'text' && !year && entry && !entry.bullets.length) {
        entry.bullets.push(block.text);
        continue;
      }
      entry = project(block.kind === 'entry' ? block.title : year ? year[1] : block.text, block.kind === 'entry' ? block.dates : year?.[2] ?? '');
      entries().push(entry);
    } else if (block.kind === 'entry') {
      entry = { ...emptyEntry(), ...splitTitle(block.title), ...splitDates(block.dates), bullets: [] };
      entries().push(entry);
    } else if (block.kind === 'text') {
      if (entry && !entry.bullets.length && !entry.org) entry.org = block.text;
      else {
        entry = { ...emptyEntry(), ...splitTitle(block.text), bullets: [] };
        entries().push(entry);
      }
    } else {
      if (!entry) {
        entry = { ...emptyEntry(), bullets: [] };
        entries().push(entry);
      }
      entry.bullets.push(block.text);
    }
  }
  section('summary').text = joinLineBreaks(section('summary').text);
  section('skills').text = mergeSkills(section('skills').text);
  return content;
}

/** Replaces the first occurrence of `original` in any text field; false when it isn't found. */
export function replaceInContent(content: BuilderContent, original: string, replacement: string): boolean {
  const strip = (value: string) => value.replace(/^\s*[-•*–▪●]\s+/gm, '').trim();
  const needles = [original.trim(), strip(original)].filter(Boolean);
  const value = strip(replacement);
  for (const needle of needles) {
    for (const section of content.sections) {
      if (section.text.includes(needle)) {
        section.text = section.text.replace(needle, needle === original.trim() ? replacement.trim() : value);
        return true;
      }
      for (const entry of section.entries) {
        const i = entry.bullets.findIndex((b) => b.includes(needle));
        if (i >= 0) {
          entry.bullets[i] = entry.bullets[i].replace(needle, value);
          return true;
        }
        if (entry.title.includes(needle)) {
          entry.title = entry.title.replace(needle, value);
          return true;
        }
      }
    }
  }
  return false;
}
