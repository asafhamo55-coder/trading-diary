"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CircleAlert, Clock, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MAX_QUESTION_CHARS,
  hasHebrew,
  startersFor,
  type AssistantQuestionDTO,
} from "@/lib/assistant";
import { Markdown } from "./Markdown";

// The "Ask" side sheet (Radix Dialog: focus trap, Esc, aria-modal). Pure
// presentation: data and actions come from AssistantLauncher.

export interface PageContext {
  pagePath: string;
  pageTitle: string | null;
  contextKeys: string[];
}

export interface AssistantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questions: AssistantQuestionDTO[];
  loading: boolean;
  error: string | null;
  context: PageContext;
  /** Ids answered since the panel was opened (highlighted as new). */
  freshIds: Set<string>;
  onAsk: (question: string) => Promise<boolean>;
  onDelete: (id: string) => void;
  /** Render inline (no portal / overlay) for the screenshot mock. */
  inline?: boolean;
}

const PENDING_TEXT = {
  en: "Pending — answered within about an hour by Claude Code",
  he: "ממתין — Claude Code יענה תוך כשעה",
};
const FAILED_TEXT = { en: "Couldn't answer", he: "לא ניתן היה לענות" };

function formatWhen(iso: string, lang: "he" | "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(lang === "he" ? "he-IL" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function QuestionItem({
  q,
  fresh,
  onDelete,
}: {
  q: AssistantQuestionDTO;
  fresh: boolean;
  onDelete: (id: string) => void;
}) {
  const lang = q.language;
  const dir = lang === "he" ? "rtl" : "ltr";
  return (
    <li
      className={cn(
        "group rounded-xl border bg-surface p-3 shadow-xs",
        fresh ? "border-primary/60 ring-1 ring-primary/30" : "border-border"
      )}
    >
      <div className="flex items-start gap-2">
        <p dir={dir} className="min-w-0 flex-1 whitespace-pre-line break-words text-sm font-medium text-foreground">
          {q.question}
        </p>
        <button
          type="button"
          onClick={() => onDelete(q.id)}
          aria-label={`Delete question: ${q.question.slice(0, 60)}`}
          className="-m-1 rounded-md p-1 text-muted-foreground opacity-70 transition hover:bg-subtle hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>
      <p className="mt-1 text-2xs text-muted-foreground">
        <time dateTime={q.createdAt}>{formatWhen(q.createdAt, "en")}</time>
        {q.pageTitle ? <span> · {q.pageTitle}</span> : <span> · {q.pagePath}</span>}
      </p>

      {q.status === "pending" && (
        <p dir={dir} className="mt-2 flex items-center gap-1.5 rounded-lg bg-warning-subtle px-2.5 py-1.5 text-xs text-warning">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          <span>{PENDING_TEXT[lang]}</span>
        </p>
      )}
      {q.status === "answered" && q.answer && (
        <div className="mt-2 border-t border-border pt-2">
          <div className="mb-1 flex items-center gap-1.5 text-2xs text-muted-foreground">
            <Sparkles className="size-3 text-primary" aria-hidden />
            <span>
              {q.answeredBy ?? "Claude Code"}
              {q.answeredAt ? ` · ${formatWhen(q.answeredAt, "en")}` : ""}
            </span>
            {fresh && <span className="rounded-full bg-primary-subtle px-1.5 py-px font-semibold text-primary">New</span>}
          </div>
          <Markdown source={q.answer} dir={dir} />
        </div>
      )}
      {q.status === "failed" && (
        <div dir={dir} className="mt-2 flex gap-1.5 rounded-lg bg-danger-subtle px-2.5 py-1.5 text-xs text-danger">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">{FAILED_TEXT[lang]}</p>
            {q.answer && <p className="mt-0.5 whitespace-pre-line">{q.answer}</p>}
          </div>
        </div>
      )}
    </li>
  );
}

