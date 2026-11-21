"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Info, Pin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { explainText, splitBidi, type ExplainKey, type ExplainText } from "@/lib/explain";
import { CLOSE_DELAY_MS, INFO_TIP_CLOSED, infoTipReducer } from "@/lib/info-tip-state";

/* ──────────────────────────────────────────────────────────────────────
 * InfoTip — a small ⓘ next to a section title or metric label that explains
 * what the figure means and how it's calculated (Hebrew by default, from the
 * glossary in lib/explain.ts).
 *
 *   hover / focus → opens at once; closes ~0.5 s after the pointer or focus
 *                   leaves (moving into the popover keeps it open)
 *   click / tap   → pins it open until the ⓘ is clicked again, a click
 *                   outside, or Esc. Touch has no hover, so a tap pins.
 *   Only one InfoTip is open at a time.
 * State rules live in lib/info-tip-state.ts (unit-tested).
 * ──────────────────────────────────────────────────────────────────── */

/** Tells every other InfoTip to close when one opens. */
const bus: EventTarget | null = typeof window === "undefined" ? null : new EventTarget();
const OPEN_EVENT = "infotip:open";

const LABELS = {
  he: { what: "מה זה", how: "איך מחושב", note: "שימו לב", explain: "הסבר", close: "סגירה", pinned: "נעוץ" },
  en: { what: "What it is", how: "How it's calculated", note: "Note", explain: "Explain", close: "Close", pinned: "Pinned" },
} as const;

export interface InfoTipProps {
  /** Glossary key (src/lib/explain.ts). */
  tip: ExplainKey;
  /** "en" shows the English version when the glossary has one. Default Hebrew. */
  lang?: "he" | "en";
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}

/** Text with `{ltr}` runs rendered as bidi-isolated spans. */
function Bidi({ text }: { text: string }) {
  return (
    <>
      {splitBidi(text).map((r, i) =>
        r.ltr ? (
          <bdi key={i} dir="ltr">
            {r.text}
          </bdi>
        ) : (
          <React.Fragment key={i}>{r.text}</React.Fragment>
        )
      )}
    </>
  );
}

export function InfoTipBody({ text, lang }: { text: ExplainText; lang: "he" | "en" }) {
  const L = LABELS[lang];
  const section = "mt-2.5 first:mt-0";
  const h = "text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground";
  return (
    <div dir={lang === "he" ? "rtl" : "ltr"} lang={lang} className="text-start">
      <section className={section}>
        <h4 className={h}>{L.what}</h4>
        <p className="mt-0.5">
          <Bidi text={text.what} />
        </p>
      </section>
      <section className={section}>
        <h4 className={h}>{L.how}</h4>
        <p className="mt-0.5">
          <Bidi text={text.how} />
        </p>
        {text.formula ? (
          <p className="mt-1.5 rounded-md border border-border bg-subtle px-2 py-1 font-medium text-foreground">
            <Bidi text={text.formula} />
          </p>
        ) : null}
      </section>
      {text.note ? (
        <section className={section}>
          <h4 className={h}>{L.note}</h4>
          <p className="mt-0.5 text-foreground-secondary">
            <Bidi text={text.note} />
          </p>
        </section>
      ) : null}
    </div>
  );
}

