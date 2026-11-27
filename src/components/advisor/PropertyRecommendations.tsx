"use client";

// The latest advisor report's recommendations for ONE property — embeddable
// on a property detail page:
//
//   import PropertyRecommendations from "@/components/advisor/PropertyRecommendations";
//   <PropertyRecommendations propertyId={property.id} />
//
// Props: propertyId (required); lang ("en" | "he", defaults to the advisor
// panel's saved choice); title (optional heading override); className.
// Loads the report, ticked action items and profile contacts itself, so it
// works anywhere inside the authenticated app. Ticks and "Prepare email" share
// the dashboard advisor's persistence.

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { readAdvisorOutput, recProgress, tx, type AdvisorLang, type AdvisorOutput } from "@/lib/advisor-report";
import type { EmailContact } from "@/lib/advisor-email";
import type { AdvisorReportDTO } from "@/lib/savings-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDisplayCurrency } from "@/components/ui/currency";
import { DismissedList, RecommendationRow, emailActionItem, useActionStatus, type EmailHandlers } from "@/components/dashboard/household/AdvisorReport";
import { ADVISOR_STRINGS, readStoredLang } from "@/components/dashboard/household/advisor-i18n";
import { isDismissed, itemKey } from "@/lib/advisor-report";

export interface PropertyRecommendationsProps {
  propertyId: string;
  lang?: AdvisorLang;
  title?: string;
  className?: string;
}

const HEADINGS = {
  en: { title: "Advisor recommendations", none: "No recommendations for this property in the latest report.", upside: "10-year upside" },
  he: { title: "המלצות היועץ", none: "אין המלצות לנכס הזה בדוח האחרון.", upside: "פוטנציאל ל־10 שנים" },
};

export default function PropertyRecommendations({ propertyId, lang: langProp, title, className }: PropertyRecommendationsProps) {
  const [report, setReport] = useState<AdvisorReportDTO | null>(null);
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [members, setMembers] = useState<{ key: string; name?: string | null; nameHe?: string | null }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storedLang, setStoredLang] = useState<AdvisorLang | null>(null);
  const lang: AdvisorLang = langProp ?? storedLang ?? "en";
  const s = ADVISOR_STRINGS[lang];
  const { money } = useDisplayCurrency();
  const compact = (usd: number) => money(usd, "USD", { compact: true });
  const { status, toggleItem, setDismissed } = useActionStatus(null, report?.id ?? null);
  const [showDismissed, setShowDismissed] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setStoredLang(readStoredLang()); // eslint-disable-line react-hooks/set-state-in-effect -- hydrate from localStorage after SSR
    let cancelled = false;
    Promise.all([
      fetch("/api/savings/advisor").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/savings/profile").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([a, p]: [{ report?: AdvisorReportDTO | null } | null, { contacts?: EmailContact[]; members?: typeof members } | null]) => {
        if (cancelled) return;
        setReport(a?.report ?? null);
        setContacts(p?.contacts ?? []);
        setMembers(p?.members ?? []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const output: AdvisorOutput | null = useMemo(() => readAdvisorOutput(report?.output), [report]);
  const mine = useMemo(() => output?.recommendations.filter((r) => r.propertyId === propertyId) ?? [], [output, propertyId]);
  const recs = mine.filter((r) => !isDismissed(r, status));
  const dismissed = mine.filter((r) => isDismissed(r, status));
  const rankOf = useMemo(() => new Map((output?.recommendations ?? []).map((r, i) => [r.id, i + 1])), [output]);
  const total = recs.reduce((acc, r) => acc + r.benefit.tenYearUsd, 0);
  const h = HEADINGS[lang];

  const emails: EmailHandlers = {
    context: { accounts: [], contacts },
    isSent: (rec, e) => {
      const it = rec.actionItems.find((a) => a.id === e.actionItemId);
      return it ? !!status[itemKey(rec, it)]?.done : false;
    },
    markSent: (rec, e) => {
      const it = emailActionItem(rec, e, status);
      if (it && !status[itemKey(rec, it)]?.done) void toggleItem(rec, it, true);
    },
  };

  if (!loaded || !output) return null;

  return (
    <Card className={className} lang={lang} dir={lang === "he" ? "rtl" : "ltr"}>
      <CardHeader
        actions={
          total > 0 ? (
            <div className="text-end">
              <p className="text-2xs text-muted-foreground">{h.upside}</p>
              <p className="text-base font-semibold text-success">
                <bdi dir="ltr" className="num">
                  +{compact(total)}
                </bdi>
              </p>
            </div>
          ) : null
        }
      >
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-accent" aria-hidden />
          <CardTitle as="h2">{title ?? h.title}</CardTitle>
          <Badge variant="ai">AI</Badge>
        </div>
        {recs.length === 0 ? <CardDescription>{h.none}</CardDescription> : null}
      </CardHeader>
      {recs.length > 0 ? (
        <CardContent>
          <ol className="space-y-2">
            {recs.map((r) => (
              <RecommendationRow
                key={r.id}
                rec={r}
                rank={rankOf.get(r.id) ?? 0}
                themeLabel={r.subTheme ? s.subTheme[r.subTheme] : tx(output.themes.find((t) => t.id === r.themeId)?.title, lang)}
                ownerName={(k) => {
                  const m = members.find((x) => x.key === k);
                  return (lang === "he" ? m?.nameHe || m?.name : m?.name || m?.nameHe) || k;
                }}
                progress={recProgress(r, status)}
                status={status}
                expanded={open.has(r.id)}
                onToggle={() =>
                  setOpen((cur) => {
                    const n = new Set(cur);
                    if (n.has(r.id)) n.delete(r.id);
                    else n.add(r.id);
                    return n;
                  })
                }
                onToggleItem={(item, done) => toggleItem(r, item, done)}
                onDismiss={() => void setDismissed(r, true)}
                onJump={(id) => setOpen((cur) => new Set(cur).add(id))}
                titleOf={(id) => tx(output.recommendations.find((x) => x.id === id)?.title, lang) || id}
                rankOfId={(id) => rankOf.get(id) ?? null}
                buttonRef={() => {}}
                lang={lang}
                s={s}
                emails={emails}
              />
            ))}
          </ol>
        </CardContent>
      ) : null}
      {dismissed.length > 0 ? (
        <CardContent className={recs.length > 0 ? "pt-0" : undefined}>
          <DismissedList recs={dismissed} open={showDismissed} onToggle={() => setShowDismissed((v) => !v)} onRestore={(r) => void setDismissed(r, false)} lang={lang} s={s} />
        </CardContent>
      ) : null}
    </Card>
  );
}
