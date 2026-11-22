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
  text = text.replace(/^[ \t]*((?:Last updated|Stand):[ \t]*\S.*)$/im, (_, line: string) => {
    updated = line.trim();
    return '';
  });
  if (HTML_BLOCK.test(text)) return { updated, html: text.trim() };

  const html: string[] = [];
  for (const block of text.split(/\n[ \t]*\n/)) {
    const lines = block.split('\n').map((line) => line.trimEnd()).filter((line) => line.trim());
    if (!lines.length) continue;
    const heading = /^(#{1,6})\s+(.*)$/.exec(lines[0].trim());
    if (heading) {
      const level = Math.min(4, Math.max(2, heading[1].length));
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      if (lines.length > 1) html.push(paragraph(lines.slice(1)));
    } else if (lines.every((line) => /^\s*[-*•]\s+/.test(line))) {
      html.push(`<ul>${lines.map((line) => `<li>${inline(line.replace(/^\s*[-*•]\s+/, ''))}</li>`).join('')}</ul>`);
    } else if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
      html.push(`<ol>${lines.map((line) => `<li>${inline(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`);
    } else {
      html.push(paragraph(lines));
    }
  }
  return { updated, html: html.join('\n') };
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
