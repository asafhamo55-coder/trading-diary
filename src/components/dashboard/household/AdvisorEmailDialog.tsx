"use client";

// "Prepare email" dialog: fills the advisor's email template with the user's
// own account numbers and recipient (advisor-email.ts), lets them edit it,
// and copies / opens it in their mail app / marks it as sent.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Copy, Mail, MailCheck, Send, UserPlus } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { buildMailto, emailAsText, renderAdvisorEmail, type EmailAccount, type EmailContact } from "@/lib/advisor-email";
import type { AdvisorEmail, AdvisorLang } from "@/lib/advisor-report";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const T = {
  en: {
    prepare: "Prepare email",
    title: "Email to send",
    to: "To",
    subject: "Subject",
    body: "Message",
    noContact: "No contact found for this email.",
    addContact: "Add one on the profile page",
    missingAccount: "Some account references couldn’t be filled in — check the message before sending.",
    copyAll: "Copy all",
    copyBody: "Copy body",
    copied: "Copied",
    openMail: "Open in mail app",
    tooLong: "Too long for a mail link — the email was copied instead; paste it into a new message.",
    markSent: "Mark as sent",
    sent: "Marked as sent",
    close: "Close",
  },
  he: {
    prepare: "הכן מייל",
    title: "מייל לשליחה",
    to: "אל",
    subject: "נושא",
    body: "תוכן",
    noContact: "לא נמצא איש קשר למייל הזה.",
    addContact: "הוסיפו איש קשר בעמוד הפרופיל",
    missingAccount: "חלק מפרטי החשבון לא מולאו — בדקו את ההודעה לפני השליחה.",
    copyAll: "העתק הכול",
    copyBody: "העתק תוכן",
    copied: "הועתק",
    openMail: "פתח בתוכנת הדואר",
    tooLong: "המייל ארוך מדי לקישור — הוא הועתק במקום; הדביקו אותו בהודעה חדשה.",
    markSent: "סמן כנשלח",
    sent: "סומן כנשלח",
    close: "סגירה",
  },
} as const;

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const field =
  "w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PrepareEmailButton({
  email,
  accounts,
  contacts,
  uiLang,
  sent,
  onMarkSent,
  size = "xs",
}: {
  email: AdvisorEmail;
  accounts: EmailAccount[];
  contacts: EmailContact[];
  uiLang: AdvisorLang;
  /** True when the linked action item is already ticked. */
  sent: boolean;
  onMarkSent: () => void;
  size?: "xs" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const label = contacts.find((c) => c.id === email.contactId)?.name;
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="secondary" size={size} icon={sent ? <MailCheck aria-hidden /> : <Mail aria-hidden />} title={label ? `${T[uiLang].prepare}: ${label}` : undefined}>
          {T[uiLang].prepare}
        </Button>
      </DialogPrimitive.Trigger>
      {open ? (
        <EmailDialogBody email={email} accounts={accounts} contacts={contacts} uiLang={uiLang} sent={sent} onMarkSent={onMarkSent} />
      ) : null}
    </DialogPrimitive.Root>
  );
}

function EmailDialogBody({
  email,
  accounts,
  contacts,
  uiLang,
  sent,
  onMarkSent,
}: {
  email: AdvisorEmail;
  accounts: EmailAccount[];
  contacts: EmailContact[];
  uiLang: AdvisorLang;
  sent: boolean;
  onMarkSent: () => void;
}) {
  const rendered = useMemo(() => renderAdvisorEmail(email, accounts, contacts), [email, accounts, contacts]);
  const t = T[uiLang];
  const [to, setTo] = useState(rendered.to);
  const [subject, setSubject] = useState(rendered.subject);
  const [body, setBody] = useState(rendered.body);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(id);
  }, [flash]);

  const L = rendered.language;
  const doCopy = async (text: string) => setFlash((await copy(text)) ? t.copied : null);
  const openMail = async () => {
    const { url } = buildMailto(to, subject, body);
    if (url) {
      window.location.href = url;
      return;
    }
    await copy(emailAsText({ to, subject, body }, L));
    setFlash(t.tooLong);
  };

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
      <DialogPrimitive.Content
        dir={uiLang === "he" ? "rtl" : "ltr"}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col gap-4 overflow-y-auto rounded-t-2xl border border-border bg-elevated p-5 text-foreground shadow-xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(40rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <DialogPrimitive.Title className="text-lg font-semibold">{t.title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-xs text-muted-foreground">
              {rendered.recipient ? `${rendered.recipient.name} · ${rendered.recipient.role.replace(/_/g, " ")}` : email.contactRole.replace(/_/g, " ")}
            </DialogPrimitive.Description>
          </div>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t.close}>
              <X aria-hidden />
            </Button>
          </DialogPrimitive.Close>
        </div>

        {!rendered.recipient ? (
          <p className="flex flex-wrap items-center gap-2 rounded-md border border-warning/25 bg-warning-subtle px-3 py-2 text-sm text-warning">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            {t.noContact}
            <Link href="/savings/profile#contacts" className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
              <UserPlus className="size-3.5" aria-hidden />
              {t.addContact}
            </Link>
          </p>
        ) : null}
        {rendered.missingAccounts.length > 0 ? (
          <p className="flex items-center gap-2 rounded-md border border-warning/25 bg-warning-subtle px-3 py-2 text-sm text-warning">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            {t.missingAccount}
          </p>
        ) : null}

        <div className="grid gap-3">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            {t.to}
            <input type="email" dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} className={field} autoComplete="off" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            {t.subject}
            <input dir={rendered.dir} value={subject} onChange={(e) => setSubject(e.target.value)} className={field} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            {t.body}
            <textarea
              dir={rendered.dir}
              lang={L}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className={cn(field, "min-h-[14rem] resize-y leading-relaxed")}
            />
          </label>
        </div>

        <p className="min-h-5 text-xs text-success" role="status" aria-live="polite">
          {flash}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" icon={<Send aria-hidden />} onClick={openMail}>
            {t.openMail}
          </Button>
          <Button variant="secondary" size="sm" icon={<Copy aria-hidden />} onClick={() => doCopy(emailAsText({ to, subject, body }, L))}>
            {t.copyAll}
          </Button>
          <Button variant="secondary" size="sm" icon={<Copy aria-hidden />} onClick={() => doCopy(body)}>
            {t.copyBody}
          </Button>
          <Button variant={sent ? "subtle" : "secondary"} size="sm" icon={<Check aria-hidden />} onClick={onMarkSent} disabled={sent} aria-pressed={sent}>
            {sent ? t.sent : t.markSent}
          </Button>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
