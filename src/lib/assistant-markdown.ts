// A tiny, safe markdown subset for assistant answers. Parses to a plain AST
// that the React renderer turns into elements, so raw HTML in an answer is
// shown as text and never injected. Supported: # / ## / ### headings,
// paragraphs, - / * / 1. lists, ``` code blocks, simple | tables |, ---,
// **bold**, *italic* / _italic_, `code`, [links](https://…) (http(s), mailto
// and app-relative "/…" only).

export type MdInline =
  | { t: "text"; v: string }
  | { t: "strong"; c: MdInline[] }
  | { t: "em"; c: MdInline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: MdInline[] }
  | { t: "br" };

export type MdBlock =
  | { type: "h"; level: 1 | 2 | 3; c: MdInline[] }
  | { type: "p"; c: MdInline[] }
  | { type: "ul" | "ol"; items: MdInline[][] }
  | { type: "code"; text: string }
  | { type: "table"; head: MdInline[][]; rows: MdInline[][][] }
  | { type: "hr" };

export function safeHref(url: string): string | null {
  const u = url.trim();
  if (/^https?:\/\/[^\s]+$/i.test(u) || /^mailto:[^\s]+$/i.test(u)) return u;
  if (/^\/(?!\/)[^\s]*$/.test(u)) return u;
  return null;
}

export function parseInline(src: string): MdInline[] {
  const out: MdInline[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push({ t: "text", v: buf });
    buf = "";
  };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpExecArray | null;
    if (rest.startsWith("  \n") || rest.startsWith("\\\n")) {
      flush();
      out.push({ t: "br" });
      i += rest[0] === "\\" ? 2 : 3;
      continue;
    }
    if ((m = /^`([^`]+)`/.exec(rest))) {
      flush();
      out.push({ t: "code", v: m[1] });
      i += m[0].length;
      continue;
    }
    if ((m = /^\*\*([\s\S]+?)\*\*/.exec(rest)) || (m = /^__([\s\S]+?)__/.exec(rest))) {
      flush();
      out.push({ t: "strong", c: parseInline(m[1]) });
      i += m[0].length;
      continue;
    }
    if ((m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest))) {
      const href = safeHref(m[2]);
      flush();
      if (href) out.push({ t: "link", href, c: parseInline(m[1]) });
      else out.push(...parseInline(m[1]));
      i += m[0].length;
      continue;
    }
    // Italic only when the marker hugs a word, so "2 * 3 * 4" stays text.
    if ((m = /^\*(?=\S)([^*\n]+?)\*(?!\*)/.exec(rest)) || (m = /^_(?=\S)([^_\n]+?)_(?![\w])/.exec(rest))) {
      const prev = src[i - 1];
      if (rest[0] === "*" || !prev || !/\w/.test(prev)) {
        flush();
        out.push({ t: "em", c: parseInline(m[1]) });
        i += m[0].length;
        continue;
      }
    }
    buf += src[i];
    i++;
  }
  flush();
  return out;
}

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

const isTableSep = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

export function parseMarkdown(md: string): MdBlock[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ type: "p", c: parseInline(para.join("\n")) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      flushPara();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }
    if (!line.trim()) {
      flushPara();
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line))) {
      flushPara();
      const level = Math.min(3, m[1].length) as 1 | 2 | 3;
      blocks.push({ type: "h", level, c: parseInline(m[2]) });
      continue;
    }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushPara();
      blocks.push({ type: "hr" });
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flushPara();
      const head = splitRow(line).map(parseInline);
      const rows: MdInline[][][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(splitRow(lines[i++]).map(parseInline));
      i--;
      blocks.push({ type: "table", head, rows });
      continue;
    }
    const ul = /^\s*[-*•]\s+(.*)$/;
    const ol = /^\s*\d+[.)]\s+(.*)$/;
    if (ul.test(line) || ol.test(line)) {
      flushPara();
      const kind = ul.test(line) ? "ul" : "ol";
      const re = kind === "ul" ? ul : ol;
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const im = re.exec(l);
        if (im) items.push(im[1]);
        else if (l.trim() && /^\s{2,}/.test(l) && items.length) items[items.length - 1] += " " + l.trim();
        else break;
        i++;
      }
      i--;
      blocks.push({ type: kind, items: items.map(parseInline) });
      continue;
    }
    para.push(line);
  }
  flushPara();
  return blocks;
}