export function InfoTip({ tip, lang = "he", side = "top", align = "center", className }: InfoTipProps) {
  const [state, dispatch] = React.useReducer(infoTipReducer, INFO_TIP_CLOSED);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  /** Set when we hand focus back to the ⓘ after closing, so it doesn't reopen. */
  const skipFocus = React.useRef(false);
  const id = React.useId();
  const contentId = `${id}-infotip`;
  const { text, lang: shown } = explainText(tip, lang);
  const L = LABELS[shown];
  const plainTitle = splitBidi(text.title)
    .map((r) => r.text)
    .join("");

  // Delayed close after leave / blur.
  React.useEffect(() => {
    if (!state.closing) return;
    const t = window.setTimeout(() => dispatch({ type: "closeTimer" }), CLOSE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [state.closing]);

  // One open at a time: announce opening, close when another opens.
  React.useEffect(() => {
    if (!bus) return;
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) dispatch({ type: "otherOpened" });
    };
    bus.addEventListener(OPEN_EVENT, onOther);
    return () => bus.removeEventListener(OPEN_EVENT, onOther);
  }, [id]);
  React.useEffect(() => {
    if (state.open) bus?.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
  }, [state.open, id]);

  const isTrigger = (target: EventTarget | null) =>
    !!(target instanceof Node && triggerRef.current?.contains(target));

  const onMouse = (type: "enter" | "leave") => (e: React.PointerEvent) => {
    // Touch and pen have no real hover: a tap pins via click instead.
    if (e.pointerType === "mouse") dispatch({ type });
  };

  return (
    <PopoverPrimitive.Root
      open={state.open}
      onOpenChange={(open) => {
        if (!open) dispatch({ type: "outside" });
      }}
    >
      <PopoverPrimitive.Anchor asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label={`${L.explain}: ${plainTitle}`}
          aria-expanded={state.open}
          aria-haspopup="dialog"
          aria-controls={state.open ? contentId : undefined}
          data-state={state.pinned ? "pinned" : state.open ? "open" : "closed"}
          // Read by the "Ask" assistant so a question carries what was on screen.
          data-explain-key={tip}
          className={cn(
            "relative inline-flex size-4 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground transition-colors",
            "hover:text-primary data-[state=pinned]:text-primary data-[state=open]:text-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            // Bigger touch target without changing the layout.
            "after:absolute after:-inset-2 after:content-['']",
            className
          )}
          onPointerEnter={onMouse("enter")}
          onPointerLeave={onMouse("leave")}
          onFocus={() => {
            if (skipFocus.current) {
              skipFocus.current = false;
              return;
            }
            dispatch({ type: "enter" });
          }}
          onBlur={(e) => {
            // Focus moving into the popover (e.g. its close button) keeps it open.
            const next = e.relatedTarget as Node | null;
            if (next && document.getElementById(contentId)?.contains(next)) return;
            dispatch({ type: "leave" });
          }}
          onClick={(e) => {
            // Inside a link or a clickable card the ⓘ must not navigate.
            e.preventDefault();
            e.stopPropagation();
            dispatch({ type: "click" });
          }}
        >
          <Info className="size-3.5" strokeWidth={2.25} aria-hidden />
        </button>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          id={contentId}
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={12}
          aria-label={plainTitle}
          // Never steal focus: hover and focus opens keep focus on the ⓘ.
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={() => dispatch({ type: "escape" })}
          onInteractOutside={(e) => {
            if (isTrigger(e.target)) e.preventDefault();
          }}
          onPointerEnter={onMouse("enter")}
          onPointerLeave={onMouse("leave")}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "z-[80] w-[min(320px,calc(100vw-24px))] overflow-y-auto rounded-lg border border-border bg-elevated p-3 text-xs leading-relaxed text-foreground shadow-lg outline-none",
            "max-h-[min(70vh,var(--radix-popover-content-available-height))]",
            "data-[state=open]:animate-fade-in"
          )}
        >
          <div
            dir={shown === "he" ? "rtl" : "ltr"}
            lang={shown}
            className="mb-2 flex items-start justify-between gap-2 border-b border-border pb-2"
          >
            <p className="text-sm font-semibold leading-snug text-foreground">
              <Bidi text={text.title} />
            </p>
            {state.pinned ? (
              <span className="-m-1 flex shrink-0 items-center gap-0.5">
                <Pin className="size-3 text-primary" role="img" aria-label={L.pinned} />
                <button
                  type="button"
                  aria-label={L.close}
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    dispatch({ type: "click" });
                    const t = triggerRef.current;
                    if (t && document.activeElement !== t) {
                      skipFocus.current = true;
                      t.focus({ preventScroll: true });
                    }
                  }}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
            ) : null}
          </div>
          <InfoTipBody text={text} lang={shown} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** A heading's text with an InfoTip after it, kept together on wrap. */
export function TitleWithTip({
  children,
  tip,
  lang,
  className,
}: {
  children: React.ReactNode;
  tip: ExplainKey;
  lang?: "he" | "en";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {children}
      <InfoTip tip={tip} lang={lang} />
    </span>
  );
}
