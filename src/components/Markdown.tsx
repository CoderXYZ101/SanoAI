import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Tiny, SAFE markdown renderer for chat answers (no dangerouslySetInnerHTML — everything is
 * rendered as React text nodes, so model output can never inject markup or scripts).
 * Supports: ### headings, **bold**, _italic_, `code`, - / 1. lists, > quotes, [links](url), [n] citations.
 */

function safeHref(url: string): string | null {
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function inline(text: string, keyBase: string, onCite?: (n: number) => void): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\)|\[\d+\])/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("_")) out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    else if (tok.startsWith("`")) out.push(<code key={k} className="rounded bg-navy-50 px-1 py-0.5 text-[0.9em]">{tok.slice(1, -1)}</code>);
    else if (/^\[\d+\]$/.test(tok)) {
      const n = Number(tok.slice(1, -1));
      out.push(
        <button key={k} type="button" onClick={() => onCite?.(n)} className="mx-0.5 align-super text-[10px] font-semibold text-sano-700 hover:underline" aria-label={`Source ${n}`}>
          [{n}]
        </button>,
      );
    } else {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!;
      const href = safeHref(mm[2]);
      if (!href) out.push(mm[1]);
      else if (href.startsWith("/")) out.push(<Link key={k} href={href}>{mm[1]}</Link>);
      else out.push(<a key={k} href={href} target="_blank" rel="noopener noreferrer">{mm[1]}</a>);
    }
    last = m.index! + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, onCite }: { text: string; onCite?: (n: number) => void }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push(
        h[1].length >= 4 ? (
          <h4 key={key++} className="mb-1 mt-4 text-[12px] font-semibold uppercase tracking-wide text-navy-400">
            {inline(h[2], `h${key}`, onCite)}
          </h4>
        ) : (
          <h3 key={key++}>{inline(h[2], `h${key}`, onCite)}</h3>
        ),
      );
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(
        <blockquote key={key++} className="my-2 rounded-xl border-l-4 border-amber-400 bg-amber-50 px-4 py-2.5 text-amber-950">
          {inline(q.join(" "), `q${key}`, onCite)}
        </blockquote>,
      );
      continue;
    }
    if (/^\s*[-•*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-•*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-•*]\s+/, ""));
      blocks.push(
        <ul key={key++}>
          {items.map((t, j) => (
            <li key={j}>{inline(t, `u${key}-${j}`, onCite)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      blocks.push(
        <ol key={key++} className="my-2 list-decimal space-y-1 pl-5">
          {items.map((t, j) => (
            <li key={j}>{inline(t, `o${key}-${j}`, onCite)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>\s?|\s*[-•*]\s+|\s*\d+[.)]\s+)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={key++}>{inline(para.join(" "), `p${key}`, onCite)}</p>);
  }
  return <div className="prose-sano text-[14.5px] text-navy-700">{blocks}</div>;
}
