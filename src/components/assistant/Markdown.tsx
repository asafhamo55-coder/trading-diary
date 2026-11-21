import * as React from "react";
import { parseMarkdown, type MdBlock, type MdInline } from "@/lib/assistant-markdown";
import { cn } from "@/lib/utils";

// Renders the safe markdown subset from assistant-markdown.ts as React
// elements. Text is always rendered as text: no dangerouslySetInnerHTML.

function Inlines({ nodes }: { nodes: MdInline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case "text":
            return <React.Fragment key={i}>{n.v}</React.Fragment>;
          case "br":
            return <br key={i} />;
          case "code":
            return (
              <code key={i} dir="ltr" className="rounded bg-subtle px-1 py-0.5 font-mono text-[0.85em] text-foreground">
                {n.v}
              </code>
            );
          case "strong":
            return (
              <strong key={i} className="font-semibold text-foreground">
                <Inlines nodes={n.c} />
              </strong>
            );
          case "em":
            return (
              <em key={i}>
                <Inlines nodes={n.c} />
              </em>
            );
          case "link": {
            const external = /^(https?:|mailto:)/i.test(n.href);
            return (
              <a
                key={i}
                href={n.href}
                className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
                {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
              >
                <Inlines nodes={n.c} />
              </a>
            );
          }
        }
      })}
    </>
  );
}

function Block({ b }: { b: MdBlock }) {
  switch (b.type) {
    case "h": {
      const cls = b.level === 1 ? "text-base" : b.level === 2 ? "text-[0.95rem]" : "text-sm";
      const Tag = (`h${b.level + 2}` as "h3" | "h4" | "h5");
      return (
        <Tag className={cn("mt-3 font-semibold text-foreground first:mt-0", cls)}>
          <Inlines nodes={b.c} />
        </Tag>
      );
    }
    case "p":
      return (
        <p className="whitespace-pre-line">
          <Inlines nodes={b.c} />
        </p>
      );
    case "ul":
    case "ol": {
      const Tag = b.type;
      return (
        <Tag className={cn("space-y-1 ps-5", b.type === "ul" ? "list-disc" : "list-decimal")}>
          {b.items.map((it, i) => (
            <li key={i}>
              <Inlines nodes={it} />
            </li>
          ))}
        </Tag>
      );
    }
    case "code":
      return (
        <pre dir="ltr" className="overflow-x-auto rounded-md bg-subtle p-2 font-mono text-xs text-foreground">
          <code>{b.text}</code>
        </pre>
      );
    case "hr":
      return <hr className="border-border" />;
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {b.head.map((c, i) => (
                  <th key={i} className="border-b border-border px-2 py-1 text-start font-semibold text-foreground">
                    <Inlines nodes={c} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="border-b border-border/60 px-2 py-1 tabular-nums">
                      <Inlines nodes={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function Markdown({ source, className, dir }: { source: string; className?: string; dir?: "rtl" | "ltr" }) {
  const blocks = React.useMemo(() => parseMarkdown(source), [source]);
  return (
    <div dir={dir} className={cn("space-y-2 text-sm leading-relaxed text-foreground-secondary", className)}>
      {blocks.map((b, i) => (
        <Block key={i} b={b} />
      ))}
    </div>
  );
}