function PanelBody(props: AssistantPanelProps) {
  const { questions, loading, error, context, freshIds, onAsk, onDelete, onOpenChange } = props;
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [starterLang, setStarterLang] = React.useState<"he" | "en">("he");
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const rtl = hasHebrew(draft) || (!draft && starterLang === "he");
  const starters = startersFor(context.pagePath);
  const glossaryCount = context.contextKeys.filter((k) => !k.includes(":") && k !== "guidelines").length;
  const entityKeys = context.contextKeys.filter((k) => k.includes(":") || k === "guidelines");

  const submit = async () => {
    const q = draft.trim();
    if (!q || sending) return;
    setSending(true);
    const ok = await onAsk(q);
    setSending(false);
    if (ok) setDraft("");
    inputRef.current?.focus();
  };

  return (
    <>
      <header className="flex items-start gap-3 border-b border-border px-4 py-3">
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <DialogPrimitive.Title className="text-base font-semibold text-foreground">
            שאל / Ask
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-xs text-muted-foreground">
            Ask about anything in the app. Claude Code answers within about an hour.
          </DialogPrimitive.Description>
        </div>
        <DialogPrimitive.Close asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={() => onOpenChange(false)}>
            <X aria-hidden />
          </Button>
        </DialogPrimitive.Close>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-2"
        >
          <label htmlFor="assistant-question" className="sr-only">
            Your question
          </label>
          <textarea
            id="assistant-question"
            ref={inputRef}
            value={draft}
            dir={rtl ? "rtl" : "ltr"}
            rows={3}
            maxLength={MAX_QUESTION_CHARS}
            placeholder={starterLang === "he" ? "מה לא ברור? שאלו כאן…" : "What's unclear? Ask here…"}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void submit();
              }
            }}
            className="block w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 text-2xs text-muted-foreground" aria-live="polite">
              <span className="font-medium text-foreground-secondary">Attached:</span> {context.pageTitle ?? context.pagePath}
              {context.pageTitle && <span dir="ltr"> ({context.pagePath})</span>}
              {glossaryCount > 0 && <span> · {glossaryCount} on-screen terms</span>}
              {entityKeys.length > 0 && <span> · {entityKeys.join(", ")}</span>}
            </p>
            <Button type="submit" size="sm" loading={sending} disabled={!draft.trim()} icon={<Sparkles aria-hidden />}>
              {rtl ? "שלח" : "Ask"}
            </Button>
          </div>
        </form>

        <section aria-labelledby="assistant-starters" className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <h3 id="assistant-starters" className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              Suggested
            </h3>
            <div role="group" aria-label="Suggestion language" className="flex overflow-hidden rounded-md border border-border text-2xs">
              {(["he", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={starterLang === l}
                  onClick={() => setStarterLang(l)}
                  className={cn(
                    "px-2 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    starterLang === l ? "bg-primary-subtle font-semibold text-primary" : "text-muted-foreground hover:bg-subtle"
                  )}
                >
                  {l === "he" ? "עב" : "EN"}
                </button>
              ))}
            </div>
          </div>
          <ul className="flex flex-wrap gap-1.5" dir={starterLang === "he" ? "rtl" : "ltr"}>
            {starters.map((s) => (
              <li key={s.en}>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(s[starterLang]);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-foreground-secondary transition hover:border-primary/50 hover:bg-primary-subtle hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {s[starterLang]}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="assistant-history" className="mt-4">
          <h3 id="assistant-history" className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your questions
          </h3>
          {error && (
            <p role="alert" className="mb-2 rounded-lg bg-danger-subtle px-2.5 py-1.5 text-xs text-danger">
              {error}
            </p>
          )}
          {loading && questions.length === 0 ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : questions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
              <p className="text-sm text-foreground-secondary">No questions yet.</p>
              <p className="mt-1 text-xs text-muted-foreground" dir="rtl">
                אפשר לשאול על כל מספר או מונח באפליקציה, בעברית או באנגלית.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {questions.map((q) => (
                <QuestionItem key={q.id} q={q} fresh={freshIds.has(q.id)} onDelete={onDelete} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

const SHEET_CLASS =
  "flex flex-col border-border bg-card text-foreground shadow-xl";

export function AssistantPanel(props: AssistantPanelProps) {
  if (props.inline) {
    // Screenshot mock: same markup, no portal/overlay/focus trap.
    return (
      <DialogPrimitive.Root open modal={false}>
        <div role="dialog" aria-label="Ask" className={cn(SHEET_CLASS, "h-full w-full border-s")}>
          <PanelBody {...props} />
        </div>
      </DialogPrimitive.Root>
    );
  }
  return (
    <DialogPrimitive.Root open={props.open} onOpenChange={props.onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-[rgb(10_15_26/0.45)] backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => {
            // Desktop: straight into the question box. Touch: focus the sheet
            // itself so the on-screen keyboard doesn't pop up uninvited.
            e.preventDefault();
            const fine = window.matchMedia?.("(pointer: fine)").matches;
            const target = fine ? document.getElementById("assistant-question") : (e.currentTarget as HTMLElement | null);
            target?.focus();
          }}
          className={cn(
            SHEET_CLASS,
            "fixed z-[61] focus:outline-none data-[state=open]:animate-fade-in",
            // Phone: bottom sheet; sm+: right-hand side panel.
            "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)]",
            "sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[26rem] sm:rounded-none sm:border-s sm:border-t-0"
          )}
        >
          <PanelBody {...props} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
