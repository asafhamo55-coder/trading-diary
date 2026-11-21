"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { collectContextKeys, unreadCount, type AssistantQuestionDTO } from "@/lib/assistant";
import { AssistantPanel, type PageContext } from "./AssistantPanel";

// Floating "שאל / Ask" button + panel, mounted once from src/app/layout.tsx.
// Hidden on /login. Questions are answered asynchronously by the Claude Code
// routine (docs/assistant.md); we refetch on page load / navigation and every
// 60 s while the panel is open.

const POLL_MS = 60_000;
const HIDDEN_PATHS = ["/login"];

function readPageContext(pathname: string): PageContext {
  if (typeof document === "undefined") return { pagePath: pathname, pageTitle: null, contextKeys: [] };
  const main = document.querySelector("main") ?? document.body;
  const h1 = main.querySelector("h1")?.textContent?.trim();
  const docTitle = document.title?.trim();
  const pageTitle = (h1 || docTitle || "").slice(0, 200) || null;
  const pagePath = pathname + (window.location.search || "");
  return { pagePath, pageTitle, contextKeys: collectContextKeys(pathname, document) };
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export interface AssistantLauncherProps {
  /** Screenshot mock: fixed data, no network. */
  preview?: { questions: AssistantQuestionDTO[]; context: PageContext; freshIds?: string[]; open?: boolean };
}

export default function AssistantLauncher({ preview }: AssistantLauncherProps = {}) {
  const pathname = usePathname() ?? "/";
  const hidden = !preview && HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const [open, setOpen] = React.useState(preview?.open ?? false);
  const [questions, setQuestions] = React.useState<AssistantQuestionDTO[]>(preview?.questions ?? []);
  const [loading, setLoading] = React.useState(!preview);
  const [error, setError] = React.useState<string | null>(null);
  const [context, setContext] = React.useState<PageContext>(preview?.context ?? { pagePath: pathname, pageTitle: null, contextKeys: [] });
  const [freshIds, setFreshIds] = React.useState<Set<string>>(() => new Set(preview?.freshIds ?? []));
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const load = React.useCallback(async () => {
    if (preview) return;
    try {
      const { questions } = await api<{ questions?: AssistantQuestionDTO[] }>("/api/assistant/questions");
      // Never let an odd response (proxy page, outage) take the whole page down.
      setQuestions(Array.isArray(questions) ? questions : []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load questions");
    } finally {
      setLoading(false);
    }
  }, [preview]);

  // Page load + every client-side navigation.
  React.useEffect(() => {
    if (hidden) return;
    void load();
  }, [hidden, pathname, load]);

  // Poll while open.
  React.useEffect(() => {
    if (!open || hidden || preview) return;
    const t = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(t);
  }, [open, hidden, preview, load]);

  // While open, unread answers are shown (highlighted as new) and marked read.
  React.useEffect(() => {
    if (!open || preview) return;
    const unread = questions.filter((q) => q.status !== "pending" && !q.readAt);
    if (unread.length === 0) return;
    setFreshIds((prev) => new Set([...prev, ...unread.map((q) => q.id)]));
    const now = new Date().toISOString();
    setQuestions((qs) => qs.map((q) => (unread.some((u) => u.id === q.id) ? { ...q, readAt: now } : q)));
    for (const q of unread) {
      void api(`/api/assistant/questions/${encodeURIComponent(q.id)}`, { method: "PATCH", body: JSON.stringify({ read: true }) }).catch(() => {});
    }
  }, [open, preview, questions]);

  const onOpenChange = (next: boolean) => {
    if (next) {
      setContext(readPageContext(pathname));
      void load();
    } else {
      setFreshIds(new Set());
    }
    setOpen(next);
  };

  const onAsk = async (question: string): Promise<boolean> => {
    if (preview) return false;
    try {
      const ctx = readPageContext(pathname);
      setContext(ctx);
      const { question: created } = await api<{ question: AssistantQuestionDTO }>("/api/assistant/questions", {
        method: "POST",
        body: JSON.stringify({ question, ...ctx }),
      });
      if (created) setQuestions((qs) => [created, ...qs]);
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the question");
      return false;
    }
  };

  const onDelete = async (id: string) => {
    if (preview) return;
    const before = questions;
    setQuestions((qs) => qs.filter((q) => q.id !== id));
    try {
      await api(`/api/assistant/questions/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (e) {
      setQuestions(before);
      setError(e instanceof Error ? e.message : "Couldn't delete the question");
    }
  };

  if (hidden) return null;
  const unread = unreadCount(questions);
  const pending = questions.filter((q) => q.status === "pending").length;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onOpenChange(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`שאל / Ask${unread ? ` — ${unread} new answer${unread === 1 ? "" : "s"}` : pending ? ` — ${pending} pending` : ""}`}
        className={cn(
          "fixed z-40 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg shadow-lg",
          "bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))]",
          "transition-[background-color,transform] duration-150 ease-standard hover:bg-primary-hover active:translate-y-px",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "print:hidden"
        )}
      >
        <Sparkles className="size-4" aria-hidden />
        <span>שאל / Ask</span>
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full border-2 border-background bg-danger-solid px-1 text-2xs font-bold leading-4 text-on-solid"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <AssistantPanel
        open={open}
        onOpenChange={onOpenChange}
        questions={questions}
        loading={loading}
        error={error}
        context={context}
        freshIds={freshIds}
        onAsk={onAsk}
        onDelete={onDelete}
      />
    </>
  );
}
