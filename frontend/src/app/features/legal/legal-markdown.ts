/**
 * A small Markdown renderer for the legal texts in public/legal/*.{en,de}.md: headings, paragraphs (single
 * line breaks are kept, for addresses), lists, **bold**, *italic*, [links](https://…) and bare
 * URLs and email addresses. All text is HTML-escaped first and only http(s), mailto, tel and
 * same-site links are kept. Text that is already HTML (some generators export HTML) is passed
 * through as is; Angular's [innerHTML] sanitizer then removes anything unsafe.
 */
export interface LegalDocument {
  /** The "Last updated: …" (English) or "Stand: …" (German) line, shown at the top of the page. */
  updated: string | null;
  html: string;
}

const HTML_BLOCK = /<(p|h[1-6]|ul|ol|li|div|br|strong|table)\b/i;

export function renderLegal(source: string): LegalDocument {
  let text = source.replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  let updated: string | null = null;
  // "Last updated: …" / "Stand: …", also when written in italics or bold (*…*, **…**, _…_).
  text = text.replace(/^[ \t]*[*_]*((?:Last updated|Stand):[ \t]*[^*_\n]*[^*_\s])[*_]*[ \t]*$/im, (_, line: string) => {
    updated = line.trim();
    return '';
  });
  // The page shows its own title, so a leading "# Title" in the file is dropped.
  text = text.replace(/^\s*#[ \t]+[^\n]*\n/, '');
  if (HTML_BLOCK.test(text)) return { updated, html: text.trim() };

  const html: string[] = [];
  for (const block of text.split(/\n[ \t]*\n/)) {
    const lines = block.split('\n').map((line) => line.trimEnd()).filter((line) => line.trim());
    renderLines(lines, html);
  }
  return { updated, html: html.join('\n') };
}

type LineKind = 'heading' | 'ul' | 'ol' | 'quote' | 'text';

function kind(line: string): LineKind {
  if (/^\s*#{1,6}\s+/.test(line)) return 'heading';
  if (/^\s*[-*•]\s+/.test(line)) return 'ul';
  if (/^\s*\d+[.)]\s+/.test(line)) return 'ol';
  if (/^\s*>/.test(line)) return 'quote';
  return 'text';
}

/** One block can mix a heading, text lines and list items without blank lines between them. */
function renderLines(lines: string[], html: string[]): void {
  let i = 0;
  while (i < lines.length) {
    const type = kind(lines[i]);
    if (type === 'heading') {
      const [, hashes, title] = /^\s*(#{1,6})\s+(.*)$/.exec(lines[i])!;
      const level = Math.min(4, Math.max(2, hashes.length));
      html.push(`<h${level}>${inline(title)}</h${level}>`);
      i++;
      continue;
    }
    const run: string[] = [];
    while (i < lines.length && kind(lines[i]) === type) run.push(lines[i++]);
    if (type === 'ul') {
      html.push(`<ul>${run.map((line) => `<li>${inline(line.replace(/^\s*[-*•]\s+/, ''))}</li>`).join('')}</ul>`);
    } else if (type === 'ol') {
      html.push(`<ol>${run.map((line) => `<li>${inline(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`);
    } else if (type === 'quote') {
      html.push(`<blockquote>${paragraph(run.map((line) => line.replace(/^\s*>\s?/, '')).filter((l) => l.trim()))}</blockquote>`);
    } else {
      html.push(paragraph(run));
    }
  }
}

function paragraph(lines: string[]): string {
  return `<p>${lines.map((line) => inline(line.trim())).join('<br>')}</p>`;
}

function inline(text: string): string {
  const links: string[] = [];
  // Pull out [text](url) first so the URL isn't escaped or auto-linked twice.
  let out = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, url: string) => {
    const href = safeUrl(url);
    if (!href) return match;
    links.push(`<a href="${escape(href)}"${external(href)}>${escape(label)}</a>`);
    return `\u0000${links.length - 1}\u0000`;
  });
  out = escape(out)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>')
    .replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (url) => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`)
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, (email) => `<a href="mailto:${email}">${email}</a>`);
  return out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => links[Number(i)]);
}

function safeUrl(url: string): string | null {
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  return null;
}

function external(href: string): string {
  return /^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : '';
}

function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
